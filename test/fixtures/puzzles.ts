import { CellState, type Hints } from "../../src/types";

export interface PuzzleFixture {
  readonly name: string;
  readonly hints: Hints;
  readonly solution: readonly (readonly CellState[])[];
}

const F = CellState.Filled;
const E = CellState.Empty;

export const plus3x3: PuzzleFixture = {
  name: "plus 3x3",
  hints: {
    rows: [[1], [3], [1]],
    cols: [[1], [3], [1]],
    size: 3,
  },
  solution: [
    [E, F, E],
    [F, F, F],
    [E, F, E],
  ],
};

export const plus5x5: PuzzleFixture = {
  name: "plus 5x5",
  hints: {
    rows: [[1], [1], [5], [1], [1]],
    cols: [[1], [1], [5], [1], [1]],
    size: 5,
  },
  solution: [
    [E, E, F, E, E],
    [E, E, F, E, E],
    [F, F, F, F, F],
    [E, E, F, E, E],
    [E, E, F, E, E],
  ],
};

export const heart5x5: PuzzleFixture = {
  name: "heart 5x5",
  hints: {
    rows: [[1, 1], [5], [5], [3], [1]],
    cols: [[3], [3], [4], [3], [3]],
    size: 5,
  },
  solution: [
    [F, E, E, E, F],
    [F, F, F, F, F],
    [F, F, F, F, F],
    [E, F, F, F, E],
    [E, E, F, E, E],
  ],
};

// 10x10 horizontal/vertical diamond: row r fills cols (4-d)..(5+d) where d=min(r,9-r)
export const diamond10x10: PuzzleFixture = {
  name: "diamond 10x10",
  hints: {
    rows: [[2], [4], [6], [8], [10], [10], [8], [6], [4], [2]],
    cols: [[2], [4], [6], [8], [10], [10], [8], [6], [4], [2]],
    size: 10,
  },
  solution: [
    [E, E, E, E, F, F, E, E, E, E],
    [E, E, E, F, F, F, F, E, E, E],
    [E, E, F, F, F, F, F, F, E, E],
    [E, F, F, F, F, F, F, F, F, E],
    [F, F, F, F, F, F, F, F, F, F],
    [F, F, F, F, F, F, F, F, F, F],
    [E, F, F, F, F, F, F, F, F, E],
    [E, E, F, F, F, F, F, F, E, E],
    [E, E, E, F, F, F, F, E, E, E],
    [E, E, E, E, F, F, E, E, E, E],
  ],
};

// 15x15 diamond: row r fills cols (7-d)..(7+d) where d=min(r,14-r)
export const diamond15x15: PuzzleFixture = {
  name: "diamond 15x15",
  hints: {
    rows: [[1],[3],[5],[7],[9],[11],[13],[15],[13],[11],[9],[7],[5],[3],[1]],
    cols: [[1],[3],[5],[7],[9],[11],[13],[15],[13],[11],[9],[7],[5],[3],[1]],
    size: 15,
  },
  solution: [
    [E,E,E,E,E,E,E,F,E,E,E,E,E,E,E],
    [E,E,E,E,E,E,F,F,F,E,E,E,E,E,E],
    [E,E,E,E,E,F,F,F,F,F,E,E,E,E,E],
    [E,E,E,E,F,F,F,F,F,F,F,E,E,E,E],
    [E,E,E,F,F,F,F,F,F,F,F,F,E,E,E],
    [E,E,F,F,F,F,F,F,F,F,F,F,F,E,E],
    [E,F,F,F,F,F,F,F,F,F,F,F,F,F,E],
    [F,F,F,F,F,F,F,F,F,F,F,F,F,F,F],
    [E,F,F,F,F,F,F,F,F,F,F,F,F,F,E],
    [E,E,F,F,F,F,F,F,F,F,F,F,F,E,E],
    [E,E,E,F,F,F,F,F,F,F,F,F,E,E,E],
    [E,E,E,E,F,F,F,F,F,F,F,E,E,E,E],
    [E,E,E,E,E,F,F,F,F,F,E,E,E,E,E],
    [E,E,E,E,E,E,F,F,F,E,E,E,E,E,E],
    [E,E,E,E,E,E,E,F,E,E,E,E,E,E,E],
  ],
};

// Puzzles solvable by intersection-only propagation (no backtracking needed)
export const lineSolvableFixtures: readonly PuzzleFixture[] = [
  plus3x3,
  plus5x5,
  diamond10x10,
  diamond15x15,
];

// Puzzles that require backtracking — will be fully tested in Phase 3
export const backtrackFixtures: readonly PuzzleFixture[] = [heart5x5];

export const allFixtures: readonly PuzzleFixture[] = [
  ...lineSolvableFixtures,
  ...backtrackFixtures,
];
