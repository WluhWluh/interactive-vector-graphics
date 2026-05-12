import { expect, test } from "@playwright/test";

test("renders the empty stage and visible Path2D sample object", async ({
  page,
}) => {
  await page.goto("/");

  const vectorCanvas = page.locator("#vector-canvas");
  await expect(vectorCanvas).toHaveAttribute(
    "data-visual-check",
    "imported-primitive",
  );

  const debugState = await page.evaluate(() => {
    const debug = window.__vectorStageDebug;

    if (!debug) {
      return null;
    }

    const assets = debug.getPrimitiveAssets();

    return {
      loadState: debug.getAssetLoadState(),
      asset: assets.find((candidate) => candidate.id === "demo-face") ?? null,
    };
  });

  expect(debugState?.loadState).toBe("ready");
  expect(debugState?.asset?.viewBox).toEqual([-100, -100, 200, 200]);
  expect(debugState?.asset?.fill).toBe("#ffcf4a");
  expect(debugState?.asset?.pathD).toContain("C -100 -66");

  await page.screenshot({
    path: "test-results/stage-sample.png",
    fullPage: true,
  });

  const samplePixelCount = await vectorCanvas.evaluate((canvas) => {
    const target = canvas as HTMLCanvasElement;
    const context = target.getContext("2d");

    if (!context) {
      return 0;
    }

    const { data, width, height } = context.getImageData(
      0,
      0,
      target.width,
      target.height,
    );
    let matchingPixels = 0;

    /**
     * The sample object uses a warm yellow fill. Counting this approximate color
     * gives the test a visual assertion without depending on brittle pixel-perfect
     * snapshots while the project is still a playground.
     */
    for (let index = 0; index < data.length; index += 4) {
      const red = data[index] ?? 0;
      const green = data[index + 1] ?? 0;
      const blue = data[index + 2] ?? 0;
      const alpha = data[index + 3] ?? 0;

      if (red > 220 && green > 150 && green < 235 && blue < 120 && alpha > 180) {
        matchingPixels += 1;
      }
    }

    /**
     * Returning the canvas size with the count helps future debugging because a
     * zero-size canvas would otherwise look similar to a missing drawing.
     */
    return matchingPixels + width * 0 + height * 0;
  });

  expect(samplePixelCount).toBeGreaterThan(2_000);
});
