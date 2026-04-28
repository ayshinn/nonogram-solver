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

// Strip-level brightness channel choice: HSV value (max(R,G,B)) when the
// strip contains meaningfully saturated pixels, plain luminance otherwise.
// Plain luminance puts orange digits (~156) in a different band from white
// (255) — Otsu's refinement splits between them and drops one. V flattens
// hue variation but thickens greyscale anti-aliased edges (3 → 5, missing
// 6). Picking once per strip keeps the channel uniform across all pixels in
// that strip, avoiding the per-pixel mode-switch artifacts that distort
// digit shape inside a single-color strip.
function computeLuminance(imageData: ImageData): Uint8ClampedArray {
  const { width, height, data } = imageData;
  const total = width * height;
  let hasColor = false;
  let coloredCount = 0;
  const SAT_THRESHOLD = 40;
  const COLOR_FRAC_THRESHOLD = 0.005;
  for (let i = 0; i < total; i++) {
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max - min > SAT_THRESHOLD && max > 80) {
      coloredCount++;
      if (coloredCount > total * COLOR_FRAC_THRESHOLD) {
        hasColor = true;
        break;
      }
    }
  }
  const out = new Uint8ClampedArray(total);
  if (hasColor) {
    for (let i = 0; i < total; i++) {
      const r = data[i * 4]!;
      const g = data[i * 4 + 1]!;
      const b = data[i * 4 + 2]!;
      out[i] = Math.max(r, g, b);
    }
  } else {
    for (let i = 0; i < total; i++) {
      const r = data[i * 4]!;
      const g = data[i * 4 + 1]!;
      const b = data[i * 4 + 2]!;
      out[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
  }
  return out;
}

// Pick a binarization threshold robust to gradient backgrounds. A single Otsu
// pass on a strip with three levels (dark app chrome / gradient bg / text)
// lands the threshold at the chrome-vs-rest valley, lumping gradient bg with
// text. So we run Otsu again inside the initial foreground class to find the
// real bg/text split, and use the refined threshold when it's clearly shifted.
//
// Bimodal-foreground guard: when the original t1 already puts the subset
// well above mid-luminance (mean(subset) high), the strip's foreground is
// effectively text on dark background — refining further only carves a slice
// off the existing text (multi-color digits, anti-aliased edges) and hurts
// OCR. Refinement is meant for bg-pulled-into-fg cases (gradient bgs), where
// the subset mean sits well below the text peak.
function chooseThreshold(
  lum: Uint8ClampedArray,
  _width?: number,
  _height?: number,
): { threshold: number; invert: boolean } {
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
  if (process.env.OCR_DEBUG) {
    // eslint-disable-next-line no-console
    console.log(
      "[chooseThreshold] N=%d invert=%s t1=%d t2=%d subsetLen=%d",
      lum.length,
      invert,
      t1,
      t2,
      subset.length,
    );
  }
  // Only accept t2 when it's clearly shifted further into the foreground side.
  // For bright-text (invert=true), a real bg/text split pushes t2 well above
  // t1. If t2 stays near t1, pass 2 just bisected a unimodal subset — keep t1.
  const MIN_SHIFT = 30;
  if (invert && t2 > t1 + MIN_SHIFT) return { threshold: t2, invert };
  if (!invert && t2 < t1 - MIN_SHIFT) return { threshold: t2, invert };
  return { threshold: t1, invert };
}

// Binarize via Otsu and auto-invert dark-mode screenshots so text is always
// dark on a light field. The downstream bilinear upscale smooths these hard
// black/white edges into anti-aliased ones, which the LSTM recognizer handles
// well. Going all-grayscale (skipping Otsu) let gradient bg / noise survive
// into OCR and caused digit confusions.
//
// Optional pre-computed threshold/invert lets the caller share one decision
// across both tightenColStrip's ink detection and the actual binarization.
// Without that, a tightened strip with multi-colored text (e.g. orange "15"
// next to white "5,2,1") gets a refined threshold that puts the orange on
// the wrong side of the split, dropping it from the OCR input.
export function preprocessForOcr(
  imageData: ImageData,
  presetDecision?: { threshold: number; invert: boolean },
): ImageData {
  const { width, height } = imageData;
  const lum = computeLuminance(imageData);
  const { threshold, invert } =
    presetDecision ?? chooseThreshold(lum, width, height);

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

// Bilinear upscaling. Small hint strips OCR poorly at native size; tesseract
// wants ~30px glyphs. A 3× scale lands phone-screenshot digits in the sweet
// spot. Bilinear (not nearest-neighbor) preserves glyph antialiasing — the
// LSTM recognizer is trained on smooth edges, and blocky stair-stepped edges
// can make a "5" get misread as "3".
function upscale(imageData: ImageData, factor: number): ImageData {
  const { width: w, height: h, data } = imageData;
  const newW = w * factor;
  const newH = h * factor;
  const out = new Uint8ClampedArray(newW * newH * 4);
  for (let y = 0; y < newH; y++) {
    const sy = (y + 0.5) / factor - 0.5;
    const y0 = Math.max(0, Math.floor(sy));
    const y1 = Math.min(h - 1, y0 + 1);
    const fy = Math.max(0, Math.min(1, sy - y0));
    for (let x = 0; x < newW; x++) {
      const sx = (x + 0.5) / factor - 0.5;
      const x0 = Math.max(0, Math.floor(sx));
      const x1 = Math.min(w - 1, x0 + 1);
      const fx = Math.max(0, Math.min(1, sx - x0));
      const d = (y * newW + x) * 4;
      for (let c = 0; c < 4; c++) {
        const p00 = data[(y0 * w + x0) * 4 + c]!;
        const p01 = data[(y0 * w + x1) * 4 + c]!;
        const p10 = data[(y1 * w + x0) * 4 + c]!;
        const p11 = data[(y1 * w + x1) * 4 + c]!;
        const top = p00 * (1 - fx) + p01 * fx;
        const bot = p10 * (1 - fx) + p11 * fx;
        out[d + c] = Math.round(top * (1 - fy) + bot * fy);
      }
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
//
// Exception: two same-digit symbols whose combined span is > 1.5× a single char
// width are adjacent twins (e.g. the two "1"s in "11" with slightly overlapping
// bboxes). Don't merge those — they represent two distinct digit slots.
function dedupeOverlapping(symbols: readonly DigitSymbol[]): DigitSymbol[] {
  const out: DigitSymbol[] = [];
  for (const s of symbols) {
    let isDuplicate = false;
    for (let i = 0; i < out.length; i++) {
      const prev = out[i]!;
      const dx =
        Math.min(prev.bbox.x1, s.bbox.x1) -
        Math.max(prev.bbox.x0, s.bbox.x0);
      const dy =
        Math.min(prev.bbox.y1, s.bbox.y1) -
        Math.max(prev.bbox.y0, s.bbox.y0);
      if (dx > 0 && dy > 0) {
        if (prev.text === s.text) {
          const spanX = Math.max(prev.bbox.x1, s.bbox.x1) - Math.min(prev.bbox.x0, s.bbox.x0);
          const maxW = Math.max(prev.bbox.x1 - prev.bbox.x0, s.bbox.x1 - s.bbox.x0);
          const spanY = Math.max(prev.bbox.y1, s.bbox.y1) - Math.min(prev.bbox.y0, s.bbox.y0);
          const maxH = Math.max(prev.bbox.y1 - prev.bbox.y0, s.bbox.y1 - s.bbox.y0);
          if (spanX > maxW * 1.5 || spanY > maxH * 1.5) break; // adjacent twins — keep both
        }
        if (s.confidence > prev.confidence) out[i] = s;
        isDuplicate = true;
        break;
      }
    }
    if (!isDuplicate) out.push(s);
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
    // Hint values are always >= 1; a "0" reading is always spurious noise
    // (background artifact misread, or a hollow shape mistaken for a 0).
    if (Number.isInteger(n) && n >= 1) digits.push(n);
    for (const s of g) if (s.confidence < minConfidence) minConfidence = s.confidence;
  }
  return { digits, minConfidence };
}

// Group symbols into hint numbers.
//
// Row strips: digits flow left-to-right. We use centroid-to-centroid distance
// rather than raw bbox gap. Bbox gaps are unreliable on wide digits (2,3,5,8)
// that nearly fill their slot — the gap between adjacent hint numbers can be
// smaller than the gap between digits within a multi-digit number. Centroid
// distance is ~1 slot pitch within a hint, ~1.5+ slot pitches between hints.
// Threshold at 1.2× median char width separates the two cleanly.
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
    if (deduped.length === 1) return digitsFromGroups([[deduped[0]!]]);

    const centers = deduped.map((s) => (s.bbox.x0 + s.bbox.x1) / 2);
    const distances: number[] = [];
    for (let i = 1; i < centers.length; i++) {
      distances.push(centers[i]! - centers[i - 1]!);
    }
    const widths = deduped.map((s) => s.bbox.x1 - s.bbox.x0).sort((a, b) => a - b);
    const maxW = widths[widths.length - 1] ?? 0;

    // Centroid distances cluster bimodally: intra-hint slot pitch (small) and
    // inter-hint pitch (slot pitch + extra space). When the min/max ratio is
    // close to 1, every distance is inter-hint — there are no multi-digit
    // hints and everything should split. When the ratio is meaningfully below
    // 1, the midpoint between min and max cleanly separates the two clusters.
    // Bbox-gap (or width-times-constant) thresholds fail because the slot
    // pitch varies between screenshots: skycastle's slot pitch is barely
    // larger than its digit width, so a width-based threshold over-merges.
    let pitchThreshold: number;
    if (distances.length === 1) {
      pitchThreshold = Math.max(8, maxW * 1.3);
    } else {
      const sortedD = [...distances].sort((a, b) => a - b);
      const minD = sortedD[0]!;
      const maxD = sortedD[sortedD.length - 1]!;
      if (minD >= maxD * 0.85) {
        pitchThreshold = 0; // uniform spacing → split everything
      } else {
        pitchThreshold = (minD + maxD) / 2;
      }
    }

    const groups: DigitSymbol[][] = [[deduped[0]!]];
    for (let i = 1; i < deduped.length; i++) {
      if (distances[i - 1]! > pitchThreshold) groups.push([deduped[i]!]);
      else groups[groups.length - 1]!.push(deduped[i]!);
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

// Crop a col strip to its bottom-most ink cluster (the hint area immediately
// above the grid). In un-cropped screenshots the col strip spans from the top
// of the image, so it can capture unrelated chrome: puzzle number labels,
// "hint" buttons, navigation icons — tesseract reads their edges as spurious
// digits. By finding the large gap between chrome and hints and cropping below
// it, OCR only sees the real hint stack.
//
// Returns the cropped strip plus the threshold/invert decision computed on
// the *original* strip. Reusing that decision for the downstream binarization
// avoids the case where a tightened strip's narrower histogram pushes Otsu
// past one of the foreground colors (e.g. orange digits sitting between dark
// bg and bright white digits — a refined per-tightened-strip Otsu can land
// between them and drop the orange ones).
function tightenColStrip(
  strip: ImageData,
  presetDecision?: { threshold: number; invert: boolean },
  padBottom: number = 6,
): { strip: ImageData; decision: { threshold: number; invert: boolean } } {
  const { width: w, height: h, data } = strip;
  const lum = computeLuminance(strip);
  const decision = presetDecision ?? chooseThreshold(lum, w, h);
  if (h < 20) return { strip, decision };
  const { threshold, invert } = decision;

  const inkPerRow = new Int32Array(h);
  for (let y = 0; y < h; y++) {
    let count = 0;
    for (let x = 0; x < w; x++) {
      const v = lum[y * w + x]!;
      const isDark = v <= threshold;
      const fg = invert ? !isDark : isDark;
      if (fg) count++;
    }
    inkPerRow[y] = count;
  }
  const inkMin = Math.max(1, Math.floor(w * 0.03));

  let bottom = h - 1;
  while (bottom >= 0 && inkPerRow[bottom]! < inkMin) bottom--;
  if (bottom < 0) return { strip, decision };

  // Tolerate small inter-line gaps within the hint stack (lines are typically
  // ~char-height apart with a few px of padding); break only on the much
  // larger gap that separates the hint stack from chrome above it.
  const maxInnerGap = Math.max(30, Math.floor(h * 0.12));
  let top = bottom;
  let gapRun = 0;
  for (let y = bottom - 1; y >= 0; y--) {
    if (inkPerRow[y]! >= inkMin) {
      top = y;
      gapRun = 0;
    } else if (++gapRun > maxInnerGap) {
      break;
    }
  }

  // padBottom is caller-controlled. Two regimes co-exist:
  // - 6 px (default): a context buffer below the bottommost glyph. Most
  //   fixtures need this — over-tight bottom can flip a "3" to a "5", etc.
  // - 0 px: flush to last ink row. galaxy30 col 16's bottom "6" misreads as
  //   "3" with any bottom padding (extra whitespace below the loop confuses
  //   the LSTM). The dual-pass logic in `recognizeStrip` runs both regimes
  //   and keeps the higher-confidence reading per strip.
  const padTop = 6;
  const y0 = Math.max(0, top - padTop);
  const y1 = Math.min(h, bottom + 1 + padBottom);
  if (y0 === 0 && y1 === h) return { strip, decision };

  const newH = y1 - y0;
  const newData = new Uint8ClampedArray(w * newH * 4);
  for (let y = 0; y < newH; y++) {
    const srcOff = (y + y0) * w * 4;
    const dstOff = y * w * 4;
    newData.set(data.subarray(srcOff, srcOff + w * 4), dstOff);
  }
  const cropped = { data: newData, width: w, height: newH, colorSpace: "srgb" } as ImageData;
  return { strip: cropped, decision };
}

async function recognizeStripOnce(
  worker: Worker,
  stripInput: ImageData,
  axis: StripAxis,
  presetDecision: { threshold: number; invert: boolean } | undefined,
): Promise<StripResult> {
  const preprocessed = preprocessForOcr(stripInput, presetDecision);
  const upscaled = upscale(preprocessed, 3);
  const input = await imageDataToRecognizable(upscaled);
  const { data } = await worker.recognize(input, {}, { blocks: true });
  const rawText = data.text ?? "";
  const symbols = extractDigitSymbols(data);
  const { digits, minConfidence } = groupSymbolsIntoHints(symbols, axis);
  if (process.env.OCR_DEBUG) {
    // eslint-disable-next-line no-console
    console.log(
      "[ocr] axis=%s w=%d h=%d text=%j digits=%j syms=%d minConf=%s",
      axis,
      stripInput.width,
      stripInput.height,
      rawText,
      digits,
      symbols.length,
      minConfidence.toFixed(1),
    );
  }
  return {
    digits,
    confidence: symbols.length > 0 ? minConfidence : data.confidence ?? 0,
    rawText,
  };
}

export async function recognizeStrip(
  imageData: ImageData,
  axis: StripAxis = "col",
  presetDecision?: { threshold: number; invert: boolean },
): Promise<StripResult> {
  const worker = await getWorker();
  // SINGLE_BLOCK handles both axes reliably: isolated single digits and
  // vertically-stacked col hints both OCR cleanly, whereas SPARSE_TEXT
  // silently drops strips with a single glyph.
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
  });

  if (axis !== "col") {
    return recognizeStripOnce(worker, imageData, axis, presetDecision);
  }

  // Dual-pass for col strips. tightenColStrip's bottom padding is a tradeoff:
  // 6 px of bottom whitespace gives the LSTM context most fixtures need, but
  // for some glyphs (notably a closed-loop "6" sitting near the strip's
  // bottom) any extra whitespace below the loop causes the LSTM to read it
  // as an open-bottom "3". Run both regimes and take whichever returns the
  // higher minimum-symbol confidence.
  const padded = tightenColStrip(imageData, presetDecision, 6).strip;
  const flush = tightenColStrip(imageData, presetDecision, 0).strip;
  const rA = await recognizeStripOnce(worker, padded, axis, presetDecision);
  const rB = await recognizeStripOnce(worker, flush, axis, presetDecision);
  // Prefer the padded pass by default — flush can drop a glyph if the strip's
  // bottom is too aggressive. Only switch to flush when both passes detect the
  // same number of digits (so neither lost a glyph) and flush has higher
  // minimum-symbol confidence.
  if (rA.digits.length === rB.digits.length && rB.confidence > rA.confidence) {
    return rB;
  }
  return rA;
}
