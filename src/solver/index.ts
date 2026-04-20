import type { Hints, SolveOptions, SolveResult } from "../types";
import { createBoard } from "../model/board";
import { propagate } from "./propagate";
import { satisfies } from "./validate";
import { backtrack } from "./backtrack";

export { satisfies } from "./validate";

const DEFAULT_MAX_STEPS = 500_000;
const DEFAULT_MAX_MS = 2000;

export function solve(hints: Hints, opts: SolveOptions = {}): SolveResult {
  const startMs = Date.now();
  const maxSteps = opts.maxSteps ?? DEFAULT_MAX_STEPS;
  const maxMs = opts.maxMs ?? DEFAULT_MAX_MS;
  const board = createBoard(hints.size);

  const propStatus = propagate(board, hints);
  if (propStatus === "contradiction") {
    return { status: "contradiction", board, steps: 0, elapsedMs: Date.now() - startMs };
  }
  if (propStatus === "solved") {
    return { status: "solved", board, steps: 0, elapsedMs: Date.now() - startMs };
  }

  // stuck — fall through to backtracking
  const ctx = { hints, maxSteps, maxMs, startMs, steps: 0 };
  const btStatus = backtrack(board, ctx);

  const elapsedMs = Date.now() - startMs;
  if (btStatus === "solved") {
    return { status: "solved", board, steps: ctx.steps, elapsedMs };
  }
  if (btStatus === "aborted") {
    return { status: "aborted", board, steps: ctx.steps, elapsedMs };
  }
  return { status: "contradiction", board, steps: ctx.steps, elapsedMs };
}
