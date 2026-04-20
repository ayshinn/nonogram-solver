import { describe, expect, it } from "vitest";
import { solve, satisfies } from "../../src/solver/index";
import { CellState } from "../../src/types";
import {
  lineSolvableFixtures,
  backtrackFixtures,
  plus3x3,
  heart5x5,
  diamond10x10,
  diamond15x15,
} from "../fixtures/puzzles";

const E = CellState.Empty;

describe("solve — line-solvable fixtures", () => {
  for (const fixture of lineSolvableFixtures) {
    it(`solves ${fixture.name}`, () => {
      const result = solve(fixture.hints);
      expect(result.status).toBe("solved");
      const check = satisfies(result.board, fixture.hints);
      expect(check.ok).toBe(true);
    });
  }

  it("solution matches expected grid for plus3x3", () => {
    const result = solve(plus3x3.hints);
    expect(result.status).toBe("solved");
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        expect(result.board.cells[r * 3 + c]).toBe(plus3x3.solution[r]![c]);
      }
    }
  });

  it("diamond10x10 solution satisfies invariant", () => {
    const result = solve(diamond10x10.hints);
    expect(result.status).toBe("solved");
    expect(satisfies(result.board, diamond10x10.hints).ok).toBe(true);
  });

  it("diamond15x15 solution satisfies invariant", () => {
    const result = solve(diamond15x15.hints);
    expect(result.status).toBe("solved");
    expect(satisfies(result.board, diamond15x15.hints).ok).toBe(true);
  });

  it("invariant: every solved result passes satisfies", () => {
    for (const fixture of lineSolvableFixtures) {
      const result = solve(fixture.hints);
      if (result.status === "solved") {
        expect(satisfies(result.board, fixture.hints).ok).toBe(true);
      }
    }
  });
});

describe("solve — backtracking fixtures", () => {
  for (const fixture of backtrackFixtures) {
    it(`solves ${fixture.name} with backtracking`, () => {
      const result = solve(fixture.hints);
      expect(result.status).toBe("solved");
      expect(satisfies(result.board, fixture.hints).ok).toBe(true);
    });
  }

  it("heart5x5 solution matches expected grid", () => {
    const result = solve(heart5x5.hints);
    expect(result.status).toBe("solved");
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        expect(result.board.cells[r * 5 + c]).toBe(heart5x5.solution[r]![c]);
      }
    }
  });

  it("invariant: every solved backtrack result passes satisfies", () => {
    for (const fixture of backtrackFixtures) {
      const result = solve(fixture.hints);
      if (result.status === "solved") {
        expect(satisfies(result.board, fixture.hints).ok).toBe(true);
      }
    }
  });
});

describe("solve — edge cases", () => {
  it("returns contradiction for impossible hints", () => {
    const hints = {
      rows: [[3], [3], [3]],
      cols: [[1], [1], [1]],
      size: 3,
    };
    const result = solve(hints);
    expect(result.status).toBe("contradiction");
  });

  it("all-empty board solves with all-empty hints", () => {
    const hints = {
      rows: [[], [], [], [], []],
      cols: [[], [], [], [], []],
      size: 5,
    };
    const result = solve(hints);
    expect(result.status).toBe("solved");
    expect(Array.from(result.board.cells).every(c => c === E)).toBe(true);
  });

  it("returns aborted when step budget is exceeded", () => {
    // A puzzle that requires backtracking, given an impossibly small budget
    const result = solve(heart5x5.hints, { maxSteps: 0 });
    expect(result.status).toBe("aborted");
  });
});
