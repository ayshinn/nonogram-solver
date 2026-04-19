import { type Board, type Hints } from "../types";
import { getCol, getRow, isComplete, setCol, setRow } from "../model/board";
import { solveLine } from "./linesolver";

export type PropagateStatus = "solved" | "stuck" | "contradiction";

export function propagate(board: Board, hints: Hints): PropagateStatus {
  const N = board.size;
  // Encoding: 0..N-1 = rows, N..2N-1 = cols
  const dirty = new Set<number>();
  for (let i = 0; i < N; i++) {
    dirty.add(i);
    dirty.add(N + i);
  }

  while (dirty.size > 0) {
    const lineId = dirty.values().next().value as number;
    dirty.delete(lineId);

    const isRow = lineId < N;
    const idx = isRow ? lineId : lineId - N;
    const hint = isRow ? hints.rows[idx]! : hints.cols[idx]!;
    const line = isRow ? getRow(board, idx) : getCol(board, idx);

    const result = solveLine(line, hint);
    if (!result.ok) return "contradiction";

    if (result.changed) {
      if (isRow) {
        setRow(board, idx, result.line);
        for (let c = 0; c < N; c++) {
          if (line[c] !== result.line[c]) dirty.add(N + c);
        }
      } else {
        setCol(board, idx, result.line);
        for (let r = 0; r < N; r++) {
          if (line[r] !== result.line[r]) dirty.add(r);
        }
      }
    }
  }

  return isComplete(board) ? "solved" : "stuck";
}
