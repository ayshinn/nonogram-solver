export interface ControlElements {
  readonly sizeInput: HTMLInputElement;
  readonly rowHints: HTMLTextAreaElement;
  readonly colHints: HTMLTextAreaElement;
  readonly rowHintsGutter: HTMLElement;
  readonly colHintsGutter: HTMLElement;
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
    rowHintsGutter: required<HTMLElement>("rowHintsGutter"),
    colHintsGutter: required<HTMLElement>("colHintsGutter"),
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
  refreshHintLineNumbers(els);
}

// Renders a "1\n2\n3..." string into the gutter sized to the textarea's
// current line count (or row count, whichever is greater so the gutter doesn't
// look stubby when the field is empty). Re-call after programmatically setting
// `textarea.value`; input events handle user typing automatically.
function renderGutter(textarea: HTMLTextAreaElement, gutter: HTMLElement): void {
  const text = textarea.value;
  const lineCount = text === "" ? 0 : text.split("\n").length;
  const minRows = textarea.rows || 1;
  const n = Math.max(lineCount, minRows);
  let s = "";
  for (let i = 1; i <= n; i++) s += i + (i < n ? "\n" : "");
  gutter.textContent = s;
  gutter.scrollTop = textarea.scrollTop;
}

export function attachHintLineNumbers(els: ControlElements): void {
  const pairs: [HTMLTextAreaElement, HTMLElement][] = [
    [els.rowHints, els.rowHintsGutter],
    [els.colHints, els.colHintsGutter],
  ];
  for (const [ta, gut] of pairs) {
    renderGutter(ta, gut);
    ta.addEventListener("input", () => renderGutter(ta, gut));
    ta.addEventListener("scroll", () => {
      gut.scrollTop = ta.scrollTop;
    });
  }
}

export function refreshHintLineNumbers(els: ControlElements): void {
  renderGutter(els.rowHints, els.rowHintsGutter);
  renderGutter(els.colHints, els.colHintsGutter);
}

function required<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing required element: #${id}`);
  return el as T;
}
