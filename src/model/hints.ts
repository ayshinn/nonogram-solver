import { CellState, type Board, type Hint, type Hints } from "../types";
import { getCol, getRow } from "./board";

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string; axis?: "row" | "col"; index?: number };

export function parseHintText(text: string, size: number): Hint[] {
  const lines = text.split("\n").map((l) => l.trim());
  const hints: Hint[] = [];
  for (const line of lines) {
    if (hints.length >= size) break;
    if (line === "") {
      hints.push([]);
      continue;
    }
    const parts = line
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const parsed: number[] = [];
    for (const p of parts) {
      const v = Number(p);
      if (!Number.isFinite(v) || !Number.isInteger(v)) {
        throw new Error(`Invalid hint number: "${p}"`);
      }
      parsed.push(v);
    }
    // Convention: a lone "0" on a line means that row/col is entirely empty.
    if (parsed.length === 1 && parsed[0] === 0) {
      hints.push([]);
    } else {
      hints.push(parsed);
    }
  }
  while (hints.length < size) hints.push([]);
  return hints;
}

function lineMinSpan(hint: Hint): number {
  if (hint.length === 0) return 0;
  let sum = 0;
  for (const n of hint) sum += n;
  return sum + (hint.length - 1);
}

function hintSum(hint: Hint): number {
  let s = 0;
  for (const n of hint) s += n;
  return s;
}

export function validateHints(hints: Hints): ValidationResult {
  const { rows, cols, size } = hints;
  if (rows.length !== size) {
    return {
      ok: false,
      reason: `expected ${size} row hint lines, got ${rows.length}`,
    };
  }
  if (cols.length !== size) {
    return {
      ok: false,
      reason: `expected ${size} column hint lines, got ${cols.length}`,
    };
  }

  for (let i = 0; i < rows.length; i++) {
    const hint = rows[i]!;
    for (const n of hint) {
      if (n < 1) {
        return {
          ok: false,
          reason: `row ${i + 1}: hint numbers must be positive`,
          axis: "row",
          index: i,
        };
      }
    }
    if (lineMinSpan(hint) > size) {
      return {
        ok: false,
        reason: `row ${i + 1}: hints don't fit in ${size} cells`,
        axis: "row",
        index: i,
      };
    }
  }

  for (let i = 0; i < cols.length; i++) {
    const hint = cols[i]!;
    for (const n of hint) {
      if (n < 1) {
        return {
          ok: false,
          reason: `col ${i + 1}: hint numbers must be positive`,
          axis: "col",
          index: i,
        };
      }
    }
    if (lineMinSpan(hint) > size) {
      return {
        ok: false,
        reason: `col ${i + 1}: hints don't fit in ${size} cells`,
        axis: "col",
        index: i,
      };
    }
  }

  let rowTotal = 0;
  for (const r of rows) rowTotal += hintSum(r);
  let colTotal = 0;
  for (const c of cols) colTotal += hintSum(c);
  if (rowTotal !== colTotal) {
    return {
      ok: false,
      reason: `filled-cell totals differ: rows sum to ${rowTotal}, cols sum to ${colTotal}`,
    };
  }

  return { ok: true };
}

export function deriveHintsFromBoard(board: Board): Hints {
  const rows: Hint[] = [];
  const cols: Hint[] = [];
  for (let r = 0; r < board.size; r++) rows.push(extractRuns(getRow(board, r)));
  for (let c = 0; c < board.size; c++) cols.push(extractRuns(getCol(board, c)));
  return { rows, cols, size: board.size };
}

function extractRuns(line: Uint8Array): number[] {
  const runs: number[] = [];
  let current = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === CellState.Filled) {
      current++;
    } else if (current > 0) {
      runs.push(current);
      current = 0;
    }
  }
  if (current > 0) runs.push(current);
  return runs;
}
