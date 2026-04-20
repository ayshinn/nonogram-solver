const VALID_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg"]);

export function assertSupportedImage(file: File): void {
  if (!VALID_MIME_TYPES.has(file.type)) {
    throw new Error(
      `Unsupported file type "${file.type || "unknown"}" — use PNG or JPG`,
    );
  }
}

export async function fileToImageData(file: File): Promise<ImageData> {
  assertSupportedImage(file);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (err) {
    throw new Error(`Could not decode image: ${(err as Error).message}`);
  }
  try {
    return bitmapToImageData(bitmap);
  } finally {
    bitmap.close?.();
  }
}

export function bitmapToImageData(bitmap: ImageBitmap): ImageData {
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
