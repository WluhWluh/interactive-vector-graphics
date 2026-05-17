import { strict as assert } from "node:assert";
import { createOpaqueId, isOpaqueId } from "../../src/core/contracts/ids";
import {
  decodeProjectPackageManifest,
  decodeProjectPackageZip,
  encodeProjectPackageManifest,
  encodeProjectPackageZip,
  validateProjectPackageManifest,
  type ProjectPackageManifest,
} from "../../src/core/contracts/package";

export function runContractUnitTests(): void {
  const projectId = createOpaqueId("project");
  const assetId = createOpaqueId("primitiveAsset");
  const prefabId = createOpaqueId("prefab");
  const sceneId = createOpaqueId("scene");

  assert.equal(isOpaqueId(projectId, "project"), true);
  assert.equal(isOpaqueId(assetId, "primitiveAsset"), true);
  assert.equal(isOpaqueId(prefabId, "prefab"), true);
  assert.equal(isOpaqueId(sceneId, "scene"), true);
  assert.equal(isOpaqueId(projectId, "scene"), false);
  assert.notEqual(createOpaqueId("project"), createOpaqueId("project"));

  const manifest = createMinimalProjectPackage(projectId);
  validateProjectPackageManifest(manifest);
  assert.deepEqual(
    decodeProjectPackageManifest(encodeProjectPackageManifest(manifest)),
    manifest,
  );
  assert.deepEqual(decodeProjectPackageZip(encodeProjectPackageZip(manifest)), manifest);

  assert.throws(
    () =>
      validateProjectPackageManifest({
        ...manifest,
        version: 2,
      }),
    /version 1/,
  );
  assert.throws(
    () =>
      validateProjectPackageManifest({
        ...manifest,
        kind: "primitive",
      }),
    /root must reference a primitive asset/,
  );
  assert.throws(
    () =>
      validateProjectPackageManifest({
        ...manifest,
        projects: [],
      }),
    /one project record/,
  );
  assert.throws(
    () =>
      validateProjectPackageManifest({
        ...manifest,
        projects: [
          ...manifest.projects,
          {
            ...manifest.projects[0]!,
          },
        ],
      }),
    /one project record/,
  );
}

function createMinimalProjectPackage(projectId: string): ProjectPackageManifest {
  const timestamp = "2026-05-17T00:00:00.000Z";

  return {
    version: 1,
    kind: "project",
    exportedAt: timestamp,
    root: {
      projectId,
    },
    projects: [
      {
        id: projectId,
        name: "Contract Test Project",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    assets: [],
    prefabs: [],
    scenes: [],
  };
}
