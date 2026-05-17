import { expect, test } from "@playwright/test";
import {
  createEditorProject,
  openEditor,
  uploadPrimitiveSvg,
} from "./helpers/editorActions";

test("keeps staged timeline ghost proxies aligned when switching prefab nodes", async ({
  page,
}) => {
  await openEditor(page);
  await createEditorProject(page, "Staging Proxy Project");

  const filledSvg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100">',
    '<path fill="#ffcf4a" d="M -42 0 C -42 -26 -18 -42 0 -42 C 28 -42 42 -18 42 0 C 42 28 18 42 0 42 C -28 42 -42 18 -42 0 Z" />',
    "</svg>",
  ].join("");
  await uploadPrimitiveSvg(page, {
    filename: "staged-face.svg",
    svgText: filledSvg,
  });
  await expect(page.getByRole("button", { name: "Fill: staged-face" })).toBeVisible();
  const stagedFaceAssetId = await page.evaluate(
    () =>
      window.__vectorEditorDebug
        ?.getAssets()
        .find((candidate) => candidate.name === "staged-face")?.id ?? null,
  );
  expect(stagedFaceAssetId).toBeTruthy();
  await page.getByRole("button", { name: "Group: Root Group" }).click();
  await page.getByRole("button", { name: "Add Primitive to Prefab" }).click();
  await page.getByRole("button", { name: "Group: Root Group" }).click();
  await page.getByRole("button", { name: "Add Primitive to Prefab" }).click();
  await expect(
    page.getByRole("button", { name: "Primitive: staged-face", exact: true }),
  ).toHaveCount(2);

  await page.locator("#timeline-clip-name-input").fill("Ghosts");
  await page.locator("#timeline-create-clip-button").click();
  await expect(page.getByRole("button", { name: /Ghosts/ })).toBeVisible();
  await page.locator('[data-prefab-node-id="prefab-node-1"]').click();
  await page.getByLabel("Position X").fill("3");
  await page.getByLabel("Position X").blur();
  await page.locator('[data-prefab-node-id="prefab-node-2"]').click();
  await page.getByLabel("Position X").fill("-3");
  await page.getByLabel("Position X").blur();
  await page.locator('[data-prefab-node-id="prefab-node-1"]').click();

  const unselectedProxyState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;
    const proxies = debug?.getExperimentScene().viewportProxies ?? [];

    return {
      selectedNodeId: debug?.getPrefabAssembly().selectedPrefabNodeId ?? null,
      firstProxy: proxies.find((candidate) => candidate.nodeId === "prefab-node-1") ?? null,
      secondProxy: proxies.find((candidate) => candidate.nodeId === "prefab-node-2") ?? null,
      firstBase: debug
        ?.getPrefabAssembly()
        .nodes.find((candidate) => candidate.id === "prefab-node-1")?.position ?? null,
      secondBase: debug
        ?.getPrefabAssembly()
        .nodes.find((candidate) => candidate.id === "prefab-node-2")?.position ?? null,
    };
  });

  expect(unselectedProxyState.selectedNodeId).toBe("prefab-node-1");
  expect(unselectedProxyState.firstBase).toEqual([0, 1, 0]);
  expect(unselectedProxyState.secondBase).toEqual([0, 1, 0]);
  expect(unselectedProxyState.firstProxy?.position).toEqual([3, 1, 0]);
  expect(unselectedProxyState.firstProxy?.selected).toBe(true);
  expect(unselectedProxyState.secondProxy?.position).toEqual([-3, 1, 0]);
  expect(unselectedProxyState.secondProxy?.selected).toBe(false);

  await page.getByLabel("Transform mode").getByRole("button", { name: "Path" }).click();
  await page.locator('[data-prefab-node-id="prefab-node-2"]').click();

  const pathToolSelectionState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;

    return {
      activeTool: debug?.getActiveEditorTool() ?? null,
      selectedNodeId: debug?.getPrefabAssembly().selectedPrefabNodeId ?? null,
      inPlaceState: debug?.getInPlacePathEditState() ?? null,
    };
  });

  expect(pathToolSelectionState.activeTool).toBe("path");
  expect(pathToolSelectionState.selectedNodeId).toBe("prefab-node-2");
  expect(pathToolSelectionState.inPlaceState).toMatchObject({
    active: true,
    nodeId: "prefab-node-2",
    assetId: stagedFaceAssetId,
  });

  await page.locator('[data-prefab-node-id="prefab-node-2"]').click();

  const reselectedProxyState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;
    const proxy = debug
      ?.getExperimentScene()
      .viewportProxies.find((candidate) => candidate.nodeId === "prefab-node-2");

    return {
      stagingPosition: debug?.getPrefabTimeline().stagingPose?.transform.position ?? null,
      proxyPosition: proxy?.position ?? null,
      proxySelected: proxy?.selected ?? null,
    };
  });

  expect(reselectedProxyState.stagingPosition).toEqual([-3, 1, 0]);
  expect(reselectedProxyState.proxyPosition).toEqual([-3, 1, 0]);
  expect(reselectedProxyState.proxySelected).toBe(true);
});

