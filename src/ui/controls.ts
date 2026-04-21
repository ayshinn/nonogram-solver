export interface ControlElements {
  readonly sizeInput: HTMLInputElement;
  readonly rowHints: HTMLTextAreaElement;
  readonly colHints: HTMLTextAreaElement;
  readonly rowHintsWarning: HTMLElement;
  readonly colHintsWarning: HTMLElement;
  readonly imageFile: HTMLInputElement;
  readonly manualInputBtn: HTMLButtonElement;
  readonly manualHints: HTMLElement;
  readonly initializeBtn: HTMLButtonElement;
  readonly solveBtn: HTMLButtonElement;
  readonly clearBtn: HTMLButtonElement;
  readonly resetBtn: HTMLButtonElement;
}

export interface ControlHandlers {
  readonly onInitialize: (
    size: number,
    rowText: string,
    colText: string,
  ) => void;
  readonly onSolve: () => void;
  readonly onClear: () => void;
  readonly onReset: () => void;
  readonly onImageFile: (file: File) => void;
}

export function findControls(): ControlElements {
  return {
    sizeInput: required<HTMLInputElement>("gridSize"),
    rowHints: required<HTMLTextAreaElement>("rowHints"),
    colHints: required<HTMLTextAreaElement>("colHints"),
    rowHintsWarning: required<HTMLElement>("rowHintsWarning"),
    colHintsWarning: required<HTMLElement>("colHintsWarning"),
    imageFile: required<HTMLInputElement>("imageFile"),
    manualInputBtn: required<HTMLButtonElement>("manualInputBtn"),
    manualHints: required<HTMLElement>("manualHints"),
    initializeBtn: required<HTMLButtonElement>("initializeBtn"),
    solveBtn: required<HTMLButtonElement>("solveBtn"),
    clearBtn: required<HTMLButtonElement>("clearBtn"),
    resetBtn: required<HTMLButtonElement>("resetBtn"),
  };
}

export function setManualHintsExpanded(
  els: ControlElements,
  expanded: boolean,
): void {
  els.manualInputBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
  els.manualHints.hidden = !expanded;
}

export function wireControls(
  els: ControlElements,
  handlers: ControlHandlers,
): void {
  els.initializeBtn.addEventListener("click", () => {
    const size = Number.parseInt(els.sizeInput.value, 10);
    handlers.onInitialize(size, els.rowHints.value, els.colHints.value);
  });
  els.solveBtn.addEventListener("click", handlers.onSolve);
  els.clearBtn.addEventListener("click", handlers.onClear);
  els.resetBtn.addEventListener("click", handlers.onReset);
  els.imageFile.addEventListener("change", () => {
    const file = els.imageFile.files?.[0];
    if (file) handlers.onImageFile(file);
  });
  els.manualInputBtn.addEventListener("click", () => {
    const expanded = els.manualInputBtn.getAttribute("aria-expanded") === "true";
    setManualHintsExpanded(els, !expanded);
  });
}

export function clearHintTextareas(els: ControlElements): void {
  els.rowHints.value = "";
  els.colHints.value = "";
}

function required<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing required element: #${id}`);
  return el as T;
}
