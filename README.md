# Nonogram Solver

A browser-based nonogram puzzle player and solver. Enter a grid size and hints, play manually, or hit Solve to let the algorithm fill it in. Deployable as a static site on GitHub Pages.

> Work in progress — see `todo.md` for phase-by-phase progress.

---

## Commands

```bash
npm install        # install dependencies
npm run dev        # start local dev server at http://localhost:5173
npm run build      # typecheck + production build → dist/
npm run preview    # serve the production build locally
npm test           # run Vitest test suite
npm run test:watch # run tests in watch mode
npm run typecheck  # TypeScript type-check only (no emit)
```

---

## Project Structure

```
nonogram-solver/
├── index.html                  # App entry (Vite)
├── src/
│   ├── main.ts                 # Bootstrap
│   ├── types.ts                # Shared domain types (CellState, Board, Hints, …)
│   ├── model/
│   │   ├── board.ts            # Board creation, get/set, row/col helpers
│   │   └── hints.ts            # Hint parsing, validation, derivation
│   ├── solver/                 # (Phase 2+) line-solver, backtracking
│   ├── ui/
│   │   ├── app.ts              # Top-level controller / state
│   │   ├── boardView.ts        # CSS-Grid board rendering + diff updates
│   │   ├── hintsView.ts        # Row/col hint bands
│   │   ├── controls.ts         # Form controls and button wiring
│   │   ├── keyboard.ts         # Arrow keys, Space/F fill, X cross, Esc
│   │   └── status.ts           # aria-live status banner
│   ├── image/                  # (Phase 4+) image import / pixel sampling
│   └── styles/
│       ├── main.css            # Entry — imports the rest
│       ├── variables.css       # CSS tokens, light + dark theme
│       ├── layout.css          # Page layout, responsive breakpoints
│       └── board.css           # Cell states, hint bands, focus styles
├── test/
│   ├── fixtures/puzzles.ts     # Known puzzles + solutions used across tests
│   └── model/hints.test.ts     # Tests for hint parsing and validation
├── py-solver/                  # Older Python prototype (separate, standalone)
├── spec.md                     # Full feature specification
├── todo.md                     # Phase-by-phase implementation checklist
└── plan.txt                    # Original scratch notes
```

---

## How It Works

Nonograms are logic puzzles where you fill in cells on a grid based on number clues along each row and column. The numbers describe consecutive runs of filled cells in that line.

**Cell states**: `Unset` (blank) → left-click → `Filled` (black) → left-click again → `Unset`. Right-click cycles `Unset → Empty` (X mark) → right-click again → `Unset`.

**Keyboard shortcuts** (when a cell is focused):

| Key | Action |
|-----|--------|
| Arrow keys | Move focus |
| `Space` or `F` | Toggle filled |
| `X` | Toggle empty / cross |
| `Esc` | Return focus to controls |

**Solver** (Phase 2–3, in progress): deterministic line-constraint propagation (intersection method) with a backtracking fallback for puzzles that require guessing. Every solved result is validated against the original hints before being accepted.

---

## Stack

- **TypeScript** — strict mode, `noUncheckedIndexedAccess`
- **Vite** — dev server + static build (`base: './'` for GitHub Pages compatibility)
- **Vitest** — unit tests with jsdom environment
- No UI framework — vanilla TypeScript + DOM APIs
- No CSS preprocessor — custom properties, Grid, Flexbox

---

## Python Prototype

`py-solver/solver.py` is a standalone earlier attempt at the solver algorithm. It reads puzzle input from `.txt` files and prints to stdout. It is not connected to the web app.

```bash
cd py-solver
python solver.py   # reads test2.txt by default
```

Input format: first line is board size N, followed by 2N lines of comma-separated segment numbers (columns first, then rows). A line containing only `0` means no filled cells.
