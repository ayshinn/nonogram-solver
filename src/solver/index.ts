import type { Hints, SolveOptions, SolveResult } from "../types";
import { createBoard } from "../model/board";
import { propagate } from "./propagate";
import { satisfies } from "./validate";

export { satisfies } from "./validate";

export function solve(hints: Hints, _opts: SolveOptions = {}): SolveResult {
  const startMs = Date.now();
  const board = createBoard(hints.size);

  const propagateStatus = propagate(board, hints);
  const elapsedMs = Date.now() - startMs;

  if (propagateStatus === "solved") {
    const check = satisfies(board, hints);
    if (!check.ok) {
      return { status: "contradiction", board, steps: 0, elapsedMs };
    }
  }

  return { status: propagateStatus, board, steps: 0, elapsedMs };
}
