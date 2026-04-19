import { describe, expect, it } from "vitest";
import { solveLine } from "../../src/solver/linesolver";
import { CellState } from "../../src/types";

const U = CellState.Unset;
const F = CellState.Filled;
const E = CellState.Empty;

function line(...vals: number[]): Uint8Array {
  return new Uint8Array(vals);
}

describe("solveLine", () => {
  it("classic overlap: [7] in length 10 forces cells 3–6", () => {
    const result = solveLine(line(U,U,U,U,U,U,U,U,U,U), [7]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Placements: start 0-3. Overlap cells 3-6
    expect(result.changed).toBe(true);
    expect(Array.from(result.line.slice(3, 7))).toEqual([F, F, F, F]);
    expect(result.line[0]).toBe(U);
    expect(result.line[9]).toBe(U);
  });

  it("full overlap: [5] in length 5 forces all filled", () => {
    const result = solveLine(line(U,U,U,U,U), [5]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Array.from(result.line)).toEqual([F,F,F,F,F]);
  });

  it("empty hint forces all empty", () => {
    const result = solveLine(line(U,U,U,U,U), []);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Array.from(result.line)).toEqual([E,E,E,E,E]);
  });

  it("contradiction: no valid placements returns ok:false", () => {
    // hint [3] but cell 1 is Filled and cells 0,2 are Empty → impossible
    const result = solveLine(line(E, F, E, U, U), [3]);
    expect(result.ok).toBe(false);
  });

  it("already-solved line returns changed:false", () => {
    const result = solveLine(line(E, F, F, E, E), [2]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(false);
  });

  it("known cell pins and forces remaining cells empty", () => {
    // [2] in [U,U,U,U,F]: cell 4 is Filled, hint [2] → run must end at 4 → start=3
    const result = solveLine(line(U,U,U,U,F), [2]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.line[3]).toBe(F);
    expect(result.line[4]).toBe(F);
    expect(result.line[0]).toBe(E);
    expect(result.line[1]).toBe(E);
    expect(result.line[2]).toBe(E);
  });

  it("two segments: [2,2] in length 6 forces overlap cells", () => {
    // Candidates: [0,3],[0,4],[1,4]. Cell 0: in 2 of 3 (not forced). Cell 1: in {[0,3],[0,4],[1,4]}: in 0-1, 0-1, 1 → 3/3? No:
    // start=[0,3]: seg0=0-1, seg1=3-4. cell1 in seg0 ✓. cell3 in seg1 ✓.
    // start=[0,4]: seg0=0-1, seg1=4-5. cell1 in seg0 ✓. cell4 in seg1 ✓.
    // start=[1,4]: seg0=1-2, seg1=4-5. cell1 in seg0 ✓. cell4 in seg1 ✓.
    // Cell 1: in seg0 for all 3 → forced Filled
    // Cell 4: in seg1 for [0,4] and [1,4] (2 of 3) → not forced
    const result = solveLine(line(U,U,U,U,U,U), [2,2]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.line[1]).toBe(F);
    expect(result.line[4]).toBe(F);
  });

  it("idempotent: solving an already partially solved line again changes nothing new", () => {
    // First pass: [7] in all-Unset forces cells 3-6
    const r1 = solveLine(line(U,U,U,U,U,U,U,U,U,U), [7]);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    // Second pass: same line
    const r2 = solveLine(r1.line, [7]);
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.changed).toBe(false);
  });
});
