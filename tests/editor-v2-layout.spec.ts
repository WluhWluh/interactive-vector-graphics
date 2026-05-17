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

  const firstResizer = page.locator(".editor-v2-split-resizer").first();
  const resizerBox = await firstResizer.boundingBox();
  expect(resizerBox).not.toBeNull();
  await page.mouse.move(
    resizerBox!.x + resizerBox!.width / 2,
    resizerBox!.y + resizerBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(resizerBox!.x + 90, resizerBox!.y + resizerBox!.height / 2);
  await expect(page.locator(".editor-v2-dock-line")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator(".editor-v2-dock-line")).toHaveCount(0);

  const resizedFingerprint = await page.evaluate(
    () => window.__editorV2Debug?.getFingerprint() ?? "",
  );
  expect(resizedFingerprint).toContain("split");

  const sourceHeader = page.locator(".editor-v2-area-header").first();
  const targetArea = page.locator(".editor-v2-area").last();
  const sourceHeaderBox = await sourceHeader.boundingBox();
  const targetBox = await targetArea.boundingBox();
  expect(sourceHeaderBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  await page.mouse.move(
    sourceHeaderBox!.x + sourceHeaderBox!.width / 2,
    sourceHeaderBox!.y + sourceHeaderBox!.height / 2,
  );
  await page.mouse.down();
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
  expect(Math.round(areaHitLineBox!.x - (targetBox!.x + targetBox!.width))).toBe(2);
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
});
