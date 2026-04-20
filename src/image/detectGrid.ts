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
const LINE_RUN_FRACTION = 0.3; // a candidate grid line must have a dark run ≥ this fraction of the axis
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

// For each row (or column), find the longest contiguous run of dark pixels.
function longestDarkRunPerRow(binary: Uint8Array, w: number, h: number): Int32Array {
  const out = new Int32Array(h);
  for (let y = 0; y < h; y++) {
    let best = 0;
    let run = 0;
    const off = y * w;
    for (let x = 0; x < w; x++) {
      if (binary[off + x]) {
        run++;
        if (run > best) best = run;
      } else {
        run = 0;
      }
    }
    out[y] = best;
  }
  return out;
}

function longestDarkRunPerCol(binary: Uint8Array, w: number, h: number): Int32Array {
  const out = new Int32Array(w);
  for (let x = 0; x < w; x++) {
    let best = 0;
    let run = 0;
    for (let y = 0; y < h; y++) {
      if (binary[y * w + x]) {
        run++;
        if (run > best) best = run;
      } else {
        run = 0;
      }
    }
    out[x] = best;
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

  let best: { first: number; last: number; matches: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    for (let j = i + needed - 1; j < lines.length; j++) {
      const first = lines[i]!;
      const last = lines[j]!;
      const span = last - first;
      if (span < expectedN * 4) continue; // cell size < 4px: implausible
      const cellSize = span / expectedN;
      const tolerance = Math.max(2, cellSize * MATCH_TOLERANCE_FRACTION);

      let matches = 0;
      for (let k = 0; k <= expectedN; k++) {
        const expected = first + k * cellSize;
        for (const line of lines) {
          if (Math.abs(line - expected) <= tolerance) {
            matches++;
            break;
          }
        }
      }

      if (!best || matches > best.matches) {
        best = { first, last, matches };
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
  const binary = binarize(imageData);

  const rowRuns = longestDarkRunPerRow(binary, w, h);
  const colRuns = longestDarkRunPerCol(binary, w, h);

  const minHRun = Math.max(20, Math.floor(w * LINE_RUN_FRACTION));
  const minVRun = Math.max(20, Math.floor(h * LINE_RUN_FRACTION));

  const hLines = candidateLineIndices(rowRuns, minHRun);
  const vLines = candidateLineIndices(colRuns, minVRun);

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
