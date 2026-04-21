import { beforeEach, describe, expect, it } from "vitest";
import { CellState } from "../../src/types";
import { createBoard } from "../../src/model/board";
import { renderBoard } from "../../src/ui/boardView";
import { startSolvePlayer } from "../../src/ui/solvePlayer";
import type { ControlElements } from "../../src/ui/controls";
import type { SolverEvent } from "../../src/solver/events";
import type { SolveResult } from "../../src/types";

// Build a minimal DOM: board-root + the player bar elements the player touches.
// Only the fields that solvePlayer actually reads/writes are populated.
function setupDom(): {
  boardRoot: HTMLElement;
  els: ControlElements;
} {
  document.body.innerHTML = `
    <div id="board-root"></div>
    <div id="solvePlayerBar" hidden></div>
    <input id="solveSpeed" type="range" min="0" max="500" value="0" />
    <span id="solveSpeedValue"></span>
    <span id="solveStepCounter"></span>
    <button id="solvePauseBtn" type="button">Pause</button>
    <button id="solveStopBtn" type="button">Stop</button>
  `;

  const boardRoot = document.getElementById("board-root") as HTMLElement;
  const els = {
    // Only the fields used by solvePlayer matter; cast stubs for the rest.
    solvePlayerBar: document.getElementById("solvePlayerBar") as HTMLElement,
    solveSpeed: document.getElementById("solveSpeed") as HTMLInputElement,
    solveSpeedValue: document.getElementById("solveSpeedValue") as HTMLElement,
    solveStepCounter: document.getElementById("solveStepCounter") as HTMLElement,
    solvePauseBtn: document.getElementById("solvePauseBtn") as HTMLButtonElement,
    solveStopBtn: document.getElementById("solveStopBtn") as HTMLButtonElement,
  } as unknown as ControlElements;

  return { boardRoot, els };
}

// Synchronous scheduler: records pending callback; tests drive it manually.
function makeSyncScheduler(): {
  scheduler: {
    setTimeout: (fn: () => void, ms: number) => number;
    clearTimeout: (h: number) => void;
  };
  run: () => void;
  pending: () => boolean;
} {
  let pending: (() => void) | null = null;
  let nextId = 1;
  return {
    scheduler: {
      setTimeout: (fn) => {
        pending = fn;
        return nextId++;
      },
      clearTimeout: () => {
        pending = null;
      },
    },
    run: () => {
      const fn = pending;
      pending = null;
      fn?.();
    },
    pending: () => pending !== null,
  };
}

function cellEl(r: number, c: number): HTMLButtonElement {
  const el = document.querySelector<HTMLButtonElement>(
    `.cell[data-r="${r}"][data-c="${c}"]`,
  );
  if (!el) throw new Error(`cell ${r},${c} not found`);
  return el;
}

describe("solvePlayer", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("replays a synthetic trace: line highlight, cell-set, tentative, unguess rollback", () => {
    const { boardRoot, els } = setupDom();
    const board = createBoard(3);
    const hints = {
      rows: [[1], [1], [1]],
      cols: [[1], [1], [1]],
      size: 3,
    };
    renderBoard(boardRoot, board, hints, () => {});

    const trace: SolverEvent[] = [
      { type: "phase", phase: "propagate-start" },
      { type: "line-enter", kind: "row", index: 0, depth: 0 },
      { type: "cell-set", r: 0, c: 1, state: CellState.Filled, depth: 0 },
      { type: "line-exit", kind: "row", index: 0, depth: 0, changed: 1 },
      { type: "phase", phase: "backtrack-start" },
      { type: "guess", r: 1, c: 1, value: CellState.Filled, depth: 1 },
      { type: "cell-set", r: 1, c: 1, state: CellState.Filled, depth: 1 },
      { type: "cell-set", r: 1, c: 2, state: CellState.Empty, depth: 1 },
      { type: "unguess", depth: 1 },
      { type: "cell-set", r: 2, c: 2, state: CellState.Filled, depth: 0 },
      { type: "phase", phase: "done", status: "solved" },
    ];

    const resultBoard = createBoard(3);
    // Final committed state: (0,1)=Filled, (2,2)=Filled; others unset (for this synthetic scenario
    // the solver wouldn't realistically stop here, but the player just paints what result.board says).
    resultBoard.cells[0 * 3 + 1] = CellState.Filled;
    resultBoard.cells[2 * 3 + 2] = CellState.Filled;
    const result: SolveResult = {
      status: "solved",
      board: resultBoard,
      steps: 1,
      elapsedMs: 0,
    };

    const sched = makeSyncScheduler();
    let doneCalled = false;
    const handle = startSolvePlayer({
      trace,
      result,
      board,
      els,
      scheduler: sched.scheduler,
      onDone: () => {
        doneCalled = true;
      },
    });

    // Player bar should be visible
    expect(els.solvePlayerBar.hidden).toBe(false);
    expect(handle.getState()).toBe("playing");

    // Drive event-by-event. The initial setTimeout schedules step 1.
    sched.run(); // consume "phase: propagate-start"
    expect(els.solveStepCounter.textContent).toBe("Step 1 / 11");

    sched.run(); // "line-enter row 0"
    // Row 0 cells should have data-active-line
    expect(cellEl(0, 0).dataset.activeLine).toBe("true");
    expect(cellEl(0, 1).dataset.activeLine).toBe("true");
    expect(cellEl(0, 2).dataset.activeLine).toBe("true");
    // Row 1 should not
    expect(cellEl(1, 0).dataset.activeLine).toBeUndefined();

    sched.run(); // "cell-set 0,1 Filled depth 0"
    expect(cellEl(0, 1).dataset.state).toBe(String(CellState.Filled));
    expect(cellEl(0, 1).dataset.tentative).toBeUndefined();

    sched.run(); // "line-exit" (no visible change)
    sched.run(); // "phase backtrack-start"

    sched.run(); // "guess depth 1" (no visible change)
    sched.run(); // "cell-set 1,1 Filled depth 1" — tentative
    expect(cellEl(1, 1).dataset.state).toBe(String(CellState.Filled));
    expect(cellEl(1, 1).dataset.tentative).toBe("true");

    sched.run(); // "cell-set 1,2 Empty depth 1" — tentative
    expect(cellEl(1, 2).dataset.state).toBe(String(CellState.Empty));
    expect(cellEl(1, 2).dataset.tentative).toBe("true");

    sched.run(); // "unguess depth 1" — rollback
    expect(cellEl(1, 1).dataset.state).toBe(String(CellState.Unset));
    expect(cellEl(1, 2).dataset.state).toBe(String(CellState.Unset));
    expect(cellEl(1, 1).dataset.tentative).toBeUndefined();
    expect(cellEl(1, 2).dataset.tentative).toBeUndefined();

    sched.run(); // "cell-set 2,2 Filled depth 0"
    expect(cellEl(2, 2).dataset.state).toBe(String(CellState.Filled));

    sched.run(); // "phase done" — triggers finish
    expect(doneCalled).toBe(true);
    expect(handle.getState()).toBe("done");
    expect(els.solvePlayerBar.hidden).toBe(true);
    // Final paint matches result.board
    expect(cellEl(0, 1).dataset.state).toBe(String(CellState.Filled));
    expect(cellEl(2, 2).dataset.state).toBe(String(CellState.Filled));
    // Highlights cleared
    expect(cellEl(0, 0).dataset.activeLine).toBeUndefined();
  });

  it("stop mid-run fast-forwards to result.board and hides the bar", () => {
    const { boardRoot, els } = setupDom();
    const board = createBoard(3);
    const hints = { rows: [[1], [1], [1]], cols: [[1], [1], [1]], size: 3 };
    renderBoard(boardRoot, board, hints, () => {});

    const trace: SolverEvent[] = [
      { type: "phase", phase: "propagate-start" },
      { type: "line-enter", kind: "row", index: 0, depth: 0 },
      { type: "cell-set", r: 0, c: 0, state: CellState.Filled, depth: 0 },
      { type: "cell-set", r: 1, c: 1, state: CellState.Filled, depth: 0 },
      { type: "cell-set", r: 2, c: 2, state: CellState.Filled, depth: 0 },
      { type: "phase", phase: "done", status: "solved" },
    ];

    const resultBoard = createBoard(3);
    resultBoard.cells[0] = CellState.Filled;
    resultBoard.cells[4] = CellState.Filled;
    resultBoard.cells[8] = CellState.Filled;
    const result: SolveResult = {
      status: "solved",
      board: resultBoard,
      steps: 0,
      elapsedMs: 0,
    };

    const sched = makeSyncScheduler();
    const handle = startSolvePlayer({
      trace,
      result,
      board,
      els,
      scheduler: sched.scheduler,
      onDone: () => {},
    });

    sched.run(); // "phase propagate-start"
    sched.run(); // "line-enter"
    expect(cellEl(0, 0).dataset.state).toBe(String(CellState.Unset));

    handle.stop();

    expect(handle.getState()).toBe("done");
    expect(els.solvePlayerBar.hidden).toBe(true);
    // All final cells painted
    expect(cellEl(0, 0).dataset.state).toBe(String(CellState.Filled));
    expect(cellEl(1, 1).dataset.state).toBe(String(CellState.Filled));
    expect(cellEl(2, 2).dataset.state).toBe(String(CellState.Filled));
  });

  it("pause halts scheduling; resume continues", () => {
    const { boardRoot, els } = setupDom();
    const board = createBoard(3);
    const hints = { rows: [[1], [1], [1]], cols: [[1], [1], [1]], size: 3 };
    renderBoard(boardRoot, board, hints, () => {});

    const trace: SolverEvent[] = [
      { type: "cell-set", r: 0, c: 0, state: CellState.Filled, depth: 0 },
      { type: "cell-set", r: 1, c: 1, state: CellState.Filled, depth: 0 },
      { type: "phase", phase: "done", status: "solved" },
    ];
    const resultBoard = createBoard(3);
    resultBoard.cells[0] = CellState.Filled;
    resultBoard.cells[4] = CellState.Filled;
    const result: SolveResult = {
      status: "solved",
      board: resultBoard,
      steps: 0,
      elapsedMs: 0,
    };

    const sched = makeSyncScheduler();
    const handle = startSolvePlayer({
      trace,
      result,
      board,
      els,
      scheduler: sched.scheduler,
      onDone: () => {},
    });

    sched.run(); // first cell-set
    expect(cellEl(0, 0).dataset.state).toBe(String(CellState.Filled));

    handle.pause();
    expect(handle.getState()).toBe("paused");
    expect(sched.pending()).toBe(false);
    expect(els.solvePauseBtn.textContent).toBe("Resume");

    handle.resume();
    expect(handle.getState()).toBe("playing");
    expect(els.solvePauseBtn.textContent).toBe("Pause");

    sched.run(); // second cell-set
    expect(cellEl(1, 1).dataset.state).toBe(String(CellState.Filled));

    sched.run(); // phase done
    expect(handle.getState()).toBe("done");
  });
});
