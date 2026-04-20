import { describe, expect, it } from "vitest";
import { solve, satisfies } from "../../src/solver/index";
import { deriveHintsFromBoard } from "../../src/model/hints";
import { createBoard, setCell } from "../../src/model/board";
import { CellState, type Hints } from "../../src/types";

// 25x25 diamond solution: row r fills cols (12-d)..(12+d) where d=min(r,24-r).
function diamondHints(size: number): Hints {
  const board = createBoard(size);
  const mid = (size - 1) / 2;
  for (let r = 0; r < size; r++) {
    const d = Math.min(r, size - 1 - r);
    const from = Math.floor(mid - d);
    const to = Math.floor(mid + d);
    for (let c = from; c <= to; c++) {
      setCell(board, r, c, CellState.Filled);
    }
  }
  return deriveHintsFromBoard(board);
}

describe("solve — performance", () => {
  it("solves 25×25 diamond under 100ms", () => {
    const hints = diamondHints(25);
    const t0 = performance.now();
    const result = solve(hints);
    const elapsedMs = performance.now() - t0;

    expect(result.status).toBe("solved");
    expect(satisfies(result.board, hints).ok).toBe(true);
    expect(elapsedMs).toBeLessThan(100);
  });
});
