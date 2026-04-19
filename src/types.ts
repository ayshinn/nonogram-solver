export const CellState = {
  Unset: 0,
  Filled: 1,
  Empty: 2,
} as const;
export type CellState = (typeof CellState)[keyof typeof CellState];

export type Hint = readonly number[];

export interface Hints {
  readonly rows: readonly Hint[];
  readonly cols: readonly Hint[];
  readonly size: number;
}

export interface Board {
  readonly size: number;
  cells: Uint8Array;
}

export interface Placement {
  readonly starts: readonly number[];
}

export interface SolveOptions {
  readonly maxSteps?: number;
  readonly maxMs?: number;
}

export type SolveStatus = "solved" | "stuck" | "contradiction" | "aborted";

export interface SolveResult {
  readonly status: SolveStatus;
  readonly board: Board;
  readonly steps: number;
  readonly elapsedMs: number;
}
