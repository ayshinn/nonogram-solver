import { describe, expect, it } from "vitest";
import {
  enumeratePlacements,
  getValidPlacements,
} from "../../src/solver/candidates";
import { CellState } from "../../src/types";

const U = CellState.Unset;
const F = CellState.Filled;
const E = CellState.Empty;

describe("enumeratePlacements", () => {
  it("empty hint yields one empty placement", () => {
    const ps = enumeratePlacements([], 5);
    expect(ps).toHaveLength(1);
    expect(ps[0]!.starts).toEqual([]);
  });

  it("single segment [3] in length 5 gives 3 placements", () => {
    const ps = enumeratePlacements([3], 5);
    expect(ps).toHaveLength(3);
    expect(ps.map(p => p.starts[0])).toEqual([0, 1, 2]);
  });

  it("single segment [5] in length 5 gives 1 placement at 0", () => {
    const ps = enumeratePlacements([5], 5);
    expect(ps).toHaveLength(1);
    expect(ps[0]!.starts).toEqual([0]);
  });

  it("negative slack returns empty array", () => {
    expect(enumeratePlacements([6], 5)).toHaveLength(0);
  });

  it("[2,2] in length 5 gives 3 placements", () => {
    const ps = enumeratePlacements([2, 2], 5);
    // minSpan=5, slack=0: only [0,3]
    expect(ps).toHaveLength(1);
    expect(ps[0]!.starts).toEqual([0, 3]);
  });

  it("[2,2] in length 6 gives 3 placements", () => {
    const ps = enumeratePlacements([2, 2], 6);
    expect(ps).toHaveLength(3);
    const starts = ps.map(p => p.starts);
    expect(starts).toContainEqual([0, 3]);
    expect(starts).toContainEqual([0, 4]);
    expect(starts).toContainEqual([1, 4]);
  });

  it("[1,1,1] in length 5 gives 1 placement", () => {
    // minSpan=5, slack=0
    expect(enumeratePlacements([1, 1, 1], 5)).toHaveLength(1);
  });

  it("[1] in length 10 gives 10 placements", () => {
    expect(enumeratePlacements([1], 10)).toHaveLength(10);
  });
});

describe("getValidPlacements", () => {
  it("filters out placements conflicting with Empty cells", () => {
    // [3] in [E, U, U, U, U]: start 0 would put Filled on cell 0 which is Empty
    const line = new Uint8Array([E, U, U, U, U]);
    const ps = getValidPlacements(line, [3]);
    expect(ps.every(p => p.starts[0]! >= 1)).toBe(true);
  });

  it("filters out placements conflicting with Filled cells in gaps", () => {
    // [2] in [U, F, U, U, U]: start=2 puts cells 2-3 filled and cell 1 (Filled) in the gap → invalid
    const line = new Uint8Array([U, F, U, U, U]);
    const ps = getValidPlacements(line, [2]);
    // Valid: start=0 (covers 0-1 ✓), start=1 (covers 1-2 ✓)
    // start=2: gap before is cells 0-1, cell 1 is Filled → invalid
    // start=3: gap is 0-2, cell 1 Filled → invalid
    expect(ps.map(p => p.starts[0])).toEqual([0, 1]);
  });

  it("empty hint with all Unset line returns one placement", () => {
    const line = new Uint8Array([U, U, U]);
    expect(getValidPlacements(line, [])).toHaveLength(1);
  });

  it("empty hint with a Filled cell returns no placements", () => {
    const line = new Uint8Array([U, F, U]);
    expect(getValidPlacements(line, [])).toHaveLength(0);
  });

  it("known Filled cell pins placement", () => {
    // [5] in [U,U,U,U,U,F,U,U,U,U]: the Filled at pos 5 must be inside the segment
    const line = new Uint8Array([U, U, U, U, U, F, U, U, U, U]);
    const ps = getValidPlacements(line, [5]);
    // start must satisfy start <= 5 <= start+4, so start in [1,5]
    expect(ps.every(p => p.starts[0]! <= 5 && p.starts[0]! + 4 >= 5)).toBe(true);
    expect(ps).toHaveLength(5);
  });
});
