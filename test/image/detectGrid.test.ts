import { describe, expect, it } from "vitest";
import {
  binarize,
  candidateLineIndices,
  detectGrid,
  findEvenlySpacedGrid,
} from "../../src/image/detectGrid";

function makeImageData(w: number, h: number): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  // Fill white.
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = 255;
    data[i * 4 + 1] = 255;
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = 255;
  }
  return { data, width: w, height: h, colorSpace: "srgb" } as ImageData;
}

function drawHLine(img: ImageData, y: number, x0: number, x1: number): void {
  for (let x = x0; x < x1; x++) {
    const i = (y * img.width + x) * 4;
    img.data[i] = 0;
    img.data[i + 1] = 0;
    img.data[i + 2] = 0;
  }
}

function drawVLine(img: ImageData, x: number, y0: number, y1: number): void {
  for (let y = y0; y < y1; y++) {
    const i = (y * img.width + x) * 4;
    img.data[i] = 0;
    img.data[i + 1] = 0;
    img.data[i + 2] = 0;
  }
}

// Synthesize a nonogram-style image with a grid of N×N cells.
function makeGridImage(opts: {
  imgW: number;
  imgH: number;
  gridX: number;
  gridY: number;
  cellSize: number;
  n: number;
}): ImageData {
  const { imgW, imgH, gridX, gridY, cellSize, n } = opts;
  const img = makeImageData(imgW, imgH);
  const gridW = cellSize * n;
  const gridH = cellSize * n;
  for (let k = 0; k <= n; k++) {
    drawHLine(img, gridY + k * cellSize, gridX, gridX + gridW + 1);
    drawVLine(img, gridX + k * cellSize, gridY, gridY + gridH + 1);
  }
  return img;
}

describe("binarize", () => {
  it("marks dark pixels as 1 and light as 0", () => {
    const img = makeImageData(4, 1);
    // pixel 0: white; pixel 1: black; pixel 2: gray (120 < 128 → dark); pixel 3: gray (140 > 128 → light)
    img.data[4] = 0;
    img.data[5] = 0;
    img.data[6] = 0;
    img.data[8] = 120;
    img.data[9] = 120;
    img.data[10] = 120;
    img.data[12] = 140;
    img.data[13] = 140;
    img.data[14] = 140;
    const bin = binarize(img);
    expect(Array.from(bin)).toEqual([0, 1, 1, 0]);
  });
});

describe("candidateLineIndices", () => {
  it("returns midpoints of contiguous above-threshold spans", () => {
    const runs = Int32Array.from([0, 0, 50, 50, 50, 0, 0, 60, 60, 0]);
    expect(candidateLineIndices(runs, 40)).toEqual([3, 7]);
  });

  it("handles a span that runs to the end", () => {
    const runs = Int32Array.from([0, 50, 50, 50]);
    expect(candidateLineIndices(runs, 40)).toEqual([2]);
  });

  it("returns empty when no index meets threshold", () => {
    const runs = Int32Array.from([0, 10, 20]);
    expect(candidateLineIndices(runs, 40)).toEqual([]);
  });
});

describe("findEvenlySpacedGrid", () => {
  it("finds the best N+1 evenly-spaced subset", () => {
    // Cells at every 10 pixels, N=5, so 6 lines at 10, 20, 30, 40, 50, 60.
    const lines = [10, 20, 30, 40, 50, 60];
    const result = findEvenlySpacedGrid(lines, 5);
    expect(result).not.toBeNull();
    expect(result!.first).toBe(10);
    expect(result!.last).toBe(60);
    expect(result!.matches).toBe(6);
  });

  it("tolerates small offsets within ±15%", () => {
    const lines = [10, 21, 29, 41, 50, 59];
    const result = findEvenlySpacedGrid(lines, 5);
    expect(result).not.toBeNull();
    expect(result!.matches).toBe(6);
  });

  it("returns null when fewer than N+1 candidates", () => {
    expect(findEvenlySpacedGrid([10, 20, 30], 5)).toBeNull();
  });
});

describe("detectGrid", () => {
  it("detects a 5×5 grid at a known position", () => {
    const img = makeGridImage({
      imgW: 200,
      imgH: 200,
      gridX: 60,
      gridY: 60,
      cellSize: 20,
      n: 5,
    });
    const det = detectGrid(img, 5);
    expect(det).not.toBeNull();
    expect(Math.abs(det!.gridBox.x - 60)).toBeLessThanOrEqual(1);
    expect(Math.abs(det!.gridBox.y - 60)).toBeLessThanOrEqual(1);
    expect(Math.abs(det!.gridBox.w - 100)).toBeLessThanOrEqual(1);
    expect(Math.abs(det!.gridBox.h - 100)).toBeLessThanOrEqual(1);
    expect(det!.n).toBe(5);
    expect(det!.confidence).toBe(1);
    expect(Math.abs(det!.cellSize - 20)).toBeLessThanOrEqual(1);
  });

  it("detects a 10×10 grid offset from the top-left", () => {
    const img = makeGridImage({
      imgW: 400,
      imgH: 400,
      gridX: 120,
      gridY: 100,
      cellSize: 25,
      n: 10,
    });
    const det = detectGrid(img, 10);
    expect(det).not.toBeNull();
    expect(Math.abs(det!.gridBox.x - 120)).toBeLessThanOrEqual(1);
    expect(Math.abs(det!.gridBox.y - 100)).toBeLessThanOrEqual(1);
    expect(Math.abs(det!.gridBox.w - 250)).toBeLessThanOrEqual(1);
    expect(Math.abs(det!.gridBox.h - 250)).toBeLessThanOrEqual(1);
    expect(det!.n).toBe(10);
  });

  it("returns null for an image without a grid", () => {
    const img = makeImageData(200, 200);
    expect(detectGrid(img, 5)).toBeNull();
  });

  it("returns null when expectedN is too small", () => {
    const img = makeGridImage({
      imgW: 200,
      imgH: 200,
      gridX: 60,
      gridY: 60,
      cellSize: 20,
      n: 5,
    });
    expect(detectGrid(img, 1)).toBeNull();
  });
});
