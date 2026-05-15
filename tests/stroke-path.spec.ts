import { expect, test } from "@playwright/test";
import { countTealPixels } from "./helpers/canvasPixels";
import {
  createEditorProject,
  openEditor,
  uploadPrimitiveSvg,
} from "./helpers/editorActions";

test("imports and previews an open strokePath primitive", async ({ page }) => {
  await openEditor(page);
  await createEditorProject(page, "Stroke Project");

  const strokeSvg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    '<path fill="none" stroke="#5bc4bf" stroke-width="12" d="M 10 80 C 30 20 70 20 90 80" />',
    "</svg>",
  ].join("");

  await uploadPrimitiveSvg(page, {
    filename: "leg-stroke.svg",
    svgText: strokeSvg,
  });

  await expect(page.getByRole("button", { name: "Stroke: leg-stroke" })).toBeVisible();
  await expect(page.locator("#inspector-fields")).toContainText("strokePath");
  await expect(page.locator("#inspector-fields")).toContainText("#5bc4bf");
  await expect(page.locator("#inspector-fields")).toContainText("12");
  await expect(page.locator("#inspector-fields")).toContainText("Bezier Segments");
  await expect(page.locator("#inspector-fields")).toContainText("Closed Path");
  await page.getByRole("button", { name: "Source Path Edit" }).click();
  await page.locator("#create-3d-curve-button").click();
  await expect(page.getByRole("button", { name: "3D Curve: leg-stroke 3D Curve" })).toBeVisible();
  await expect(page.locator("#inspector-fields")).toContainText("bezierCurve3d");
  await expect(page.locator("#inspector-fields")).toContainText("3D Bezier Segments");
  await expect(page.getByLabel("3D path anchor Z")).toHaveValue("0");

  const initialCurve3dState = await page.evaluate(
    () => window.__vectorEditorDebug?.getPathEditState() ?? null,
  );

  expect(initialCurve3dState).toMatchObject({
    is3d: true,
    assetId: "leg-stroke-3d-curve",
    selectedSegmentId: "seg-1",
    selectedComponent: "anchor",
    hasDraft: true,
  });
  expect(initialCurve3dState?.draftBezierPath3d?.segments[0]?.anchor).toEqual([
    10,
    80,
    0,
  ]);
  expect(initialCurve3dState?.controls3d.length).toBeGreaterThanOrEqual(6);
  expect(initialCurve3dState?.projectedCommandCount).toBeGreaterThan(0);

  await page.getByLabel("3D path anchor Z").fill("18");
  await page.getByLabel("3D path anchor Z").blur();
  await expect(page.getByLabel("3D path anchor Z")).toHaveValue("18");
  await page.locator("#projection-toggle-button").click();
  await expect(page.locator("#projection-toggle-button")).toHaveText("Orthographic");
  await page.locator("#projection-toggle-button").click();
  await expect(page.locator("#projection-toggle-button")).toHaveText("Perspective");

  const editedCurve3dState = await page.evaluate(
    () => window.__vectorEditorDebug?.getPathEditState() ?? null,
  );

  expect(editedCurve3dState?.draftBezierPath3d?.segments[0]?.anchor).toEqual([
    10,
    80,
    18,
  ]);
  expect(await countTealPixels(page.locator("#vector-canvas"))).toBeGreaterThan(200);
  await page.locator("#save-path-button").click();
  await expect
    .poll(async () =>
      page.evaluate(
        () => window.__vectorEditorDebug?.getPathEditState().hasDraft ?? true,
      ),
    )
    .toBe(false);

  const savedCurve3dState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;
    const asset = debug
      ?.getAssets()
      .find((candidate) => candidate.id === "leg-stroke-3d-curve");

    return {
      selectedAssetId: debug?.getSelectedAssetId() ?? null,
      asset,
    };
  });

  expect(savedCurve3dState.selectedAssetId).toBe("leg-stroke-3d-curve");
  expect(savedCurve3dState.asset?.assetKind).toBe("bezierCurve3d");
  expect(savedCurve3dState.asset?.bezierPath3d?.segments[0]?.anchor).toEqual([
    10,
    80,
    18,
  ]);

  await page.getByRole("button", { name: "Asset Assembly" }).click();
  await page.getByRole("button", { name: "Add Primitive to Prefab" }).click();
  await expect(
    page.getByRole("button", { name: /Primitive: leg-stroke 3D Curve/ }),
  ).toBeVisible();
  await expect(await countTealPixels(page.locator("#vector-canvas"))).toBeGreaterThan(200);
  await page.getByRole("button", { name: "Source Path Edit" }).click();
  await page.getByRole("button", { name: "Stroke: leg-stroke" }).click();
  await page.locator("#edit-path-button").click();

  const secondHandleScreenPoint = await page.evaluate(() =>
    window.__vectorEditorDebug
      ?.getPathEditState()
      .controls.find(
        (control) =>
          control.segmentId === "seg-2" && control.component === "handleIn",
      ) ?? null,
  );

  expect(secondHandleScreenPoint).not.toBeNull();
  const strokePaperBox = await page.locator("#paper-canvas").boundingBox();
  expect(strokePaperBox).not.toBeNull();
  await page.mouse.click(
    strokePaperBox!.x + secondHandleScreenPoint!.x,
    strokePaperBox!.y + secondHandleScreenPoint!.y,
  );
  await expect(page.getByLabel("Path handleIn X")).toBeVisible();
  await page.getByLabel("Path handleIn X").fill("-24");
  await page.getByLabel("Path handleIn X").blur();
  await page.locator("#save-path-button").click();
  await expect
    .poll(async () =>
      page.evaluate(
        () => window.__vectorEditorDebug?.getPathEditState().hasDraft ?? true,
      ),
    )
    .toBe(false);
  await expect(page.locator("#edit-path-button")).toBeVisible();

  const strokeState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;
    const asset = debug?.getAssets().find((candidate) => candidate.id === "leg-stroke");

    return {
      asset,
      selectedAssetId: debug?.getSelectedAssetId() ?? null,
    };
  });

  expect(strokeState.asset).toMatchObject({
    assetKind: "strokePath",
    stroke: "#5bc4bf",
    strokeWidth: 12,
    bezierPath: {
      version: 1,
      closed: false,
    },
  });
  expect(strokeState.asset?.bezierPath.segments).toHaveLength(2);
  expect(strokeState.selectedAssetId).toBe("leg-stroke");
  expect(await countTealPixels(page.locator("#vector-canvas"))).toBeGreaterThan(300);

  await page.getByRole("button", { name: "Asset Assembly" }).click();
  await page.getByRole("button", { name: "Add Primitive to Prefab" }).click();
  await expect(
    page.getByRole("button", { name: "Primitive: leg-stroke", exact: true }),
  ).toBeVisible();
  await expect(await countTealPixels(page.locator("#vector-canvas"))).toBeGreaterThan(300);

  const closedStrokeSvg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    '<path fill="none" stroke="#5bc4bf" stroke-width="12" d="M 10 10 L 90 10 Z" />',
    "</svg>",
  ].join("");

  await uploadPrimitiveSvg(page, {
    filename: "closed-stroke.svg",
    svgText: closedStrokeSvg,
  });

  await expect(page.locator("#import-error")).toContainText(
    "open path without Z commands",
  );
  await expect(page.getByRole("button", { name: "Stroke: closed-stroke" })).toHaveCount(0);

  await page.getByRole("button", { name: "Delete Project" }).click();
  await expect(page.getByRole("button", { name: "Stroke Project" })).toHaveCount(0);
});

