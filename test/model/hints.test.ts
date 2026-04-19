import { describe, expect, it } from "vitest";
import {
  deriveHintsFromBoard,
  parseHintText,
  validateHints,
} from "../../src/model/hints";
import { createBoard, setCell } from "../../src/model/board";
import { allFixtures } from "../fixtures/puzzles";

describe("parseHintText", () => {
  it("parses comma-separated numbers per line", () => {
    expect(parseHintText("1,2\n3\n1,1,1", 3)).toEqual([
      [1, 2],
      [3],
      [1, 1, 1],
    ]);
  });

  it("treats an empty line as an empty hint", () => {
    expect(parseHintText("\n3\n", 3)).toEqual([[], [3], []]);
  });

  it("treats a lone 0 as an empty hint", () => {
    expect(parseHintText("0\n3\n0", 3)).toEqual([[], [3], []]);
  });

  it("trims whitespace around numbers", () => {
    expect(parseHintText(" 1 , 2 \n 3 ", 2)).toEqual([[1, 2], [3]]);
  });

  it("pads short input up to size with empty hints", () => {
    expect(parseHintText("3", 3)).toEqual([[3], [], []]);
  });

  it("truncates long input down to size", () => {
    expect(parseHintText("1\n2\n3\n4\n5", 3)).toEqual([[1], [2], [3]]);
  });

  it("throws on non-numeric tokens", () => {
    expect(() => parseHintText("abc", 1)).toThrow();
  });

  it("throws on fractional numbers", () => {
    expect(() => parseHintText("1.5", 1)).toThrow();
  });
});

describe("validateHints", () => {
  it("accepts a balanced set of hints", () => {
    expect(
      validateHints({
        rows: [[1], [3], [1]],
        cols: [[1], [3], [1]],
        size: 3,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects row count mismatch", () => {
    const result = validateHints({
      rows: [[1], [3]],
      cols: [[1], [3], [1]],
      size: 3,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects hints that don't fit in the line", () => {
    const result = validateHints({
      rows: [[3, 3], [], [], [], []],
      cols: [[1], [1], [1], [1], [1]],
      size: 5,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects zero or negative hint numbers", () => {
    const result = validateHints({
      rows: [[-1], [], []],
      cols: [[], [], []],
      size: 3,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects row/col fill totals that disagree", () => {
    const result = validateHints({
      rows: [[2], [1], []],
      cols: [[1], [1], []],
      size: 3,
    });
    expect(result.ok).toBe(false);
  });
});

describe("deriveHintsFromBoard", () => {
  for (const fx of allFixtures) {
    it(`round-trips ${fx.name}`, () => {
      const board = createBoard(fx.hints.size);
      for (let r = 0; r < fx.hints.size; r++) {
        for (let c = 0; c < fx.hints.size; c++) {
          setCell(board, r, c, fx.solution[r]![c]!);
        }
      }
      const derived = deriveHintsFromBoard(board);
      expect(derived.size).toBe(fx.hints.size);
      expect(derived.rows).toEqual(fx.hints.rows);
      expect(derived.cols).toEqual(fx.hints.cols);
    });
  }
});
