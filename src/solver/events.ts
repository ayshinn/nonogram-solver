import type { CellState, SolveStatus } from "../types";

export type LineKind = "row" | "col";

export type SolverEvent =
  | { type: "phase"; phase: "propagate-start" | "backtrack-start" | "done"; status?: SolveStatus }
  | { type: "line-enter"; kind: LineKind; index: number; depth: number }
  | { type: "line-exit"; kind: LineKind; index: number; depth: number; changed: number }
  | { type: "cell-set"; r: number; c: number; state: CellState; depth: number }
  | { type: "guess"; r: number; c: number; value: CellState; depth: number }
  | { type: "unguess"; depth: number };

export type SolverEventSink = (e: SolverEvent) => void;
