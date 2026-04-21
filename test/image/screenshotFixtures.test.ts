// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { PNG } from "pngjs";
import { afterAll, describe, expect, it } from "vitest";
import { parseScreenshotImage } from "../../src/image/screenshotParser";
import { terminateOcrWorker } from "../../src/image/ocr";
import type { Hints } from "../../src/types";

const FIXTURES_DIR = join(__dirname, "..", "fixtures", "screenshots");

interface Fixture {
  readonly name: string;
  readonly pngPath: string;
  readonly expected: Hints;
}

function loadFixtures(): Fixture[] {
  const files = readdirSync(FIXTURES_DIR);
  const pngs = files.filter((f) => f.endsWith(".png"));
  return pngs.map((png) => {
    const name = basename(png, ".png");
    const jsonPath = join(FIXTURES_DIR, `${name}.json`);
    const expected = JSON.parse(readFileSync(jsonPath, "utf8")) as Hints;
    return { name, pngPath: join(FIXTURES_DIR, png), expected };
  });
}

function hasGroundTruth(h: Hints): boolean {
  return h.rows.length > 0 && h.cols.length > 0;
}

function decodePng(path: string): ImageData {
  const buf = readFileSync(path);
  const png = PNG.sync.read(buf);
  const data = new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.byteLength);
  return { width: png.width, height: png.height, data, colorSpace: "srgb" } as ImageData;
}

describe("screenshot fixtures — end-to-end OCR", () => {
  const fixtures = loadFixtures();

  afterAll(async () => {
    await terminateOcrWorker();
  });

  for (const fx of fixtures) {
    const hasTruth = hasGroundTruth(fx.expected);
    const runner = hasTruth ? it : it.skip;
    runner(
      `${fx.name}: parses to expected hints`,
      async () => {
        const imageData = decodePng(fx.pngPath);
        const result = await parseScreenshotImage(imageData, fx.expected.size);
        console.log(result.hints);
        expect(result.hints.size).toBe(fx.expected.size);
        expect(result.hints.rows).toEqual(fx.expected.rows);
        expect(result.hints.cols).toEqual(fx.expected.cols);
      },
      120_000,
    );
  }

  if (fixtures.every((f) => !hasGroundTruth(f.expected))) {
    it.skip("no ground truth populated yet — fill in rows/cols in the .json files", () => {});
  }
});
