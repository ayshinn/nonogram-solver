import type { Board } from "../types";
import { focusCell } from "./boardView";
import type { ToggleKind } from "./boardView";

export interface KeyboardDeps {
  readonly getBoard: () => Board | null;
  readonly onToggle: (r: number, c: number, kind: ToggleKind) => void;
  readonly onEscape: () => void;
}

export function attachKeyboard(deps: KeyboardDeps): void {
  document.addEventListener("keydown", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains("cell")) return;

    const board = deps.getBoard();
    if (!board) return;

    const r = Number(target.dataset.r);
    const c = Number(target.dataset.c);
    if (Number.isNaN(r) || Number.isNaN(c)) return;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        focusCell(Math.max(0, r - 1), c);
        break;
      case "ArrowDown":
        e.preventDefault();
        focusCell(Math.min(board.size - 1, r + 1), c);
        break;
      case "ArrowLeft":
        e.preventDefault();
        focusCell(r, Math.max(0, c - 1));
        break;
      case "ArrowRight":
        e.preventDefault();
        focusCell(r, Math.min(board.size - 1, c + 1));
        break;
      case " ":
      case "f":
      case "F":
        e.preventDefault();
        deps.onToggle(r, c, "fill");
        break;
      case "x":
      case "X":
        e.preventDefault();
        deps.onToggle(r, c, "cross");
        break;
      case "Escape":
        e.preventDefault();
        deps.onEscape();
        break;
    }
  });
}
