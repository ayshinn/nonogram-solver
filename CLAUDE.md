# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A nonogram puzzle solver implemented in two parallel tracks:
- **Web app** (`index.html`, `js/setup.js`, `css/style.css`) — browser-based, fully static, intended for GitHub Pages deployment
- **Python prototype** (`py-solver/solver.py`) — experimental solver with text file input/output

## Running the Project

**Web app**: Open `index.html` directly in a browser (no build step, no server required). All paths are relative.

**Python solver**:
```bash
cd py-solver
python solver.py
```
Input file is hardcoded in `main()` as `test2.txt`. Input format: first line is board size N, followed by 2N lines of comma-separated segment numbers (first N lines = column hints, next N lines = row hints). A line of `0` means no segments.

## Architecture

### Web App Data Model

Cell states: `UNSET=0`, `EMPTY=1`, `FILLED=2`. Left-click toggles fill; right-click marks empty/crossout.

The grid is a 2D array of integers. `rowHints` and `colHints` are arrays of arrays of numbers parsed from newline/comma-separated textarea input.

The table renders with one extra top row (column hints) and one extra left column (row hints), so board cell `[i][j]` maps to table `rows[i+1].cells[j+1]`.

### Python Data Model

`numbers` is a flat list of length `2N`: indices `0..N-1` are column hint lines, indices `N..2N-1` are row hint lines. Each element is a list of `Segment` objects (`.number`, `.completed`). Board is `N×N` list of `Space` objects with `.status` and `.x_segment`/`.y_segment` tuples referencing their owning segment.

### Planned Features (from spec.md)

The spec defines four implementation phases:
1. **Phase 1** (partially done): Manual hint input, board rendering, cell toggling — `solveNonogram()` in JS is currently a random stub
2. **Phase 2**: Image upload + canvas pixel parsing to auto-derive hints
3. **Phase 3**: Deterministic line-solving algorithm (overlap method), with optional backtracking
4. **Phase 4**: Polish, GitHub Pages deployment

### Known Issues in Current Code

- `js/setup.js`: `Segment` constructor uses `False` (Python syntax) instead of `false` — this will throw a ReferenceError at runtime when a Segment is instantiated
- `js/setup.js`: Grid is still filled with `0` integers rather than `Space` objects (TODO in code)
- `solveNonogram()` is a random fill placeholder, not a real solver
