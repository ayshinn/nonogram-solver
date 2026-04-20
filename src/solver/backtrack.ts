import { CellState, type Board, type Hints } from "../types";
import { cloneBoard, getCell, setCell } from "../model/board";
import { propagate } from "./propagate";
import { satisfies } from "./validate";

export interface BacktrackContext {
  readonly hints: Hints;
  readonly maxSteps: number;
  readonly maxMs: number;
  readonly startMs: number;
  steps: number;
}

export type BacktrackStatus = "solved" | "contradiction" | "aborted";

// Pick the unset cell in the row with fewest remaining unset cells (most-constrained heuristic).
function pickCell(board: Board): [number, number] | null {
  const N = board.size;
  let bestRow = -1;
  let bestUnset = N + 1;

  for (let r = 0; r < N; r++) {
    let unset = 0;
    for (let c = 0; c < N; c++) {
      if (getCell(board, r, c) === CellState.Unset) unset++;
    }
    if (unset > 0 && unset < bestUnset) {
      bestUnset = unset;
      bestRow = r;
    }
  }

  if (bestRow === -1) return null;

  for (let c = 0; c < N; c++) {
    if (getCell(board, bestRow, c) === CellState.Unset) return [bestRow, c];
  }

  return null;
}

export function backtrack(board: Board, ctx: BacktrackContext): BacktrackStatus {
  const cell = pickCell(board);
  if (cell === null) {
    return satisfies(board, ctx.hints).ok ? "solved" : "contradiction";
  }

  const [r, c] = cell;

  for (const value of [CellState.Filled, CellState.Empty] as const) {
    if (ctx.steps >= ctx.maxSteps || Date.now() - ctx.startMs >= ctx.maxMs) {
      return "aborted";
    }
    ctx.steps++;

    const clone = cloneBoard(board);
    setCell(clone, r, c, value);

    const propStatus = propagate(clone, ctx.hints);
    if (propStatus === "contradiction") continue;
    if (propStatus === "solved") {
      board.cells.set(clone.cells);
      return "solved";
    }

    const result = backtrack(clone, ctx);
    if (result === "solved") {
      board.cells.set(clone.cells);
      return "solved";
    }
    if (result === "aborted") return "aborted";
  }

  return "contradiction";
}
