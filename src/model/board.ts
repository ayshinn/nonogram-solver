import { CellState, type Board } from "../types";

export function createBoard(size: number): Board {
  return { size, cells: new Uint8Array(size * size) };
}

export function cloneBoard(board: Board): Board {
  return { size: board.size, cells: new Uint8Array(board.cells) };
}

export function idx(size: number, r: number, c: number): number {
  return r * size + c;
}

export function getCell(board: Board, r: number, c: number): CellState {
  return board.cells[idx(board.size, r, c)] as CellState;
}

export function setCell(
  board: Board,
  r: number,
  c: number,
  state: CellState,
): void {
  board.cells[idx(board.size, r, c)] = state;
}

export function getRow(board: Board, r: number): Uint8Array {
  const start = r * board.size;
  return new Uint8Array(board.cells.subarray(start, start + board.size));
}

export function getCol(board: Board, c: number): Uint8Array {
  const line = new Uint8Array(board.size);
  for (let r = 0; r < board.size; r++) {
    line[r] = board.cells[idx(board.size, r, c)]!;
  }
  return line;
}

export function setRow(board: Board, r: number, line: Uint8Array): void {
  board.cells.set(line, r * board.size);
}

export function setCol(board: Board, c: number, line: Uint8Array): void {
  for (let r = 0; r < board.size; r++) {
    board.cells[idx(board.size, r, c)] = line[r]!;
  }
}

export function isComplete(board: Board): boolean {
  for (let i = 0; i < board.cells.length; i++) {
    if (board.cells[i] === CellState.Unset) return false;
  }
  return true;
}
