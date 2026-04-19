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

- [ ] `src/solver/backtrack.ts`: DFS with most-constrained-cell heuristic, Filled-first, step + time budget.
- [ ] Extend `solve()`: if propagate returns `stuck`, call backtrack.
- [ ] Return `aborted` when budget exhausted; UI surfaces "solver gave up".
- [ ] Default `maxSteps = 500_000`, `maxMs = 2000` (overridable via `SolveOptions`).

### Tests
- [ ] Puzzle in fixtures that requires backtracking; solver returns `solved` and passes `satisfies`.
- [ ] Contradiction propagation: contradictory hints → `status: 'contradiction'`.
- [ ] Budget exhaustion test: synthetic hard input → `status: 'aborted'`.

**Acceptance**: every fixture puzzle solves in the browser. Hard/ambiguous puzzles show a clear status.

---

## Phase 4 — Image Importer (Minimal)

Goal: upload a clean B&W solved-board image → derived hints populate the UI.

- [ ] `src/image/sampling.ts`: `sampleTile(imageData, x, y, w, h)` → mean luminance.
- [ ] `src/image/parser.ts`: File → `ImageBitmap` → `OffscreenCanvas` (with hidden `<canvas>` fallback) → N×N tile sampling → binary `Board`.
- [ ] Wire file input in `controls.ts`: after parse, call `deriveHintsFromBoard`, populate textareas, initialize board.
- [ ] Error UI: invalid file type, parse failure, aspect-ratio warning.

### Tests
- [ ] `test/image/parser.test.ts`: synthetic `ImageData` from a known board, round-trip through parser, assert derived hints match.

**Acceptance**: the user can upload a known solved-board PNG and see correct hints + board appear.

---

## Phase 5 — Polish + Deploy

- [ ] `.github/workflows/deploy.yml`: build on push to `main`, publish `dist/` to `gh-pages`.
- [ ] Accessibility pass: `aria-label` on each cell (`"row 3 column 5, filled"`), `aria-live` status banner, color-contrast check (WCAG AA).
- [ ] Performance pass: confirm N=25 typical puzzles solve under 100 ms.
- [ ] README refresh: controls reference, keyboard shortcuts, build + deploy instructions.
- [ ] Add favicon + title polish.

**Acceptance**: deployed GitHub Pages URL works end-to-end; Lighthouse accessibility ≥ 95.

---

## Follow-ups (out of scope for initial rewrite)

- [ ] OCR-based screenshot parsing (Tesseract.js) for actual nonogram-game screenshots with hint numbers.
- [ ] Grid-line autodetection so N does not need to be pre-set for image import.
- [ ] Ambiguous-puzzle detection (search for a second valid completion).
- [ ] Drag-paint (click-and-drag applies the same transition across multiple cells).
- [ ] Undo / redo stack.
- [ ] Save / load via `localStorage` and shareable URL encoding.
- [ ] Step-by-step solver visualization (replay mode).
- [ ] Rectangular grids (refactor `Hints.size: number` → `{ rows; cols }`).
- [ ] Playwright end-to-end test suite.
- [ ] Web Worker offload for large solves to keep the UI responsive.
