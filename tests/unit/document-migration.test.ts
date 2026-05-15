import { strict as assert } from "node:assert";
import { migrateSceneDocument } from "../../server/sceneDocumentMigration";
import type { PrefabDocument, SceneDocument } from "../../server/types";
import { migratePrefabDocument } from "../../src/core/documents/prefabDocumentMigration";

export function runDocumentMigrationUnitTests(): void {
  const prefabDocument: PrefabDocument = {
    version: 4,
    nodes: [],
    animation: {
      snapFps: 10,
      activeClipId: null,
      clips: [],
    },
  };
  const prefabMigration = migratePrefabDocument(prefabDocument);

  assert.equal(prefabMigration.ok, true);
  if (prefabMigration.ok) {
    assert.equal(prefabMigration.migrated, false);
    assert.equal(prefabMigration.fromVersion, 4);
    assert.deepEqual(prefabMigration.document, prefabDocument);
  }

  const unsupportedPrefab = migratePrefabDocument({ ...prefabDocument, version: 3 });
  assert.equal(unsupportedPrefab.ok, false);

  const sceneDocument: SceneDocument = {
    version: 2,
    camera: {
      projection: "perspective",
      position: [0, 0, 5],
      target: [0, 0, 0],
      fov: 45,
      zoom: 1,
      near: 0.05,
      far: 100,
    },
    nodes: [],
    animation: {
      fps: 24,
      activeClipId: null,
      clips: [],
    },
  };
  const sceneMigration = migrateSceneDocument(sceneDocument);

  assert.equal(sceneMigration.ok, true);
  if (sceneMigration.ok) {
    assert.equal(sceneMigration.migrated, false);
    assert.equal(sceneMigration.fromVersion, 2);
    assert.deepEqual(sceneMigration.document, sceneDocument);
  }

  const unsupportedScene = migrateSceneDocument({ ...sceneDocument, version: 1 });
  assert.equal(unsupportedScene.ok, false);
}
