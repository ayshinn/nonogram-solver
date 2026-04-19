# Nonogram Solver Web App Specification

## Overview
Build a static, client-side Nonogram puzzle solver for GitHub Pages using HTML, CSS, and JavaScript.

The app must support:
- manual board size selection
- manual row and column hint input
- interactive board creation and editing
- image upload for PNG/JPG nonogram templates
- client-side image parsing into a nonogram board
- a solving algorithm that displays the final solved board

GitHub Pages deployment is supported because the app is fully static and runs entirely in the browser.

---

## Goals
- Create a clean, user-friendly app UI in `index.html`.
- Implement board rendering and user interaction in `js/setup.js`.
- Add a responsive style layer in `css/style.css`.
- Enable image upload and pixel-based parsing using the browser `FileReader` API and an HTML `canvas`.
- Ensure the solver works without server-side components.

---

## User Flow

### 1. Setup
- User opens the page.
- User selects a grid size.
- User clicks `Create Grid`.
- The app displays manual hint entry fields and board controls.

### 2. Manual Hints Input
- User enters row hints in a textarea, one row per line, comma-separated.
- User enters column hints similarly.
- User clicks `Initialize Game`.
- The app validates input and builds the interactive board.
- User can click cells to toggle fill or right-click to mark empty.

### 3. Image Upload Input
- User chooses a PNG or JPG file with an input control.
- The app loads and displays the image preview.
- User clicks `Parse Image`.
- The app draws the image on a hidden canvas.
- The app samples pixel brightness and threshold to detect filled cells.
- The app derives row/column hints from the binary board structure.
- The app populates the hint inputs and renders the board.

### 4. Solve
- User clicks `Solve Nonogram`.
- The app runs the solver on the current hints and board state.
- The app updates the board visually with the final solution.

### 5. Reset/Clear
- User can reset the board and inputs at any time.
- The app clears internal state and UI elements.

---

## File Responsibilities

### `index.html`
- Page structure and content
- Controls for grid size, hint input, image upload, and solver actions
- Board display elements: puzzle table and optional preview canvas
- Script inclusion for `js/setup.js`

### `css/style.css`
- Layout and spacing for controls and board
- Styling for interactive board cells and number headers
- Responsive table/canvas display
- Visual states for filled, empty, and crossout cells

### `js/setup.js`
- Application state management
- UI event handling
- Manual input parsing and validation
- Board table rendering and click behavior
- Image upload, loading, and canvas parsing
- Hint generation from parsed images
- Solver implementation and board update

---

## Detailed Feature Specification

### App State
The app will maintain:
- `gridSize` (number)
- `rowHints` (array of arrays of numbers)
- `colHints` (array of arrays of numbers)
- `grid` (2D array of cell state values)
- `cellStates` constants: `UNSET`, `FILLED`, `EMPTY`
- `imageDataBoard` or parsed board representation (optional)

### UI Behavior
- The `Create Grid` button reveals manual hint input areas.
- `Initialize Game` parses hints and constructs the board UI.
- The board is displayed as a table with one top row of column hints and one left column of row hints.
- Board cells are clickable to toggle states.
- A `Solve Nonogram` button becomes visible after initialization.
- A `Reset` button clears state and resets the UI.

### Input Formats
- Row hints: newline-separated rows, comma-separated numbers.
- Column hints: newline-separated columns, comma-separated numbers.
- Example input:
  - Row hints:
    - `2,1`
    - `3`
    - `1,1`
  - Column hints:
    - `1`
    - `2`
    - `1,1`

### Image Upload
- Use `<input type="file" accept="image/png, image/jpeg">`.
- Validate file type.
- Read file as a data URL using `FileReader`.
- Load into an `Image` object.
- Draw into a hidden `<canvas>` with a target size based on detected grid or user-selected size.
- Sample pixel brightness for each cell region.
- Convert brightness to binary fill state using a threshold.
- Support at least simple black/white nonogram image templates.
- Derive row and column run-length hints from the binary board.
- Populate manual hint textareas and render the parsed board.

### Solver Requirements
- The solver algorithm should make deterministic progress using line solving:
  - For each row and column, compute possible filled cell placements from hints.
  - Mark cells that are always filled or always empty across all valid placements.
  - Repeat until no further progress.
- If deterministic solving does not finish, optionally backtrack to find a complete solution.
- The solver should update the board display on success.
- The solver should not require server-side execution.

### Validation & Error Handling
- Validate that row and column hint counts match the selected grid size.
- Validate that row/column hints are numeric and positive.
- Show an error message if manual or image input is invalid.
- Show a warning if the image cannot be parsed into a clean nonogram.

---

## Implementation Phases

### Phase 1: Basic UI and Manual Board
- Rewrite `index.html` with full controls.
- Implement board creation and hint parsing in `js/setup.js`.
- Render interactive table cells and manual toggling.
- Add `Solve` and `Reset` actions.

### Phase 2: Image Upload and Parsing
- Add file input and image preview.
- Implement client-side image load and canvas extraction.
- Derive binary board data and hints.
- Connect parsed image results to the manual board flow.

### Phase 3: Solver Logic
- Implement deterministic line solving.
- Add fallback search/backtracking if needed.
- Validate solver results and display final board.

### Phase 4: Polish and Deployment
- Improve UI styling and responsiveness.
- Test on local static hosting.
- Prepare for GitHub Pages deployment.
- Add README usage instructions if desired.

---

## GitHub Pages Notes
- The app is fully static and can be published as-is.
- No `.htaccess` or server code is required.
- Use GitHub Pages from the repository settings or a `gh-pages` branch.
- Ensure all resources use relative paths (`css/style.css`, `js/setup.js`).

---

## Success Criteria
- The app allows manual hint input and board interaction.
- The app accepts a PNG/JPG image upload and derives a nonogram board.
- The solver returns a final board display in the browser.
- The project works when opened locally and can be hosted on GitHub Pages.

---

## Future Improvements
- Add TypeScript for stronger typing and maintainability.
- Improve image parsing with better grid detection and more flexible image formats.
- Add puzzle saving/loading via JSON or localStorage.
- Add step-by-step solver visualization.
- Support larger boards with responsive scaling.
