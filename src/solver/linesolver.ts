import { CellState, type Hint } from "../types";
import { getValidPlacements } from "./candidates";

export type LineResult =
  | { ok: true; line: Uint8Array; changed: boolean }
  | { ok: false; contradiction: true };

export function solveLine(line: Uint8Array, hint: Hint): LineResult {
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
    if (filledCount[j] === candidates.length) {
      result[j] = CellState.Filled;
      changed = true;
    } else if (filledCount[j] === 0) {
      result[j] = CellState.Empty;
      changed = true;
    }
  }

  return { ok: true, line: result, changed };
}
