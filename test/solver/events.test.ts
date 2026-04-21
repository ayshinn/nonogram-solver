import { describe, expect, it } from "vitest";
import { CellState } from "../../src/types";
import { solve } from "../../src/solver/index";
import { solveWithTrace } from "../../src/solver/trace";
import type { SolverEvent } from "../../src/solver/events";
import {
  backtrackFixtures,
  heart5x5,
  lineSolvableFixtures,
  plus3x3,
} from "../fixtures/puzzles";

function replayBoard(
  size: number,
  trace: readonly SolverEvent[],
): Uint8Array {
  const cells = new Uint8Array(size * size);
  for (const e of trace) {
    if (e.type === "cell-set") {
      cells[e.r * size + e.c] = e.state;
    } else if (e.type === "unguess") {
      // ignore: the trace of cell-sets at deeper depths already narrates the rollback
    }
  }
  return cells;
}

function replayBoardWithUnguess(
  size: number,
  trace: readonly SolverEvent[],
): Uint8Array {
  const cells = new Uint8Array(size * size);
  const history = new Map<number, { r: number; c: number; prev: number }[]>();
  for (const e of trace) {
    if (e.type === "cell-set") {
      const prev = cells[e.r * size + e.c]!;
      let stack = history.get(e.depth);
      if (!stack) {
        stack = [];
        history.set(e.depth, stack);
      }
      stack.push({ r: e.r, c: e.c, prev });
      cells[e.r * size + e.c] = e.state;
    } else if (e.type === "unguess") {
      for (const d of [...history.keys()]
        .filter((x) => x >= e.depth)
        .sort((a, b) => b - a)) {
        const stack = history.get(d)!;
        while (stack.length > 0) {
          const { r, c, prev } = stack.pop()!;
          cells[r * size + c] = prev;
        }
        history.delete(d);
      }
    }
  }
  return cells;
}

describe("solveWithTrace — event invariants", () => {
  it("emits phase propagate-start first and phase done last (plus3x3)", () => {
    const { trace, result } = solveWithTrace(plus3x3.hints);
    expect(result.status).toBe("solved");
    expect(trace[0]).toEqual({ type: "phase", phase: "propagate-start" });
    const last = trace[trace.length - 1];
    expect(last).toEqual({
      type: "phase",
      phase: "done",
      status: "solved",
    });
  });

  it("every cell-set has valid coordinates and state", () => {
    const { trace } = solveWithTrace(plus3x3.hints);
    const N = plus3x3.hints.size;
    for (const e of trace) {
      if (e.type !== "cell-set") continue;
      expect(e.r).toBeGreaterThanOrEqual(0);
      expect(e.r).toBeLessThan(N);
      expect(e.c).toBeGreaterThanOrEqual(0);
      expect(e.c).toBeLessThan(N);
      expect([CellState.Filled, CellState.Empty]).toContain(e.state);
    }
  });

  it("replaying cell-sets produces the result board (line-solvable fixtures)", () => {
    for (const fixture of lineSolvableFixtures) {
      const { trace, result } = solveWithTrace(fixture.hints);
      expect(result.status).toBe("solved");
      const replayed = replayBoard(fixture.hints.size, trace);
      expect(Array.from(replayed)).toEqual(Array.from(result.board.cells));
    }
  });

  it("line-solvable puzzles emit no guess or unguess events", () => {
    for (const fixture of lineSolvableFixtures) {
      const { trace } = solveWithTrace(fixture.hints);
      const guesses = trace.filter(
        (e) => e.type === "guess" || e.type === "unguess",
      );
      expect(guesses).toEqual([]);
      for (const e of trace) {
        if (e.type === "cell-set") expect(e.depth).toBe(0);
      }
    }
  });

  it("backtracking puzzles emit guess events at depth >= 1", () => {
    for (const fixture of backtrackFixtures) {
      const { trace, result } = solveWithTrace(fixture.hints);
      expect(result.status).toBe("solved");
      const guesses = trace.filter((e) => e.type === "guess");
      expect(guesses.length).toBeGreaterThan(0);
      for (const e of guesses) {
        if (e.type === "guess") expect(e.depth).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("replay with unguess rollback matches result.board for backtracking puzzles", () => {
    for (const fixture of backtrackFixtures) {
      const { trace, result } = solveWithTrace(fixture.hints);
      const replayed = replayBoardWithUnguess(fixture.hints.size, trace);
      expect(Array.from(replayed)).toEqual(Array.from(result.board.cells));
    }
  });

  it("guess + unguess depths are balanced for heart5x5", () => {
    const { trace } = solveWithTrace(heart5x5.hints);
    // Every unguess at depth d must correspond to a preceding guess at depth d
    // that hasn't already been closed.
    const open = new Map<number, number>();
    for (const e of trace) {
      if (e.type === "guess") {
        open.set(e.depth, (open.get(e.depth) ?? 0) + 1);
      } else if (e.type === "unguess") {
        expect(open.get(e.depth) ?? 0).toBeGreaterThan(0);
        open.set(e.depth, open.get(e.depth)! - 1);
      }
    }
  });

  it("regression: solve(hints) and solve(hints, { onEvent }) return equivalent results", () => {
    for (const fixture of [...lineSolvableFixtures, ...backtrackFixtures]) {
      const plain = solve(fixture.hints);
      const instrumented = solve(fixture.hints, { onEvent: () => {} });
      expect(instrumented.status).toBe(plain.status);
      expect(Array.from(instrumented.board.cells)).toEqual(
        Array.from(plain.board.cells),
      );
    }
  });
});
