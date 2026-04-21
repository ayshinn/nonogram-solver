import { CellState, type Board, type SolveResult, type SolverEvent } from "../types";
import { getCell, setCell } from "../model/board";
import {
  clearAllHighlights,
  flashCellUnwind,
  highlightLine,
  setCellTentative,
  updateCell,
} from "./boardView";
import { clearHintHighlights, highlightHint } from "./hintsView";
import type { ControlElements } from "./controls";

export type PlayerState = "playing" | "paused" | "stopped" | "done";

export interface SolvePlayerHandle {
  readonly pause: () => void;
  readonly resume: () => void;
  readonly stop: () => void;
  readonly getState: () => PlayerState;
  /** Synchronously consume the next event (for tests). */
  readonly stepOnce: () => void;
}

export interface SolvePlayerDeps {
  readonly trace: readonly SolverEvent[];
  readonly result: SolveResult;
  readonly board: Board;
  readonly els: ControlElements;
  readonly onDone: (result: SolveResult) => void;
  /** Override scheduler for tests. Defaults to window.setTimeout. */
  readonly scheduler?: {
    readonly setTimeout: (fn: () => void, ms: number) => number;
    readonly clearTimeout: (handle: number) => void;
  };
  /** Disable auto-start (for tests that drive stepOnce manually). */
  readonly autoplay?: boolean;
}

interface HistoryEntry {
  readonly r: number;
  readonly c: number;
  readonly prev: CellState;
}

export function startSolvePlayer(deps: SolvePlayerDeps): SolvePlayerHandle {
  const { trace, result, board, els, onDone } = deps;
  const scheduler = deps.scheduler ?? {
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (h) => window.clearTimeout(h),
  };

  let state: PlayerState = "playing";
  let cursor = 0;
  let timer: number | null = null;
  const history = new Map<number, HistoryEntry[]>();
  let activeLine: { kind: "row" | "col"; index: number } | null = null;

  function getDelayMs(): number {
    const parsed = Number.parseInt(els.solveSpeed.value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 50;
  }

  function clearActiveLine(): void {
    if (!activeLine) return;
    highlightLine(activeLine.kind, activeLine.index, false);
    highlightHint(activeLine.kind, activeLine.index, false);
    activeLine = null;
  }

  function applyEvent(e: SolverEvent): void {
    switch (e.type) {
      case "phase":
        // phase events are markers; no DOM change needed here.
        return;
      case "line-enter": {
        clearActiveLine();
        highlightLine(e.kind, e.index, true);
        highlightHint(e.kind, e.index, true);
        activeLine = { kind: e.kind, index: e.index };
        return;
      }
      case "line-exit":
        // Keep highlight active until the next line-enter for smoother playback.
        return;
      case "cell-set": {
        const prev = getCell(board, e.r, e.c);
        if (prev !== e.state) {
          let stack = history.get(e.depth);
          if (!stack) {
            stack = [];
            history.set(e.depth, stack);
          }
          stack.push({ r: e.r, c: e.c, prev });
        }
        setCell(board, e.r, e.c, e.state);
        updateCell(e.r, e.c, e.state);
        if (e.depth > 0) setCellTentative(e.r, e.c, true);
        return;
      }
      case "guess":
        // The matching cell-set follows immediately; nothing to render here.
        return;
      case "unguess": {
        const depths = [...history.keys()]
          .filter((d) => d >= e.depth)
          .sort((a, b) => b - a);
        for (const d of depths) {
          const stack = history.get(d);
          if (!stack) continue;
          while (stack.length > 0) {
            const entry = stack.pop()!;
            setCell(board, entry.r, entry.c, entry.prev);
            updateCell(entry.r, entry.c, entry.prev);
            setCellTentative(entry.r, entry.c, false);
            flashCellUnwind(entry.r, entry.c);
          }
          history.delete(d);
        }
        return;
      }
    }
  }

  function finish(): void {
    if (state === "done") return;
    state = "done";
    if (timer !== null) {
      scheduler.clearTimeout(timer);
      timer = null;
    }
    // Authoritative paint from the final result.
    clearActiveLine();
    clearAllHighlights();
    clearHintHighlights();
    const N = result.board.size;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const s = getCell(result.board, r, c);
        if (getCell(board, r, c) !== s) {
          setCell(board, r, c, s);
        }
        updateCell(r, c, s);
      }
    }
    els.solvePlayerBar.hidden = true;
    onDone(result);
  }

  function stepOnce(): void {
    timer = null;
    if (state === "done" || state === "stopped") return;
    if (cursor >= trace.length) {
      finish();
      return;
    }
    const e = trace[cursor++]!;
    applyEvent(e);
    els.solveStepCounter.textContent = `Step ${cursor} / ${trace.length}`;
    if (cursor >= trace.length) {
      finish();
      return;
    }
    if (state === "playing") {
      timer = scheduler.setTimeout(stepOnce, Math.max(0, getDelayMs()));
    }
  }

  function pause(): void {
    if (state !== "playing") return;
    state = "paused";
    if (timer !== null) {
      scheduler.clearTimeout(timer);
      timer = null;
    }
    els.solvePauseBtn.textContent = "Resume";
  }

  function resume(): void {
    if (state !== "paused") return;
    state = "playing";
    els.solvePauseBtn.textContent = "Pause";
    stepOnce();
  }

  function stop(): void {
    if (state === "done" || state === "stopped") return;
    if (timer !== null) {
      scheduler.clearTimeout(timer);
      timer = null;
    }
    state = "stopped";
    // Drain remaining events synchronously — preserves semantic consistency
    // (tentative cells collapse via any remaining unguess/cell-set events)
    // before we snap to the final board.
    while (cursor < trace.length) {
      const e = trace[cursor++]!;
      applyEvent(e);
    }
    finish();
  }

  const onPauseClick = (): void => {
    if (state === "playing") pause();
    else if (state === "paused") resume();
  };
  const onStopClick = (): void => stop();
  els.solvePauseBtn.addEventListener("click", onPauseClick);
  els.solveStopBtn.addEventListener("click", onStopClick);

  els.solvePlayerBar.hidden = false;
  els.solvePauseBtn.textContent = "Pause";
  els.solveStepCounter.textContent = `Step 0 / ${trace.length}`;

  if (deps.autoplay !== false) {
    timer = scheduler.setTimeout(stepOnce, Math.max(0, getDelayMs()));
  }

  return {
    pause,
    resume,
    stop,
    getState: () => state,
    stepOnce,
  };
}
