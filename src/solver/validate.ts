import { CellState, type Board, type Hint, type Hints } from "../types";
import { getCol, getRow } from "../model/board";

export type SatisfiesResult =
  | { ok: true }
  | { ok: false; reason: string; row?: number; col?: number };

function runLengths(line: Uint8Array): number[] {
  const runs: number[] = [];
  let count = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === CellState.Filled) {
      count++;
    } else if (count > 0) {
      runs.push(count);
      count = 0;
    }
  }
  if (count > 0) runs.push(count);
  return runs;
}

function hintMatches(runs: number[], hint: Hint): boolean {
  if (runs.length !== hint.length) return false;
  for (let i = 0; i < runs.length; i++) {
    if (runs[i] !== hint[i]) return false;
  }
  return true;
}

export function satisfies(board: Board, hints: Hints): SatisfiesResult {
  for (let r = 0; r < board.size; r++) {
    const runs = runLengths(getRow(board, r));
    if (!hintMatches(runs, hints.rows[r]!)) {
      return {
        ok: false,
        reason: `row ${r} runs [${runs.join(",")}] does not match hint [${hints.rows[r]!.join(",")}]`,
        row: r,
      };
    }
  }
  for (let c = 0; c < board.size; c++) {
    const runs = runLengths(getCol(board, c));
    if (!hintMatches(runs, hints.cols[c]!)) {
      return {
        ok: false,
        reason: `col ${c} runs [${runs.join(",")}] does not match hint [${hints.cols[c]!.join(",")}]`,
        col: c,
      };
    }
  }
  return { ok: true };
}
