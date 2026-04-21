import { CellState, type Board, type Hints } from "../types";
import { getCell } from "../model/board";
import { renderHintBand } from "./hintsView";

export type ToggleKind = "fill" | "cross";
export type CellToggleHandler = (r: number, c: number, kind: ToggleKind) => void;

let cellEls: HTMLButtonElement[][] = [];

export function renderBoard(
  root: HTMLElement,
  board: Board,
  hints: Hints,
  onToggle: CellToggleHandler,
): void {
  root.innerHTML = "";
  root.style.setProperty("--n", String(board.size));
  root.dataset.size = String(board.size);

  const corner = document.createElement("div");
  corner.className = "board-corner";

  const colBand = document.createElement("div");
  colBand.className = "board-col-hints";
  renderHintBand(colBand, hints.cols, "col");

  const rowBand = document.createElement("div");
  rowBand.className = "board-row-hints";
  renderHintBand(rowBand, hints.rows, "row");

  const cellsGrid = document.createElement("div");
  cellsGrid.className = "board-cells";

  cellEls = [];
  for (let r = 0; r < board.size; r++) {
    const row: HTMLButtonElement[] = [];
    for (let c = 0; c < board.size; c++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cell";
      if ((r + 1) % 5 === 0 && r < board.size - 1) {
        btn.classList.add("cell--section-bottom");
      }
      if ((c + 1) % 5 === 0 && c < board.size - 1) {
        btn.classList.add("cell--section-right");
      }
      btn.dataset.r = String(r);
      btn.dataset.c = String(c);
      const state = getCell(board, r, c);
      btn.dataset.state = String(state);
      btn.setAttribute("aria-label", ariaLabel(r, c, state));
      // -1 keeps cells out of the Tab sequence; arrow keys move focus instead.
      btn.tabIndex = r === 0 && c === 0 ? 0 : -1;

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        onToggle(r, c, "fill");
      });
      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        onToggle(r, c, "cross");
      });

      row.push(btn);
      cellsGrid.appendChild(btn);
    }
    cellEls.push(row);
  }

  root.appendChild(corner);
  root.appendChild(colBand);
  root.appendChild(rowBand);
  root.appendChild(cellsGrid);
}

export function updateCell(r: number, c: number, state: CellState): void {
  const el = cellEls[r]?.[c];
  if (!el) return;
  el.dataset.state = String(state);
  el.setAttribute("aria-label", ariaLabel(r, c, state));
}

export function setCellTentative(r: number, c: number, tentative: boolean): void {
  const el = cellEls[r]?.[c];
  if (!el) return;
  if (tentative) {
    el.dataset.tentative = "true";
  } else {
    delete el.dataset.tentative;
  }
}

export function flashCellUnwind(r: number, c: number): void {
  const el = cellEls[r]?.[c];
  if (!el) return;
  el.dataset.unwinding = "true";
  // Clear on next frame so CSS can animate the transition.
  setTimeout(() => {
    const cur = cellEls[r]?.[c];
    if (cur) delete cur.dataset.unwinding;
  }, 180);
}

export function highlightLine(
  kind: "row" | "col",
  index: number,
  on: boolean,
): void {
  const size = cellEls.length;
  if (size === 0) return;
  if (kind === "row") {
    const row = cellEls[index];
    if (!row) return;
    for (const el of row) {
      if (on) el.dataset.activeLine = "true";
      else delete el.dataset.activeLine;
    }
  } else {
    for (let r = 0; r < size; r++) {
      const el = cellEls[r]?.[index];
      if (!el) continue;
      if (on) el.dataset.activeLine = "true";
      else delete el.dataset.activeLine;
    }
  }
}

export function clearAllHighlights(): void {
  for (const row of cellEls) {
    for (const el of row) {
      delete el.dataset.activeLine;
      delete el.dataset.tentative;
      delete el.dataset.unwinding;
    }
  }
}

export function focusCell(r: number, c: number): void {
  const previous = document.activeElement;
  if (previous instanceof HTMLElement && previous.classList.contains("cell")) {
    previous.tabIndex = -1;
  }
  const el = cellEls[r]?.[c];
  if (!el) return;
  el.tabIndex = 0;
  el.focus();
}

export function clearBoardDom(root: HTMLElement): void {
  root.innerHTML = "";
  cellEls = [];
}

function ariaLabel(r: number, c: number, state: CellState): string {
  const tone =
    state === CellState.Filled
      ? "filled"
      : state === CellState.Empty
        ? "empty"
        : "unset";
  return `row ${r + 1} column ${c + 1}, ${tone}`;
}
