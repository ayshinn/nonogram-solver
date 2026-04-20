// Mean luminance of the center inner region of a tile.
// innerFraction selects the central window (default 60%) to avoid grid lines at tile edges.
export function sampleTile(
  imageData: ImageData,
  x: number,
  y: number,
  w: number,
  h: number,
  innerFraction = 0.6,
): number {
  const marginX = (w * (1 - innerFraction)) / 2;
  const marginY = (h * (1 - innerFraction)) / 2;
  const startX = Math.max(0, Math.floor(x + marginX));
  const startY = Math.max(0, Math.floor(y + marginY));
  const endX = Math.min(imageData.width, Math.ceil(x + w - marginX));
  const endY = Math.min(imageData.height, Math.ceil(y + h - marginY));

  let sum = 0;
  let count = 0;
  for (let py = startY; py < endY; py++) {
    for (let px = startX; px < endX; px++) {
      const i = (py * imageData.width + px) * 4;
      const r = imageData.data[i]!;
      const g = imageData.data[i + 1]!;
      const b = imageData.data[i + 2]!;
      sum += 0.299 * r + 0.587 * g + 0.114 * b;
      count++;
    }
  }

  return count > 0 ? sum / count : 255;
}
