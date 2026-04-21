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
  readonly solveModal: HTMLDialogElement;
  readonly solveModalInstantBtn: HTMLButtonElement;
  readonly solveModalWatchBtn: HTMLButtonElement;
  readonly solveModalCancelBtn: HTMLButtonElement;
  readonly solvePlayerBar: HTMLElement;
  readonly solveSpeed: HTMLInputElement;
  readonly solveSpeedValue: HTMLElement;
  readonly solveStepCounter: HTMLElement;
  readonly solvePauseBtn: HTMLButtonElement;
  readonly solveStopBtn: HTMLButtonElement;
}

export interface ControlHandlers {
  readonly onInitialize: (
    size: number,
    rowText: string,
    colText: string,
  ) => void;
  readonly onSolveInstant: () => void;
  readonly onSolveAnimated: () => void;
  readonly onSolveCancel: () => void;
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
    solveModal: required<HTMLDialogElement>("solveModal"),
    solveModalInstantBtn: required<HTMLButtonElement>("solveModalInstantBtn"),
    solveModalWatchBtn: required<HTMLButtonElement>("solveModalWatchBtn"),
    solveModalCancelBtn: required<HTMLButtonElement>("solveModalCancelBtn"),
    solvePlayerBar: required<HTMLElement>("solvePlayerBar"),
    solveSpeed: required<HTMLInputElement>("solveSpeed"),
    solveSpeedValue: required<HTMLElement>("solveSpeedValue"),
    solveStepCounter: required<HTMLElement>("solveStepCounter"),
    solvePauseBtn: required<HTMLButtonElement>("solvePauseBtn"),
    solveStopBtn: required<HTMLButtonElement>("solveStopBtn"),
  };
}

export function setManualHintsExpanded(
  els: ControlElements,
  expanded: boolean,
): void {
  els.manualInputBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
  els.manualHints.hidden = !expanded;
}

export function openSolveModal(els: ControlElements): void {
  if (typeof els.solveModal.showModal === "function") {
    els.solveModal.showModal();
  } else {
    els.solveModal.setAttribute("open", "");
  }
}

export function closeSolveModal(els: ControlElements): void {
  if (typeof els.solveModal.close === "function") {
    els.solveModal.close();
  } else {
    els.solveModal.removeAttribute("open");
  }
}

export function wireControls(
  els: ControlElements,
  handlers: ControlHandlers,
): void {
  els.initializeBtn.addEventListener("click", () => {
    const size = Number.parseInt(els.sizeInput.value, 10);
    handlers.onInitialize(size, els.rowHints.value, els.colHints.value);
  });
  els.solveBtn.addEventListener("click", () => openSolveModal(els));
  els.solveModalInstantBtn.addEventListener("click", () => {
    closeSolveModal(els);
    handlers.onSolveInstant();
  });
  els.solveModalWatchBtn.addEventListener("click", () => {
    closeSolveModal(els);
    handlers.onSolveAnimated();
  });
  els.solveModalCancelBtn.addEventListener("click", () => {
    closeSolveModal(els);
    handlers.onSolveCancel();
  });
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
  els.solveSpeed.addEventListener("input", () => {
    els.solveSpeedValue.textContent = `${els.solveSpeed.value}\u00a0ms`;
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
