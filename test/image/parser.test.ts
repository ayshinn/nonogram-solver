import { describe, expect, it } from "vitest";
import { parseImageData } from "../../src/image/parser";
import { deriveHintsFromBoard } from "../../src/model/hints";
import { CellState } from "../../src/types";
import {
  plus3x3,
  plus5x5,
  heart5x5,
  diamond10x10,
  allFixtures,
} from "../fixtures/puzzles";

// Build a synthetic ImageData where each cell of the solution occupies a tilePx×tilePx block.
// Filled cells become black (0), Empty cells white (255).
function boardToImageData(
  solution: readonly (readonly CellState[])[],
  tilePx: number,
): ImageData {
  const size = solution.length;
  const w = size * tilePx;
  const h = size * tilePx;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = Math.floor(y / tilePx);
      const c = Math.floor(x / tilePx);
      const cell = solution[r]![c];
      const v = cell === CellState.Filled ? 0 : 255;
      const i = (y * w + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h, colorSpace: "srgb" } as ImageData;
}

describe("parseImageData — round-trip", () => {
  it("recovers plus3x3 from synthetic 30×30 image", () => {
    const img = boardToImageData(plus3x3.solution, 10);
    const board = parseImageData(img, 3);
    const derived = deriveHintsFromBoard(board);
    expect(derived).toEqual(plus3x3.hints);
  });

  it("recovers plus5x5 from synthetic 50×50 image", () => {
    const img = boardToImageData(plus5x5.solution, 10);
    const board = parseImageData(img, 5);
    const derived = deriveHintsFromBoard(board);
    expect(derived).toEqual(plus5x5.hints);
  });

  it("recovers heart5x5", () => {
    const img = boardToImageData(heart5x5.solution, 10);
    const board = parseImageData(img, 5);
    const derived = deriveHintsFromBoard(board);
    expect(derived).toEqual(heart5x5.hints);
  });

  it("recovers diamond10x10 from synthetic 100×100 image", () => {
    const img = boardToImageData(diamond10x10.solution, 10);
    const board = parseImageData(img, 10);
    const derived = deriveHintsFromBoard(board);
    expect(derived).toEqual(diamond10x10.hints);
  });

  it("recovers every fixture", () => {
    for (const fixture of allFixtures) {
      const img = boardToImageData(fixture.solution, 8);
      const board = parseImageData(img, fixture.hints.size);
      const derived = deriveHintsFromBoard(board);
      expect(derived, fixture.name).toEqual(fixture.hints);
    }
  });

  it("tolerates non-integer tile widths by flooring to center sampling", () => {
    // Using a tile size that doesn't evenly divide: 3x3 board in 31×31 image
    const solution = plus3x3.solution;
    const size = 3;
    const w = 31;
    const h = 31;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const r = Math.min(size - 1, Math.floor((y / h) * size));
        const c = Math.min(size - 1, Math.floor((x / w) * size));
        const cell = solution[r]![c];
        const v = cell === CellState.Filled ? 0 : 255;
        const i = (y * w + x) * 4;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = 255;
      }
    }
    const img = { data, width: w, height: h, colorSpace: "srgb" } as ImageData;
    const board = parseImageData(img, size);
    const derived = deriveHintsFromBoard(board);
    expect(derived).toEqual(plus3x3.hints);
  });
});

describe("parseImageData — edge cases", () => {
  it("throws when image is smaller than the grid", () => {
    const img = { data: new Uint8ClampedArray(4), width: 1, height: 1, colorSpace: "srgb" } as ImageData;
    expect(() => parseImageData(img, 5)).toThrow(/too small/i);
  });

  it("reads color images via luminance", () => {
    // 2×2 grid: filled (black), empty (red), empty (blue), filled (dark green)
    const size = 2;
    const tile = 10;
    const w = size * tile;
    const h = size * tile;
    const data = new Uint8ClampedArray(w * h * 4);
    const color = (r: number, c: number): [number, number, number] => {
      if (r === 0 && c === 0) return [0, 0, 0];       // filled
      if (r === 0 && c === 1) return [255, 200, 200]; // empty (light pink)
      if (r === 1 && c === 0) return [200, 200, 255]; // empty (light blue)
      return [0, 40, 0];                               // filled (dark)
    };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const r = Math.floor(y / tile);
        const c = Math.floor(x / tile);
        const [cr, cg, cb] = color(r, c);
        const i = (y * w + x) * 4;
        data[i] = cr;
        data[i + 1] = cg;
        data[i + 2] = cb;
        data[i + 3] = 255;
      }
    }
    const img = { data, width: w, height: h, colorSpace: "srgb" } as ImageData;
    const board = parseImageData(img, size);
    expect(board.cells[0]).toBe(CellState.Filled);
    expect(board.cells[1]).toBe(CellState.Empty);
    expect(board.cells[2]).toBe(CellState.Empty);
    expect(board.cells[3]).toBe(CellState.Filled);
  });
});
