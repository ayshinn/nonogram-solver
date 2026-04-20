# Nonogram Solver — Iterative Progress

Phase-by-phase checklist. Each phase should ship a working app. See `spec.md` for the full design.

---

## Phase 0 — Tooling Bootstrap

Goal: introduce Vite + TypeScript + Vitest without changing runtime behavior.

- [x] Add `package.json` with `vite`, `typescript`, `vitest`, `@types/node`, `@vitest/coverage-v8`.
- [x] Scripts: `dev`, `build`, `preview`, `test`, `test:watch`, `typecheck`.
- [x] Add `vite.config.ts` (`base: './'`, Vitest block with `environment: 'jsdom'`, `globals: true`, v8 coverage).
- [x] Add `tsconfig.json` (`strict`, `noUncheckedIndexedAccess`, `module: ESNext`, `moduleResolution: bundler`, `target: ES2022`).
- [x] Extend `.gitignore` for `node_modules`, `dist`, `coverage`.
- [x] Create `src/main.ts` that imports the legacy `js/setup.js` and `css/style.css` so the current UI renders unchanged under Vite.
- [x] Rewrite `index.html` to load `<script type="module" src="/src/main.ts">` and remove inline `onclick` handlers (wire via `main.ts`).

**Acceptance**: `npm install` → `npm run dev` serves a working page identical to the current prototype. `npm run build` produces `dist/`. `npm run preview` serves the build.

---

## Phase 1 — Domain Model + UI Rewrite (no solver)

Goal: real types, real UI, keyboard nav, responsive layout. Manual play works; solver button is a stub.

### Domain model
- [x] `src/types.ts` with `CellState`, `Hint`, `Hints`, `Board`, `Placement`, `SolveResult`, `SolveOptions`.
- [x] `src/model/board.ts`: `createBoard`, `cloneBoard`, `getCell`, `setCell`, `getRow`, `getCol`, `setRow`, `setCol`, `isComplete`.
- [x] `src/model/hints.ts`: `parseHintText`, `validateHints`, `deriveHintsFromBoard`.

### UI
- [x] `src/ui/app.ts` as top-level controller.
- [x] `src/ui/controls.ts`: size input, textareas, buttons (Initialize / Solve / Clear / Reset). *File input deferred to Phase 4.*
- [x] `src/ui/hintsView.ts`: row + column hint bands.
- [x] `src/ui/boardView.ts`: CSS-Grid board render; diff-update by `data-state` attribute on changed cells only.
- [x] `src/ui/keyboard.ts`: arrow movement, Space/F fill, X cross, Esc returns focus.
- [x] `src/ui/status.ts`: `aria-live="polite"` banner for errors + solver status.

### Styles
- [x] `src/styles/variables.css`: color tokens, `--cell-size`, spacing, light + dark theme.
- [x] `src/styles/layout.css`: header, controls, board region, responsive breakpoint at ≤720px.
- [x] `src/styles/board.css`: cell visual states, 5n borders, focus ring, X for empty cells (pseudo-element; SVG-background upgrade deferred to Phase 5 polish).
- [x] `src/styles/main.css`: imports the above.

### Cleanup
- [x] Delete legacy `js/setup.js` and `css/style.css`.
- [x] Remove any references to them from `index.html` / `main.ts`.

### Tests
- [x] `test/model/hints.test.ts` — parse/validate/derive happy paths + rejection cases.
- [x] `test/fixtures/puzzles.ts` — seed a few known puzzles with solutions.

**Acceptance**: user can set N, enter hints, initialize the board, fill/cross cells with mouse and keyboard, on desktop and mobile viewport sizes. `npm test` green.

---

## Phase 2 — Line Solver + Propagation

Goal: `solve()` works for puzzles that don't require guessing.

- [x] `src/solver/candidates.ts`: enumerate placements via stars-and-bars over slack; filter against known cells.
- [x] `src/solver/linesolver.ts`: intersection-based `solveLine(line, hint)`.
- [x] `src/solver/propagate.ts`: dirty-line fixed-point loop.
- [x] `src/solver/validate.ts`: `satisfies(board, hints)`.
- [x] `src/solver/index.ts`: public `solve(hints, opts)` calling propagate (returns `solved` or `stuck`).
- [x] UI wiring in `app.ts`: Solve button calls `solve()`, paints result, shows status.
- [x] On `stuck`: preserve partial fill, display "needs more info — try backtracking in Phase 3".

### Tests
- [x] `test/solver/candidates.test.ts` — count + filter correctness.
- [x] `test/solver/linesolver.test.ts` — classic overlap, contradiction, idempotence.
- [x] `test/solver/validate.test.ts` — ok cases + pinpointed failure cases.
- [x] `test/solver/solve.puzzles.test.ts` — line-solvable 5×5, 10×10, 15×15 fixtures.
- [x] **Invariant**: every `status === 'solved'` result passes `satisfies(result.board, hints)`.

**Acceptance**: solving a fixture puzzle in the browser paints the correct solution. Tests green.

---

## Phase 3 — Backtracking Fallback

Goal: `solve()` handles guess-required puzzles and enforces a budget.

- [x] `src/solver/backtrack.ts`: DFS with most-constrained-cell heuristic, Filled-first, step + time budget.
- [x] Extend `solve()`: if propagate returns `stuck`, call backtrack.
- [x] Return `aborted` when budget exhausted; UI surfaces "solver gave up".
- [x] Default `maxSteps = 500_000`, `maxMs = 2000` (overridable via `SolveOptions`).

### Tests
- [x] Puzzle in fixtures that requires backtracking; solver returns `solved` and passes `satisfies`.
- [x] Contradiction propagation: contradictory hints → `status: 'contradiction'`.
- [x] Budget exhaustion test: synthetic hard input → `status: 'aborted'`.

**Acceptance**: every fixture puzzle solves in the browser. Hard/ambiguous puzzles show a clear status.

---

## Phase 4 — Image Importer (Minimal)

Goal: upload a clean B&W solved-board image → derived hints populate the UI.

- [x] `src/image/sampling.ts`: `sampleTile(imageData, x, y, w, h)` → mean luminance.
- [x] `src/image/parser.ts`: File → `ImageBitmap` → `OffscreenCanvas` (with hidden `<canvas>` fallback) → N×N tile sampling → binary `Board`.
- [x] Wire file input in `controls.ts`: after parse, call `deriveHintsFromBoard`, populate textareas, initialize board.
- [x] Error UI: invalid file type, parse failure, aspect-ratio warning.

### Tests
- [x] `test/image/parser.test.ts`: synthetic `ImageData` from a known board, round-trip through parser, assert derived hints match.

**Acceptance**: the user can upload a known solved-board PNG and see correct hints + board appear.

---

## Phase 5 — Polish + Deploy

- [x] `.github/workflows/deploy.yml`: build on push to `main`, publish `dist/` to `gh-pages`.
- [x] Accessibility pass: `aria-label` on each cell (`"row 3 column 5, filled"`), `aria-live` status banner, color-contrast check (WCAG AA).
- [x] Performance pass: confirm N=25 typical puzzles solve under 100 ms.
- [x] README refresh: controls reference, keyboard shortcuts, build + deploy instructions.
- [x] Add favicon + title polish.

**Acceptance**: deployed GitHub Pages URL works end-to-end; Lighthouse accessibility ≥ 95.

---

## Phase 6 — Screenshot Hint OCR (replaces Phase 4)

Goal: upload a screenshot of an **unsolved** nonogram puzzle (hint numbers arranged around an empty grid) and have the app extract the hints (and ideally grid size) automatically — the flow users actually want.

**Phase 4's solved-board pixel importer is removed in this phase.** The existing `#imageFile` input is repurposed for screenshot uploads. Generic utilities (`bitmapToImageData`, `sampleTile`) are retained.

### Scope assumptions

- Input is a reasonably clean screenshot from a nonogram app or print (not a photo with perspective distortion).
- Top band contains column-hint numbers; left band contains row-hint numbers; the grid region is empty or mostly empty.
- Puzzle is square; rectangular puzzles are deferred (already in follow-ups).

### Cleanup (from Phase 4)

- [x] Remove `parseImageData` and `parseImageFile` from `src/image/parser.ts` (keep `bitmapToImageData`).
- [x] Delete `test/image/parser.test.ts`.
- [x] Update the `#imageFile` field label in `index.html` from "solved-board image" to "puzzle screenshot".

### Pipeline

- [x] `src/image/detectGrid.ts`: locate the grid region.
  - Convert to grayscale, compute horizontal + vertical projection profiles of dark pixels (reuse `sampleTile` for sub-region luminance).
  - Find the largest axis-aligned rectangular region with regularly-spaced strong dark lines (the grid).
  - Return `{ gridBox: {x,y,w,h}, cellSize, n }`.
  - Fall back to the user-entered N if detection confidence is low.
- [x] `src/image/extractHintRegions.ts`: given the grid box, slice the image into per-row and per-column hint strips.
  - Column hints = image region above the grid, split into N vertical strips by grid column lines.
  - Row hints = region to the left of the grid, split into N horizontal strips by grid row lines.
- [x] `src/image/ocr.ts`: wrap Tesseract.js (`npm i tesseract.js`) with a digit-whitelisted recognizer.
  - Whitelist `0-9` only (`tessedit_char_whitelist`).
  - Pre-binarize strips (adaptive threshold) before OCR to boost digit accuracy.
  - Parse multi-digit tokens per strip; split on whitespace or newline; reject non-numeric junk.
  - Return `number[]` per strip (empty array → `[]`, meaning no filled cells on that line).
- [x] `src/image/screenshotParser.ts`: orchestrate detectGrid → extractHintRegions → ocr → assemble `Hints`. Reuse `bitmapToImageData` for File → ImageData.
- [x] Tesseract worker lifecycle: lazy-load on first use, reuse worker across strips, terminate on reset.

### UI

- [x] Update `handleImageFile` in `src/ui/app.ts` to call `screenshotParser` instead of the old solved-board pipeline.
- [x] Loading indicator while OCR runs (Tesseract is slow — seconds on larger grids).
- [x] **Hint review UX** — populate the textareas as before, but flag low-confidence entries.
  - Status banner: "Imported — review highlighted hints before Initialize."
  - Per-line confidence from Tesseract: `.field-warning` element under each textarea lists low-confidence line numbers.
- [x] On OCR failure: clear error status, leave textareas untouched.

### Tests

- [x] `test/image/detectGrid.test.ts`: synthetic images with known grid positions, assert detection to ±1 pixel.
- [x] `test/image/extractHintRegions.test.ts`: strip bounds + `cropImageData` sub-rectangle copy.
- [ ] `test/image/screenshotParser.test.ts`: one or two checked-in real screenshots + expected hints (golden-file test). **Deferred** — running real Tesseract in CI is slow and flaky; verify manually with `npm run dev` until we have a lightweight fixture.
- [x] Graceful-failure tests: noisy input (`detectGrid` returns null for image without a grid), small-n rejected.

### Non-goals for this phase

- Handwriting / stylized fonts (only printed digits in the screenshot).
- Skewed or rotated screenshots (require perspective correction first).
- Multi-color or themed puzzle skins.
- Rectangular grids (tracked separately in follow-ups).
- Auto-initializing the board after import (user still clicks Initialize).

**Acceptance**: user uploads a screenshot of a well-formed unsolved puzzle from a common nonogram app, clicks a single button, sees the hints populated correctly enough that Initialize + Solve reconstructs the intended solution. At least one golden-file test passes in CI. Phase 4 pixel-import code is gone.

---

## Follow-ups (out of scope for initial rewrite)

- [ ] Ambiguous-puzzle detection (search for a second valid completion).
- [ ] Drag-paint (click-and-drag applies the same transition across multiple cells).
- [ ] Undo / redo stack.
- [ ] Save / load via `localStorage` and shareable URL encoding.
- [ ] Step-by-step solver visualization (replay mode).
- [ ] Rectangular grids (refactor `Hints.size: number` → `{ rows; cols }`).
- [ ] Playwright end-to-end test suite.
- [ ] Web Worker offload for large solves to keep the UI responsive.
