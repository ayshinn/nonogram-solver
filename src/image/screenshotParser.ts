import type { Hints } from "../types";
import { detectGrid } from "./detectGrid";
import {
  cropImageData,
  extractHintRegions,
  type HintStrip,
} from "./extractHintRegions";
import { recognizeStrip, type StripResult } from "./ocr";
import { fileToImageData } from "./parser";

export interface ParsedScreenshot {
  readonly hints: Hints;
  readonly rowConfidences: readonly number[]; // 0..100 per row
  readonly colConfidences: readonly number[]; // 0..100 per col
  readonly detectionConfidence: number; // 0..1
}

export interface ScreenshotParserOptions {
  readonly onProgress?: (done: number, total: number) => void;
}

async function recognizeOneStrip(
  imageData: ImageData,
  strip: HintStrip,
): Promise<StripResult> {
  const crop = cropImageData(
    imageData,
    strip.x,
    strip.y,
    strip.w,
    strip.h,
  );
  return recognizeStrip(crop);
}

export async function parseScreenshotImage(
  imageData: ImageData,
  expectedN: number,
  opts: ScreenshotParserOptions = {},
): Promise<ParsedScreenshot> {
  const detection = detectGrid(imageData, expectedN);
  if (!detection) {
    throw new Error(
      `Could not find a ${expectedN}×${expectedN} grid in the screenshot`,
    );
  }
  const { gridBox, n, confidence } = detection;
  const regions = extractHintRegions(imageData.width, imageData.height, gridBox, n);

  const total = regions.rowStrips.length + regions.colStrips.length;
  let done = 0;
  const tick = () => {
    done++;
    opts.onProgress?.(done, total);
  };

  const rowResults: StripResult[] = [];
  for (const s of regions.rowStrips) {
    const r = await recognizeOneStrip(imageData, s);
    rowResults.push(r);
    tick();
  }
  const colResults: StripResult[] = [];
  for (const s of regions.colStrips) {
    const r = await recognizeOneStrip(imageData, s);
    colResults.push(r);
    tick();
  }

  const hints: Hints = {
    size: n,
    rows: rowResults.map((r) => r.digits),
    cols: colResults.map((r) => r.digits),
  };
  return {
    hints,
    rowConfidences: rowResults.map((r) => r.confidence),
    colConfidences: colResults.map((r) => r.confidence),
    detectionConfidence: confidence,
  };
}

export async function parseScreenshotFile(
  file: File,
  expectedN: number,
  opts: ScreenshotParserOptions = {},
): Promise<ParsedScreenshot> {
  const imageData = await fileToImageData(file);
  return parseScreenshotImage(imageData, expectedN, opts);
}

export function formatHintsAsText(
  lines: readonly (readonly number[])[],
): string {
  return lines.map((line) => (line.length === 0 ? "0" : line.join(","))).join("\n");
}
