import { expect, test, type Locator } from "@playwright/test";

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

test("imports a primitive SVG in the editor and rejects invalid SVG", async ({
  page,
}) => {
  await page.goto("/editor.html");

  await expect(page.getByRole("heading", { name: "Assets" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Inspector" })).toBeVisible();

  const fileInput = page.locator("#svg-file-input");
  const validSvg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100">',
    '<path fill="#ffcf4a" d="M -50 0 C -50 -33 -21 -50 0 -50 C 21 -50 50 -33 50 0 C 50 33 21 50 0 50 C -21 50 -50 33 -50 0 Z" />',
    "</svg>",
  ].join("");

  await fileInput.setInputFiles({
    name: "uploaded-face.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(validSvg),
  });

  await expect(page.getByRole("button", { name: "uploaded-face" })).toBeVisible();
  await expect(page.locator("#inspector-fields")).toContainText("uploaded-face");
  await expect(page.locator("#inspector-fields")).toContainText("#ffcf4a");

  const editorDebugState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;

    if (!debug) {
      return null;
    }

    return {
      selectedAssetId: debug.getSelectedAssetId(),
      importedAsset: debug
        .getAssets()
        .find((candidate) => candidate.id === "uploaded-face"),
      lastImportError: debug.getLastImportError(),
    };
  });

  expect(editorDebugState?.selectedAssetId).toBe("uploaded-face");
  expect(editorDebugState?.importedAsset?.viewBox).toEqual([-50, -50, 100, 100]);
  expect(editorDebugState?.importedAsset?.sourceUrl).toBe("local:uploaded-face.svg");
  expect(editorDebugState?.lastImportError).toBeNull();

  await page.screenshot({
    path: "test-results/editor-import.png",
    fullPage: true,
  });

  const vectorCanvas = page.locator("#vector-canvas");
  const yellowPixels = await countWarmYellowPixels(vectorCanvas);
  expect(yellowPixels).toBeGreaterThan(2_000);

  const invalidSvg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    '<path fill="#ffcf4a" d="M 0 0 L 50 0 L 50 50 Z" />',
    '<path fill="#ffcf4a" stroke="#111827" d="M 10 10 L 20 10 L 20 20 Z" />',
    "</svg>",
  ].join("");

  await fileInput.setInputFiles({
    name: "bad-asset.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(invalidSvg),
  });

  await expect(page.locator("#import-error")).toBeVisible();
  await expect(page.locator("#import-error")).toContainText(
    "primitive SVG assets must contain exactly one path",
  );

  const invalidImportState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;

    if (!debug) {
      return null;
    }

    return {
      hasBadAsset: debug.getAssets().some((asset) => asset.id === "bad-asset"),
      lastImportError: debug.getLastImportError(),
    };
  });

  expect(invalidImportState?.hasBadAsset).toBe(false);
  expect(invalidImportState?.lastImportError).toContain("bad-asset");
});

async function countWarmYellowPixels(vectorCanvas: Locator): Promise<number> {
  return vectorCanvas.evaluate((canvas) => {
    const context = canvas.getContext("2d");

    if (!context) {
      return 0;
    }

    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let matchingPixels = 0;

    for (let index = 0; index < data.length; index += 4) {
      const red = data[index] ?? 0;
      const green = data[index + 1] ?? 0;
      const blue = data[index + 2] ?? 0;
      const alpha = data[index + 3] ?? 0;

      if (red > 220 && green > 150 && green < 235 && blue < 120 && alpha > 180) {
        matchingPixels += 1;
      }
    }

    return matchingPixels;
  });
}
