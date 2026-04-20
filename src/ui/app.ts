import { CellState, type Board, type Hints } from "../types";
import { createBoard, getCell, setCell } from "../model/board";
import { deriveHintsFromBoard, parseHintText, validateHints } from "../model/hints";
import { parseImageFile } from "../image/parser";
import { solve } from "../solver/index";
import { setStatus } from "./status";
import {
  clearBoardDom,
  focusCell,
  renderBoard,
  updateCell,
  type ToggleKind,
} from "./boardView";
import { findControls, wireControls, type ControlElements } from "./controls";
import { attachKeyboard } from "./keyboard";

interface AppState {
  board: Board | null;
  hints: Hints | null;
}

const state: AppState = { board: null, hints: null };

function handleToggle(r: number, c: number, kind: ToggleKind): void {
  const { board } = state;
  if (!board) return;
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
  renderBoard(boardRoot, state.board, state.hints, handleToggle);
  focusCell(0, 0);
  setStatus(
    `Board ready — ${size}×${size}. Click cells or use arrow keys + Space/X.`,
    "success",
  );
}

function handleClear(boardRoot: HTMLElement): void {
  if (!state.hints || !state.board) return;
  state.board = createBoard(state.board.size);
  renderBoard(boardRoot, state.board, state.hints, handleToggle);
  focusCell(0, 0);
  setStatus("Board cleared.", "info");
}

function handleReset(
  boardRoot: HTMLElement,
  els: ControlElements,
): void {
  state.board = null;
  state.hints = null;
  clearBoardDom(boardRoot);
  els.sizeInput.value = "5";
  els.rowHints.value = "";
  els.colHints.value = "";
  els.imageFile.value = "";
  els.sizeInput.focus();
  setStatus("Reset. Enter hints to start a new puzzle.", "info");
}

function formatHints(hints: readonly (readonly number[])[]): string {
  return hints.map((h) => (h.length === 0 ? "0" : h.join(","))).join("\n");
}

async function handleImageFile(file: File, els: ControlElements): Promise<void> {
  const size = Number.parseInt(els.sizeInput.value, 10);
  if (!Number.isInteger(size) || size < 5 || size > 25) {
    setStatus("Set grid size (5–25) before importing an image.", "error");
    return;
  }
  setStatus(`Parsing image as ${size}×${size} grid…`, "info");
  try {
    const { board, warning } = await parseImageFile(file, size);
    const derived = deriveHintsFromBoard(board);
    els.rowHints.value = formatHints(derived.rows);
    els.colHints.value = formatHints(derived.cols);
    const suffix = warning ? ` ${warning}` : "";
    setStatus(
      `Image parsed. Review the hints, then click Initialize.${suffix}`,
      warning ? "info" : "success",
    );
  } catch (err) {
    setStatus(`Image import failed: ${(err as Error).message}`, "error");
  } finally {
    els.imageFile.value = "";
  }
}

function handleSolve(boardRoot: HTMLElement): void {
  const { hints, board } = state;
  if (!hints || !board) {
    setStatus("Initialize the board before solving.", "error");
    return;
  }
  const result = solve(hints);
  state.board = result.board;
  renderBoard(boardRoot, result.board, hints, handleToggle);
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

export function startApp(): void {
  const boardRoot = document.getElementById("board-root");
  if (!boardRoot) throw new Error("Missing #board-root");
  const els = findControls();

  wireControls(els, {
    onInitialize: (size, r, c) => handleInitialize(size, r, c, boardRoot),
    onSolve: () => handleSolve(boardRoot),
    onClear: () => handleClear(boardRoot),
    onReset: () => handleReset(boardRoot, els),
    onImageFile: (file) => void handleImageFile(file, els),
  });

  attachKeyboard({
    getBoard: () => state.board,
    onToggle: handleToggle,
    onEscape: () => els.initializeBtn.focus(),
  });

  setStatus("Enter grid size and hints, then click Initialize.", "info");
}
