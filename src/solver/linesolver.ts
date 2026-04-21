import { CellState, type Hint } from "../types";
import type { LineKind, SolverEventSink } from "./events";
import { getValidPlacements } from "./candidates";

export type LineResult =
  | { ok: true; line: Uint8Array; changed: boolean }
  | { ok: false; contradiction: true };

export interface LineContext {
  readonly kind: LineKind;
  readonly index: number;
  readonly depth: number;
  readonly onEvent?: SolverEventSink;
}

export function solveLine(
  line: Uint8Array,
  hint: Hint,
  ctx?: LineContext,
): LineResult {
  const candidates = getValidPlacements(line, hint);

  if (candidates.length === 0) {
    return { ok: false, contradiction: true };
  }

  const L = line.length;
  const filledCount = new Int32Array(L);

  for (const p of candidates) {
    for (let i = 0; i < hint.length; i++) {
      const start = p.starts[i]!;
      const len = hint[i]!;
      for (let j = start; j < start + len; j++) {
        filledCount[j]! ++;
      }
    }
  }

  const result = new Uint8Array(line);
  let changed = false;

  for (let j = 0; j < L; j++) {
    if (result[j] !== CellState.Unset) continue;
    let next: CellState | null = null;
    if (filledCount[j] === candidates.length) {
      next = CellState.Filled;
    } else if (filledCount[j] === 0) {
      next = CellState.Empty;
    }
    if (next !== null) {
      result[j] = next;
      changed = true;
      if (ctx?.onEvent) {
        const r = ctx.kind === "row" ? ctx.index : j;
        const c = ctx.kind === "row" ? j : ctx.index;
        ctx.onEvent({
          type: "cell-set",
          r,
          c,
          state: next,
          depth: ctx.depth,
        });
      }
    }
  }

  return { ok: true, line: result, changed };
}
