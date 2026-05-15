import type { DatabaseSync } from "node:sqlite";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import type { PrefabDocument, PrefabRecord } from "../types";
import { validatePrefabDocument } from "../prefabDocument";
import { writeJsonDocumentFile } from "../persistence/documentFiles";
import { runFileBackedDatabaseTransaction } from "../persistence/persistenceTransaction";

export type CreatePrefabInput = {
  projectId: string;
  name: string;
  document: PrefabDocument;
};

export type PrefabStore = {
  listPrefabs: (projectId: string) => PrefabRecord[];
  createPrefab: (input: CreatePrefabInput) => Promise<PrefabRecord>;
  getPrefab: (
    projectId: string,
    prefabId: string,
  ) => Promise<{ prefab: PrefabRecord; document: PrefabDocument }>;
  updatePrefab: (
    projectId: string,
    prefabId: string,
    document: PrefabDocument,
  ) => Promise<PrefabRecord>;
  deletePrefab: (projectId: string, prefabId: string) => Promise<void>;
};

export type PrefabStoreDependencies = {
  database: DatabaseSync;
  resolvedDataDir: string;
  assertProjectExists: (projectId: string) => void;
  getPrefabsDir: (projectId: string) => string;
  toDataRelativePath: (path: string) => string;
  runDatabaseTransaction: <T>(operation: () => T) => T;
  createUniqueId: (baseId: string, existingIds: Set<string>) => string;
  slugifyName: (name: string) => string;
};

export function createPrefabStore(
  dependencies: PrefabStoreDependencies,
): PrefabStore {
  const {
    database,
    resolvedDataDir,
    assertProjectExists,
    getPrefabsDir,
    toDataRelativePath,
    runDatabaseTransaction,
    createUniqueId,
    slugifyName,
  } = dependencies;

  function listPrefabs(projectId: string): PrefabRecord[] {
    assertProjectExists(projectId);

    return database
      .prepare(
        `
        SELECT id, projectId, name, dataPath, createdAt, updatedAt
        FROM prefabs
        WHERE projectId = ?
        ORDER BY createdAt
      `,
      )
      .all(projectId) as PrefabRecord[];
  }

  async function createPrefab(input: CreatePrefabInput): Promise<PrefabRecord> {
    assertProjectExists(input.projectId);

    const prefabId = createUniquePrefabId(input.projectId, input.name);
    const timestamp = new Date().toISOString();
    const dataPath = join(getPrefabsDir(input.projectId), `${prefabId}.json`);
    const relativeDataPath = toDataRelativePath(dataPath);
    const prefab: PrefabRecord = {
      id: prefabId,
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
        INSERT INTO prefabs (id, projectId, name, dataPath, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
            )
            .run(
              prefab.id,
              prefab.projectId,
              prefab.name,
              prefab.dataPath,
              prefab.createdAt,
              prefab.updatedAt,
            );
        }),
      rollbackFiles: async () => {
        await rm(dataPath, { force: true });
      },
    });

    return prefab;
  }

  async function getPrefab(
    projectId: string,
    prefabId: string,
  ): Promise<{ prefab: PrefabRecord; document: PrefabDocument }> {
    const prefab = getPrefabRecord(projectId, prefabId);
    const rawDocument = JSON.parse(
      await readFile(join(resolvedDataDir, prefab.dataPath), "utf8"),
    ) as unknown;

    return {
      prefab,
      document: validatePrefabDocument(rawDocument, { projectId, prefabId }),
    };
  }

  async function updatePrefab(
    projectId: string,
    prefabId: string,
    document: PrefabDocument,
  ): Promise<PrefabRecord> {
    const prefab = getPrefabRecord(projectId, prefabId);
    const timestamp = new Date().toISOString();

    await writeJsonDocumentFile(join(resolvedDataDir, prefab.dataPath), document);
    runDatabaseTransaction(() => {
      database
        .prepare(
          "UPDATE prefabs SET updatedAt = ? WHERE projectId = ? AND id = ?",
        )
        .run(timestamp, projectId, prefabId);
    });

    return {
      ...prefab,
      updatedAt: timestamp,
    };
  }

  async function deletePrefab(projectId: string, prefabId: string): Promise<void> {
    const prefab = getPrefabRecord(projectId, prefabId);

    runDatabaseTransaction(() => {
      database
        .prepare("DELETE FROM prefabs WHERE projectId = ? AND id = ?")
        .run(projectId, prefabId);
    });
    await rm(join(resolvedDataDir, prefab.dataPath), { force: true });
  }

  function createUniquePrefabId(projectId: string, name: string): string {
    const baseId = slugifyName(name);
    const existingIds = new Set(listPrefabs(projectId).map((prefab) => prefab.id));

    return createUniqueId(baseId, existingIds);
  }

  function getPrefabRecord(projectId: string, prefabId: string): PrefabRecord {
    assertProjectExists(projectId);

    const row = database
      .prepare(
        `
        SELECT id, projectId, name, dataPath, createdAt, updatedAt
        FROM prefabs
        WHERE projectId = ? AND id = ?
      `,
      )
      .get(projectId, prefabId) as PrefabRecord | undefined;

    if (!row) {
      throw new Error(`Prefab "${prefabId}" does not exist.`);
    }

    return row;
  }

  return {
    listPrefabs,
    createPrefab,
    getPrefab,
    updatePrefab,
    deletePrefab,
  };
}
