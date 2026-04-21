# Nonogram Solver Web App — Specification

## Overview

A static, client-side nonogram puzzle solver and player deployable to GitHub Pages. Written in **TypeScript**, bundled with **Vite**, tested with **Vitest**. No server, no framework — just vanilla TypeScript + DOM APIs and hand-written modern CSS.

The app supports:

- Manual board setup (size + hint entry) with a polished, responsive UI
- Interactive play with mouse and keyboard
- A correct solver (line-solver constraint propagation with backtracking fallback)
- A minimal image importer for clean solved-board templates (OCR-based screenshot parsing is a documented follow-up phase)
- A Vitest test suite that asserts solver outputs satisfy all row and column constraints

The Python code in `py-solver/` is an older prototype and is out of scope for this spec.

---

## Technology Stack

| Concern | Choice |
|---|---|
| Language | TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`) |
| Bundler / dev server | Vite (`npm run dev`, `npm run build`, `npm run preview`) |
| Test runner | Vitest (`npm test`, `npm run test:watch`) with `jsdom` env and v8 coverage |
| UI | Vanilla TS + DOM APIs — no framework |
| Styling | Hand-written CSS using CSS variables, Grid, Flexbox |
| Deployment | Static `dist/` output published to GitHub Pages via GitHub Actions |

---

## Directory Layout

```
nonogram-solver/
  index.html                   Vite entry at project root
  package.json
  vite.config.ts               Bundler + Vitest config
  tsconfig.json
  spec.md                      This document
  todo.md                      Iterative progress checklist
  .github/workflows/deploy.yml Publishes dist/ to gh-pages (Phase 5)

  src/
    main.ts                    App bootstrap
    types.ts                   Shared domain types

    model/
      board.ts                 Board factory, cloning, indexing, row/col IO
      hints.ts                 parse/validate/derive hints

    solver/
      index.ts                 Public solve(hints, opts): SolveResult
      candidates.ts            Enumerate line placements
      linesolver.ts            Intersection-based single-line solver
      propagate.ts             Board-wide fixed-point with dirty queue
      backtrack.ts             DFS fallback with step + time budget
      validate.ts              satisfies(board, hints) checker

    ui/
      app.ts                   Top-level controller
      boardView.ts             CSS-Grid board render + diff updates
      hintsView.ts             Row/col hint panes
      controls.ts              Size input, buttons, file input
      keyboard.ts              Arrow/space/x/esc focus + actions
      status.ts                aria-live status banner

    image/
      parser.ts                File → ImageBitmap → binary grid → hints
      sampling.ts              Canvas pixel sampling helpers

    styles/
      main.css                 Imports the rest
      variables.css            Theme tokens (colors, spacing, --cell-size)
      layout.css               Page regions, responsive breakpoints
      board.css                Cells, hints, focus states

  test/
    model/hints.test.ts
    solver/candidates.test.ts
    solver/linesolver.test.ts
    solver/validate.test.ts
    solver/solve.puzzles.test.ts
    image/parser.test.ts
    fixtures/puzzles.ts        Known puzzles + solutions

  py-solver/                   Untouched (out of scope)
```

---

## Data Model

All domain types live in `src/types.ts`. Helpers for construction and mutation live in `src/model/`.

```ts
export const enum CellState { Unset = 0, Filled = 1, Empty = 2 }

export type Hint = readonly number[];         // e.g. [3, 1]
export interface Hints {
  rows: Hint[];
  cols: Hint[];
  size: number;                                // N (square grids only)
}

export interface Board {
  readonly size: number;
  cells: Uint8Array;                           // row-major, length size*size
}

export interface Placement { starts: number[] }

export interface SolveOptions {
  maxSteps?: number;                           // default ~500_000
  maxMs?: number;                              // default 2000
}

export interface SolveResult {
  status: 'solved' | 'stuck' | 'contradiction' | 'aborted';
  board: Board;
  steps: number;
  elapsedMs: number;
}
```

Notes:

- Cell state ordering is **`Unset=0, Filled=1, Empty=2`** (changed from the previous prototype's `UNSET=0, EMPTY=1, FILLED=2`; nothing external depends on the old ordering).
- `Board.cells` is a flat `Uint8Array` for cache-friendliness and cheap cloning during backtracking. Index with `r * size + c`.
- Hints are immutable arrays. The `Hints` object fully describes a puzzle (no external state needed to solve it).
- Only square (N×N) grids are supported in this version. Rectangular support is a documented follow-up.

---

## User Flow

### 1. Manual setup
1. User opens the page.
2. User chooses grid size N (5–30).
3. User enters row hints (newline-separated rows, comma-separated numbers) and column hints in the same format.
4. User clicks **Initialize Game**.
5. The app validates input (counts match N, all values positive, each line fits) and renders the interactive board.

### 2. Image import (minimal phase)
1. User sets N in the size input.
2. User chooses a PNG or JPG file (a clean black/white image of a solved board).
3. App loads the image, splits it into N×N equal tiles, samples the center of each tile, thresholds luminance to determine filled/empty.
4. App derives row and column hints from the resulting binary board and populates the hint textareas.
5. User clicks **Initialize Game** to start.

### 3. Play
- Left-click cycles `Unset → Filled → Unset`.
- Right-click (or long-press on touch) cycles `Unset → Empty → Unset`.
- Arrow keys move focus; **Space** or **F** toggles fill; **X** toggles cross; **Esc** returns focus to controls.

### 4. Solve
- User clicks **Solve**.
- The app runs `solve(hints, opts)`:
  1. Line-solver constraint propagation until fixed point.
  2. If `stuck`, backtracking DFS.
- The UI paints the final board and shows status: *solved*, *needs more info* (stuck), *contradiction*, or *gave up* (budget exhausted).
- A post-solve sanity gate calls `satisfies(board, hints)` before declaring success.

### 5. Reset
- **Clear Board** wipes cell state, keeps hints.
- **Reset** wipes hints and board, returns to setup.

---

## Solver Algorithm

### Line candidate enumeration (`src/solver/candidates.ts`)

For a line of length `L` with hint `[s₁, s₂, …, sₖ]`:

- `minSpan = Σsᵢ + (k − 1)` (one mandatory gap between segments).
- `slack = L − minSpan`. Negative slack means the line is unsatisfiable.
- Distribute `slack` extra empty cells across `k + 1` gap slots (leading, between each pair of segments, trailing) by stars-and-bars recursion.
- Filter candidates: reject any placement that puts `Filled` where the line already has `Empty`, or `Empty` where the line has `Filled`.

### Single-line solver (`src/solver/linesolver.ts`)

`solveLine(line, hint)`:
1. Build the filtered candidate set.
2. If empty → contradiction.
3. For each cell, if all surviving candidates agree on its state, set the cell to that state.
4. Return the updated line plus a `changed` flag.

### Board-wide propagation (`src/solver/propagate.ts`)

Fixed-point loop using a dirty-line queue:
1. Seed the queue with every row and column.
2. Pop a line, run `solveLine`. If any cell changed, enqueue the perpendicular lines that crossed those cells.
3. Terminate when the queue drains.
4. Return `'solved'` if every cell is determined, `'stuck'` if any `Unset` remain, `'contradiction'` on empty candidate sets.

### Backtracking (`src/solver/backtrack.ts`)

When propagation returns `'stuck'`:
1. Pick the most-constrained `Unset` cell (minimum candidate count on its row or column).
2. Try `Filled` first: clone the board, recurse through propagate + backtrack.
3. On contradiction, undo and try `Empty`.
4. Bound the search by both `maxSteps` and `maxMs`; return `'aborted'` if exhausted.
5. On the first valid completion, return. (Ambiguous-puzzle detection is a follow-up.)

### Validator (`src/solver/validate.ts`)

`satisfies(board, hints)` walks each row and column, computes `Filled`-run lengths, and compares to the hint arrays. Returns `{ ok: true }` or `{ ok: false, reason, row?, col? }`. Used by the test suite and as a post-solve UI sanity gate.

Reference: Jan Wolter, *Survey of Paint-by-Number Puzzle Solvers* — the intersection method and backtracking structure.

---

## UI Specification

### Layout

- **Header**: title and short usage hint.
- **Controls panel** (left on desktop, stacked above on mobile):
  - Grid size input (`min=5`, `max=30`).
  - Row hints textarea, column hints textarea.
  - File input for image import.
  - Buttons: **Initialize Game**, **Solve**, **Clear Board**, **Reset**.
- **Board area** (center/right): board + col-hints band (top) + row-hints band (left).
- **Status bar** (bottom, `aria-live="polite"`): validation errors, solver status, last action.

### Board rendering

- Implemented with CSS Grid (not `<table>`). Four regions: empty corner, col-hints band, row-hints band, cells.
- Each cell is `<button type="button" data-r="..." data-c="...">` for native focus and keyboard handling.
- Every 5th row and column gets a thicker border via `:nth-child(5n)` selectors.
- Cell size via `--cell-size: clamp(24px, 5vmin, 40px)` for N ≤ 15; shrinks at larger N. N > 20 wraps the board in `overflow: auto; max-height: 80vh`.
- `boardView` renders the DOM once per initialization, then mutates `data-state` and class on only changed cells on subsequent updates.

### Interaction model

- Left-click: `Unset ↔ Filled`.
- Right-click / long-press: `Unset ↔ Empty`.
- Keyboard:
  - Arrow keys: move focus one cell.
  - `Space` or `F`: toggle fill.
  - `X`: toggle cross/empty.
  - `Esc`: return focus to controls.
  - `Tab`: follow document order.

### Visual states

- `--color-filled`, `--color-empty`, `--color-unset`, `--color-accent` in `variables.css`.
- Filled cells: solid fill.
- Empty cells: subtle SVG X as a CSS background (scales cleanly at any cell size).
- Contradictions: `aria-invalid="true"` → red outline.
- `:focus-visible`: 2px accent outline inside the cell.
- Light + dark theme via `prefers-color-scheme` and CSS variables.

### Responsive behavior

- Default: two-column flex (controls | board).
- `≤ 720px`: controls stack above the board; textareas span full width; board region scrolls horizontally if cells overflow.

---

## Image Import (Minimal Phase)

**Scope**: a clean black-and-white image of a solved nonogram board (no hint numbers in the image, tightly cropped, approximately square).

**Flow** (`src/image/parser.ts`, `src/image/sampling.ts`):

1. `<input type="file" accept="image/png,image/jpeg">` fires a change event.
2. `createImageBitmap(file)` loads the image without layout.
3. Draw into an `OffscreenCanvas` (fallback: hidden `<canvas>` for older Safari).
4. User has already set N in the size input.
5. Divide the image into N×N equal tiles.
6. For each tile, sample the center 60% and average pixel luminance (`0.299R + 0.587G + 0.114B`).
7. Threshold at 128: dark = `Filled`, light = `Empty`.
8. Emit a `Board` and run `deriveHintsFromBoard` to produce `Hints`.
9. Populate the hint textareas and initialize the board.

**Out of scope for this phase** (documented as follow-ups in `todo.md`):
- Grid-line autodetection (locate N and tile bounds when the image is not perfectly cropped).
- OCR of hint numbers in actual nonogram-game screenshots (Tesseract.js or similar).

---

## Testing Strategy

Vitest, configured in `vite.config.ts`:

```ts
test: { environment: 'jsdom', globals: true, coverage: { provider: 'v8' } }
```

### Minimum test suite

- `test/model/hints.test.ts` — `parseHintText`, `validateHints`, `deriveHintsFromBoard` round-trips, rejection of malformed inputs.
- `test/solver/candidates.test.ts` — candidate counts match a brute-force enumerator for small cases; filter respects known cells.
- `test/solver/linesolver.test.ts` — classic overlap (hint `[7]` in length-10 fixes cells 3–6); empty candidate set ⇒ contradiction; already-solved line ⇒ `changed: false`.
- `test/solver/validate.test.ts` — `satisfies` returns `ok: true` on known solutions and a pinpointed failure on off-by-one boards.
- `test/solver/solve.puzzles.test.ts` — fixtures at 5×5, 10×10, 15×15, including at least one puzzle that requires backtracking. **Critical invariant**: every `solve()` result with `status === 'solved'` must pass `satisfies(result.board, hints)`. This is the constraint-satisfaction gate.
- `test/image/parser.test.ts` — synthetic `ImageData` built from a known board, round-tripped through the parser, derived hints match the original.

### Deferred

- DOM interaction tests (Playwright or @testing-library/dom) — see `todo.md` follow-ups.

---

## Validation & Error Handling

- Hint count must equal N for both rows and columns.
- All hint numbers must be positive integers.
- Each line's hints must satisfy `sum + (count − 1) ≤ N`.
- Image uploads must be PNG or JPG; invalid types show an inline error.
- Image parsing errors (wrong aspect ratio, unreadable pixels) show a warning banner.
- Solver post-run: if `satisfies(board, hints).ok === false`, show a contradiction banner with the offending row/column.

---

## Implementation Phases

Each phase ships an app that still runs. See `todo.md` for per-item acceptance criteria.

- **Phase 0 — Tooling bootstrap.** `package.json`, `vite.config.ts`, `tsconfig.json`, `.gitignore`. `src/main.ts` imports existing legacy JS/CSS so the current UI still renders under Vite. `npm run build` produces a working `dist/`.
- **Phase 1 — Domain model + UI rewrite.** Introduce `src/types.ts`, `src/model/*`, `src/ui/*`, `src/styles/*`. Replace the legacy table with the new CSS-Grid board, keyboard nav, responsive layout. Solve button shows a "not wired yet" toast. Delete legacy `js/setup.js` and `css/style.css`.
- **Phase 2 — Line solver + propagation.** Implement `candidates`, `linesolver`, `propagate`, `validate`. Wire `solve()`. Tests for fully line-solvable puzzles.
- **Phase 3 — Backtracking fallback.** Implement `backtrack.ts`, wire into `solve()`, enforce step + time budget. Tests for guess-required puzzles and abort paths.
- **Phase 4 — Image importer (minimal).** `src/image/*` + file input + round-trip test.
- **Phase 5 — Polish + deploy.** GitHub Actions workflow to publish `dist/` to `gh-pages`. Accessibility pass, README refresh, perf check (N=25 typical puzzles under 100 ms).

---

## GitHub Pages Deployment

- The build output (`dist/`) is fully static.
- `vite.config.ts` sets `base: './'` so the site works at any sub-path.
- `.github/workflows/deploy.yml` (Phase 5) builds on push to `main` and publishes `dist/` to the `gh-pages` branch.

---

## Success Criteria

- Manual hint entry, play, and solve work end-to-end in the browser.
- The solver solves every puzzle in the test fixtures, and every solved output passes `satisfies`.
- A clean solved-board image can be parsed into a board + correct hints.
- `npm test`, `npm run build`, and `npm run preview` all succeed in CI.
- The site deploys to GitHub Pages and works when opened from the published URL.

---

## Future Improvements

- OCR-based screenshot parsing (Tesseract.js) for actual nonogram-game screenshots, including hint extraction.
- Grid-line autodetection in image import so N does not need to be pre-specified.
- Ambiguous-puzzle detection (search for a second valid completion).
- Drag-paint: click-and-drag to apply the same transition across multiple cells.
- Undo / redo stack.
- Save / load via `localStorage` and shareable URL encoding.
- Step-by-step solver visualization (replay).
- Rectangular grids (requires `Hints.size` → `{ rows; cols }` refactor).
- Playwright end-to-end test suite.
- Web Worker offload for large solves so the UI stays responsive.
