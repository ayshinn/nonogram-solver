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

// Pick a binarization threshold robust to gradient backgrounds. A single Otsu
// pass on a strip with three levels (dark app chrome / gradient bg / text)
// lands the threshold at the chrome-vs-rest valley, lumping gradient bg with
// text. So we run Otsu again inside the initial foreground class to find the
// real bg/text split, and use the refined threshold when it's clearly shifted.
function chooseThreshold(lum: Uint8ClampedArray): { threshold: number; invert: boolean } {
  const t1 = otsuThreshold(lum);
  let darkCount = 0;
  for (let i = 0; i < lum.length; i++) if (lum[i]! <= t1) darkCount++;
  const invert = darkCount > lum.length / 2;

  const subset: number[] = [];
  for (let i = 0; i < lum.length; i++) {
    const v = lum[i]!;
    const isDark = v <= t1;
    const isForeground = invert ? !isDark : isDark;
    if (isForeground) subset.push(v);
  }
  if (subset.length < 50 || subset.length > lum.length * 0.9) {
    return { threshold: t1, invert };
  }
  const t2 = otsuThreshold(new Uint8ClampedArray(subset));
  // Only accept t2 when it's clearly shifted further into the foreground side.
  // For bright-text (invert=true), a real bg/text split pushes t2 well above
  // t1. If t2 stays near t1, pass 2 just bisected a unimodal subset — keep t1.
  const MIN_SHIFT = 30;
  if (invert && t2 > t1 + MIN_SHIFT) return { threshold: t2, invert };
  if (!invert && t2 < t1 - MIN_SHIFT) return { threshold: t2, invert };
  return { threshold: t1, invert };
}

// Binarize via Otsu and auto-invert dark-mode screenshots so text is always
// dark on a light field. Returns a new ImageData that Tesseract can consume
// directly (no DOM canvas required — works in Node and browser).
export function preprocessForOcr(imageData: ImageData): ImageData {
  const { width, height } = imageData;
  const lum = computeLuminance(imageData);
  const { threshold, invert } = chooseThreshold(lum);

  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < lum.length; i++) {
    const isDark = lum[i]! <= threshold;
    const foreground = invert ? !isDark : isDark;
    const v = foreground ? 0 : 255;
    data[i * 4] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { data, width, height, colorSpace: "srgb" } as ImageData;
}

export function parseDigitText(text: string): number[] {
  return text
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => Number.parseInt(t, 10))
    .filter((n) => Number.isInteger(n) && n >= 0);
}

// Tesseract's ImageLike type accepts Buffer/Canvas/etc. but not raw ImageData.
// In Node we encode to a PNG Buffer; in browser we paint onto a canvas. Either
// way the caller gets something recognize() is typed to accept.
async function imageDataToRecognizable(
  imageData: ImageData,
): Promise<Buffer | HTMLCanvasElement> {
  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2d context");
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }
  const { PNG } = await import("pngjs");
  const png = new PNG({ width: imageData.width, height: imageData.height });
  png.data = Buffer.from(
    imageData.data.buffer,
    imageData.data.byteOffset,
    imageData.data.byteLength,
  );
  return PNG.sync.write(png);
}

// Nearest-neighbor upscaling. Small hint strips OCR poorly at native size;
// tesseract wants ~30px char height. A 3× scale gets tiny phone-screenshot
// digits into the sweet spot.
function upscale(imageData: ImageData, factor: number): ImageData {
  const { width, height, data } = imageData;
  const newW = width * factor;
  const newH = height * factor;
  const out = new Uint8ClampedArray(newW * newH * 4);
  for (let y = 0; y < newH; y++) {
    const srcY = Math.floor(y / factor);
    for (let x = 0; x < newW; x++) {
      const srcX = Math.floor(x / factor);
      const srcOff = (srcY * width + srcX) * 4;
      const dstOff = (y * newW + x) * 4;
      out[dstOff] = data[srcOff]!;
      out[dstOff + 1] = data[srcOff + 1]!;
      out[dstOff + 2] = data[srcOff + 2]!;
      out[dstOff + 3] = data[srcOff + 3]!;
    }
  }
  return { data: out, width: newW, height: newH, colorSpace: "srgb" } as ImageData;
}

export type StripAxis = "row" | "col";

interface Bbox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface DigitSymbol {
  text: string;
  confidence: number;
  bbox: Bbox;
}

function extractDigitSymbols(data: unknown): DigitSymbol[] {
  const d = data as {
    blocks?: Array<{
      paragraphs?: Array<{
        lines?: Array<{
          words?: Array<{
            symbols?: Array<{
              text?: string;
              confidence?: number;
              bbox?: Bbox;
            }>;
          }>;
        }>;
      }>;
    }>;
  };
  const out: DigitSymbol[] = [];
  for (const b of d.blocks ?? []) {
    for (const p of b.paragraphs ?? []) {
      for (const l of p.lines ?? []) {
        for (const w of l.words ?? []) {
          for (const s of w.symbols ?? []) {
            if (s.text && /^\d$/.test(s.text) && s.bbox) {
              out.push({
                text: s.text,
                confidence: s.confidence ?? 0,
                bbox: s.bbox,
              });
            }
          }
        }
      }
    }
  }
  return out;
}

// Drop spatial duplicates: two glyphs shouldn't occupy the same 2D region, so
// any bbox overlap (in both x AND y) is a tesseract hallucination — keep the
// higher-confidence one. Checking 2D (not just the primary axis) matters for
// col strips, where side-by-side digits of a multi-digit number share a y-range
// but have disjoint x-ranges.
function dedupeOverlapping(symbols: readonly DigitSymbol[]): DigitSymbol[] {
  const out: DigitSymbol[] = [];
  for (const s of symbols) {
    let replaced = false;
    for (let i = 0; i < out.length; i++) {
      const prev = out[i]!;
      const dx =
        Math.min(prev.bbox.x1, s.bbox.x1) -
        Math.max(prev.bbox.x0, s.bbox.x0);
      const dy =
        Math.min(prev.bbox.y1, s.bbox.y1) -
        Math.max(prev.bbox.y0, s.bbox.y0);
      if (dx > 0 && dy > 0) {
        if (s.confidence > prev.confidence) out[i] = s;
        replaced = true;
        break;
      }
    }
    if (!replaced) out.push(s);
  }
  return out;
}

function digitsFromGroups(
  groups: readonly (readonly DigitSymbol[])[],
): { digits: number[]; minConfidence: number } {
  const digits: number[] = [];
  let minConfidence = 100;
  for (const g of groups) {
    const numStr = g.map((s) => s.text).join("");
    const n = Number.parseInt(numStr, 10);
    if (Number.isInteger(n)) digits.push(n);
    for (const s of g) if (s.confidence < minConfidence) minConfidence = s.confidence;
  }
  return { digits, minConfidence };
}

// Group symbols into hint numbers.
//
// Row strips: digits flow left-to-right. Hints are separated by wide horizontal
// gaps; digits within one multi-digit number nearly touch. A gap threshold of
// 0.5× median char width cleanly distinguishes the two.
//
// Col strips: hints are stacked vertically, one per line. Multi-digit numbers
// like "12" sit side-by-side on the same line, sharing a y-range. A single
// x-axis gap threshold can't express this, so we cluster by y-overlap into
// lines first, then concatenate x-sorted glyphs within each line.
function groupSymbolsIntoHints(
  symbols: readonly DigitSymbol[],
  axis: StripAxis,
): { digits: number[]; minConfidence: number } {
  if (symbols.length === 0) return { digits: [], minConfidence: 0 };

  if (axis === "row") {
    const sorted = [...symbols].sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const deduped = dedupeOverlapping(sorted);
    const widths = deduped.map((s) => s.bbox.x1 - s.bbox.x0).sort((a, b) => a - b);
    const medianW = widths[Math.floor(widths.length / 2)] ?? 0;
    const gapThreshold = Math.max(4, medianW * 0.5);

    const groups: DigitSymbol[][] = [[deduped[0]!]];
    for (let i = 1; i < deduped.length; i++) {
      const prev = deduped[i - 1]!;
      const cur = deduped[i]!;
      const gap = cur.bbox.x0 - prev.bbox.x1;
      if (gap > gapThreshold) groups.push([cur]);
      else groups[groups.length - 1]!.push(cur);
    }
    return digitsFromGroups(groups);
  }

  // axis === "col": cluster by y-line, then concat x-order within each line.
  const sorted = [...symbols].sort((a, b) => a.bbox.y0 - b.bbox.y0);
  const deduped = dedupeOverlapping(sorted);
  const heights = deduped.map((s) => s.bbox.y1 - s.bbox.y0).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] ?? 0;
  const overlapThreshold = Math.max(2, medianH * 0.4);

  const lines: DigitSymbol[][] = [];
  for (const s of deduped) {
    const last = lines[lines.length - 1];
    if (last) {
      const lineY0 = Math.min(...last.map((x) => x.bbox.y0));
      const lineY1 = Math.max(...last.map((x) => x.bbox.y1));
      const overlap = Math.min(lineY1, s.bbox.y1) - Math.max(lineY0, s.bbox.y0);
      if (overlap >= overlapThreshold) {
        last.push(s);
        continue;
      }
    }
    lines.push([s]);
  }
  for (const line of lines) line.sort((a, b) => a.bbox.x0 - b.bbox.x0);
  return digitsFromGroups(lines);
}

export async function recognizeStrip(
  imageData: ImageData,
  axis: StripAxis = "col",
): Promise<StripResult> {
  const worker = await getWorker();
  // SINGLE_BLOCK handles both axes reliably: isolated single digits and
  // vertically-stacked col hints both OCR cleanly, whereas SPARSE_TEXT
  // silently drops strips with a single glyph.
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
  });
  const preprocessed = preprocessForOcr(imageData);
  const upscaled = upscale(preprocessed, 3);
  const input = await imageDataToRecognizable(upscaled);
  const { data } = await worker.recognize(input, {}, { blocks: true });
  const rawText = data.text ?? "";
  const symbols = extractDigitSymbols(data);
  const { digits, minConfidence } = groupSymbolsIntoHints(symbols, axis);
  if (process.env.OCR_DEBUG) {
    // eslint-disable-next-line no-console
    console.log(
      "[ocr] axis=%s w=%d h=%d text=%j digits=%j syms=%d",
      axis,
      imageData.width,
      imageData.height,
      rawText,
      digits,
      symbols.length,
    );
  }
  return {
    digits,
    confidence: symbols.length > 0 ? minConfidence : data.confidence ?? 0,
    rawText,
  };
}
