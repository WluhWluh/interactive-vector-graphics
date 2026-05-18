import { expect, test } from "@playwright/test";

test("supports the editor v2 docking layout experiment", async ({ page }) => {
  await page.goto("/editor-v2.html");

  await expect(page.getByRole("navigation", { name: "Editor v2 menu" })).toBeVisible();
  await expect(page.locator('[data-content-type="viewport"]')).toBeVisible();
  await expect(page.locator(".editor-v2-area")).toHaveCount(5);
  await expect(page.locator(".editor-v2-corner")).toHaveCount(0);
  await expect(page.locator(".editor-v2-title-label").first()).toHaveText(" || ");
  await expect(page.locator(".editor-v2-workspace")).toHaveCSS("padding-top", "8px");
  await expect(page.locator(".editor-v2-split").first()).toHaveCSS("gap", "2px");
  const workspaceBox = await page.locator(".editor-v2-workspace").boundingBox();
  const rootSplitBox = await page.locator(".editor-v2-split").first().boundingBox();
  expect(workspaceBox).not.toBeNull();
  expect(rootSplitBox).not.toBeNull();
  expect(Math.round(rootSplitBox!.x - workspaceBox!.x)).toBe(8);

  const firstArea = page.locator(".editor-v2-area").first();
  const secondArea = page.locator(".editor-v2-area").nth(1);
  await firstArea.getByLabel("Area editor type").click();
  await page.getByRole("button", { name: "Console" }).first().click();
  await secondArea.getByLabel("Area editor type").click();
  await page.getByRole("button", { name: "Console" }).first().click();
  await expect(page.locator('[data-content-type="console"]')).toHaveCount(2);

  const firstSplitButton = firstArea.getByTitle("Split horizontally");
  await firstSplitButton.click();
  await expect(page.locator(".editor-v2-area")).toHaveCount(6);
  await expect(page.locator('[data-content-type="console"]')).toHaveCount(3);
  await expect(firstArea.getByLabel("Area editor type")).toHaveCSS("text-overflow", "ellipsis");
  await expect(firstArea.getByLabel("Area editor type")).toHaveCSS("white-space", "nowrap");

  const firstResizer = page.locator(".editor-v2-split-resizer").first();
  const resizerBox = await firstResizer.boundingBox();
  expect(resizerBox).not.toBeNull();
  await page.mouse.move(
    resizerBox!.x + resizerBox!.width / 2,
    resizerBox!.y + resizerBox!.height / 2,
  );
  await expect(firstResizer).toHaveCSS("cursor", "default");
  await expect(firstResizer).toHaveAttribute("data-hover-intent", "false");
  await expect(firstResizer).toHaveAttribute("data-hover-intent", "true", { timeout: 450 });
  await expect(firstResizer).toHaveCSS("cursor", "col-resize");
  await page.mouse.down();
  await page.mouse.move(resizerBox!.x + 90, resizerBox!.y + resizerBox!.height / 2);
  await expect(page.locator(".editor-v2-dock-line")).toBeVisible();
  await expect(page.locator(".editor-v2-dock-line")).toHaveCSS("border-radius", "3px");
  await page.mouse.up();
  await expect(page.locator(".editor-v2-dock-line")).toHaveCount(0);

  const resizedFingerprint = await page.evaluate(
    () => window.__editorV2Debug?.getFingerprint() ?? "",
  );
  expect(resizedFingerprint).toContain("split");

  const dropTargetProbe = await page.evaluate(() => {
    const source = document.querySelector<HTMLElement>(".editor-v2-area");
    const workspace = document.querySelector<HTMLElement>(".editor-v2-workspace");
    const root = workspace?.firstElementChild;
    const resizers = [...document.querySelectorAll<HTMLElement>(".editor-v2-split-resizer")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          direction: element.dataset.direction,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom,
        };
      });

    if (!(source && workspace && root instanceof HTMLElement)) {
      return null;
    }

    const workspaceRect = workspace.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const innerResizer = resizers.find(
      (resizer) =>
        resizer.direction === "horizontal" &&
        resizer.height < rootRect.height * 0.8 &&
        resizer.bottom + 32 < rootRect.bottom,
    );

    if (!innerResizer) {
      return null;
    }

    const sourceAreaId = source.dataset.areaId ?? "";
    const extensionTarget = window.__editorV2Debug?.getDropTargetAtPoint(
      innerResizer.left + innerResizer.width / 2,
      innerResizer.bottom + 24,
      sourceAreaId,
    );
    const outerTarget = window.__editorV2Debug?.getDropTargetAtPoint(
      rootRect.left - (rootRect.left - workspaceRect.left) / 2,
      rootRect.top + rootRect.height / 2,
      sourceAreaId,
    );

    return { extensionTarget, outerTarget };
  });

  expect(dropTargetProbe).not.toBeNull();
  expect(dropTargetProbe!.extensionTarget?.kind).not.toBe("boundary");
  expect(dropTargetProbe!.extensionTarget?.kind).not.toBe("workspace-boundary");
  expect(dropTargetProbe!.outerTarget?.kind).toBe("workspace-boundary");
  expect(dropTargetProbe!.outerTarget?.edge).toBe("left");

  const sourceHeader = page.locator(".editor-v2-area-header").first();
  const targetArea = page.locator(".editor-v2-area").last();
  const sourceHeaderBox = await sourceHeader.boundingBox();
  const targetBox = await targetArea.boundingBox();
  expect(sourceHeaderBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  await page.mouse.move(
    sourceHeaderBox!.x + 10,
    sourceHeaderBox!.y + sourceHeaderBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    sourceHeaderBox!.x + 24,
    sourceHeaderBox!.y + sourceHeaderBox!.height / 2 + 12,
  );
  await page.mouse.move(
    targetBox!.x + targetBox!.width * 0.84,
    targetBox!.y + targetBox!.height / 2,
  );
  await expect(page.locator(".editor-v2-dock-line")).toBeVisible();
  await expect(page.locator(".editor-v2-dock-arrow")).toBeVisible();
  await expect(page.locator(".editor-v2-dock-arrow path")).toHaveAttribute("d", /Q/);
  const areaHitLineBox = await page.locator(".editor-v2-dock-line").boundingBox();
  const areaHitArrowBox = await page.locator(".editor-v2-dock-arrow").boundingBox();
  expect(areaHitLineBox).not.toBeNull();
  expect(areaHitArrowBox).not.toBeNull();
  expect(Math.abs(Math.round(areaHitLineBox!.x - (targetBox!.x + targetBox!.width)))).toBeLessThanOrEqual(4);
  expect(areaHitArrowBox!.x).toBeLessThan(areaHitLineBox!.x);
  await page.mouse.up();
  await expect(page.locator(".editor-v2-area")).toHaveCount(6);

  await page.reload();
  await expect(page.locator('[data-content-type="console"]')).toHaveCount(3);
  await expect
    .poll(() => page.evaluate(() => window.__editorV2Debug?.getFingerprint() ?? ""))
    .toBe(resizedFingerprint);

  await page.getByRole("button", { name: "Layouts" }).click();
  await page.getByTitle("Upload cookie layout to project").click();
  await expect(page.locator(".editor-v2-layout-row")).toHaveCount(3);
  await expect(page.locator('.editor-v2-layout-row[data-active="true"]')).toHaveCount(2);

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("Rename project layout");
    await dialog.accept("Review Workspace");
  });
  await page.getByTitle("Rename layout").last().click();
  await expect(page.getByRole("button", { name: "Review Workspace" })).toBeVisible();

  await page.getByTitle("Delete layout").last().click();
  await expect(page.getByRole("dialog")).toContainText("Delete Layout");
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Layouts" }).click();
  await page.getByTitle("Delete layout").last().click();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("button", { name: "Review Workspace" })).toHaveCount(0);

  const projectLayoutCount = await page.evaluate(
    () => window.__editorV2Debug?.getProjectLayouts().length ?? -1,
  );
  expect(projectLayoutCount).toBe(1);
  const layoutDocumentText = await page.evaluate(
    () => JSON.stringify(window.__editorV2Debug?.getLayout() ?? null),
  );
  expect(layoutDocumentText).not.toContain("minWidth");
  expect(layoutDocumentText).not.toContain("minHeight");
});

test("clips compressed editor v2 areas inside their layout cells", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 360 });
  await page.goto("/editor-v2.html");

  const areaBoxes = await page.locator(".editor-v2-area").evaluateAll((areas) =>
    areas.map((area) => {
      const rect = area.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      };
    }),
  );

  for (let index = 0; index < areaBoxes.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < areaBoxes.length; otherIndex += 1) {
      const first = areaBoxes[index]!;
      const second = areaBoxes[otherIndex]!;
      const overlapWidth = Math.max(
        0,
        Math.min(first.right, second.right) - Math.max(first.left, second.left),
      );
      const overlapHeight = Math.max(
        0,
        Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top),
      );

      expect(overlapWidth * overlapHeight).toBe(0);
    }
  }
});

test("blocks editor v2 docking operations below the viewport minimum", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 360 });
  await page.goto("/editor-v2.html");

  await page.evaluate(() => {
    const layout = window.__editorV2Debug?.getLayout();
    const firstArea = layout?.root.kind === "split" ? layout.root.first : null;
    const secondNode = layout?.root.kind === "split" ? layout.root.second : null;

    if (!layout || !firstArea || !secondNode) {
      throw new Error("Unexpected editor v2 layout shape.");
    }

    window.__editorV2Debug?.setLayout({
      ...layout,
      root: {
        kind: "split",
        id: "test-too-small-root",
        direction: "horizontal",
        ratio: 0.07,
        first: firstArea,
        second: secondNode,
      },
    });
  });

  const firstArea = page.locator(".editor-v2-area").first();
  const sourceHeader = page.locator(".editor-v2-area-header").last();
  const targetBox = await firstArea.boundingBox();
  const sourceHeaderBox = await sourceHeader.boundingBox();
  expect(targetBox).not.toBeNull();
  expect(sourceHeaderBox).not.toBeNull();
  const beforeFingerprint = await page.evaluate(
    () => window.__editorV2Debug?.getFingerprint() ?? "",
  );

  await page.mouse.move(
    sourceHeaderBox!.x + 10,
    sourceHeaderBox!.y + sourceHeaderBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    sourceHeaderBox!.x + 24,
    sourceHeaderBox!.y + sourceHeaderBox!.height / 2 + 12,
  );
  await page.mouse.move(
    targetBox!.x + targetBox!.width * 0.84,
    targetBox!.y + targetBox!.height / 2,
  );
  await page.mouse.up();

  await expect(page.locator(".editor-v2-toast")).toContainText("at least 5% of the viewport");
  await expect
    .poll(() => page.evaluate(() => window.__editorV2Debug?.getFingerprint() ?? ""))
    .toBe(beforeFingerprint);
});

test("shows invalid editor v2 docking preview when dropping onto itself", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 360 });
  await page.goto("/editor-v2.html");

  const firstArea = page.locator(".editor-v2-area").first();
  const firstHeader = firstArea.locator(".editor-v2-area-header");
  const headerBox = await firstHeader.boundingBox();
  const areaBox = await firstArea.boundingBox();
  expect(headerBox).not.toBeNull();
  expect(areaBox).not.toBeNull();

  await page.mouse.move(headerBox!.x + 10, headerBox!.y + headerBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(headerBox!.x + 24, headerBox!.y + headerBox!.height / 2 + 12);
  await page.mouse.move(areaBox!.x + areaBox!.width * 0.8, areaBox!.y + areaBox!.height / 2);

  await expect(page.locator(".editor-v2-dock-preview")).toHaveAttribute("data-invalid", "true");
  await expect(page.locator(".editor-v2-dock-line")).toBeVisible();
  await page.mouse.up();

  await expect(page.locator(".editor-v2-toast")).toContainText("layout unchanged");
});

test("shows invalid editor v2 docking preview for too-small drops", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 360 });
  await page.goto("/editor-v2.html");

  await page.evaluate(() => {
    const layout = window.__editorV2Debug?.getLayout();
    const firstArea = layout?.root.kind === "split" ? layout.root.first : null;
    const secondNode = layout?.root.kind === "split" ? layout.root.second : null;

    if (!layout || !firstArea || !secondNode) {
      throw new Error("Unexpected editor v2 layout shape.");
    }

    window.__editorV2Debug?.setLayout({
      ...layout,
      root: {
        kind: "split",
        id: "test-invalid-preview-root",
        direction: "horizontal",
        ratio: 0.07,
        first: firstArea,
        second: secondNode,
      },
    });
  });

  const firstArea = page.locator(".editor-v2-area").first();
  const sourceHeader = page.locator(".editor-v2-area-header").last();
  const targetBox = await firstArea.boundingBox();
  const sourceHeaderBox = await sourceHeader.boundingBox();
  expect(targetBox).not.toBeNull();
  expect(sourceHeaderBox).not.toBeNull();

  await page.mouse.move(sourceHeaderBox!.x + 10, sourceHeaderBox!.y + sourceHeaderBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(sourceHeaderBox!.x + 24, sourceHeaderBox!.y + sourceHeaderBox!.height / 2 + 12);
  await page.mouse.move(targetBox!.x + targetBox!.width * 0.84, targetBox!.y + targetBox!.height / 2);

  await expect(page.locator(".editor-v2-dock-preview")).toHaveAttribute("data-invalid", "true");
  await expect(page.locator(".editor-v2-dock-line")).toBeVisible();
  await page.mouse.up();

  await expect(page.locator(".editor-v2-toast")).toContainText("at least 5% of the viewport");
});

test("hides editor v2 split buttons when an area cannot be split further", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 360 });
  await page.goto("/editor-v2.html");

  await page.evaluate(() => {
    const layout = window.__editorV2Debug?.getLayout();
    const firstArea = layout?.root.kind === "split" ? layout.root.first : null;
    const secondNode = layout?.root.kind === "split" ? layout.root.second : null;

    if (!layout || !firstArea || !secondNode) {
      throw new Error("Unexpected editor v2 layout shape.");
    }

    window.__editorV2Debug?.setLayout({
      ...layout,
      root: {
        kind: "split",
        id: "test-narrow-root",
        direction: "horizontal",
        ratio: 0.07,
        first: firstArea,
        second: secondNode,
      },
    });
  });

  const narrowArea = page.locator(".editor-v2-area").first();
  await expect(narrowArea.getByTitle("Split horizontally")).toBeHidden();
  await expect(narrowArea.getByTitle("Split vertically")).toBeVisible();

  const wideArea = page.locator(".editor-v2-area").last();
  await expect(wideArea.getByTitle("Split horizontally")).toBeVisible();
  await expect(wideArea.getByTitle("Split vertically")).toBeVisible();
});

test("redistributes editor v2 resize pressure across same-axis siblings", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 360 });
  await page.goto("/editor-v2.html");

  await page.evaluate(() => {
    const layout = window.__editorV2Debug?.getLayout();
    if (!layout || layout.root.kind !== "split") {
      throw new Error("Unexpected editor v2 layout shape.");
    }

    const left = layout.root.first;
    const right =
      layout.root.second.kind === "split" && layout.root.second.direction === "vertical"
        ? layout.root.second.first
        : layout.root.second;
    const farRight =
      layout.root.second.kind === "split" && layout.root.second.direction === "vertical"
        ? layout.root.second.second
        : layout.root.second;

    window.__editorV2Debug?.setLayout({
      ...layout,
      root: {
        kind: "split",
        id: "test-redistribute-root",
        direction: "horizontal",
        ratio: 0.34,
        first: left,
        second: {
          kind: "split",
          id: "test-redistribute-nested",
          direction: "horizontal",
          ratio: 0.5,
          first: right,
          second: farRight,
        },
      },
    });
  });

  const beforeBoxes = await page.locator(".editor-v2-area").evaluateAll((areas) =>
    areas.slice(0, 3).map((area) => area.getBoundingClientRect().width),
  );
  const firstResizer = page.locator(".editor-v2-split-resizer").first();
  const resizerBox = await firstResizer.boundingBox();
  expect(resizerBox).not.toBeNull();

  await page.mouse.move(
    resizerBox!.x + resizerBox!.width / 2,
    resizerBox!.y + resizerBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(resizerBox!.x - 420, resizerBox!.y + resizerBox!.height / 2);
  await page.mouse.up();

  const afterBoxes = await page.locator(".editor-v2-area").evaluateAll((areas) =>
    areas.slice(0, 3).map((area) => area.getBoundingClientRect().width),
  );
  const minWidth = 960 * 0.05;

  for (const width of afterBoxes) {
    expect(width).toBeGreaterThanOrEqual(minWidth - 1);
  }
  expect(afterBoxes[0]!).toBeLessThan(beforeBoxes[0]!);
  expect(afterBoxes[1]!).toBeGreaterThan(beforeBoxes[1]!);
  expect(afterBoxes[2]!).toBeGreaterThan(beforeBoxes[2]!);
});

test("keeps editor v2 areas at viewport minimum during extreme resize drags", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 360 });
  await page.goto("/editor-v2.html");

  const firstResizer = page.locator(".editor-v2-split-resizer").first();
  const resizerBox = await firstResizer.boundingBox();
  expect(resizerBox).not.toBeNull();

  await page.mouse.move(
    resizerBox!.x + resizerBox!.width / 2,
    resizerBox!.y + resizerBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(960, resizerBox!.y + resizerBox!.height / 2);
  await page.mouse.move(0, resizerBox!.y + resizerBox!.height / 2);
  await page.mouse.up();

  const widths = await page.locator(".editor-v2-area").evaluateAll((areas) =>
    areas.map((area) => area.getBoundingClientRect().width),
  );
  const minWidth = 960 * 0.05;
  for (const width of widths) {
    expect(width).toBeGreaterThanOrEqual(minWidth - 1);
  }
});


test("preserves nested cross-axis area minimums during outer resize drags", async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 360 });
  await page.goto("/editor-v2.html");

  await page.evaluate(() => {
    const layout = window.__editorV2Debug?.getLayout();
    if (!layout || layout.root.kind !== "split") {
      throw new Error("Unexpected editor v2 layout shape.");
    }

    const firstArea = layout.root.first;
    const secondNode = layout.root.second;
    window.__editorV2Debug?.setLayout({
      ...layout,
      root: {
        kind: "split",
        id: "test-nested-cross-axis-root",
        direction: "horizontal",
        ratio: 0.5,
        first: firstArea,
        second: {
          kind: "split",
          id: "test-nested-cross-axis-a",
          direction: "vertical",
          ratio: 0.5,
          first: secondNode,
          second: {
            kind: "split",
            id: "test-nested-cross-axis-b",
            direction: "vertical",
            ratio: 0.5,
            first: {
              kind: "area",
              id: "test-nested-cross-axis-area-1",
              contentType: "console",
            },
            second: {
              kind: "area",
              id: "test-nested-cross-axis-area-2",
              contentType: "properties",
            },
          },
        },
      },
    });
  });

  const firstResizer = page.locator('.editor-v2-split-resizer[data-split-id="test-nested-cross-axis-root"]');
  const resizerBox = await firstResizer.boundingBox();
  expect(resizerBox).not.toBeNull();

  await page.mouse.move(
    resizerBox!.x + resizerBox!.width / 2,
    resizerBox!.y + resizerBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(930, resizerBox!.y + resizerBox!.height / 2);
  await page.mouse.up();

  const widths = await page.locator(".editor-v2-area").evaluateAll((areas) =>
    areas.map((area) => area.getBoundingClientRect().width),
  );
  const minWidth = 960 * 0.05;
  for (const width of widths) {
    expect(width).toBeGreaterThanOrEqual(minWidth - 1);
  }
});
