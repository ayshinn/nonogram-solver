export interface GridBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface GridDetection {
  readonly gridBox: GridBox;
  readonly cellSize: number;
  readonly n: number;
  readonly confidence: number; // 0..1, fraction of expected lines matched
}

const DARK_THRESHOLD = 128;
const GRAD_THRESHOLD = 20; // per-pixel luminance delta that counts as an edge
const LINE_EDGE_FRACTION = 0.3; // a candidate line must have edges spanning ≥ this fraction of the axis
const MATCH_TOLERANCE_FRACTION = 0.15; // a candidate line must fall within ±15% of a cell size to count

export function binarize(
  imageData: ImageData,
  threshold = DARK_THRESHOLD,
): Uint8Array {
  const { data, width, height } = imageData;
  const out = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    out[i] = lum < threshold ? 1 : 0;
  }
  return out;
}

function computeLuminance(imageData: ImageData): Uint8ClampedArray {
  const { data, width, height } = imageData;
  const out = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    out[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return out;
}

// Count, for each row y, the number of x positions where the vertical luminance
// gradient |lum(x,y) - lum(x,y-1)| is large. A horizontal grid line produces a
// row-wide band of strong vertical gradient regardless of the line's polarity
// (dark-on-light or light-on-dark), making this polarity-invariant.
export function vEdgeCountsPerRow(
  imageData: ImageData,
  gradThreshold = GRAD_THRESHOLD,
): Int32Array {
  const { width: w, height: h } = imageData;
  const lum = computeLuminance(imageData);
  const out = new Int32Array(h);
  for (let y = 1; y < h; y++) {
    let count = 0;
    const off = y * w;
    const offPrev = (y - 1) * w;
    for (let x = 0; x < w; x++) {
      const d = lum[off + x]! - lum[offPrev + x]!;
      if (d >= gradThreshold || -d >= gradThreshold) count++;
    }
    out[y] = count;
  }
  return out;
}

// Count, for each column x, the number of y positions where the horizontal
// luminance gradient |lum(x,y) - lum(x-1,y)| is large. Mirror of vEdgeCountsPerRow.
export function hEdgeCountsPerCol(
  imageData: ImageData,
  gradThreshold = GRAD_THRESHOLD,
): Int32Array {
  const { width: w, height: h } = imageData;
  const lum = computeLuminance(imageData);
  const out = new Int32Array(w);
  for (let x = 1; x < w; x++) {
    let count = 0;
    for (let y = 0; y < h; y++) {
      const d = lum[y * w + x]! - lum[y * w + (x - 1)]!;
      if (d >= gradThreshold || -d >= gradThreshold) count++;
    }
    out[x] = count;
  }
  return out;
}

// Collapse contiguous spans above threshold into their midpoint index.
export function candidateLineIndices(
  runs: Int32Array,
  minRun: number,
): number[] {
  const out: number[] = [];
  let inLine = false;
  let start = 0;
  for (let i = 0; i < runs.length; i++) {
    const hit = runs[i]! >= minRun;
    if (hit && !inLine) {
      inLine = true;
      start = i;
    } else if (!hit && inLine) {
      inLine = false;
      out.push(Math.floor((start + i - 1) / 2));
    }
  }
  if (inLine) out.push(Math.floor((start + runs.length - 1) / 2));
  return out;
}

// Given candidate line positions on one axis, pick the best N+1 evenly-spaced subset.
// Returns { first, last, matches } or null if no reasonable fit exists.
export function findEvenlySpacedGrid(
  lines: readonly number[],
  expectedN: number,
): { first: number; last: number; matches: number } | null {
  const needed = expectedN + 1;
  if (lines.length < needed) return null;

  let best: { first: number; last: number; matches: number; residual: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    for (let j = i + needed - 1; j < lines.length; j++) {
      const first = lines[i]!;
      const last = lines[j]!;
      const span = last - first;
      if (span < expectedN * 4) continue; // cell size < 4px: implausible
      const cellSize = span / expectedN;
      const tolerance = Math.max(2, cellSize * MATCH_TOLERANCE_FRACTION);

      let matches = 0;
      let totalResidual = 0;
      for (let k = 0; k <= expectedN; k++) {
        const expected = first + k * cellSize;
        let minDist = tolerance + 1;
        for (const line of lines) {
          const d = Math.abs(line - expected);
          if (d <= tolerance && d < minDist) minDist = d;
        }
        if (minDist <= tolerance) {
          matches++;
          totalResidual += minDist;
        }
      }

      if (!best || matches > best.matches || (matches === best.matches && totalResidual < best.residual)) {
        best = { first, last, matches, residual: totalResidual };
      }
    }
  }

  return best;
}

export function detectGrid(
  imageData: ImageData,
  expectedN: number,
): GridDetection | null {
  if (expectedN < 2) return null;
  const { width: w, height: h } = imageData;

  const rowEdges = vEdgeCountsPerRow(imageData);
  const colEdges = hEdgeCountsPerCol(imageData);

  const minHEdge = Math.max(20, Math.floor(w * LINE_EDGE_FRACTION));
  const minVEdge = Math.max(20, Math.floor(h * LINE_EDGE_FRACTION));

  const hLines = candidateLineIndices(rowEdges, minHEdge);
  const vLines = candidateLineIndices(colEdges, minVEdge);

  const hGrid = findEvenlySpacedGrid(hLines, expectedN);
  const vGrid = findEvenlySpacedGrid(vLines, expectedN);
  if (!hGrid || !vGrid) return null;

  const needed = expectedN + 1;
  const confidence = Math.min(hGrid.matches, vGrid.matches) / needed;
  const gridBox: GridBox = {
    x: vGrid.first,
    y: hGrid.first,
    w: vGrid.last - vGrid.first,
    h: hGrid.last - hGrid.first,
  };
  return {
    gridBox,
    cellSize: (gridBox.w + gridBox.h) / (2 * expectedN),
    n: expectedN,
    confidence,
  };
}
