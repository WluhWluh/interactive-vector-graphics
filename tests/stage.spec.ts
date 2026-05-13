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
  expect(debugState?.asset?.bezierPath.version).toBe(1);
  expect(debugState?.asset?.bezierPath.closed).toBe(true);
  expect(debugState?.asset?.bezierPath.segments.length).toBeGreaterThanOrEqual(3);
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

test("creates a project, imports a primitive SVG, and deletes data", async ({
  page,
}) => {
  await page.goto("/editor.html");

  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Inspector" })).toBeVisible();
  await expect(page.locator('[data-module-collapse-button="projects"]')).toHaveText("▴");
  await expect(
    page.locator('[data-module-collapse-button="primitive-assets"]'),
  ).toHaveText("▴");
  await expect(page.locator('[data-module-collapse-button="prefabs"]')).toHaveText(
    "▴",
  );
  await expect(
    page.locator('[data-module-collapse-button="prefab-contents"]'),
  ).toHaveText("▴");
  await expect(
    page.locator('[data-module-collapse-button="scene-documents"]'),
  ).toHaveText("▴");
  await expect(
    page.locator('[data-module-collapse-button="scene-contents"]'),
  ).toHaveText("▴");

  await page.locator('[data-module-collapse-button="primitive-assets"]').click();
  await expect(
    page.locator('[data-collapsible-module="primitive-assets"] .collapsible-module-body'),
  ).toBeHidden();
  await expect(
    page.locator('[data-module-collapse-button="primitive-assets"]'),
  ).toHaveText("▾");
  expect(
    await page.evaluate(() =>
      window.__vectorEditorDebug?.getCollapsedModules() ?? [],
    ),
  ).toEqual(["primitive-assets"]);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Primitive Assets" })).toBeVisible();
  await expect(
    page.locator('[data-collapsible-module="primitive-assets"] .collapsible-module-body'),
  ).toBeHidden();
  await expect(
    page.locator('[data-module-collapse-button="primitive-assets"]'),
  ).toHaveText("▾");

  await page.locator('[data-module-collapse-button="primitive-assets"]').click();
  await expect(
    page.locator('[data-collapsible-module="primitive-assets"] .collapsible-module-body'),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator('[data-collapsible-module="primitive-assets"] .collapsible-module-body'),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.__vectorEditorDebug?.getCollapsedModules() ?? [],
    ),
  ).toEqual([]);

  await page.locator("#project-name-input").fill("Playwright Project");
  await page.locator("#project-form").getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("button", { name: "Playwright Project" })).toBeVisible();

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
  await expect(page.locator("#inspector-fields")).toContainText("Bezier Segments");
  await expect(page.locator("#inspector-fields")).toContainText("Closed Path");
  await expect(page.locator("#inspector-fields")).toContainText("Source Path Edit");
  const originalUploadedAnchor = await page.evaluate(() => {
    const asset = window.__vectorEditorDebug
      ?.getAssets()
      .find((candidate) => candidate.id === "uploaded-face");

    return asset?.bezierPath.segments[0]?.anchor ?? null;
  });

  await page.getByRole("button", { name: "Source Path Edit" }).click();
  await expect(page.getByRole("button", { name: "Fill: uploaded-face" })).toBeVisible();
  await page.locator("#edit-path-button").click();
  await expect(page.locator("#save-path-button")).toBeVisible();
  await expect(page.getByLabel("Path anchor X")).toHaveValue("-50");

  const initialPathEditState = await page.evaluate(
    () => window.__vectorEditorDebug?.getPathEditState() ?? null,
  );

  expect(initialPathEditState).toMatchObject({
    assetId: "uploaded-face",
    selectedSegmentId: "seg-1",
    selectedComponent: "anchor",
    hasDraft: true,
  });

  const firstAnchorScreenPoint = await page.evaluate(() =>
    window.__vectorEditorDebug
      ?.getPathEditState()
      .controls.find(
        (control) =>
          control.segmentId === "seg-1" && control.component === "anchor",
      ) ?? null,
  );

  expect(firstAnchorScreenPoint).not.toBeNull();
  await page.getByLabel("Path anchor X").fill("-42");
  await page.getByLabel("Path anchor X").blur();
  await expect(page.getByLabel("Path anchor X")).toHaveValue("-42");

  const draggedPathEditState = await page.evaluate(
    () => window.__vectorEditorDebug?.getPathEditState() ?? null,
  );

  expect(draggedPathEditState?.draftBezierPath?.segments[0]?.anchor).toEqual([
    -42,
    0,
  ]);
  await page.locator("#save-path-button").click();
  await expect
    .poll(async () =>
      page.evaluate(
        () => window.__vectorEditorDebug?.getPathEditState().hasDraft ?? true,
      ),
    )
    .toBe(false);
  await expect(page.locator("#edit-path-button")).toBeVisible();

  const savedPathState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;
    const asset = debug?.getAssets().find((candidate) => candidate.id === "uploaded-face");

    return {
      pathEdit: debug?.getPathEditState() ?? null,
      anchor: asset?.bezierPath.segments[0]?.anchor ?? null,
      pathD: asset?.pathD ?? "",
    };
  });

  expect(savedPathState.pathEdit?.hasDraft).toBe(false);
  expect(savedPathState.anchor).not.toEqual(originalUploadedAnchor);
  expect(savedPathState.pathD).toContain(`M ${savedPathState.anchor?.[0]}`);
  await page.locator("#edit-path-button").click();
  await page.getByLabel("Path anchor X").fill("not-a-number");
  await page.getByLabel("Path anchor X").blur();
  await expect(page.getByLabel("Path anchor X")).not.toHaveValue("not-a-number");
  await page.locator("#cancel-path-button").click();
  await expect
    .poll(async () =>
      page.evaluate(
        () => window.__vectorEditorDebug?.getPathEditState().hasDraft ?? true,
      ),
    )
    .toBe(false);
  await page.getByRole("button", { name: "Asset Assembly" }).click();
  await expect(page.getByRole("button", { name: "Group: Root Group" })).toBeVisible();
  await page.getByRole("button", { name: "Group: Root Group" }).click();
  await expect(page.locator("#delete-prefab-node-button")).toBeDisabled();
  await expect(page.locator("#prefab-copy-button")).toBeDisabled();
  await expect(page.locator("#prefab-cut-button")).toBeDisabled();
  await page.getByRole("button", { name: "Add Primitive to Prefab" }).click();
  await expect(page.getByRole("button", { name: /Primitive: uploaded-face/ })).toBeVisible();
  await expect(page.locator("#inspector-fields")).toContainText("prefab-node-1");

  const editorDebugState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;

    if (!debug) {
      return null;
    }

    return {
      selectedProjectId: debug.getSelectedProjectId(),
      selectedAssetId: debug.getSelectedAssetId(),
      importedAsset: debug
        .getAssets()
        .find((candidate) => candidate.id === "uploaded-face"),
      prefabAssembly: debug.getPrefabAssembly(),
      lastImportError: debug.getLastImportError(),
    };
  });

  expect(editorDebugState?.selectedProjectId).toBe("playwright-project");
  expect(editorDebugState?.selectedAssetId).toBe("uploaded-face");
  expect(editorDebugState?.importedAsset?.viewBox).toEqual([-50, -50, 100, 100]);
  expect(editorDebugState?.importedAsset?.bezierPath.version).toBe(1);
  expect(editorDebugState?.importedAsset?.bezierPath.closed).toBe(true);
  expect(
    editorDebugState?.importedAsset?.bezierPath.segments.length,
  ).toBeGreaterThanOrEqual(3);
  expect(editorDebugState?.importedAsset?.sourceUrl).toBe(
    "projects/playwright-project/primitives/uploaded-face.svg",
  );
  expect(editorDebugState?.prefabAssembly.nodes).toEqual([
    {
      id: "prefab-node-1",
      kind: "primitive",
      parentId: null,
      assetId: "uploaded-face",
      name: "uploaded-face",
      position: [0, 1, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      billboardMode: "spherical",
    },
  ]);
  expect(editorDebugState?.prefabAssembly.selectedPrefabNodeId).toBe(
    "prefab-node-1",
  );
  expect(editorDebugState?.lastImportError).toBeNull();

  await page.getByLabel("Position X").fill("2.5");
  await page.getByLabel("Position X").blur();
  await page.getByLabel("Rotation Z").fill("0.75");
  await page.getByLabel("Rotation Z").blur();
  await page.getByLabel("Scale Y").fill("not-a-number");
  await page.getByLabel("Scale Y").blur();

  const editedTransformState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;
    return debug?.getPrefabAssembly().nodes[0] ?? null;
  });

  expect(editedTransformState?.position).toEqual([2.5, 1, 0]);
  expect(editedTransformState?.rotation).toEqual([0, 0, 0.75]);
  expect(editedTransformState?.scale).toEqual([1, 1, 1]);
  await expect(page.getByLabel("Scale Y")).toHaveValue("1");
  await page.locator("#prefab-copy-button").click();
  await expect(page.locator("#prefab-copy-button")).toHaveText("Paste");
  await expect(page.locator("#prefab-cut-button")).toHaveText("Cancel");
  await page.getByLabel("Position X").fill("1.5");
  await page.getByLabel("Position X").blur();
  await page.getByRole("button", { name: "Group: Root Group" }).click();
  await page.locator("#prefab-copy-button").click();

  const copiedPrimitiveState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;
    return debug?.getPrefabAssembly() ?? null;
  });

  expect(copiedPrimitiveState?.pendingClipboard).toBeNull();
  expect(copiedPrimitiveState?.selectedPrefabNodeId).toBe("prefab-node-2");
  expect(copiedPrimitiveState?.nodes).toHaveLength(2);
  expect(copiedPrimitiveState?.nodes[1]).toMatchObject({
    id: "prefab-node-2",
    parentId: null,
    name: "uploaded-face Copy",
    position: [1.5, 1, 0],
  });
  await page.locator('[data-prefab-node-id="prefab-node-2"]').click();
  await page.locator("#prefab-copy-button").click();
  await page.locator("#delete-prefab-node-button").click();

  const afterDeleteCopiedSourceState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;
    return debug?.getPrefabAssembly() ?? null;
  });

  expect(afterDeleteCopiedSourceState?.pendingClipboard).toBeNull();
  expect(afterDeleteCopiedSourceState?.nodes).toHaveLength(1);
  await page.locator('[data-prefab-node-id="prefab-node-1"]').click();
  await page.locator("#create-prefab-group-button").click();
  await expect(page.getByRole("button", { name: "Group: Group 3" })).toBeVisible();
  await page.locator("#prefab-cut-button").click();
  await page.getByRole("button", { name: "Group: Group 3" }).click();
  await page.locator("#prefab-copy-button").click();
  await expect(page.locator("#import-error")).toContainText(
    "Cannot paste a group or node inside itself.",
  );

  const invalidCutState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;
    return debug?.getPrefabAssembly() ?? null;
  });

  expect(invalidCutState?.pendingClipboard).toEqual({
    mode: "cut",
    sourceNodeId: "prefab-node-3",
  });
  expect(invalidCutState?.nodes).toHaveLength(2);
  await page.locator("#prefab-cut-button").click();
  await expect(page.locator("#prefab-copy-button")).toHaveText("Copy");
  await page.locator("#delete-prefab-node-button").click();

  const afterGroupDeleteState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;
    return debug?.getPrefabAssembly() ?? null;
  });

  expect(afterGroupDeleteState?.nodes).toHaveLength(1);
  await page.locator('[data-prefab-node-id="prefab-node-1"]').click();
  await page.locator("#prefab-cut-button").click();
  await page.getByRole("button", { name: "Group: Root Group" }).click();
  await page.locator("#prefab-copy-button").click();

  const cutPrimitiveState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;
    return debug?.getPrefabAssembly() ?? null;
  });

  expect(cutPrimitiveState?.pendingClipboard).toBeNull();
  expect(cutPrimitiveState?.selectedPrefabNodeId).toBe("prefab-node-1");
  expect(cutPrimitiveState?.nodes).toHaveLength(1);
  expect(cutPrimitiveState?.nodes[0]?.id).toBe("prefab-node-1");
  expect(cutPrimitiveState?.nodes[0]?.parentId).toBeNull();
  await page.getByLabel("Position X").fill("0");
  await page.getByLabel("Position X").blur();
  await page.getByLabel("Rotation Z").fill("0");
  await page.getByLabel("Rotation Z").blur();
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
  await expect(page.locator("#timeline-add-keyframe-button")).toBeDisabled();
  await page.locator("#timeline-clip-name-input").fill("Idle");
  await page.locator("#timeline-create-clip-button").click();
  await expect(page.getByRole("button", { name: /Idle/ })).toBeVisible();
  await page.locator('[data-prefab-node-id="prefab-node-1"]').click();
  await expect(page.locator("#timeline-snap-fps-input")).toHaveValue("10");
  await page.locator("#timeline-snap-fps-input").fill("20");
  await page.locator("#timeline-snap-fps-input").blur();
  await page.locator("#timeline-duration-input").fill("1000");
  await page.locator("#timeline-duration-input").blur();
  await expect(page.locator('.timeline-track-bar[data-timeline-property="position"] .timeline-snap-tick')).toHaveCount(21);
  await page.locator("#timeline-time-input").fill("0");
  await page.locator("#timeline-time-input").blur();
  await page.locator("#timeline-add-keyframe-button").click();
  await page.getByLabel("Position X").fill("2");
  await page.getByLabel("Position X").blur();
  await page.locator("#timeline-time-input").fill("1000");
  await page.locator("#timeline-time-input").blur();
  await page.locator("#timeline-add-keyframe-button").click();
  await page.locator("#timeline-scrub-input").fill("500");
  await page.locator('.timeline-track-bar[data-timeline-property="scale"]').click({
    position: { x: 120, y: 8 },
  });
  await page.locator("#timeline-add-keyframe-button").click();

  const timelineState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;
    return debug?.getPrefabTimeline() ?? null;
  });

  const positionTrack = timelineState?.animation.clips[0]?.tracks.find(
    (track) => track.target.property === "position",
  );
  const scaleTrack = timelineState?.animation.clips[0]?.tracks.find(
    (track) => track.target.property === "scale",
  );

  expect(timelineState?.animation.activeClipId).toBe("idle");
  expect(timelineState?.animation.snapFps).toBe(20);
  expect(timelineState?.animation.clips[0]?.durationMs).toBe(1000);
  expect(timelineState?.animation.clips[0]?.tracks).toHaveLength(2);
  expect(positionTrack?.keyframes).toMatchObject([
    {
      timeMs: 0,
      value: [0, 1, 0],
      easing: "linear",
    },
    {
      timeMs: 1000,
      value: [2, 1, 0],
      easing: "linear",
    },
  ]);
  expect(positionTrack?.keyframes[0]?.id).toBeTruthy();
  expect(scaleTrack?.keyframes).toHaveLength(1);
  expect(timelineState?.currentTimeMs).toBe(500);
  expect(timelineState?.activeTrackProperty).toBe("scale");
  expect(timelineState?.selectedKeyframeId).toBeTruthy();
  expect(timelineState?.evaluatedNodes[0]?.position).toEqual([1, 1, 0]);
  expect(
    await page.evaluate(
      () => window.__vectorEditorDebug?.getPrefabAssembly().nodes[0]?.position,
    ),
  ).toEqual([2, 1, 0]);
  await page.locator("#timeline-snap-base-button").click();
  await expect
    .poll(async () =>
      page.evaluate(
        () => window.__vectorEditorDebug?.getPrefabAssembly().nodes[0]?.position,
      ),
    )
    .toEqual([1, 1, 0]);
  await page
    .getByLabel("Transform mode")
    .getByRole("button", { name: "Rotate" })
    .click();
  await page.locator("#timeline-add-keyframe-button").click();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          window.__vectorEditorDebug
            ?.getPrefabTimeline()
            .animation.clips[0]?.tracks.some(
              (track) => track.target.property === "rotation",
            ) ?? false,
      ),
    )
    .toBe(true);
  await page.locator("#timeline-play-button").click();
  await expect
    .poll(async () =>
      page.evaluate(() => window.__vectorEditorDebug?.getPrefabTimeline().isPlaying),
    )
    .toBe(true);
  await page.locator("#timeline-pause-button").click();
  await expect
    .poll(async () =>
      page.evaluate(() => window.__vectorEditorDebug?.getPrefabTimeline().isPlaying),
    )
    .toBe(false);
  await page.getByRole("button", { name: "Group: Root Group" }).click();
  await expect(page.locator("#timeline-add-keyframe-button")).toBeDisabled();
  await page.locator('[data-prefab-node-id="prefab-node-1"]').click();
  await page.locator("#prefab-name-input").fill("Face Prefab");
  await page.locator("#create-prefab-button").click();
  await expect(page.getByRole("button", { name: /Face Prefab/ })).toBeVisible();

  const savedPrefabState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;

    if (!debug) {
      return null;
    }

    return {
      prefabs: debug.getPrefabs(),
      selectedPrefabId: debug.getSelectedPrefabId(),
      loadedPrefabId: debug.getLoadedPrefabId(),
      timeline: debug.getPrefabTimeline(),
    };
  });

  expect(savedPrefabState?.prefabs).toHaveLength(1);
  expect(savedPrefabState?.selectedPrefabId).toBe("face-prefab");
  expect(savedPrefabState?.loadedPrefabId).toBe("face-prefab");
  expect(savedPrefabState?.timeline.animation.clips[0]?.name).toBe("Idle");
  await page.getByRole("button", { name: "Load Prefab" }).click();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          window.__vectorEditorDebug?.getPrefabTimeline().animation.clips[0]
            ?.tracks.length ?? 0,
      ),
    )
    .toBe(3);
  await expect
    .poll(async () =>
      page.evaluate(
        () => window.__vectorEditorDebug?.getPrefabTimeline().animation.snapFps,
      ),
    )
    .toBe(20);
  await page.getByLabel("Position X").fill("0");
  await page.getByLabel("Position X").blur();
  await page.getByRole("button", { name: "Save Prefab" }).click();
  await expect
    .poll(async () => page.evaluate(() => window.__vectorEditorDebug?.getLoadedPrefabId()))
    .toBe("face-prefab");
  await page.getByRole("button", { name: "Scene Layout" }).click();

  await page.locator("#scene-name-input").fill("Empty Scene");
  await page.locator("#create-scene-button").click();
  await expect(page.getByRole("button", { name: /Empty Scene/ })).toBeVisible();

  const createdSceneState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;

    if (!debug) {
      return null;
    }

    return {
      scenes: debug.getScenes(),
      selectedSceneId: debug.getSelectedSceneId(),
      loadedSceneId: debug.getLoadedSceneId(),
    };
  });

  expect(createdSceneState?.scenes).toHaveLength(1);
  expect(createdSceneState?.scenes[0]?.id).toBe("empty-scene");
  expect(createdSceneState?.selectedSceneId).toBe("empty-scene");
  expect(createdSceneState?.loadedSceneId).toBe("empty-scene");

  await page.getByRole("button", { name: "Load Scene" }).click();

  const emptyLoadedState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;

    if (!debug) {
      return null;
    }

    return {
      nodeCount: debug.getExperimentScene().nodes.length,
      loadedSceneId: debug.getLoadedSceneId(),
    };
  });

  expect(emptyLoadedState?.nodeCount).toBe(0);
  expect(emptyLoadedState?.loadedSceneId).toBe("empty-scene");

  await page.getByRole("button", { name: "Add Prefab Instance to Scene" }).click();
  await expect.poll(async () =>
    page.evaluate(() => window.__vectorEditorDebug?.getExperimentScene().nodes.length ?? 0),
  ).toBe(1);
  await expect(page.locator("#inspector-fields")).toContainText("node-1");
  await page.getByLabel("Position X").fill("2.5");
  await page.getByLabel("Position X").blur();
  await page.getByLabel("Rotation Z").fill("0.75");
  await page.getByLabel("Rotation Z").blur();
  await expect.poll(async () =>
    page.evaluate(() =>
      window.__vectorEditorDebug?.getExperimentScene().nodes[0]?.position[0] ?? null,
    ),
  ).toBe(2.5);
  await page.locator("#scene-name-input").fill("Opening Scene");
  await page.locator("#clone-scene-button").click();
  await expect(page.getByRole("button", { name: /Opening Scene/ })).toBeVisible();

  const clonedSceneState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;

    if (!debug) {
      return null;
    }

    return {
      scenes: debug.getScenes(),
      selectedSceneId: debug.getSelectedSceneId(),
      loadedSceneId: debug.getLoadedSceneId(),
      node: debug.getExperimentScene().nodes[0] ?? null,
    };
  });

  expect(clonedSceneState?.scenes).toHaveLength(2);
  expect(clonedSceneState?.selectedSceneId).toBe("opening-scene");
  expect(clonedSceneState?.loadedSceneId).toBe("opening-scene");
  expect(clonedSceneState?.node).toMatchObject({
    id: "node-1",
    kind: "prefabInstance",
    prefabId: "face-prefab",
    position: [2.5, 1, 0],
  });

  await page.getByLabel("Position X").fill("2");
  await page.getByLabel("Position X").blur();
  await page.getByRole("button", { name: "Save Scene" }).click();
  await expect.poll(async () =>
    page.evaluate(() => window.__vectorEditorDebug?.getLoadedSceneId() ?? null),
  ).toBe("opening-scene");

  await page.getByLabel("Position X").fill("0");
  await page.getByLabel("Position X").blur();

  const unsavedSceneState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;

    if (!debug) {
      return null;
    }

    return {
      node: debug.getExperimentScene().nodes[0] ?? null,
      loadedSceneId: debug.getLoadedSceneId(),
    };
  });

  expect(unsavedSceneState?.node?.position).toEqual([0, 1, 0]);
  expect(unsavedSceneState?.loadedSceneId).toBeNull();

  await page.getByRole("button", { name: "Load Scene" }).click();
  await expect(page.getByLabel("Position X")).toHaveValue("2");

  const loadedSceneState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;

    if (!debug) {
      return null;
    }

    return {
      node: debug.getExperimentScene().nodes[0] ?? null,
      loadedSceneId: debug.getLoadedSceneId(),
      camera: debug.getExperimentScene().camera,
    };
  });

  expect(loadedSceneState?.node).toMatchObject({
    kind: "prefabInstance",
    prefabId: "face-prefab",
    position: [2, 1, 0],
  });
  expect(loadedSceneState?.loadedSceneId).toBe("opening-scene");
  expect(loadedSceneState?.camera.near).toBe(0.05);
  expect(loadedSceneState?.camera.far).toBe(120);

  await page.screenshot({
    path: "test-results/editor-import.png",
    fullPage: true,
  });

  const vectorCanvas = page.locator("#vector-canvas");
  const yellowPixels = await countWarmYellowPixels(vectorCanvas);
  expect(yellowPixels).toBeGreaterThan(2_000);

  await page.screenshot({
    path: "test-results/editor-camera-transform.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "Perspective" }).click();
  await expect(page.getByRole("button", { name: "Orthographic" })).toBeVisible();
  await page.getByRole("button", { name: "Rotate" }).click();
  await page.getByRole("button", { name: "Scale" }).click();

  const transformState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;
    return debug?.getExperimentScene() ?? null;
  });

  expect(transformState?.camera.projection).toBe("orthographic");
  expect(transformState?.transformMode).toBe("scale");

  await page.getByRole("button", { name: "Asset Assembly" }).click();

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

  await page.getByRole("button", { name: "Scene Layout" }).click();
  await page.locator("#delete-scene-button").click();
  await expect(page.getByRole("button", { name: /Opening Scene/ })).toHaveCount(0);

  const afterSceneDeleteState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;

    if (!debug) {
      return null;
    }

    return {
      sceneCount: debug.getScenes().length,
      selectedSceneId: debug.getSelectedSceneId(),
      loadedSceneId: debug.getLoadedSceneId(),
      nodeCount: debug.getExperimentScene().nodes.length,
    };
  });

  expect(afterSceneDeleteState?.sceneCount).toBe(1);
  expect(afterSceneDeleteState?.selectedSceneId).toBe("empty-scene");
  expect(afterSceneDeleteState?.loadedSceneId).toBeNull();
  expect(afterSceneDeleteState?.nodeCount).toBe(1);

  await page.locator("#delete-scene-node-button").click();
  await expect(page.getByRole("button", { name: /node-1/ })).toHaveCount(0);

  const afterNodeDeleteState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;

    if (!debug) {
      return null;
    }

    return {
      assetCount: debug.getAssets().length,
      nodeCount: debug.getExperimentScene().nodes.length,
      selectedNodeId: debug.getExperimentScene().selectedNodeId,
    };
  });

  expect(afterNodeDeleteState?.assetCount).toBe(1);
  expect(afterNodeDeleteState?.nodeCount).toBe(0);
  expect(afterNodeDeleteState?.selectedNodeId).toBeNull();

  await page.getByRole("button", { name: "Asset Assembly" }).click();
  await page.locator("#delete-prefab-button").click();
  await expect(page.getByRole("button", { name: /Face Prefab/ })).toHaveCount(0);

  const afterPrefabDeleteState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;

    if (!debug) {
      return null;
    }

    return {
      prefabCount: debug.getPrefabs().length,
      selectedPrefabId: debug.getSelectedPrefabId(),
      loadedPrefabId: debug.getLoadedPrefabId(),
    };
  });

  expect(afterPrefabDeleteState?.prefabCount).toBe(0);
  expect(afterPrefabDeleteState?.selectedPrefabId).toBeNull();
  expect(afterPrefabDeleteState?.loadedPrefabId).toBeNull();

  await page.getByRole("button", { name: "Delete Imported Asset" }).click();
  await expect(page.getByRole("button", { name: "uploaded-face" })).toHaveCount(0);

  const afterAssetDeleteState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;

    if (!debug) {
      return {
        assetCount: -1,
        selectedAssetId: "missing-debug",
      };
    }

    return {
      assetCount: debug.getAssets().length,
      nodeCount: debug.getExperimentScene().nodes.length,
      selectedAssetId: debug.getSelectedAssetId(),
    };
  });

  expect(afterAssetDeleteState.assetCount).toBe(0);
  expect(afterAssetDeleteState.nodeCount).toBe(0);
  expect(afterAssetDeleteState.selectedAssetId).toBeNull();

  await page.getByRole("button", { name: "Delete Project" }).click();
  await expect(page.getByRole("button", { name: "Playwright Project" })).toHaveCount(
    0,
  );

  const afterProjectDeleteState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;

    if (!debug) {
      return {
        projectCount: -1,
        selectedProjectId: "missing-debug",
      };
    }

    return {
      projectCount: debug.getProjects().length,
      selectedProjectId: debug.getSelectedProjectId(),
    };
  });

  expect(afterProjectDeleteState.projectCount).toBe(0);
  expect(afterProjectDeleteState.selectedProjectId).toBeNull();
});

test("imports and previews an open strokePath primitive", async ({ page }) => {
  await page.goto("/editor.html");

  await page.locator("#project-name-input").fill("Stroke Project");
  await page.locator("#project-form").getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("button", { name: "Stroke Project" })).toBeVisible();

  const strokeSvg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    '<path fill="none" stroke="#5bc4bf" stroke-width="12" d="M 10 80 C 30 20 70 20 90 80" />',
    "</svg>",
  ].join("");

  const fileInput = page.locator("#svg-file-input");

  await fileInput.setInputFiles({
    name: "leg-stroke.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(strokeSvg),
  });

  await expect(page.getByRole("button", { name: "Stroke: leg-stroke" })).toBeVisible();
  await expect(page.locator("#inspector-fields")).toContainText("strokePath");
  await expect(page.locator("#inspector-fields")).toContainText("#5bc4bf");
  await expect(page.locator("#inspector-fields")).toContainText("12");
  await expect(page.locator("#inspector-fields")).toContainText("Bezier Segments");
  await expect(page.locator("#inspector-fields")).toContainText("Closed Path");
  await page.getByRole("button", { name: "Source Path Edit" }).click();
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
  await expect(page.getByRole("button", { name: /Primitive: leg-stroke/ })).toBeVisible();
  await expect(await countTealPixels(page.locator("#vector-canvas"))).toBeGreaterThan(300);

  const closedStrokeSvg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    '<path fill="none" stroke="#5bc4bf" stroke-width="12" d="M 10 10 L 90 10 Z" />',
    "</svg>",
  ].join("");

  await fileInput.setInputFiles({
    name: "closed-stroke.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(closedStrokeSvg),
  });

  await expect(page.locator("#import-error")).toContainText(
    "open path without Z commands",
  );
  await expect(page.getByRole("button", { name: "Stroke: closed-stroke" })).toHaveCount(0);

  await page.getByRole("button", { name: "Delete Project" }).click();
  await expect(page.getByRole("button", { name: "Stroke Project" })).toHaveCount(0);
});

async function countWarmYellowPixels(vectorCanvas: Locator): Promise<number> {
  return vectorCanvas.evaluate((canvas) => {
    const target = canvas as HTMLCanvasElement;
    const context = target.getContext("2d");

    if (!context) {
      return 0;
    }

    const { data } = context.getImageData(0, 0, target.width, target.height);
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

async function countTealPixels(vectorCanvas: Locator): Promise<number> {
  return vectorCanvas.evaluate((canvas) => {
    const target = canvas as HTMLCanvasElement;
    const context = target.getContext("2d");

    if (!context) {
      return 0;
    }

    const { data } = context.getImageData(0, 0, target.width, target.height);
    let matchingPixels = 0;

    for (let index = 0; index < data.length; index += 4) {
      const red = data[index] ?? 0;
      const green = data[index + 1] ?? 0;
      const blue = data[index + 2] ?? 0;
      const alpha = data[index + 3] ?? 0;

      if (red > 60 && red < 130 && green > 160 && blue > 160 && alpha > 120) {
        matchingPixels += 1;
      }
    }

    return matchingPixels;
  });
}
