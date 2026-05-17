import type { DatabaseSync } from "node:sqlite";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { SceneDocument, SceneRecord } from "../types";
import { validateSceneDocument } from "../sceneDocument";
import { migrateSceneDocument } from "../sceneDocumentMigration";
import { writeJsonDocumentFile } from "../persistence/documentFiles";
import { runFileBackedDatabaseTransaction } from "../persistence/persistenceTransaction";
import type { SceneId } from "../../src/core/contracts/ids";

export type CreateSceneInput = {
  projectId: string;
  name: string;
  document: SceneDocument;
};

export type SceneStore = {
  listScenes: (projectId: string) => SceneRecord[];
  createScene: (input: CreateSceneInput) => Promise<SceneRecord>;
  importSceneFromPackage: (input: CreateSceneInput) => Promise<SceneRecord>;
  getScene: (
    projectId: string,
    sceneId: string,
  ) => Promise<{ scene: SceneRecord; document: SceneDocument }>;
  updateScene: (
    projectId: string,
    sceneId: string,
    document: SceneDocument,
  ) => Promise<SceneRecord>;
  renameScene: (projectId: string, sceneId: string, name: string) => SceneRecord;
  deleteScene: (projectId: string, sceneId: string) => Promise<void>;
};

export type SceneStoreDependencies = {
  database: DatabaseSync;
  resolvedDataDir: string;
  assertProjectExists: (projectId: string) => void;
  getScenesDir: (projectId: string) => string;
  toDataRelativePath: (path: string) => string;
  runDatabaseTransaction: <T>(operation: () => T) => T;
  createSceneId: () => SceneId;
};

export function createSceneStore(
  dependencies: SceneStoreDependencies,
): SceneStore {
  const {
    database,
    resolvedDataDir,
    assertProjectExists,
    getScenesDir,
    toDataRelativePath,
    runDatabaseTransaction,
    createSceneId,
  } = dependencies;

  function listScenes(projectId: string): SceneRecord[] {
    assertProjectExists(projectId);

    return database
      .prepare(
        `
        SELECT id, projectId, name, dataPath, createdAt, updatedAt
        FROM scenes
        WHERE projectId = ?
        ORDER BY createdAt
      `,
      )
      .all(projectId) as SceneRecord[];
  }

  async function createScene(input: CreateSceneInput): Promise<SceneRecord> {
    return writeNewScene(input);
  }

  async function importSceneFromPackage(input: CreateSceneInput): Promise<SceneRecord> {
    return writeNewScene(input);
  }

  async function writeNewScene(input: CreateSceneInput): Promise<SceneRecord> {
    assertProjectExists(input.projectId);

    const trimmedName = input.name.trim();

    if (!trimmedName) {
      throw new Error("Scene name is required.");
    }

    const sceneId = createSceneId();
    const timestamp = new Date().toISOString();
    const dataPath = join(getScenesDir(input.projectId), `${sceneId}.json`);
    const relativeDataPath = toDataRelativePath(dataPath);
    const scene: SceneRecord = {
      id: sceneId,
      projectId: input.projectId,
      name: trimmedName,
      dataPath: relativeDataPath,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await runFileBackedDatabaseTransaction({
      writeFiles: () => writeJsonDocumentFile(dataPath, input.document),
      writeDatabase: () =>
        runDatabaseTransaction(() => {
          database
            .prepare(
              `
        INSERT INTO scenes (id, projectId, name, dataPath, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
            )
            .run(
              scene.id,
              scene.projectId,
              scene.name,
              scene.dataPath,
              scene.createdAt,
              scene.updatedAt,
            );
        }),
      rollbackFiles: async () => {
        await rm(dataPath, { force: true });
      },
    });

    return scene;
  }

  async function getScene(
    projectId: string,
    sceneId: string,
  ): Promise<{ scene: SceneRecord; document: SceneDocument }> {
    const scene = getSceneRecord(projectId, sceneId);
    const rawDocument = JSON.parse(
      await readFile(join(resolvedDataDir, scene.dataPath), "utf8"),
    ) as unknown;
    const migration = migrateSceneDocument(rawDocument);

    if (!migration.ok) {
      throw new Error(migration.reason);
    }

    return {
      scene,
      document: validateSceneDocument(migration.document, { projectId, sceneId }),
    };
  }

  async function updateScene(
    projectId: string,
    sceneId: string,
    document: SceneDocument,
  ): Promise<SceneRecord> {
    const scene = getSceneRecord(projectId, sceneId);
    const timestamp = new Date().toISOString();

    await writeJsonDocumentFile(join(resolvedDataDir, scene.dataPath), document);
    runDatabaseTransaction(() => {
      database
        .prepare(
          "UPDATE scenes SET updatedAt = ? WHERE projectId = ? AND id = ?",
        )
        .run(timestamp, projectId, sceneId);
    });

    return {
      ...scene,
      updatedAt: timestamp,
    };
  }

  function renameScene(
    projectId: string,
    sceneId: string,
    name: string,
  ): SceneRecord {
    const trimmedName = name.trim();

    if (!trimmedName) {
      throw new Error("Scene name is required.");
    }

    const scene = getSceneRecord(projectId, sceneId);
    const timestamp = new Date().toISOString();
    const renamedScene = {
      ...scene,
      name: trimmedName,
      updatedAt: timestamp,
    };

    runDatabaseTransaction(() => {
      database
        .prepare(
          "UPDATE scenes SET name = ?, updatedAt = ? WHERE projectId = ? AND id = ?",
        )
        .run(renamedScene.name, renamedScene.updatedAt, projectId, sceneId);
    });

    return renamedScene;
  }

  async function deleteScene(projectId: string, sceneId: string): Promise<void> {
    const scene = getSceneRecord(projectId, sceneId);

    runDatabaseTransaction(() => {
      database
        .prepare("DELETE FROM scenes WHERE projectId = ? AND id = ?")
        .run(projectId, sceneId);
    });
    await rm(join(resolvedDataDir, scene.dataPath), { force: true });
  }

  function getSceneRecord(projectId: string, sceneId: string): SceneRecord {
    assertProjectExists(projectId);

    const row = database
      .prepare(
        `
        SELECT id, projectId, name, dataPath, createdAt, updatedAt
        FROM scenes
        WHERE projectId = ? AND id = ?
      `,
      )
      .get(projectId, sceneId) as SceneRecord | undefined;

    if (!row) {
      throw new Error(`Scene "${sceneId}" does not exist.`);
    }

    return row;
  }

  return {
    listScenes,
    createScene,
    importSceneFromPackage,
    getScene,
    updateScene,
    renameScene,
    deleteScene,
  };
}
