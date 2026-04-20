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

// Otsu's method: pick the threshold that maximizes inter-class variance
// between "dark" and "light" pixels. Returns a value in [0, 255].
export function otsuThreshold(luminance: Uint8ClampedArray): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < luminance.length; i++) {
    const v = luminance[i]!;
    hist[v] = hist[v]! + 1;
  }
  const total = luminance.length;
  if (total === 0) return 128;

  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t]!;

  let sumB = 0;
  let wB = 0;
  let maxVar = -1;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > maxVar) {
      maxVar = between;
      threshold = t;
    }
  }
  return threshold;
}

function computeLuminance(imageData: ImageData): Uint8ClampedArray {
  const { width, height, data } = imageData;
  const out = new Uint8ClampedArray(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    out[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return out;
}

// Render an ImageData into a canvas Tesseract can consume.
// Binarizes via Otsu so faint digits become crisp black-on-white, and auto-
// inverts for dark-mode screenshots so text is always dark on a light field.
function toCanvas(imageData: ImageData): HTMLCanvasElement {
  const { width, height } = imageData;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d context");

  const lum = computeLuminance(imageData);
  const threshold = otsuThreshold(lum);

  let darkCount = 0;
  for (let i = 0; i < lum.length; i++) if (lum[i]! <= threshold) darkCount++;
  const invert = darkCount > lum.length / 2; // dark-mode: more dark than light

  const out = ctx.createImageData(width, height);
  for (let i = 0; i < lum.length; i++) {
    const isDark = lum[i]! <= threshold;
    const foreground = invert ? !isDark : isDark;
    const v = foreground ? 0 : 255;
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
