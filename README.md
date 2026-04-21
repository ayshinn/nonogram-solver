# Nonogram Solver

A browser-based nonogram puzzle player and solver. Enter a grid size and hints (or import a solved-board image), play manually, or hit **Solve** to let the algorithm fill it in. Deployed as a static site on GitHub Pages.

---

## Commands

```bash
npm install        # install dependencies
npm run dev        # local dev server at http://localhost:5173
npm run build      # typecheck + production build → dist/
npm run preview    # serve the production build locally
npm test           # run Vitest test suite
npm run test:watch # Vitest watch mode
npm run typecheck  # tsc --noEmit only
```

---

## Controls

| Action | Mouse | Keyboard |
|---|---|---|
| Fill / unfill cell | Left-click | `Space` or `F` |
| Mark empty / X (unfill) | Right-click | `X` |
| Move focus | — | Arrow keys |
| Leave the board | — | `Esc` |

**Cell states**: `Unset` (blank) → left-click → `Filled` → left-click → `Unset`. Right-click cycles `Unset ↔ Empty` (an X mark).

---

## Workflow

1. **Set grid size** (5–30).
2. **Enter hints** in the two textareas (one row/column per line, numbers comma-separated). Or **import a solved-board image** (PNG/JPG) — the app samples pixels and auto-fills the hint textareas.
3. Click **Initialize** to create a playable board.
4. Play manually, or click **Solve** to run the solver. Every solved result is validated against the hints before being accepted.
5. **Clear Board** wipes cells but keeps hints. **Reset** wipes everything.

---

## Solver

Three nested layers (see `src/solver/README.md` for full details):

- **Line solver** (`linesolver.ts` + `candidates.ts`) — for each line, enumerate every valid placement of the clue and take the cell-by-cell intersection. Logically complete for a single line.
- **Fixed-point propagation** (`propagate.ts`) — dirty-line queue that re-solves perpendiculars whenever a cell changes.
- **Backtracking** (`backtrack.ts`) — DFS fallback with a most-constrained-row heuristic when propagation gets stuck. Bounded by `maxSteps` (default 500 000) and `maxMs` (default 2000); returns `aborted` if exhausted.

---

## Project Structure

```
nonogram-solver/
├── index.html                  # App entry (Vite)
├── public/
│   └── favicon.svg
├── src/
│   ├── main.ts                 # Bootstrap
│   ├── types.ts                # Shared domain types
│   ├── model/                  # Board + hints
│   ├── solver/                 # Line solver, propagation, backtracking, validation
│   ├── image/                  # Image parser + pixel sampling
│   ├── ui/                     # App controller, board, controls, keyboard, status
│   └── styles/                 # CSS tokens, layout, board styling
├── test/
│   ├── fixtures/puzzles.ts
│   ├── image/
│   ├── model/
│   └── solver/
├── .github/workflows/deploy.yml
├── py-solver/                  # Older Python prototype (standalone)
├── spec.md
└── todo.md
```

---

## Stack

- **TypeScript** — strict mode, `noUncheckedIndexedAccess`
- **Vite** — dev server + static build (`base: './'` for GitHub Pages)
- **Vitest** — unit tests under jsdom
- No framework, no CSS preprocessor. Vanilla DOM APIs, custom properties, Grid, Flexbox.

---

## Deployment

`.github/workflows/deploy.yml` builds on every push to `main` and publishes `dist/` via GitHub Pages. To enable:

1. Repo **Settings → Pages → Source** → "GitHub Actions".
2. Push to `main`; the workflow runs tests, builds, and deploys.

The site works at any sub-path because `vite.config.ts` sets `base: './'`.

---

## Python Prototype

`py-solver/solver.py` is a standalone earlier attempt at the solver algorithm. Not connected to the web app.

```bash
cd py-solver
python solver.py   # reads test2.txt by default
```

Input format: first line is board size N, then 2N lines of comma-separated segments (columns first, then rows). A line containing only `0` means no filled cells.
