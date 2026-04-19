# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install        # install dependencies
npm run dev        # local dev server at http://localhost:5173
npm run build      # typecheck + production build → dist/
npm run preview    # serve the production build
npm test           # run Vitest
npm run test:watch # Vitest watch mode
npm run typecheck  # tsc --noEmit only
```

## Project Context

Browser-based nonogram puzzle player and solver. Vite + TypeScript + Vitest, no framework, vanilla DOM APIs, hand-written CSS. Deployable as a static site on GitHub Pages (`base: './'` in vite.config.ts).

Phase-by-phase implementation plan is in `spec.md` (full spec) and `todo.md` (checklist). Phases 0 and 1 are complete. The plan file at `~/.claude/plans/focus-purely-on-the-mellow-marshmallow.md` has the full design rationale and working agreement.

**Working agreement**: check off items in `todo.md` as they are completed.

## Architecture

### Core types (`src/types.ts`)
- `CellState` — `as const` object: `Unset=0, Filled=1, Empty=2`
- `Board` — `{ size: number; cells: Uint8Array }` flat row-major array; index via `r * size + c`
- `Hints` — `{ rows, cols, size }` where each row/col is `readonly number[]`
- `SolveResult` — `{ status: 'solved'|'stuck'|'contradiction'|'aborted'; board; steps; elapsedMs }`

### Model (`src/model/`)
- `board.ts` — `createBoard`, `cloneBoard`, `getCell`, `setCell`, `getRow`, `getCol`, `setRow`, `setCol`, `isComplete`
- `hints.ts` — `parseHintText(text, size)` (newline/comma separated, lone `0` = empty hint, pads/truncates to size), `validateHints` (count, positivity, min-span, row/col totals), `deriveHintsFromBoard`

### Solver (`src/solver/`) — Phase 2–3, not yet implemented
Per spec: `candidates.ts` (stars-and-bars placement enumeration), `linesolver.ts` (intersection-based fixing), `propagate.ts` (dirty-queue fixed-point), `backtrack.ts` (DFS with step + wall-clock budget), `validate.ts` (`satisfies(board, hints)` — the critical invariant test: every `status === 'solved'` result must pass this).

### UI (`src/ui/`)
- `app.ts` — state machine (`board`, `hints`), coordinates all handlers
- `boardView.ts` — renders CSS-Grid board once; diff-updates via `data-state` attribute. Exports `renderBoard`, `updateCell`, `focusCell`, `clearBoardDom`
- `hintsView.ts` — renders row/col hint bands
- `controls.ts` — wires 4 buttons (Initialize / Solve / Clear Board / Reset) + exposes `ControlElements`
- `keyboard.ts` — arrow keys move focus (`focusCell`), Space/F fills, X crosses, Esc returns to controls
- `status.ts` — `setStatus(msg, tone)` updates `#statusBar` aria-live region

### Styles (`src/styles/`)
- `variables.css` — CSS tokens + light/dark theme via `prefers-color-scheme`. Key: `--cell-size: clamp(22px, 4.5vmin, 34px)`, `--n` set by boardView on the board root.
- `layout.css` — two-column desktop layout, stacks at ≤720px, sticky controls panel
- `board.css` — 4-region CSS Grid (corner / col-hints / row-hints / cells). Cells are `<button data-r data-c data-state>`. Thicker borders on every 5th row/col via `.cell--section-right` / `.cell--section-bottom` classes added at render time. `data-state="1"` = filled (solid), `data-state="2"` = empty (X via ::before/::after pseudo-elements).

### Tests (`test/`)
- `fixtures/puzzles.ts` — `plus3x3`, `plus5x5`, `heart5x5` with verified hints + solutions
- `model/hints.test.ts` — 16 tests covering all parse/validate/derive cases

## Key Constraints
- Board shape: square N×N only (5–25). `Hints.size` bakes this in — rectangular support requires a refactor.
- `noUncheckedIndexedAccess` is on: `arr[i]` returns `number | undefined`; use `!` or explicit checks.
- `verbatimModuleSyntax` is on: use `import type` for type-only imports.
- Solver budget (Phase 3): both `maxSteps` (~500k default) and `maxMs` (~2000ms default) — whichever trips first returns `status: 'aborted'`.

## Python Prototype
`py-solver/solver.py` is a standalone earlier attempt, not connected to the web app. Input format: first line = N, then 2N lines of comma-separated segment numbers (columns first, then rows). Run with `python solver.py` from `py-solver/`.
