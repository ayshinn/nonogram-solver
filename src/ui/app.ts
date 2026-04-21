import { CellState, type Board, type Hints, type SolveResult } from "../types";
import { createBoard, getCell, setCell } from "../model/board";
import { parseHintText, validateHints } from "../model/hints";
import { solve } from "../solver/index";
import { solveWithTrace } from "../solver/trace";
import {
  formatHintsAsText,
  parseScreenshotFile,
} from "../image/screenshotParser";
import { terminateOcrWorker } from "../image/ocr";
import { setStatus } from "./status";
import {
  clearBoardDom,
  fitBoardToContainer,
  focusCell,
  renderBoard,
  updateCell,
  type ToggleKind,
} from "./boardView";
import {
  findControls,
  setManualHintsExpanded,
  wireControls,
  type ControlElements,
} from "./controls";
import { attachKeyboard } from "./keyboard";
import { startSolvePlayer, type SolvePlayerHandle } from "./solvePlayer";

interface AppState {
  board: Board | null;
  hints: Hints | null;
  player: SolvePlayerHandle | null;
}

const state: AppState = { board: null, hints: null, player: null };

function handleToggle(r: number, c: number, kind: ToggleKind): void {
  const { board, player } = state;
  if (!board) return;
  if (player && player.getState() !== "done" && player.getState() !== "stopped") {
    return; // Disable manual edits during animation.
  }
  const current = getCell(board, r, c);
  const target: CellState =
    kind === "fill" ? CellState.Filled : CellState.Empty;
  const next: CellState = current === target ? CellState.Unset : target;
  setCell(board, r, c, next);
  updateCell(r, c, next);
}

function handleInitialize(
  size: number,
  rowText: string,
  colText: string,
  boardRoot: HTMLElement,
  els: ControlElements,
): void {
  if (!Number.isInteger(size) || size < 5 || size > 25) {
    setStatus("Grid size must be an integer between 5 and 25.", "error");
    return;
  }
  let rows, cols;
  try {
    rows = parseHintText(rowText, size);
    cols = parseHintText(colText, size);
  } catch (err) {
    setStatus(`Parse error: ${(err as Error).message}`, "error");
    return;
  }
  const hints: Hints = { rows, cols, size };
  const v = validateHints(hints);
  if (!v.ok) {
    setStatus(`Invalid hints: ${v.reason}`, "error");
    return;
  }
  state.hints = hints;
  state.board = createBoard(size);
  state.player = null;
  els.solvePlayerBar.hidden = true;
  clearHintWarnings(els);
  renderBoard(boardRoot, state.board, state.hints, handleToggle);
  fitBoardToArea(boardRoot);
  focusCell(0, 0);
  setStatus(
    `Board ready — ${size}×${size}. Click cells or use arrow keys + Space/X.`,
    "success",
  );
}

function fitBoardToArea(boardRoot: HTMLElement): void {
  const area = boardRoot.parentElement;
  if (area) fitBoardToContainer(boardRoot, area);
}

function handleClear(boardRoot: HTMLElement): void {
  if (!state.hints || !state.board) return;
  state.board = createBoard(state.board.size);
  state.player = null;
  renderBoard(boardRoot, state.board, state.hints, handleToggle);
  fitBoardToArea(boardRoot);
  focusCell(0, 0);
  setStatus("Board cleared.", "info");
}

function handleReset(
  boardRoot: HTMLElement,
  els: ControlElements,
): void {
  state.board = null;
  state.hints = null;
  state.player = null;
  els.solvePlayerBar.hidden = true;
  clearBoardDom(boardRoot);
  els.sizeInput.value = "5";
  els.rowHints.value = "";
  els.colHints.value = "";
  els.imageFile.value = "";
  clearHintWarnings(els);
  setManualHintsExpanded(els, false);
  els.sizeInput.focus();
  void terminateOcrWorker();
  setStatus("Reset. Enter hints to start a new puzzle.", "info");
}

const LOW_CONF_THRESHOLD = 70;

function lowConfidenceIndices(
  confidences: readonly number[],
): number[] {
  const out: number[] = [];
  confidences.forEach((c, i) => {
    if (c < LOW_CONF_THRESHOLD) out.push(i + 1); // 1-indexed for humans
  });
  return out;
}

function setHintWarning(el: HTMLElement, label: string, indices: number[]): void {
  if (indices.length === 0) {
    el.hidden = true;
    el.textContent = "";
  } else {
    el.hidden = false;
    el.textContent = `Low OCR confidence on ${label} ${indices.join(", ")} — review before Initialize.`;
  }
}

function clearHintWarnings(els: ControlElements): void {
  setHintWarning(els.rowHintsWarning, "row", []);
  setHintWarning(els.colHintsWarning, "col", []);
}

async function handleImageFile(
  file: File,
  els: ControlElements,
): Promise<void> {
  const size = Number.parseInt(els.sizeInput.value, 10);
  if (!Number.isInteger(size) || size < 5 || size > 25) {
    setStatus(
      "Set a grid size between 5 and 25 before importing a screenshot.",
      "error",
    );
    els.imageFile.value = "";
    return;
  }
  els.imageFile.disabled = true;
  clearHintWarnings(els);
  setStatus("Reading screenshot — OCR may take a few seconds…", "info");
  try {
    const result = await parseScreenshotFile(file, size, {
      onProgress: (done, total) => {
        setStatus(`Recognizing hints — ${done}/${total} strips…`, "info");
      },
    });
    els.rowHints.value = formatHintsAsText(result.hints.rows);
    els.colHints.value = formatHintsAsText(result.hints.cols);
    setManualHintsExpanded(els, true);
    const lowRows = lowConfidenceIndices(result.rowConfidences);
    const lowCols = lowConfidenceIndices(result.colConfidences);
    setHintWarning(els.rowHintsWarning, "row", lowRows);
    setHintWarning(els.colHintsWarning, "col", lowCols);
    const totalLow = lowRows.length + lowCols.length;
    if (totalLow > 0) {
      setStatus(
        `Imported — ${totalLow} line(s) flagged for review before Initialize.`,
        "info",
      );
    } else {
      setStatus("Imported — review hints and click Initialize.", "success");
    }
  } catch (err) {
    setStatus(`Screenshot import failed: ${(err as Error).message}`, "error");
  } finally {
    els.imageFile.disabled = false;
    els.imageFile.value = "";
  }
}

function reportSolveResult(result: SolveResult): void {
  switch (result.status) {
    case "solved":
      setStatus(`Solved in ${result.elapsedMs}ms.`, "success");
      break;
    case "stuck":
      setStatus(
        "Partially filled — the solver could not complete this puzzle.",
        "info",
      );
      break;
    case "contradiction":
      setStatus("Contradiction — these hints have no solution.", "error");
      break;
    case "aborted":
      setStatus("Solver gave up (budget exhausted).", "error");
      break;
  }
}

function readyToSolve(): { hints: Hints; board: Board } | null {
  const { hints, board } = state;
  if (!hints || !board) {
    setStatus("Initialize the board before solving.", "error");
    return null;
  }
  return { hints, board };
}

function handleSolveInstant(boardRoot: HTMLElement): void {
  const ready = readyToSolve();
  if (!ready) return;
  const result = solve(ready.hints);
  state.board = result.board;
  renderBoard(boardRoot, result.board, ready.hints, handleToggle);
  fitBoardToArea(boardRoot);
  reportSolveResult(result);
}

function handleSolveAnimated(
  boardRoot: HTMLElement,
  els: ControlElements,
): void {
  const ready = readyToSolve();
  if (!ready) return;
  // Reset the displayed board to empty before playing so the animation reflects
  // the solver's reasoning from scratch.
  const fresh = createBoard(ready.hints.size);
  state.board = fresh;
  renderBoard(boardRoot, fresh, ready.hints, handleToggle);
  fitBoardToArea(boardRoot);

  const { result, trace } = solveWithTrace(ready.hints);
  setStatus(
    `Watching solver — ${trace.length} events. Adjust speed, pause, or stop anytime.`,
    "info",
  );

  state.player = startSolvePlayer({
    trace,
    result,
    board: fresh,
    els,
    onDone: (final) => {
      state.board = final.board;
      reportSolveResult(final);
    },
  });
}

export function startApp(): void {
  const boardRoot = document.getElementById("board-root");
  if (!boardRoot) throw new Error("Missing #board-root");
  const els = findControls();

  wireControls(els, {
    onInitialize: (size, r, c) => handleInitialize(size, r, c, boardRoot, els),
    onSolveInstant: () => handleSolveInstant(boardRoot),
    onSolveAnimated: () => handleSolveAnimated(boardRoot, els),
    onSolveCancel: () => {
      /* no-op */
    },
    onClear: () => handleClear(boardRoot),
    onReset: () => handleReset(boardRoot, els),
    onImageFile: (file) => void handleImageFile(file, els),
  });

  attachKeyboard({
    getBoard: () => state.board,
    onToggle: handleToggle,
    onEscape: () => els.initializeBtn.focus(),
  });

  let resizeRaf = 0;
  window.addEventListener("resize", () => {
    if (!state.board) return;
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      fitBoardToArea(boardRoot);
    });
  });

  setStatus("Enter grid size and hints, then click Initialize.", "info");
}
