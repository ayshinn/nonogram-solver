export interface ControlElements {
  readonly sizeInput: HTMLInputElement;
  readonly rowHints: HTMLTextAreaElement;
  readonly colHints: HTMLTextAreaElement;
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
}

export function findControls(): ControlElements {
  return {
    sizeInput: required<HTMLInputElement>("gridSize"),
    rowHints: required<HTMLTextAreaElement>("rowHints"),
    colHints: required<HTMLTextAreaElement>("colHints"),
    initializeBtn: required<HTMLButtonElement>("initializeBtn"),
    solveBtn: required<HTMLButtonElement>("solveBtn"),
    clearBtn: required<HTMLButtonElement>("clearBtn"),
    resetBtn: required<HTMLButtonElement>("resetBtn"),
  };
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
