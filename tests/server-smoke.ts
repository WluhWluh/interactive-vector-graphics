import { strict as assert } from "node:assert";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDataStore } from "../server/dataStore";
import { importPrimitiveSvgOnServer } from "../server/primitiveSvgImport";
import { validatePrefabDocument } from "../server/prefabDocument";
import { validateSceneDocument } from "../server/sceneDocument";
import { migrateSceneDocument } from "../server/sceneDocumentMigration";
import {
  parsePathDToStructuredBezier,
  structuredBezierToPathD,
} from "../src/core/assets/structuredBezierPath";
import { migratePrefabDocument } from "../src/core/documents/prefabDocumentMigration";
import type { StructuredBezierPath3D } from "../src/core/assets/structuredBezierPath3d";
import { evaluateViewMorphProfileToBezierPath } from "../src/core/assets/viewMorphProfile";
import type { PrefabDocument, SceneDocument } from "../server/types";
import {
  assertInvalidPrefabDocument,
  assertInvalidSceneDocument,
  assertInvalidStructuredBezierPath,
  assertInvalidStructuredBezierPath3D,
  cloneStructuredBezierPath3DForTest,
  cloneStructuredBezierPathForTest,
  createBezierSegment,
} from "./helpers/serverSmokeAssertions";

const tempDataDir = await mkdtemp(join(tmpdir(), "ivg-server-smoke-"));
const store = createDataStore(tempDataDir);

try {
  await store.ensureReady();

  assert.equal(await store.countProjects(), 0);
  assert.deepEqual(await store.listProjects(), []);

  const firstProject = await store.createProject("My Test Project");
  const secondProject = await store.createProject("My Test Project");

  assert.equal(firstProject.id, "my-test-project");
  assert.equal(firstProject.name, "My Test Project");
  assert.equal(secondProject.id, "my-test-project-2");
  assert.equal((await store.listProjects()).length, 2);

  const validSvg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100">',
    '<path fill="#ffcf4a" d="M -50 0 C -50 -33 -21 -50 0 -50 C 21 -50 50 -33 50 0 C 50 33 21 50 0 50 C -21 50 -50 33 -50 0 Z" />',
    "</svg>",
  ].join("");
  const imported = importPrimitiveSvgOnServer(validSvg, {
    id: "Uploaded Face",
    name: "Uploaded Face",
    sourceUrl: "test:uploaded-face.svg",
  });
  const firstAsset = await store.createPrimitiveAsset({
    projectId: firstProject.id,
    name: "Uploaded Face",
    sourceFilename: "uploaded-face.svg",
    svgText: validSvg,
    ...imported,
  });
  const secondAsset = await store.createPrimitiveAsset({
    projectId: firstProject.id,
    name: "Uploaded Face",
    sourceFilename: "uploaded-face.svg",
    svgText: validSvg,
    ...imported,
  });

  assert.equal(firstAsset.id, "uploaded-face");
  assert.equal(secondAsset.id, "uploaded-face-2");
  assert.equal(firstAsset.sourcePath, "projects/my-test-project/primitives/uploaded-face.svg");
  assert.deepEqual(firstAsset.viewBox, [-50, -50, 100, 100]);
  assert.equal(firstAsset.assetKind, "filledPath");
  assert.equal(firstAsset.fill, "#ffcf4a");
  assert.equal(firstAsset.bezierPath.version, 1);
  assert.equal(firstAsset.bezierPath.closed, true);
  assert.ok(firstAsset.bezierPath.segments.length >= 3);
  assert.deepEqual(firstAsset.bezierPath.segments[0]?.anchor, [-50, 0]);
  assert.equal(store.listPrimitiveAssets(firstProject.id).length, 2);
  const normalizedFilledSvg = await readFile(
    join(tempDataDir, firstAsset.sourcePath),
    "utf8",
  );

  assert.match(normalizedFilledSvg, /fill-rule="nonzero"/);
  assert.match(normalizedFilledSvg, /d="M -50 0 C -50 -33 -21 -50 0 -50/);

  const roundTripPathD = structuredBezierToPathD(firstAsset.bezierPath);
  const reparsedRoundTrip = parsePathDToStructuredBezier(roundTripPathD, {
    expectedClosed: true,
  });

  assert.equal(reparsedRoundTrip.closed, true);
  assert.ok(reparsedRoundTrip.segments.length >= 3);

  const validStrokeSvg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    '<path fill="none" stroke="#5bc4bf" stroke-width="6" d="M 10 80 C 30 20 70 20 90 80" />',
    "</svg>",
  ].join("");
  const importedStroke = importPrimitiveSvgOnServer(validStrokeSvg, {
    id: "leg-stroke",
    name: "Leg Stroke",
    sourceUrl: "test:leg-stroke.svg",
  });
  const strokeAsset = await store.createPrimitiveAsset({
    projectId: firstProject.id,
    name: "Leg Stroke",
    sourceFilename: "leg-stroke.svg",
    svgText: validStrokeSvg,
    ...importedStroke,
  });

  assert.equal(strokeAsset.assetKind, "strokePath");
  assert.equal(strokeAsset.fill, "none");
  assert.equal(strokeAsset.stroke, "#5bc4bf");
  assert.equal(strokeAsset.strokeWidth, 6);
  assert.equal(strokeAsset.bezierPath.version, 1);
  assert.equal(strokeAsset.bezierPath.closed, false);
  assert.equal(strokeAsset.bezierPath.segments.length, 2);
  assert.equal(store.listPrimitiveAssets(firstProject.id).length, 3);
  const normalizedStrokeSvg = await readFile(
    join(tempDataDir, strokeAsset.sourcePath),
    "utf8",
  );

  assert.match(normalizedStrokeSvg, /stroke-linecap="round"/);
  assert.match(normalizedStrokeSvg, /stroke-linejoin="round"/);

  const viewMorphAsset = await store.createViewMorphProfileAsset(firstProject.id);

  assert.equal(viewMorphAsset.id, "view-morph-profile");
  assert.equal(viewMorphAsset.assetKind, "viewMorphProfile");
  assert.equal(viewMorphAsset.fill, "#ffcf4a");
  assert.equal(viewMorphAsset.fillRule, "nonzero");
  assert.equal(viewMorphAsset.viewMorphProfile?.version, 1);
  assert.equal(viewMorphAsset.viewMorphProfile?.verticalPlanes.length, 2);
  assert.equal(
    viewMorphAsset.viewMorphProfile?.horizontalPlane.path.points.length,
    8,
  );
  assert.equal(viewMorphAsset.bezierPath.closed, true);
  assert.equal(
    viewMorphAsset.bezierPath.segments.length,
    (viewMorphAsset.viewMorphProfile?.verticalPlanes[0]?.path.points.length ?? 0) +
      (viewMorphAsset.viewMorphProfile?.horizontalPlane.path.points.length ?? 0),
  );
  assert.deepEqual(
    evaluateViewMorphProfileToBezierPath(viewMorphAsset.viewMorphProfile!, [
      0,
      0,
      1,
    ]),
    viewMorphAsset.bezierPath,
  );

  const normalizedViewMorphSvg = await readFile(
    join(tempDataDir, viewMorphAsset.sourcePath),
    "utf8",
  );

  assert.match(normalizedViewMorphSvg, /data-ivg-asset-kind="viewMorphProfile"/);
  assert.match(normalizedViewMorphSvg, /fill="#ffcf4a"/);

  const editedViewMorphProfile = structuredClone(
    viewMorphAsset.viewMorphProfile!,
  );
  editedViewMorphProfile.verticalPlanes[0]!.path.points[2]!.point = [62, 0];
  const updatedViewMorphAsset = await store.updatePrimitiveAssetViewMorphProfile(
    firstProject.id,
    viewMorphAsset.id,
    editedViewMorphProfile,
  );

  assert.equal(
    updatedViewMorphAsset.viewMorphProfile?.verticalPlanes[0]?.path.points[2]?.point[0],
    62,
  );
  assert.equal(updatedViewMorphAsset.bezierPath.closed, true);
  assert.match(
    await readFile(join(tempDataDir, updatedViewMorphAsset.sourcePath), "utf8"),
    /data-ivg-asset-kind="viewMorphProfile"/,
  );

  const curve3dAsset = await store.convertPrimitiveAssetTo3DCurve(
    firstProject.id,
    strokeAsset.id,
  );

  assert.equal(curve3dAsset.assetKind, "bezierCurve3d");
  assert.equal(curve3dAsset.stroke, strokeAsset.stroke);
  assert.equal(curve3dAsset.strokeWidth, strokeAsset.strokeWidth);
  assert.equal(curve3dAsset.bezierPath3d?.closed, false);
  assert.equal(
    curve3dAsset.bezierPath3d?.segments.length,
    strokeAsset.bezierPath.segments.length,
  );
  assert.ok(
    curve3dAsset.bezierPath3d?.segments.every(
      (segment) =>
        segment.anchor[2] === 0 &&
        segment.handleIn[2] === 0 &&
        segment.handleOut[2] === 0,
    ),
  );
  assert.match(
    await readFile(join(tempDataDir, curve3dAsset.sourcePath), "utf8"),
    /data-ivg-asset-kind="bezierCurve3d"/,
  );
  assert.equal(store.listPrimitiveAssets(firstProject.id).length, 5);
  await assert.rejects(
    () => store.convertPrimitiveAssetTo3DCurve(firstProject.id, firstAsset.id),
    /Only strokePath assets/,
  );
  await assert.rejects(
    () =>
      store.convertPrimitiveAssetTo3DCurve(firstProject.id, curve3dAsset.id),
    /Only strokePath assets/,
  );

  const editedCurve3d = cloneStructuredBezierPath3DForTest(
    curve3dAsset.bezierPath3d!,
  );
  editedCurve3d.segments[0] = {
    ...editedCurve3d.segments[0]!,
    anchor: [10, 80, 12],
  };
  const updatedCurve3dAsset = await store.updatePrimitiveAssetCurve3D(
    firstProject.id,
    curve3dAsset.id,
    editedCurve3d,
  );

  assert.deepEqual(
    updatedCurve3dAsset.bezierPath3d?.segments[0]?.anchor,
    [10, 80, 12],
  );
  assert.deepEqual(updatedCurve3dAsset.bezierPath.segments[0]?.anchor, [10, 80]);
  await assert.rejects(
    () =>
      store.updatePrimitiveAssetCurve3D(firstProject.id, strokeAsset.id, editedCurve3d),
    /Only 3D curve assets/,
  );
  assertInvalidStructuredBezierPath3D(
    {
      ...editedCurve3d,
      closed: true,
    } as unknown as StructuredBezierPath3D,
    /must be open/,
  );
  assertInvalidStructuredBezierPath3D(
    {
      ...editedCurve3d,
      segments: [editedCurve3d.segments[0]!],
    },
    /at least 2 segments/,
  );
  assertInvalidStructuredBezierPath3D(
    {
      ...editedCurve3d,
      segments: editedCurve3d.segments.map((segment, index) =>
        index === 1
          ? { ...segment, anchor: [0, Number.POSITIVE_INFINITY, 0] }
          : segment,
      ),
    },
    /finite numbers/,
  );
  assertInvalidStructuredBezierPath3D(
    {
      ...editedCurve3d,
      segments: editedCurve3d.segments.map((segment, index) =>
        index === 1 ? { ...segment, id: editedCurve3d.segments[0]!.id } : segment,
      ),
    },
    /duplicated/,
  );

  const editedFilledBezier = cloneStructuredBezierPathForTest(
    firstAsset.bezierPath,
  );
  editedFilledBezier.segments[0] = {
    ...editedFilledBezier.segments[0]!,
    anchor: [-45, 5],
  };
  const updatedFilledAsset = await store.updatePrimitiveAssetPath(
    firstProject.id,
    firstAsset.id,
    editedFilledBezier,
  );

  assert.deepEqual(updatedFilledAsset.bezierPath.segments[0]?.anchor, [-45, 5]);
  assert.match(updatedFilledAsset.pathD, /^M -45 5/);
  assert.match(
    await readFile(join(tempDataDir, firstAsset.sourcePath), "utf8"),
    /d="M -45 5/,
  );

  const editedStrokeBezier = cloneStructuredBezierPathForTest(
    strokeAsset.bezierPath,
  );
  editedStrokeBezier.segments[1] = {
    ...editedStrokeBezier.segments[1]!,
    handleIn: [-30, -20],
  };
  const updatedStrokeAsset = await store.updatePrimitiveAssetPath(
    firstProject.id,
    strokeAsset.id,
    editedStrokeBezier,
  );

  assert.equal(updatedStrokeAsset.bezierPath.closed, false);
  assert.deepEqual(updatedStrokeAsset.bezierPath.segments[1]?.handleIn, [-30, -20]);
  assert.doesNotMatch(updatedStrokeAsset.pathD, /Z$/);
  await assert.rejects(
    () =>
      store.updatePrimitiveAssetPath(firstProject.id, firstAsset.id, {
        ...firstAsset.bezierPath,
        closed: false,
      }),
    /must be closed/,
  );
  await assert.rejects(
    () =>
      store.updatePrimitiveAssetPath(firstProject.id, strokeAsset.id, {
        ...strokeAsset.bezierPath,
        closed: true,
      }),
    /must be open/,
  );

  const styledStrokeSvg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    '<path style="fill:none;stroke:#ffcf4a;stroke-width:4px" d="M 10 50 L 90 50" />',
    "</svg>",
  ].join("");
  const styledStroke = importPrimitiveSvgOnServer(styledStrokeSvg, {
    id: "styled-stroke",
    name: "Styled Stroke",
    sourceUrl: "test:styled-stroke.svg",
  });

  assert.equal(styledStroke.assetKind, "strokePath");
  assert.equal(styledStroke.stroke, "#ffcf4a");
  assert.equal(styledStroke.strokeWidth, 4);
  assert.equal(styledStroke.bezierPath.closed, false);
  assert.equal(styledStroke.bezierPath.segments.length, 2);

  assert.throws(
    () =>
      importPrimitiveSvgOnServer(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="none" stroke="#5bc4bf" stroke-width="6" d="M 0 0 L 10 0 M 20 0 L 30 0" /></svg>',
        { id: "multi-subpath", name: "Multi Subpath", sourceUrl: "test" },
      ),
    /exactly one subpath/,
  );
  assert.throws(
    () =>
      importPrimitiveSvgOnServer(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="none" stroke="#5bc4bf" stroke-width="6" d="M 10 10 L 90 10 Z" /></svg>',
        { id: "closed-stroke", name: "Closed Stroke", sourceUrl: "test" },
      ),
    /open path without Z commands/,
  );
  assert.throws(
    () =>
      importPrimitiveSvgOnServer(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path stroke="#5bc4bf" stroke-width="6" d="M 10 10 L 90 10" /></svg>',
        { id: "missing-fill-none", name: "Missing Fill None", sourceUrl: "test" },
      ),
    /fill="none"/,
  );
  assert.throws(
    () =>
      importPrimitiveSvgOnServer(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="none" stroke="#5bc4bf" d="M 10 10 L 90 10" /></svg>',
        { id: "missing-width", name: "Missing Width", sourceUrl: "test" },
      ),
    /stroke-width/,
  );
  assert.throws(
    () =>
      importPrimitiveSvgOnServer(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="none" stroke-width="6" d="M 10 10 L 90 10" /></svg>',
        { id: "missing-stroke", name: "Missing Stroke", sourceUrl: "test" },
      ),
    /define stroke/,
  );
  assert.throws(
    () =>
      importPrimitiveSvgOnServer(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="none" stroke="#5bc4bf" stroke-width="0" d="M 10 10 L 90 10" /></svg>',
        { id: "bad-width", name: "Bad Width", sourceUrl: "test" },
      ),
    /positive number/,
  );
  assert.throws(
    () =>
      importPrimitiveSvgOnServer(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="none" stroke="url(#paint)" stroke-width="6" d="M 10 10 L 90 10" /></svg>',
        { id: "paint-server", name: "Paint Server", sourceUrl: "test" },
      ),
    /paint server/,
  );
  assert.throws(
    () =>
      importPrimitiveSvgOnServer(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="none" stroke="#5bc4bf" stroke-width="6" stroke-dasharray="4 4" d="M 10 10 L 90 10" /></svg>',
        { id: "dash", name: "Dash", sourceUrl: "test" },
      ),
    /stroke-dasharray/,
  );
  assertInvalidStructuredBezierPath(
    {
      version: 1,
      closed: true,
      segments: [
        createBezierSegment("seg-1", [0, 0]),
        createBezierSegment("seg-2", [10, 0]),
        createBezierSegment("seg-3", [0, 10]),
      ],
    },
    { expectedClosed: false },
    /must be open/,
  );
  assertInvalidStructuredBezierPath(
    {
      version: 1,
      closed: true,
      segments: [
        createBezierSegment("seg-1", [0, 0]),
        createBezierSegment("seg-1", [10, 0]),
        createBezierSegment("seg-3", [0, 10]),
      ],
    },
    { expectedClosed: true },
    /duplicate Bezier segment id/,
  );
  assertInvalidStructuredBezierPath(
    {
      version: 1,
      closed: true,
      segments: [
        createBezierSegment("seg-1", [0, 0]),
        createBezierSegment("seg-2", [10, Number.POSITIVE_INFINITY]),
        createBezierSegment("seg-3", [0, 10]),
      ],
    },
    { expectedClosed: true },
    /finite numbers/,
  );

  const validPrefabDocument: PrefabDocument = {
    version: 4,
    nodes: [
      {
        id: "prefab-node-1",
        kind: "group",
        parentId: null,
        name: "Head",
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        billboardMode: "spherical",
      },
      {
        id: "prefab-node-2",
        kind: "primitive",
        parentId: "prefab-node-1",
        assetId: firstAsset.id,
        name: "Face",
        position: [0, 1, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        billboardMode: "spherical",
      },
    ],
    animation: {
      snapFps: 10,
      activeClipId: null,
      clips: [],
    },
  };
  const animatedPrefabDocument: PrefabDocument = {
    ...validPrefabDocument,
    animation: {
      snapFps: 10,
      activeClipId: "idle",
      clips: [
        {
          id: "idle",
          name: "Idle",
          durationMs: 1000,
          loop: true,
          tracks: [
            {
              id: "prefab-node-2-position",
              target: {
                nodeId: "prefab-node-2",
                property: "position",
              },
              keyframes: [
                {
                  id: "prefab-node-2-position-key",
                  timeMs: 0,
                  value: [0, 1, 0],
                  easing: "linear",
                },
                {
                  id: "prefab-node-2-position-key-2",
                  timeMs: 1000,
                  value: [0.5, 1, 0],
                  easing: "easeInOut",
                },
              ],
            },
          ],
        },
      ],
    },
  };
  const pathAnimatedPrefabDocument: PrefabDocument = {
    ...validPrefabDocument,
    animation: {
      snapFps: 10,
      activeClipId: "path-idle",
      clips: [
        {
          id: "path-idle",
          name: "Path Idle",
          durationMs: 1000,
          loop: true,
          tracks: [
            {
              id: "prefab-node-2-path",
              target: {
                nodeId: "prefab-node-2",
                property: "path",
              },
              keyframes: [
                {
                  id: "prefab-node-2-path-key",
                  timeMs: 0,
                  value: firstAsset.bezierPath,
                  easing: "linear",
                },
                {
                  id: "prefab-node-2-path-key-2",
                  timeMs: 1000,
                  value: {
                    ...firstAsset.bezierPath,
                    segments: firstAsset.bezierPath.segments.map((segment, index) =>
                      index === 0
                        ? {
                            ...segment,
                            anchor: [
                              segment.anchor[0] + 5,
                              segment.anchor[1],
                            ],
                          }
                        : segment,
                    ),
                  },
                  easing: "easeInOut",
                },
              ],
            },
          ],
        },
      ],
    },
  };

  validatePrefabDocument(validPrefabDocument, { projectId: firstProject.id });
  validatePrefabDocument(animatedPrefabDocument, { projectId: firstProject.id });
  validatePrefabDocument(pathAnimatedPrefabDocument, { projectId: firstProject.id });
  assert.deepEqual(migratePrefabDocument(validPrefabDocument), {
    ok: true,
    document: validPrefabDocument,
    fromVersion: 4,
    toVersion: 4,
    migrated: false,
  });
  const unsupportedPrefabMigration = migratePrefabDocument({
    ...validPrefabDocument,
    version: 3,
  });
  assert.equal(unsupportedPrefabMigration.ok, false);
  assert.match(unsupportedPrefabMigration.reason, /cannot be migrated/);
  assert.throws(
    () =>
      validatePrefabDocument(
        {
          ...validPrefabDocument,
          version: 1,
        },
        { projectId: firstProject.id },
      ),
    /version must be 4/,
  );
  assert.throws(
    () =>
      validatePrefabDocument(
        {
          ...validPrefabDocument,
          version: 3,
        },
        { projectId: firstProject.id },
      ),
    /version must be 4/,
  );
  assertInvalidPrefabDocument(
    {
      ...animatedPrefabDocument,
      animation: {
        ...animatedPrefabDocument.animation,
        snapFps: 0,
      },
    },
    /snapFps/,
    firstProject.id,
  );
  assertInvalidPrefabDocument(
    {
      ...animatedPrefabDocument,
      animation: {
        ...animatedPrefabDocument.animation,
        clips: [
          {
            ...animatedPrefabDocument.animation.clips[0],
            durationMs: 1000.5,
          },
        ],
      },
    },
    /durationMs must be an integer/,
    firstProject.id,
  );
  assertInvalidPrefabDocument(
    {
      ...animatedPrefabDocument,
      animation: {
        ...animatedPrefabDocument.animation,
        activeClipId: "missing-clip",
      },
    },
    /activeClipId/,
    firstProject.id,
  );
  assertInvalidPrefabDocument(
    {
      ...animatedPrefabDocument,
      animation: {
        ...animatedPrefabDocument.animation,
        clips: [
          {
            ...animatedPrefabDocument.animation.clips[0],
            loop: "yes",
          },
        ],
      },
    },
    /loop must be a boolean/,
    firstProject.id,
  );
  assertInvalidPrefabDocument(
    {
      ...animatedPrefabDocument,
      animation: {
        ...animatedPrefabDocument.animation,
        clips: [
          {
            ...animatedPrefabDocument.animation.clips[0],
            tracks: [
              {
                ...animatedPrefabDocument.animation.clips[0].tracks[0],
                target: {
                  nodeId: "prefab-node-2",
                  property: "opacity",
                },
              },
            ],
          },
        ],
      },
    },
    /property is invalid/,
    firstProject.id,
  );
  assertInvalidPrefabDocument(
    {
      ...animatedPrefabDocument,
      animation: {
        ...animatedPrefabDocument.animation,
        clips: [
          {
            ...animatedPrefabDocument.animation.clips[0],
            tracks: [
              {
                ...animatedPrefabDocument.animation.clips[0].tracks[0],
                keyframes: [
                  {
                    id: "bad-value",
                    timeMs: 0,
                    value: 1,
                    easing: "linear",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    /value must contain three numbers/,
    firstProject.id,
  );
  assertInvalidPrefabDocument(
    {
      ...animatedPrefabDocument,
      animation: {
        ...animatedPrefabDocument.animation,
        clips: [
          {
            ...animatedPrefabDocument.animation.clips[0],
            tracks: [
              {
                ...animatedPrefabDocument.animation.clips[0].tracks[0],
                keyframes: [
                  {
                    id: "bad-time",
                    timeMs: 2000,
                    value: [0, 1, 0],
                    easing: "linear",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    /within the clip duration/,
    firstProject.id,
  );
  assertInvalidPrefabDocument(
    {
      ...animatedPrefabDocument,
      animation: {
        ...animatedPrefabDocument.animation,
        clips: [
          {
            ...animatedPrefabDocument.animation.clips[0],
            tracks: [
              {
                ...animatedPrefabDocument.animation.clips[0].tracks[0],
                keyframes: [
                  {
                    id: "duplicate-key",
                    timeMs: 0,
                    value: [0, 1, 0],
                    easing: "linear",
                  },
                  {
                    id: "duplicate-key",
                    timeMs: 500,
                    value: [0.5, 1, 0],
                    easing: "linear",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    /duplicate keyframe id/,
    firstProject.id,
  );
  assertInvalidPrefabDocument(
    {
      ...pathAnimatedPrefabDocument,
      animation: {
        ...pathAnimatedPrefabDocument.animation,
        clips: [
          {
            ...pathAnimatedPrefabDocument.animation.clips[0],
            tracks: [
              {
                ...pathAnimatedPrefabDocument.animation.clips[0].tracks[0],
                keyframes: [
                  {
                    id: "bad-path",
                    timeMs: 0,
                    value: [0, 1, 0],
                    easing: "linear",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    /structured Bezier path/,
    firstProject.id,
  );
  assertInvalidPrefabDocument(
    {
      ...pathAnimatedPrefabDocument,
      animation: {
        ...pathAnimatedPrefabDocument.animation,
        clips: [
          {
            ...pathAnimatedPrefabDocument.animation.clips[0],
            tracks: [
              {
                ...pathAnimatedPrefabDocument.animation.clips[0].tracks[0],
                keyframes: [
                  pathAnimatedPrefabDocument.animation.clips[0].tracks[0].keyframes[0],
                  {
                    id: "missing-segment",
                    timeMs: 1000,
                    value: {
                      ...firstAsset.bezierPath,
                      segments: firstAsset.bezierPath.segments.slice(1),
                    },
                    easing: "linear",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    /same Bezier segment ids/,
    firstProject.id,
  );
  assert.throws(
    () =>
      validatePrefabDocument(
        {
          ...validPrefabDocument,
          nodes: [
            validPrefabDocument.nodes[0],
            {
              ...validPrefabDocument.nodes[1],
              id: "prefab-node-1",
            },
          ],
        },
        { projectId: firstProject.id },
      ),
    /duplicate node id/,
  );
  assert.throws(
    () =>
      validatePrefabDocument(
        {
          ...validPrefabDocument,
          nodes: [
            {
              ...validPrefabDocument.nodes[0],
              assetId: firstAsset.id,
            },
          ],
        },
        { projectId: firstProject.id },
      ),
    /must not be set for group/,
  );
  assert.throws(
    () =>
      validatePrefabDocument(
        {
          ...validPrefabDocument,
          nodes: [
            {
              ...validPrefabDocument.nodes[1],
              parentId: "missing-parent",
            },
          ],
        },
        { projectId: firstProject.id },
      ),
    /parentId "missing-parent" does not exist/,
  );

  const firstPrefab = await store.createPrefab({
    projectId: firstProject.id,
    name: "Demo Head",
    document: validPrefabDocument,
  });
  const secondPrefab = await store.createPrefab({
    projectId: firstProject.id,
    name: "Demo Head",
    document: {
      version: 4,
      nodes: [],
      animation: {
        snapFps: 10,
        activeClipId: null,
        clips: [],
      },
    },
  });

  assert.equal(firstPrefab.id, "demo-head");
  assert.equal(secondPrefab.id, "demo-head-2");
  assert.equal(firstPrefab.dataPath, "projects/my-test-project/prefabs/demo-head.json");
  assert.equal(store.listPrefabs(firstProject.id).length, 2);

  const storedPrefab = await store.getPrefab(firstProject.id, firstPrefab.id);
  assert.deepEqual(storedPrefab.document, validPrefabDocument);

  const updatedPrefabDocument: PrefabDocument = {
    ...validPrefabDocument,
    nodes: [
      validPrefabDocument.nodes[0],
      {
        ...validPrefabDocument.nodes[1],
        position: [0.5, 1, 0],
      },
    ],
  };
  const updatedPrefab = await store.updatePrefab(
    firstProject.id,
    firstPrefab.id,
    updatedPrefabDocument,
  );
  const updatedStoredPrefab = await store.getPrefab(firstProject.id, firstPrefab.id);

  assert.equal(updatedPrefab.id, firstPrefab.id);
  assert.deepEqual(updatedStoredPrefab.document, updatedPrefabDocument);

  const validSceneDocument: SceneDocument = {
    version: 2,
    camera: {
      projection: "perspective",
      position: [4.5, 3.2, 5.2],
      target: [0, 0.8, 0],
      fov: 45,
      zoom: 1,
      near: 0.05,
      far: 120,
    },
    nodes: [
      {
        id: "node-1",
        kind: "prefabInstance",
        prefabId: firstPrefab.id,
        position: [0, 1, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
    ],
    animation: {
      fps: 24,
      activeClipId: null,
      clips: [],
    },
  };
  const animatedSceneDocument: SceneDocument = {
    ...validSceneDocument,
    animation: {
      fps: 24,
      activeClipId: "intro",
      clips: [
        {
          id: "intro",
          name: "Intro",
          duration: 1,
          tracks: [
            {
              id: "node-1-position",
              target: {
                kind: "node",
                nodeId: "node-1",
                property: "position",
              },
              keyframes: [
                {
                  time: 0,
                  value: [0, 1, 0],
                  easing: "linear",
                },
                {
                  time: 1,
                  value: [2, 1, 0],
                  easing: "easeInOut",
                },
              ],
            },
          ],
        },
      ],
    },
  };
  validateSceneDocument(animatedSceneDocument, { projectId: firstProject.id });
  assert.deepEqual(migrateSceneDocument(validSceneDocument), {
    ok: true,
    document: validSceneDocument,
    fromVersion: 2,
    toVersion: 2,
    migrated: false,
  });
  const unsupportedSceneMigration = migrateSceneDocument({
    ...validSceneDocument,
    version: 1,
  });
  assert.equal(unsupportedSceneMigration.ok, false);
  assert.match(unsupportedSceneMigration.reason, /cannot be migrated/);
  assertInvalidSceneDocument(
    {
      ...validSceneDocument,
      nodes: [
        {
          id: "node-1",
          kind: "prefabInstance",
          position: [0, 1, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
      ],
    },
    /prefabId is required/,
    firstProject.id,
  );
  assert.throws(
    () =>
      validateSceneDocument(
        {
          ...validSceneDocument,
          version: 1,
        },
        { projectId: firstProject.id },
      ),
    /version must be 2/,
  );
  assertInvalidSceneDocument(
    {
      ...animatedSceneDocument,
      animation: {
        ...animatedSceneDocument.animation,
        activeClipId: "missing-clip",
      },
    },
    /activeClipId/,
    firstProject.id,
  );
  assertInvalidSceneDocument(
    {
      ...animatedSceneDocument,
      animation: {
        ...animatedSceneDocument.animation,
        clips: [
          {
            ...animatedSceneDocument.animation.clips[0],
            tracks: [
              {
                ...animatedSceneDocument.animation.clips[0].tracks[0],
                keyframes: [
                  {
                    time: 0,
                    value: 1,
                    easing: "linear",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    /value must contain three numbers/,
    firstProject.id,
  );
  assertInvalidSceneDocument(
    {
      ...animatedSceneDocument,
      animation: {
        ...animatedSceneDocument.animation,
        clips: [
          {
            ...animatedSceneDocument.animation.clips[0],
            tracks: [
              {
                id: "camera-fov",
                target: {
                  kind: "camera",
                  property: "fov",
                },
                keyframes: [
                  {
                    time: 0,
                    value: [1, 2, 3],
                    easing: "linear",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    /value must be a number/,
    firstProject.id,
  );
  assertInvalidSceneDocument(
    {
      ...animatedSceneDocument,
      animation: {
        ...animatedSceneDocument.animation,
        clips: [
          {
            ...animatedSceneDocument.animation.clips[0],
            tracks: [
              {
                ...animatedSceneDocument.animation.clips[0].tracks[0],
                keyframes: [
                  {
                    time: 2,
                    value: [0, 1, 0],
                    easing: "linear",
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    /within the clip duration/,
    firstProject.id,
  );
  const firstScene = await store.createScene({
    projectId: firstProject.id,
    name: "Opening Scene",
    document: validSceneDocument,
  });
  const secondScene = await store.createScene({
    projectId: firstProject.id,
    name: "Opening Scene",
    document: animatedSceneDocument,
  });

  assert.equal(firstScene.id, "opening-scene");
  assert.equal(secondScene.id, "opening-scene-2");
  assert.equal(firstScene.dataPath, "projects/my-test-project/scenes/opening-scene.json");
  assert.equal(store.listScenes(firstProject.id).length, 2);

  const storedScene = await store.getScene(firstProject.id, firstScene.id);
  assert.deepEqual(storedScene.document, validSceneDocument);

  const updatedSceneDocument: SceneDocument = {
    ...animatedSceneDocument,
    camera: {
      ...animatedSceneDocument.camera,
      projection: "orthographic",
      zoom: 1.5,
    },
    nodes: [
      {
        ...animatedSceneDocument.nodes[0],
        position: [2.5, 1, 0],
      },
    ],
  };
  const updatedScene = await store.updateScene(
    firstProject.id,
    firstScene.id,
    updatedSceneDocument,
  );
  const updatedStoredScene = await store.getScene(firstProject.id, firstScene.id);

  assert.equal(updatedScene.id, firstScene.id);
  assert.notEqual(updatedScene.updatedAt, firstScene.updatedAt);
  assert.deepEqual(updatedStoredScene.document, updatedSceneDocument);

  const primitiveFiles = await readdir(
    join(tempDataDir, "projects", firstProject.id, "primitives"),
  );
  assert.deepEqual(primitiveFiles.sort(), [
    "leg-stroke-3d-curve.svg",
    "leg-stroke.svg",
    "uploaded-face-2.svg",
    "uploaded-face.svg",
    "view-morph-profile.svg",
  ]);

  const sceneFiles = await readdir(
    join(tempDataDir, "projects", firstProject.id, "scenes"),
  );
  assert.deepEqual(sceneFiles.sort(), [
    "opening-scene-2.json",
    "opening-scene.json",
  ]);
  const sceneFileText = await readFile(
    join(tempDataDir, "projects", firstProject.id, "scenes", "opening-scene.json"),
    "utf8",
  );
  assert.equal(JSON.parse(sceneFileText).nodes[0].position[0], 2.5);

  const prefabFiles = await readdir(
    join(tempDataDir, "projects", firstProject.id, "prefabs"),
  );
  assert.deepEqual(prefabFiles.sort(), [
    "demo-head-2.json",
    "demo-head.json",
  ]);
  const prefabFileText = await readFile(
    join(tempDataDir, "projects", firstProject.id, "prefabs", "demo-head.json"),
    "utf8",
  );
  assert.equal(JSON.parse(prefabFileText).nodes[1].position[0], 0.5);

  await store.deletePrefab(firstProject.id, firstPrefab.id);
  assert.equal(store.listPrefabs(firstProject.id).length, 1);
  const remainingPrefabFiles = await readdir(
    join(tempDataDir, "projects", firstProject.id, "prefabs"),
  );
  assert.deepEqual(remainingPrefabFiles, ["demo-head-2.json"]);

  await store.deleteScene(firstProject.id, firstScene.id);
  assert.equal(store.listScenes(firstProject.id).length, 1);
  const remainingSceneFiles = await readdir(
    join(tempDataDir, "projects", firstProject.id, "scenes"),
  );
  assert.deepEqual(remainingSceneFiles, ["opening-scene-2.json"]);

  await store.deletePrimitiveAsset(firstProject.id, firstAsset.id);
  assert.equal(store.listPrimitiveAssets(firstProject.id).length, 4);

  await store.deleteProject(firstProject.id);
  assert.equal(store.listProjects().length, 1);
} finally {
  store.close();
  await rm(tempDataDir, { recursive: true, force: true });
}
