import type { Hints, SolveOptions, SolveResult } from "../types";
import type { SolverEvent } from "./events";
import { solve } from "./index";

export interface TraceResult {
  readonly result: SolveResult;
  readonly trace: readonly SolverEvent[];
}

export function solveWithTrace(
  hints: Hints,
  opts: Omit<SolveOptions, "onEvent"> = {},
): TraceResult {
  const trace: SolverEvent[] = [];
  const result = solve(hints, {
    ...opts,
    onEvent: (e) => trace.push(e),
  });
  return { result, trace };
}
