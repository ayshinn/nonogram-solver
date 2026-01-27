const UNSET = 0, FILLED = 2, EMPTY = 1;

let grid, rowHints, colHints;
// data structures
/**
Numbers = [[XRow, XRow, XRow], [YRow, YRow, YRow]] (or could do one long list, any above N index is just y row)
Row: {
  segments: Segment[]
}

Segment: {
  number (length shown in game)
  bool (completed or not)
}

ON BOARD SIDE
Grid: [[Space, Space, Space], [Space, Space, Space], ...]

Space: {
  coordinate (maybe unneeded since part of Grid?)
  x segment it's part of
  y segment it's part of
  status (emoji)
}
 */
let stuff;

// Classes
class Segment {
  constructor(number) {
    this.number = number;
    this.completed = False;
  }
}

class Space {
  constructor() {
    this.status = UNSET;
    this.x_segment = null; // row index, segment index
    this.y_segment = null; // row index, segment index
  }
}

function createGrid() {
  const gridSize = document.getElementById('gridSize').value;
  const inputArea = document.getElementById('inputArea');
  inputArea.style.display = 'block';

  // Create empty hints
  rowHints = Array.from({ length: gridSize }, () => []);
  colHints = Array.from({ length: gridSize }, () => []);
}

function initializeGame() {
  const gridSize = document.getElementById('gridSize').value;
  const rowsInput = document.getElementById('rowHints').value.trim();
  const colsInput = document.getElementById('colHints').value.trim();
  const nonogramTable = document.getElementById('nonogramTable');
  const solveButton = document.getElementById('solveButton');

  // Parse row and column hints
  // TODO rowHints should be list of list of Segments. First list is each row/col. Second is each number.
  rowHints = rowsInput.split('\n').map(hint => hint.split(',').map(Number));
  colHints = colsInput.split('\n').map(hint => hint.split(',').map(Number));

  // Create empty grid
  // TODO instead of filling with zeros, fill with new Space()s
  grid = Array.from({ length: gridSize }, () => Array.from({ length: gridSize }, () => 0));

  // Clear the table
  nonogramTable.innerHTML = '';

  for (let i = 0; i <= gridSize; i++) {
    const row = document.createElement('tr');
    for (let j = 0; j <= gridSize; j++) {
      const cell = document.createElement('td');
      if (i === 0 && j === 0) {
        cell.classList.add('number-cell');
      } else if (i === 0) {
        cell.textContent = colHints[j - 1].join(' ');
        cell.classList.add('number-cell');
      } else if (j === 0) {
        cell.textContent = rowHints[i - 1].join(' ');
        cell.classList.add('number-cell');
      } else {
        cell.addEventListener('click', () => toggleCell(i - 1, j - 1, 1));
        cell.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          toggleCell(i - 1, j - 1, 2);
        });
      }
      row.appendChild(cell);
    }
    nonogramTable.appendChild(row);
  }

  updateGrid();
  solveButton.style.display = 'block';
}

function toggleCell(row, col, state) {
  grid[row][col] = grid[row][col] == 0 ? state : 0;
  updateGrid();
}

function updateGrid() {
  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid[i].length; j++) {
      const cell = nonogramTable.rows[i + 1].cells[j + 1];
      cell.style.backgroundColor = 'white';
      cell.classList.remove('filled', 'crossout');

      if (grid[i][j] === 0) {
        cell.style.backgroundColor = 'white';
      } else if (grid[i][j] === 1) {
        cell.style.backgroundColor = 'black';
      } else {
        cell.classList.add('crossout');
      }
    }
  }
}

function solveNonogram() {
  // TODO: implement actual solution algorithm here
  for (let i = 0; i < grid.length; i++) {
    for (let j = 0; j < grid[i].length; j++) {
      grid[i][j] = Math.random() < 0.5 ? 1 : 0;
    }
  }
  updateGrid();
}
