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

export const allFixtures: readonly PuzzleFixture[] = [
  plus3x3,
  plus5x5,
  heart5x5,
];
