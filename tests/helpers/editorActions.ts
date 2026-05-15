import { expect, type Page } from "@playwright/test";

export async function openEditor(page: Page): Promise<void> {
  await page.goto("/editor.html");
}

export async function createEditorProject(
  page: Page,
  name: string,
): Promise<void> {
  await page.locator("#project-name-input").fill(name);
  await page
    .locator("#project-form")
    .getByRole("button", { name: "Create" })
    .click();
  await expect(page.getByRole("button", { name })).toBeVisible();
}

export async function uploadPrimitiveSvg(
  page: Page,
  input: {
    filename: string;
    svgText: string;
  },
): Promise<void> {
  await page.locator("#svg-file-input").setInputFiles({
    name: input.filename,
    mimeType: "image/svg+xml",
    buffer: Buffer.from(input.svgText),
  });
}
