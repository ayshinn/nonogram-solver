# Solver Architecture

## Approach 1 (Current)

The solver has three nested layers. They are not sequential passes — each layer calls the one below it.

```
solve()
└── propagate()                     ← outer fixed-point loop
    └── solveLine() per dirty line  ← uses candidates + intersection together
        └── getCandidates()         ← enumeration is internal to solveLine
```

### Layer 1: Line Solver (`linesolver.ts` + `candidates.ts`)

`solveLine` is a single combined operation:

1. **Candidate enumeration** (`candidates.ts`): For a line with a given clue and current cell states, generate every valid placement of the clue segments — all configurations that fit without conflicting with already-known cells. Uses stars-and-bars combinatorics filtered against the board.

2. **Intersection / consensus** (`linesolver.ts`): Across all valid placements, look at each cell position:
   - Every placement has Filled → mark Filled
   - No placement has Filled → mark Empty
   - Placements disagree → leave Unset

   If no valid placements exist, the line has a contradiction.

This is the strongest possible single-line deduction — it is logically complete for one line in isolation.

### Layer 2: Fixed-Point Propagation (`propagate.ts`)

The outer loop that keeps applying the line solver until no new information can be deduced:

1. Initialize a dirty queue with all rows and columns.
2. Pop a line, run `solveLine` on it.
3. If any cells changed, enqueue all perpendicular lines that cross those cells.
4. Repeat until the queue drains.

Returns one of: `'solved'` (board complete), `'stuck'` (cells remain Unset), or `'contradiction'`.

### Layer 3: Backtracking (`backtrack.ts`, Phase 3)

Sits above propagation. Triggered when `propagate()` returns `'stuck'`:

1. Pick an Unset cell (heuristic: most-constrained row or column).
2. Clone the board, set the cell to Filled, call `propagate()` recursively.
   - If contradiction → the cell must be Empty; try that instead.
   - If solved → done.
3. Repeat until solved or a step/time budget is exhausted (`maxSteps ≈ 500k`, `maxMs ≈ 2000`).

Backtracking does not replace the deterministic solver — it calls `propagate()` at every node of the search tree. The line solver does the heavy lifting; guessing just unlocks more deductions.

---

## Approach 2 (Future Work)

_To be filled in._

The idea: exhaust all non-backtracking techniques first — including cross-line reasoning such as probing / forcing — so that backtracking is only applied to cells that are genuinely ambiguous. This would reduce the search space significantly for hard puzzles.

Candidate techniques to explore:
- **Probing / forcing**: Hypothetically set a cell, propagate fully; if contradiction results, the opposite value is proven. Deterministic but expensive (O(N²) propagation passes per round).
- Other advanced single-line or multi-line constraint techniques from published solvers (e.g. Jan Wolter's survey).

### Anthony Human Approach

This is my written notes as per how I've played Nonogram on mobile apps all my life (and paint-by-number in Mr. Pline's pre-algebra class in 7th grade, shout out to Mr. Pline for showing me game and giving me extra credit for solving the 30x30 one)

My strategy uses a bit more association between cells and which hint number they're tied to.

1. Base Game Line Solver. Essentially the same strategy as described above. My way of doing it is using math.
For each line (row, column), take the largest hint number for that line (say 4) and save it. Then, add up all the numbers in the line hint, and the number of spaces (which is count(hints) - 1). Example: [5, 2, 1, 1, 4] has maxNum = 5, and lineSum = 5+2+1+1+4+4 (last 4 is len(hints)-1) = 17. Then take the length of the row or column in the grid (say 20). If length of grid row/column (20) minus the sum of hints (17) which ends up being (3) is less than the largest number (5), then you have a hit.
Take the result of length of grid line minus sum of hints (3) and iterate through all the hints in the grid assuming they're as left-shifted or top-shifted as possible. Whenever a hint is larger than that diff N, you know that the cells at spot N+1 and later of that hint is to be filled in, so the last 2 cells of the 5 block, and last cell of the 4 block. If the resulting number is 0, then you know the length of the grid line equals sum of hints so there's only 1 possible solution for the entire line and all can be filled in, including X's.
Additionally, any row or column with no hints can be filled in with all X's.
Repeat this for all rows and columns once

The cells filled in from the previous step are associated with specific hint numbers now. This information should be stored somehow. If the algorithm uses OOP, then each cell can be an object that stores which row/column hint index it belongs to (or list of which hint indexes it could belong to.)

2. Board Edges
Now look at all unfinished rows/columns that have at least one cell filled in. For every line, if the first number hint is M, and the first filled in cell is within the first M-1 positions in that line, then every cell from there til M can be filled in. If the last number hint is N, and the last cell filled in is within the last N-1 positions in that line, then all cells from position (len(line) - N) to the end of the line can be filled in.

3. Large Number Hints
(TODO continue this later.)
