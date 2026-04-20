import { describe, expect, it } from "vitest";
import {
  cropImageData,
  extractHintRegions,
} from "../../src/image/extractHintRegions";

describe("extractHintRegions", () => {
  const gridBox = { x: 100, y: 80, w: 200, h: 200 };

  it("produces N row strips and N col strips", () => {
    const regions = extractHintRegions(400, 400, gridBox, 5);
    expect(regions.rowStrips).toHaveLength(5);
    expect(regions.colStrips).toHaveLength(5);
  });

  it("col strips sit above the grid and tile its width", () => {
    const regions = extractHintRegions(400, 400, gridBox, 5);
    for (const s of regions.colStrips) {
      expect(s.axis).toBe("col");
      expect(s.y).toBe(0);
      expect(s.h).toBe(gridBox.y);
    }
    // First col strip starts at gridBox.x; last ends at gridBox.x + gridBox.w (±1).
    expect(regions.colStrips[0]!.x).toBe(gridBox.x);
    const last = regions.colStrips[4]!;
    expect(Math.abs(last.x + last.w - (gridBox.x + gridBox.w))).toBeLessThanOrEqual(1);
  });

  it("row strips sit to the left of the grid and tile its height", () => {
    const regions = extractHintRegions(400, 400, gridBox, 5);
    for (const s of regions.rowStrips) {
      expect(s.axis).toBe("row");
      expect(s.x).toBe(0);
      expect(s.w).toBe(gridBox.x);
    }
    expect(regions.rowStrips[0]!.y).toBe(gridBox.y);
    const last = regions.rowStrips[4]!;
    expect(Math.abs(last.y + last.h - (gridBox.y + gridBox.h))).toBeLessThanOrEqual(1);
  });

  it("indexes strips 0..n-1 in order", () => {
    const regions = extractHintRegions(400, 400, gridBox, 5);
    regions.rowStrips.forEach((s, i) => expect(s.index).toBe(i));
    regions.colStrips.forEach((s, i) => expect(s.index).toBe(i));
  });

  it("throws when grid touches the top edge (no col hints possible)", () => {
    expect(() =>
      extractHintRegions(400, 400, { x: 80, y: 0, w: 200, h: 200 }, 5),
    ).toThrow(/hints/i);
  });

  it("throws when grid touches the left edge (no row hints possible)", () => {
    expect(() =>
      extractHintRegions(400, 400, { x: 0, y: 80, w: 200, h: 200 }, 5),
    ).toThrow(/hints/i);
  });

  it("throws when grid extends beyond image bounds", () => {
    expect(() =>
      extractHintRegions(300, 300, { x: 100, y: 100, w: 250, h: 250 }, 5),
    ).toThrow(/bounds/i);
  });

  it("throws for n < 1", () => {
    expect(() => extractHintRegions(400, 400, gridBox, 0)).toThrow();
  });
});

describe("cropImageData", () => {
  function makeImageData(w: number, h: number, fill: number): ImageData {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = fill;
      data[i * 4 + 1] = fill;
      data[i * 4 + 2] = fill;
      data[i * 4 + 3] = 255;
    }
    return { data, width: w, height: h, colorSpace: "srgb" } as ImageData;
  }

  it("returns a sub-rectangle with the correct dimensions", () => {
    const src = makeImageData(10, 10, 200);
    const out = cropImageData(src, 2, 3, 4, 5);
    expect(out.width).toBe(4);
    expect(out.height).toBe(5);
    expect(out.data.length).toBe(4 * 5 * 4);
  });

  it("copies pixel values from the source region", () => {
    const src = makeImageData(4, 4, 100);
    // Paint a marker at (1,1)
    const i = (1 * 4 + 1) * 4;
    src.data[i] = 50;
    src.data[i + 1] = 60;
    src.data[i + 2] = 70;
    const out = cropImageData(src, 1, 1, 2, 2);
    expect(out.data[0]).toBe(50);
    expect(out.data[1]).toBe(60);
    expect(out.data[2]).toBe(70);
  });
});
