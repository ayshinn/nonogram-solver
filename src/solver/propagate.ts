import { type Board, type Hints } from "../types";
import type { SolverEventSink } from "./events";
import { getCol, getRow, isComplete, setCol, setRow } from "../model/board";
import { solveLine } from "./linesolver";

export type PropagateStatus = "solved" | "stuck" | "contradiction";

export function propagate(
  board: Board,
  hints: Hints,
  depth: number = 0,
  onEvent?: SolverEventSink,
): PropagateStatus {
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
    const kind = isRow ? "row" : "col";
    const hint = isRow ? hints.rows[idx]! : hints.cols[idx]!;
    const line = isRow ? getRow(board, idx) : getCol(board, idx);

    onEvent?.({ type: "line-enter", kind, index: idx, depth });

    const result = solveLine(line, hint, onEvent ? { kind, index: idx, depth, onEvent } : undefined);
    if (!result.ok) {
      onEvent?.({ type: "line-exit", kind, index: idx, depth, changed: 0 });
      return "contradiction";
    }

    let changedCount = 0;
    if (result.changed) {
      if (isRow) {
        setRow(board, idx, result.line);
        for (let c = 0; c < N; c++) {
          if (line[c] !== result.line[c]) {
            dirty.add(N + c);
            changedCount++;
          }
        }
      } else {
        setCol(board, idx, result.line);
        for (let r = 0; r < N; r++) {
          if (line[r] !== result.line[r]) {
            dirty.add(r);
            changedCount++;
          }
        }
      }
    }

    onEvent?.({ type: "line-exit", kind, index: idx, depth, changed: changedCount });
  }

  return isComplete(board) ? "solved" : "stuck";
}
