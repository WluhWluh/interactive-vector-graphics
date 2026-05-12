import { strict as assert } from "node:assert";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDataStore } from "../server/dataStore";
import { importPrimitiveSvgOnServer } from "../server/primitiveSvgImport";

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

  const primitiveFiles = await readdir(
    join(tempDataDir, "projects", firstProject.id, "primitives"),
  );
  assert.deepEqual(primitiveFiles.sort(), [
    "uploaded-face-2.svg",
    "uploaded-face.svg",
  ]);

  await store.deletePrimitiveAsset(firstProject.id, firstAsset.id);
  assert.equal(store.listPrimitiveAssets(firstProject.id).length, 1);

  await store.deleteProject(firstProject.id);
  assert.equal(store.listProjects().length, 1);
} finally {
  store.close();
  await rm(tempDataDir, { recursive: true, force: true });
}
