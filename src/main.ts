// Phase 0 bootstrap: preserve legacy behavior under Vite.
// Phase 1 will replace this with a real app module graph.
import "../css/style.css";
import { createGrid, initializeGame, solveNonogram } from "../js/setup.js";

function bind(id: string, handler: () => void): void {
  const el = document.getElementById(id);
  if (el) el.addEventListener("click", handler);
}

function wire(): void {
  bind("createGridBtn", createGrid);
  bind("initializeGameBtn", initializeGame);
  bind("solveButton", solveNonogram);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", wire);
} else {
  wire();
}
