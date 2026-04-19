import { CellState, type Hint, type Placement } from "../types";

export function enumeratePlacements(hint: Hint, length: number): Placement[] {
  const k = hint.length;
  if (k === 0) return [{ starts: [] }];

  const minSpan = hint.reduce((a, b) => a + b, 0) + (k - 1);
  const slack = length - minSpan;
  if (slack < 0) return [];

  const result: Placement[] = [];
  const starts = new Array<number>(k);

  function rec(seg: number, pos: number, remaining: number): void {
    if (seg === k) {
      result.push({ starts: starts.slice() });
      return;
    }
    for (let extra = 0; extra <= remaining; extra++) {
      starts[seg] = pos + extra;
      rec(seg + 1, starts[seg]! + hint[seg]! + 1, remaining - extra);
    }
  }

  rec(0, 0, slack);
  return result;
}

function isCompatible(p: Placement, line: Uint8Array, hint: Hint): boolean {
  const L = line.length;
  const k = hint.length;
  const { starts } = p;

  for (let i = 0; i < k; i++) {
    const start = starts[i]!;
    const len = hint[i]!;
    for (let j = start; j < start + len; j++) {
      if (line[j] === CellState.Empty) return false;
    }
  }

  let pos = 0;
  for (let i = 0; i < k; i++) {
    const segStart = starts[i]!;
    for (let j = pos; j < segStart; j++) {
      if (line[j] === CellState.Filled) return false;
    }
    pos = segStart + hint[i]!;
  }
  for (let j = pos; j < L; j++) {
    if (line[j] === CellState.Filled) return false;
  }

  return true;
}

export function getValidPlacements(line: Uint8Array, hint: Hint): Placement[] {
  return enumeratePlacements(hint, line.length).filter(p =>
    isCompatible(p, line, hint),
  );
}
