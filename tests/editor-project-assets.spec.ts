import { expect, test } from "@playwright/test";
import { countWarmYellowPixels } from "./helpers/canvasPixels";
import {
  createEditorProject,
  openEditor,
  uploadPrimitiveSvg,
} from "./helpers/editorActions";
import {
  createFilledFaceSvg,
  createInvalidMultiPathSvg,
} from "./helpers/svgFixtures";

test("creates a project, imports a primitive SVG, and deletes data", async ({
  page,
}) => {
  await openEditor(page);

  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Inspector" })).toBeVisible();
  await expect(page.locator('[data-module-collapse-button="projects"]')).toHaveCount(1);
  await expect(
    page.locator('[data-module-collapse-button="primitive-assets"]'),
  ).toHaveCount(1);
  await expect(page.locator('[data-module-collapse-button="prefabs"]')).toHaveCount(1);
  await expect(
    page.locator('[data-module-collapse-button="prefab-contents"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-module-collapse-button="scene-documents"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('[data-module-collapse-button="scene-contents"]'),
  ).toHaveCount(1);

  await page.locator('[data-module-collapse-button="primitive-assets"]').click();
  await expect(
    page.locator('[data-collapsible-module="primitive-assets"] .collapsible-module-body'),
  ).toBeHidden();
  await expect(
    page.locator('[data-module-collapse-button="primitive-assets"]'),
  ).toBeVisible();
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
  ).toBeVisible();

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
  await createEditorProject(page, "Playwright Project");

  await uploadPrimitiveSvg(page, {
    filename: "uploaded-face.svg",
    svgText: createFilledFaceSvg(),
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
  await expect(page.locator("#transform-path-button")).toBeDisabled();

  await page.locator("#timeline-clip-name-input").fill("Pose Check");
  await page.locator("#timeline-create-clip-button").click();
  await page.locator("#timeline-duration-input").fill("1000");
  await page.locator("#timeline-duration-input").blur();
  await page.locator("#timeline-time-input").fill("0");
  await page.locator("#timeline-time-input").blur();
  await expect(page.getByRole("button", { name: "Base Pose" })).toHaveAttribute(
    "data-selected",
    "false",
  );

  await page.getByLabel("Transform mode").getByRole("button", { name: "Path" }).click();
  await expect(page.locator("#inspector-fields")).toContainText("In-Place Path");
  await expect(page.locator("#inspector-fields")).toContainText("Preview only");
  await expect(page.getByLabel("In-place path anchor X")).toHaveValue("-42");
  await expect(page.locator("#transform-path-button")).toHaveAttribute(
    "data-selected",
    "true",
  );
  await expect(page.locator("#transform-translate-button")).toHaveAttribute(
    "data-selected",
    "false",
  );
  await expect(page.locator("#transform-rotate-button")).toHaveAttribute(
    "data-selected",
    "false",
  );
  await expect(page.locator("#transform-scale-button")).toHaveAttribute(
    "data-selected",
    "false",
  );

  const inPlaceInitialState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;
    const asset = debug?.getAssets().find((candidate) => candidate.id === "uploaded-face");

    return {
      path: debug?.getInPlacePathEditState() ?? null,
      assetAnchor: asset?.bezierPath.segments[0]?.anchor ?? null,
      activeTool: debug?.getActiveEditorTool() ?? null,
    };
  });

  expect(inPlaceInitialState.path).toMatchObject({
    nodeId: "prefab-node-1",
    assetId: "uploaded-face",
    active: true,
    hasDraft: true,
    selectedSegmentId: "seg-1",
    selectedComponent: "anchor",
  });
  expect(inPlaceInitialState.path?.controls.length).toBeGreaterThan(0);
  expect(inPlaceInitialState.path?.draftBezierPath?.segments[0]?.anchor).toEqual([
    -42,
    0,
  ]);
  expect(inPlaceInitialState.assetAnchor).toEqual([-42, 0]);
  expect(inPlaceInitialState.activeTool).toBe("path");
  const viewportBox = await page.locator("#three-overlay-canvas").boundingBox();
  const firstPathControl = inPlaceInitialState.path?.controls.find((control) => {
    const width = viewportBox?.width ?? 0;
    const height = viewportBox?.height ?? 0;

    return control.x >= 0 && control.x <= width && control.y >= 0 && control.y <= height;
  });

  expect(firstPathControl).toBeTruthy();
  expect(viewportBox).toBeTruthy();
  const firstPathControlPageX = (viewportBox?.x ?? 0) + (firstPathControl?.x ?? 0);
  const firstPathControlPageY = (viewportBox?.y ?? 0) + (firstPathControl?.y ?? 0);
  await page.mouse.move(firstPathControlPageX, firstPathControlPageY);
  await page.locator("#three-overlay-canvas").dispatchEvent("pointermove", {
    clientX: firstPathControlPageX,
    clientY: firstPathControlPageY,
    bubbles: true,
    pointerType: "mouse",
  });
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          window.__vectorEditorDebug?.getInPlacePathEditState().hoveredSegmentId ??
          null,
      ),
    )
    .toBe(firstPathControl?.segmentId);

  const cameraBeforePathOrbit = await page.evaluate(
    () => window.__vectorEditorDebug?.getExperimentScene().camera.position ?? null,
  );
  const pathOrbitStartX = (viewportBox?.x ?? 0) + (viewportBox?.width ?? 0) - 72;
  const pathOrbitStartY = (viewportBox?.y ?? 0) + 110;
  await page.mouse.move(pathOrbitStartX, pathOrbitStartY);
  await page.mouse.down();
  await page.mouse.move(pathOrbitStartX - 160, pathOrbitStartY + 30);
  await page.mouse.up();

  await expect
    .poll(async () =>
      page.evaluate(
        () => window.__vectorEditorDebug?.getExperimentScene().camera.position ?? null,
      ),
    )
    .not.toEqual(cameraBeforePathOrbit);
  const pathOrbitState = await page.evaluate(() => ({
    controls: window.__vectorEditorDebug?.getInPlacePathEditState().controls ?? [],
    hasDraft: window.__vectorEditorDebug?.getInPlacePathEditState().hasDraft ?? false,
  }));

  expect(pathOrbitState.hasDraft).toBe(true);
  expect(pathOrbitState.controls.length).toBeGreaterThan(0);
  await page.getByLabel("In-place path anchor X").fill("-30");
  await page.getByLabel("In-place path anchor X").blur();

  const inPlaceEditedState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;
    const asset = debug?.getAssets().find((candidate) => candidate.id === "uploaded-face");

    return {
      path: debug?.getInPlacePathEditState() ?? null,
      assetAnchor: asset?.bezierPath.segments[0]?.anchor ?? null,
    };
  });

  expect(inPlaceEditedState.path?.draftBezierPath?.segments[0]?.anchor).toEqual([
    -30,
    0,
  ]);
  expect(inPlaceEditedState.assetAnchor).toEqual([-42, 0]);
  await page.locator("#timeline-time-input").fill("0");
  await page.locator("#timeline-time-input").blur();
  await page.getByLabel("Transform mode").getByRole("button", { name: "Path" }).click();
  await page.getByLabel("In-place path anchor X").fill("-30");
  await page.getByLabel("In-place path anchor X").blur();
  await page.locator("#timeline-add-keyframe-button").click();
  await page.locator("#timeline-time-input").fill("1000");
  await page.locator("#timeline-time-input").blur();
  await page.getByLabel("In-place path anchor X").fill("-10");
  await page.getByLabel("In-place path anchor X").blur();
  await page.locator("#timeline-add-keyframe-button").click();
  await page.locator("#timeline-scrub-input").fill("500");

  const pathKeyframeState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;
    const asset = debug?.getAssets().find((candidate) => candidate.id === "uploaded-face");
    const timeline = debug?.getPrefabTimeline();
    const pathTrack = timeline?.animation.clips[0]?.tracks.find(
      (track) => track.target.property === "path",
    );
    const firstPathValue = pathTrack?.keyframes[0]?.value ?? null;
    const secondPathValue = pathTrack?.keyframes[1]?.value ?? null;
    const override = timeline?.evaluatedPathOverrides.find(
      (candidate) => candidate.nodeId === "prefab-node-1",
    );

    return {
      assetAnchor: asset?.bezierPath.segments[0]?.anchor ?? null,
      pathTrackKeyframeCount: pathTrack?.keyframes.length ?? 0,
      firstPathKeyframeAnchor: Array.isArray(firstPathValue)
        ? null
        : (firstPathValue?.segments[0]?.anchor ?? null),
      secondPathKeyframeAnchor: Array.isArray(secondPathValue)
        ? null
        : (secondPathValue?.segments[0]?.anchor ?? null),
      overrideAnchor: override?.path.segments[0]?.anchor ?? null,
      inPlaceAnchor:
        debug?.getInPlacePathEditState().draftBezierPath?.segments[0]?.anchor ??
        null,
    };
  });

  expect(pathKeyframeState.assetAnchor).toEqual([-42, 0]);
  expect(pathKeyframeState.pathTrackKeyframeCount).toBe(2);
  expect(pathKeyframeState.firstPathKeyframeAnchor).toEqual([-30, 0]);
  expect(pathKeyframeState.secondPathKeyframeAnchor).toEqual([-10, 0]);
  expect(pathKeyframeState.overrideAnchor).toEqual([-20, 0]);
  expect(pathKeyframeState.inPlaceAnchor).toEqual([-10, 0]);
  await page.locator("#timeline-snap-base-button").click();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          window.__vectorEditorDebug
            ?.getInPlacePathEditState()
            .draftBezierPath?.segments[0]?.anchor ?? null,
      ),
    )
    .toEqual([-20, 0]);
  await page
    .getByLabel("Transform mode")
    .getByRole("button", { name: "Move" })
    .click();
  await expect(page.locator("#transform-path-button")).toHaveAttribute(
    "data-selected",
    "false",
  );
  await expect(page.locator("#transform-translate-button")).toHaveAttribute(
    "data-selected",
    "true",
  );
  const stagingAfterMoveToolState = await page.evaluate(() => {
    const timeline = window.__vectorEditorDebug?.getPrefabTimeline();

    return {
      stagingPathAnchor:
        timeline?.stagingPose?.pathDraft?.segments[0]?.anchor ?? null,
      basePathAnchor:
        window.__vectorEditorDebug
          ?.getAssets()
          .find((candidate) => candidate.id === "uploaded-face")
          ?.bezierPath.segments[0]?.anchor ?? null,
    };
  });

  expect(stagingAfterMoveToolState.stagingPathAnchor).toEqual([-20, 0]);
  expect(stagingAfterMoveToolState.basePathAnchor).toEqual([-42, 0]);
  await page.locator("#timeline-time-input").fill("0");
  await page.locator("#timeline-time-input").blur();
  await page
    .getByLabel("Transform mode")
    .getByRole("button", { name: "Move" })
    .click();
  await page.locator("#timeline-add-keyframe-button").click();
  await page.getByLabel("Position X").fill("4");
  await page.getByLabel("Position X").blur();
  await page.locator("#timeline-time-input").fill("1000");
  await page.locator("#timeline-time-input").blur();
  await page.locator("#timeline-add-keyframe-button").click();
  await page.locator("#timeline-scrub-input").fill("500");
  await page.getByLabel("Transform mode").getByRole("button", { name: "Path" }).click();

  const inPlaceAfterTimelineState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;

    return {
      path: debug?.getInPlacePathEditState() ?? null,
      basePosition: debug?.getPrefabAssembly().nodes[0]?.position ?? null,
      evaluatedPosition: debug?.getPrefabTimeline().evaluatedNodes[0]?.position ?? null,
      stagingPosition:
        debug?.getPrefabTimeline().stagingPose?.transform.position ?? null,
    };
  });

  expect(inPlaceAfterTimelineState.path?.active).toBe(true);
  expect(inPlaceAfterTimelineState.basePosition).toEqual([2.5, 1, 0]);
  expect(inPlaceAfterTimelineState.evaluatedPosition).toEqual([3.25, 1, 0]);
  expect(inPlaceAfterTimelineState.stagingPosition).toEqual([4, 1, 0]);
  await page
    .getByLabel("Transform mode")
    .getByRole("button", { name: "Move" })
    .click();

  const inPlaceDiscardedState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;
    const asset = debug?.getAssets().find((candidate) => candidate.id === "uploaded-face");

    return {
      path: debug?.getInPlacePathEditState() ?? null,
      stagingPathAnchor:
        debug?.getPrefabTimeline().stagingPose?.pathDraft?.segments[0]?.anchor ??
        null,
      assetAnchor: asset?.bezierPath.segments[0]?.anchor ?? null,
    };
  });

  expect(inPlaceDiscardedState.path?.active).toBe(false);
  expect(inPlaceDiscardedState.stagingPathAnchor).toEqual([-20, 0]);
  expect(inPlaceDiscardedState.assetAnchor).toEqual([-42, 0]);
  await page.getByRole("button", { name: "Base Pose" }).click();
  await expect(page.getByRole("button", { name: "Base Pose" })).toHaveAttribute(
    "data-selected",
    "true",
  );
  await expect(page.locator("#transform-path-button")).toBeDisabled();
  await page.getByLabel("Position X").fill("1.75");
  await page.getByLabel("Position X").blur();
  const basePoseEditedState = await page.evaluate(() => ({
    basePosition: window.__vectorEditorDebug?.getPrefabAssembly().nodes[0]?.position ?? null,
    selectedClipId: window.__vectorEditorDebug?.getPrefabTimeline().selectedClipId ?? null,
    stagingPose: window.__vectorEditorDebug?.getPrefabTimeline().stagingPose ?? null,
  }));

  expect(basePoseEditedState.basePosition).toEqual([1.75, 1, 0]);
  expect(basePoseEditedState.selectedClipId).toBeNull();
  expect(basePoseEditedState.stagingPose).toBeNull();
  await page.getByRole("button", { name: "Pose Check (1000 ms)" }).click();
  expect(
    await page.evaluate(
      () =>
        window.__vectorEditorDebug?.getPrefabTimeline().stagingPose?.pathDraft
          ?.segments[0]?.anchor ?? null,
    ),
  ).toEqual([-20, 0]);
  await page.locator("#timeline-delete-clip-button").click();
  await page.getByLabel("Position X").fill("1.5");
  await page.getByLabel("Position X").blur();

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
  ).toEqual([0, 1, 0]);
  expect(timelineState?.stagingPose?.transform.position).toEqual([2, 1, 0]);
  await page.locator("#timeline-snap-base-button").click();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          window.__vectorEditorDebug?.getPrefabTimeline().stagingPose?.transform
            .position ?? null,
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
  await page.getByLabel("Transform mode").getByRole("button", { name: "Path" }).click();
  await page.getByLabel("In-place path anchor X").fill("-18");
  await page.getByLabel("In-place path anchor X").blur();
  await page.locator("#timeline-add-keyframe-button").click();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          window.__vectorEditorDebug
            ?.getPrefabTimeline()
            .animation.clips[0]?.tracks.some(
              (track) => track.target.property === "path",
            ) ?? false,
      ),
    )
    .toBe(true);
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
    .toBe(4);
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

  await uploadPrimitiveSvg(page, {
    filename: "bad-asset.svg",
    svgText: createInvalidMultiPathSvg(),
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
        hasPlaywrightProject: true,
      };
    }

    return {
      hasPlaywrightProject: debug
        .getProjects()
        .some((project) => project.name === "Playwright Project"),
    };
  });

  expect(afterProjectDeleteState.hasPlaywrightProject).toBe(false);
});

test("creates and renders a view morph profile asset", async ({ page }) => {
  await openEditor(page);
  await createEditorProject(page, "View Morph Project");

  await page.getByRole("button", { name: "Create View Morph Profile" }).click();
  await expect(
    page.getByRole("button", { name: "View Morph: View Morph Profile" }),
  ).toBeVisible();
  await expect(page.locator("#inspector-fields")).toContainText("viewMorphProfile");
  await expect(page.locator("#inspector-fields")).toContainText("Planes");
  await expect(page.locator("#inspector-fields")).toContainText("View Morph Segments");

  const assetState = await page.evaluate(() => {
    const debug = window.__vectorEditorDebug;
    const asset = debug
      ?.getAssets()
      .find((candidate) => candidate.id === "view-morph-profile");

    return {
      selectedAssetId: debug?.getSelectedAssetId() ?? null,
      asset,
    };
  });

  expect(assetState.selectedAssetId).toBe("view-morph-profile");
  expect(assetState.asset?.assetKind).toBe("viewMorphProfile");
  expect(assetState.asset?.viewMorphProfile?.version).toBe(1);
  expect(assetState.asset?.viewMorphProfile?.planes.length).toBe(3);
  expect(assetState.asset?.bezierPath.closed).toBe(true);
  expect(assetState.asset?.bezierPath.segments.length).toBe(4);

  const vectorCanvas = page.locator("#vector-canvas");
  await expect.poll(() => countWarmYellowPixels(vectorCanvas)).toBeGreaterThan(50);

  await page.getByRole("button", { name: "Source Path Edit" }).click();
  await expect(page.locator("#edit-path-button")).toBeDisabled();
  await expect(page.locator("#path-edit-fields")).toContainText(
    "View morph profiles do not support Source Path Edit yet.",
  );

  await page.getByRole("button", { name: "Asset Assembly" }).click();
  await page.getByRole("button", { name: "Add Primitive to Prefab" }).click();
  await expect(
    page.getByRole("button", { name: /Primitive: View Morph Profile/ }),
  ).toBeVisible();

  await expect.poll(() => countWarmYellowPixels(vectorCanvas)).toBeGreaterThan(50);
  await page.locator("#projection-toggle-button").click();
  await expect.poll(() => countWarmYellowPixels(vectorCanvas)).toBeGreaterThan(50);

  const prefabState = await page.evaluate(() => ({
    node: window.__vectorEditorDebug?.getPrefabAssembly().nodes[0] ?? null,
    asset: window.__vectorEditorDebug
      ?.getAssets()
      .find((candidate) => candidate.id === "view-morph-profile"),
  }));

  expect(prefabState.node).toMatchObject({
    kind: "primitive",
    assetId: "view-morph-profile",
  });
  expect(prefabState.asset?.viewMorphProfile?.planes[0]?.path.segments.length).toBe(
    4,
  );
});

