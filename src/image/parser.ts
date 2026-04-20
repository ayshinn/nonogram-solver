import { CellState, type Board } from "../types";
import { createBoard, setCell } from "../model/board";
import { sampleTile } from "./sampling";

const LUMINANCE_THRESHOLD = 128;
const VALID_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg"]);

export function parseImageData(imageData: ImageData, size: number): Board {
  if (imageData.width < size || imageData.height < size) {
    throw new Error(
      `Image is too small (${imageData.width}×${imageData.height}) for a ${size}×${size} grid`,
    );
  }
  const board = createBoard(size);
  const tileW = imageData.width / size;
  const tileH = imageData.height / size;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const lum = sampleTile(imageData, c * tileW, r * tileH, tileW, tileH);
      setCell(
        board,
        r,
        c,
        lum < LUMINANCE_THRESHOLD ? CellState.Filled : CellState.Empty,
      );
    }
  }

  return board;
}

export interface ParseImageResult {
  readonly board: Board;
  readonly warning?: string;
}

export async function parseImageFile(
  file: File,
  size: number,
): Promise<ParseImageResult> {
  if (!VALID_MIME_TYPES.has(file.type)) {
    throw new Error(
      `Unsupported file type "${file.type || "unknown"}" — use PNG or JPG`,
    );
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (err) {
    throw new Error(`Could not decode image: ${(err as Error).message}`);
  }

  try {
    const aspect = bitmap.width / bitmap.height;
    const warning =
      aspect < 0.85 || aspect > 1.15
        ? `Image aspect ratio is ${aspect.toFixed(2)}; expected roughly square — results may be misaligned.`
        : undefined;

    const imageData = bitmapToImageData(bitmap);
    const board = parseImageData(imageData, size);
    return warning ? { board, warning } : { board };
  } finally {
    bitmap.close?.();
  }
}

function bitmapToImageData(bitmap: ImageBitmap): ImageData {
  const w = bitmap.width;
  const h = bitmap.height;
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2d context from OffscreenCanvas");
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, w, h);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2d context from canvas");
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, w, h);
}
