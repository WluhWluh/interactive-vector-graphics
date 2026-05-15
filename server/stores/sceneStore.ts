import type { DatabaseSync } from "node:sqlite";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { SceneDocument, SceneRecord } from "../types";
import { validateSceneDocument } from "../sceneDocument";
import { writeJsonDocumentFile } from "../persistence/documentFiles";
import { runFileBackedDatabaseTransaction } from "../persistence/persistenceTransaction";

export type CreateSceneInput = {
  projectId: string;
  name: string;
  document: SceneDocument;
};

export type SceneStore = {
  listScenes: (projectId: string) => SceneRecord[];
  createScene: (input: CreateSceneInput) => Promise<SceneRecord>;
  getScene: (
    projectId: string,
    sceneId: string,
  ) => Promise<{ scene: SceneRecord; document: SceneDocument }>;
  updateScene: (
    projectId: string,
    sceneId: string,
    document: SceneDocument,
  ) => Promise<SceneRecord>;
  deleteScene: (projectId: string, sceneId: string) => Promise<void>;
};

export type SceneStoreDependencies = {
  database: DatabaseSync;
  resolvedDataDir: string;
  assertProjectExists: (projectId: string) => void;
  getScenesDir: (projectId: string) => string;
  toDataRelativePath: (path: string) => string;
  runDatabaseTransaction: <T>(operation: () => T) => T;
  createUniqueId: (baseId: string, existingIds: Set<string>) => string;
  slugifyName: (name: string) => string;
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
    createUniqueId,
    slugifyName,
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
    assertProjectExists(input.projectId);

    const sceneId = createUniqueSceneId(input.projectId, input.name);
    const timestamp = new Date().toISOString();
    const dataPath = join(getScenesDir(input.projectId), `${sceneId}.json`);
    const relativeDataPath = toDataRelativePath(dataPath);
    const scene: SceneRecord = {
      id: sceneId,
      projectId: input.projectId,
      name: input.name.trim(),
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

    return {
      scene,
      document: validateSceneDocument(rawDocument, { projectId, sceneId }),
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

  async function deleteScene(projectId: string, sceneId: string): Promise<void> {
    const scene = getSceneRecord(projectId, sceneId);

    runDatabaseTransaction(() => {
      database
        .prepare("DELETE FROM scenes WHERE projectId = ? AND id = ?")
        .run(projectId, sceneId);
    });
    await rm(join(resolvedDataDir, scene.dataPath), { force: true });
  }

  function createUniqueSceneId(projectId: string, name: string): string {
    const baseId = slugifyName(name);
    const existingIds = new Set(listScenes(projectId).map((scene) => scene.id));

    return createUniqueId(baseId, existingIds);
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
    getScene,
    updateScene,
    deleteScene,
  };
}
