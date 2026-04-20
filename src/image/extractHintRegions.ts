import type { GridBox } from "./detectGrid";

export interface HintStrip {
  readonly axis: "row" | "col";
  readonly index: number; // 0..n-1
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface HintRegions {
  readonly rowStrips: readonly HintStrip[];
  readonly colStrips: readonly HintStrip[];
}

// Slice the image area above the grid (col hints) and to the left of the grid (row hints)
// into N strips each, aligned to the grid's cell boundaries.
export function extractHintRegions(
  imageW: number,
  imageH: number,
  gridBox: GridBox,
  n: number,
): HintRegions {
  if (n < 1) throw new Error(`n must be ≥ 1 (got ${n})`);
  if (gridBox.x < 0 || gridBox.y < 0) {
    throw new Error("gridBox must be within image bounds");
  }
  if (gridBox.x + gridBox.w > imageW || gridBox.y + gridBox.h > imageH) {
    throw new Error("gridBox extends beyond image bounds");
  }
  if (gridBox.x === 0 || gridBox.y === 0) {
    throw new Error("No space for hints: grid touches top or left edge");
  }

  const cellW = gridBox.w / n;
  const cellH = gridBox.h / n;

  const colStrips: HintStrip[] = [];
  for (let c = 0; c < n; c++) {
    const x = Math.round(gridBox.x + c * cellW);
    const xEnd = Math.round(gridBox.x + (c + 1) * cellW);
    colStrips.push({
      axis: "col",
      index: c,
      x,
      y: 0,
      w: Math.max(1, xEnd - x),
      h: gridBox.y,
    });
  }

  const rowStrips: HintStrip[] = [];
  for (let r = 0; r < n; r++) {
    const y = Math.round(gridBox.y + r * cellH);
    const yEnd = Math.round(gridBox.y + (r + 1) * cellH);
    rowStrips.push({
      axis: "row",
      index: r,
      x: 0,
      y,
      w: gridBox.x,
      h: Math.max(1, yEnd - y),
    });
  }

  return { rowStrips, colStrips };
}

// Copy a sub-rectangle of imageData into a new ImageData (for passing to OCR).
export function cropImageData(
  imageData: ImageData,
  x: number,
  y: number,
  w: number,
  h: number,
): ImageData {
  const src = imageData.data;
  const srcW = imageData.width;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) {
    const srcOff = ((y + row) * srcW + x) * 4;
    const dstOff = row * w * 4;
    out.set(src.subarray(srcOff, srcOff + w * 4), dstOff);
  }
  return { data: out, width: w, height: h, colorSpace: "srgb" } as ImageData;
}
