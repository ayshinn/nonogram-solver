import { describe, expect, it } from "vitest";
import { satisfies } from "../../src/solver/validate";
import { CellState, type Board } from "../../src/types";
import { plus5x5, heart5x5, plus3x3 } from "../fixtures/puzzles";

const F = CellState.Filled;
const E = CellState.Empty;

function boardFrom(grid: readonly (readonly number[])[]): Board {
  const size = grid.length;
  const cells = new Uint8Array(size * size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      cells[r * size + c] = grid[r]![c]!;
    }
  }
  return { size, cells };
}

describe("satisfies", () => {
  it("returns ok:true for plus3x3 solution", () => {
    const board = boardFrom(plus3x3.solution);
    expect(satisfies(board, plus3x3.hints)).toEqual({ ok: true });
  });

  it("returns ok:true for plus5x5 solution", () => {
    const board = boardFrom(plus5x5.solution);
    expect(satisfies(board, plus5x5.hints)).toEqual({ ok: true });
  });

  it("returns ok:true for heart5x5 solution", () => {
    const board = boardFrom(heart5x5.solution);
    expect(satisfies(board, heart5x5.hints)).toEqual({ ok: true });
  });

  it("detects wrong row run length", () => {
    // plus3x3 solution, but flip (1,0) from F to E
    const grid: number[][] = plus3x3.solution.map(row => [...row]);
    grid[1]![0] = E;
    const board = boardFrom(grid);
    const result = satisfies(board, plus3x3.hints);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.row ?? result.col).toBeDefined();
  });

  it("detects wrong column run length", () => {
    // plus3x3 solution, flip (0,1) from F to E
    const grid: number[][] = plus3x3.solution.map(row => [...row]);
    grid[0]![1] = E;
    const board = boardFrom(grid);
    const result = satisfies(board, plus3x3.hints);
    expect(result.ok).toBe(false);
  });

  it("empty-hint row: all Empty is ok", () => {
    const board: Board = {
      size: 3,
      cells: new Uint8Array([E, E, E, F, F, F, E, E, E]),
    };
    const hints = { rows: [[], [3], []], cols: [[1], [1], [1]], size: 3 };
    expect(satisfies(board, hints)).toEqual({ ok: true });
  });

  it("empty-hint row: a Filled cell fails", () => {
    const board: Board = {
      size: 3,
      cells: new Uint8Array([F, E, E, F, F, F, E, E, E]),
    };
    const hints = { rows: [[], [3], []], cols: [[2], [1], [1]], size: 3 };
    const result = satisfies(board, hints);
    expect(result.ok).toBe(false);
  });
});
