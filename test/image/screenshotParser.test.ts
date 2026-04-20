import { describe, expect, it } from "vitest";
import { formatHintsAsText } from "../../src/image/screenshotParser";
import { parseDigitText } from "../../src/image/ocr";

describe("parseDigitText", () => {
  it("splits on whitespace and parses integers", () => {
    expect(parseDigitText("1 3")).toEqual([1, 3]);
    expect(parseDigitText("1\n3\n5")).toEqual([1, 3, 5]);
  });

  it("splits on commas too", () => {
    expect(parseDigitText("1,3,5")).toEqual([1, 3, 5]);
  });

  it("returns empty for empty or whitespace-only input", () => {
    expect(parseDigitText("")).toEqual([]);
    expect(parseDigitText("   \n  ")).toEqual([]);
  });

  it("filters non-numeric junk", () => {
    expect(parseDigitText("1 foo 3 ! 5")).toEqual([1, 3, 5]);
  });
});

describe("formatHintsAsText", () => {
  it("joins multi-digit lines with commas", () => {
    expect(formatHintsAsText([[1, 3], [5]])).toBe("1,3\n5");
  });

  it("renders empty lines as 0 (compatible with parseHintText)", () => {
    expect(formatHintsAsText([[], [3], []])).toBe("0\n3\n0");
  });
});
