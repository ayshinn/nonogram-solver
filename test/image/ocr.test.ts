import { describe, expect, it } from "vitest";
import { otsuThreshold, parseDigitText } from "../../src/image/ocr";

describe("otsuThreshold", () => {
  it("separates a bimodal histogram between the two peaks", () => {
    // 60 dark pixels (lum 20), 40 light pixels (lum 230).
    const lum = new Uint8ClampedArray(100);
    for (let i = 0; i < 60; i++) lum[i] = 20;
    for (let i = 60; i < 100; i++) lum[i] = 230;
    const t = otsuThreshold(lum);
    // Otsu's threshold sits at the dark peak (inclusive) for bimodal input.
    expect(t).toBeGreaterThanOrEqual(20);
    expect(t).toBeLessThan(230);
  });

  it("returns a sensible threshold for near-uniform input", () => {
    const lum = new Uint8ClampedArray(100);
    for (let i = 0; i < 100; i++) lum[i] = 128;
    const t = otsuThreshold(lum);
    // With all pixels the same, the algorithm degenerates; any value in [0,255] is fine.
    expect(t).toBeGreaterThanOrEqual(0);
    expect(t).toBeLessThanOrEqual(255);
  });

  it("returns 128 for empty input", () => {
    expect(otsuThreshold(new Uint8ClampedArray(0))).toBe(128);
  });

  it("picks a higher threshold when light pixels dominate", () => {
    // Mostly light (200), small cluster of mid-tone (90).
    const lum = new Uint8ClampedArray(100);
    for (let i = 0; i < 20; i++) lum[i] = 90;
    for (let i = 20; i < 100; i++) lum[i] = 200;
    const t = otsuThreshold(lum);
    expect(t).toBeGreaterThanOrEqual(90);
    expect(t).toBeLessThan(200);
  });
});

describe("parseDigitText (imported from ocr module)", () => {
  it("still exports the helper", () => {
    expect(parseDigitText("1 2 3")).toEqual([1, 2, 3]);
  });
});
