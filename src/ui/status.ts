export type Tone = "info" | "error" | "success";

export function setStatus(message: string, tone: Tone = "info"): void {
  const el = document.getElementById("statusBar");
  if (!el) return;
  el.textContent = message;
  el.dataset.tone = tone;
}
