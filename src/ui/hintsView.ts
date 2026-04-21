import type { Hint } from "../types";

export type HintAxis = "row" | "col";

const hintEls: Record<HintAxis, HTMLDivElement[]> = {
  row: [],
  col: [],
};

export function renderHintBand(
  container: HTMLElement,
  hints: readonly Hint[],
  axis: HintAxis,
): void {
  container.innerHTML = "";
  const baseClass = axis === "row" ? "row-hints" : "col-hints";
  const sectionClass =
    axis === "row" ? "row-hints--section-bottom" : "col-hints--section-right";

  hintEls[axis] = [];

  for (let i = 0; i < hints.length; i++) {
    const cell = document.createElement("div");
    cell.className = baseClass;
    if ((i + 1) % 5 === 0 && i < hints.length - 1) {
      cell.classList.add(sectionClass);
    }
    const hint = hints[i]!;
    if (hint.length === 0) {
      const zero = document.createElement("span");
      zero.className = "hint-number hint-number--empty";
      zero.textContent = "0";
      cell.appendChild(zero);
    } else {
      for (const n of hint) {
        const span = document.createElement("span");
        span.className = "hint-number";
        span.textContent = String(n);
        cell.appendChild(span);
      }
    }
    container.appendChild(cell);
    hintEls[axis].push(cell);
  }
}

export function highlightHint(
  axis: HintAxis,
  index: number,
  on: boolean,
): void {
  const el = hintEls[axis][index];
  if (!el) return;
  if (on) el.dataset.activeLine = "true";
  else delete el.dataset.activeLine;
}

export function clearHintHighlights(): void {
  for (const axis of ["row", "col"] as const) {
    for (const el of hintEls[axis]) {
      delete el.dataset.activeLine;
    }
  }
}
