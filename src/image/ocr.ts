import { createWorker, PSM, type Worker } from "tesseract.js";

export interface StripResult {
  readonly digits: readonly number[];
  readonly confidence: number; // 0..100 from Tesseract
  readonly rawText: string;
}

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const w = await createWorker("eng");
      await w.setParameters({
        tessedit_char_whitelist: "0123456789",
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
      });
      return w;
    })();
  }
  return workerPromise;
}

export async function terminateOcrWorker(): Promise<void> {
  if (!workerPromise) return;
  const p = workerPromise;
  workerPromise = null;
  const w = await p;
  await w.terminate();
}

// Render an ImageData into a canvas Tesseract can consume.
// Applies a binarization pass first so faint digits become crisp black-on-white.
function toCanvas(imageData: ImageData, threshold = 150): HTMLCanvasElement {
  const { width, height, data } = imageData;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d context");
  const out = ctx.createImageData(width, height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    const v = lum < threshold ? 0 : 255;
    out.data[i * 4] = v;
    out.data[i * 4 + 1] = v;
    out.data[i * 4 + 2] = v;
    out.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

export function parseDigitText(text: string): number[] {
  return text
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => Number.parseInt(t, 10))
    .filter((n) => Number.isInteger(n) && n >= 0);
}

export async function recognizeStrip(
  imageData: ImageData,
): Promise<StripResult> {
  const worker = await getWorker();
  const canvas = toCanvas(imageData);
  const { data } = await worker.recognize(canvas);
  const rawText = data.text ?? "";
  return {
    digits: parseDigitText(rawText),
    confidence: data.confidence ?? 0,
    rawText,
  };
}
