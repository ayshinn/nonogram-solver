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
  const onEvent = opts.onEvent;
  const board = createBoard(hints.size);

  onEvent?.({ type: "phase", phase: "propagate-start" });
  const propStatus = propagate(board, hints, 0, onEvent);
  if (propStatus === "contradiction") {
    const result: SolveResult = {
      status: "contradiction",
      board,
      steps: 0,
      elapsedMs: Date.now() - startMs,
    };
    onEvent?.({ type: "phase", phase: "done", status: result.status });
    return result;
  }
  if (propStatus === "solved") {
    const result: SolveResult = {
      status: "solved",
      board,
      steps: 0,
      elapsedMs: Date.now() - startMs,
    };
    onEvent?.({ type: "phase", phase: "done", status: result.status });
    return result;
  }

  // stuck — fall through to backtracking
  onEvent?.({ type: "phase", phase: "backtrack-start" });
  const ctx = { hints, maxSteps, maxMs, startMs, onEvent, steps: 0 };
  const btStatus = backtrack(board, ctx);

  const elapsedMs = Date.now() - startMs;
  let result: SolveResult;
  if (btStatus === "solved") {
    result = { status: "solved", board, steps: ctx.steps, elapsedMs };
  } else if (btStatus === "aborted") {
    result = { status: "aborted", board, steps: ctx.steps, elapsedMs };
  } else {
    result = { status: "contradiction", board, steps: ctx.steps, elapsedMs };
  }
  onEvent?.({ type: "phase", phase: "done", status: result.status });
  return result;
}
