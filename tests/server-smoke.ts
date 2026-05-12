import { strict as assert } from "node:assert";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDataStore } from "../server/dataStore";
import { importPrimitiveSvgOnServer } from "../server/primitiveSvgImport";
import { validateSceneDocument } from "../server/sceneDocument";
import type { SceneDocument } from "../server/types";

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
  assert.equal(firstAsset.fill, "#ffcf4a");
  assert.equal(store.listPrimitiveAssets(firstProject.id).length, 2);

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
        assetId: firstAsset.id,
        position: [0, 1, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        billboardMode: "spherical",
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
    "uploaded-face-2.svg",
    "uploaded-face.svg",
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

  await store.deleteScene(firstProject.id, firstScene.id);
  assert.equal(store.listScenes(firstProject.id).length, 1);
  const remainingSceneFiles = await readdir(
    join(tempDataDir, "projects", firstProject.id, "scenes"),
  );
  assert.deepEqual(remainingSceneFiles, ["opening-scene-2.json"]);

  await store.deletePrimitiveAsset(firstProject.id, firstAsset.id);
  assert.equal(store.listPrimitiveAssets(firstProject.id).length, 1);

  await store.deleteProject(firstProject.id);
  assert.equal(store.listProjects().length, 1);
} finally {
  store.close();
  await rm(tempDataDir, { recursive: true, force: true });
}

function assertInvalidSceneDocument(
  document: unknown,
  expectedMessage: RegExp,
  projectId: string,
): void {
  assert.throws(
    () => validateSceneDocument(document, { projectId }),
    expectedMessage,
  );
}
