import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import type {
  PrefabDocument,
  PrefabRecord,
  ProjectRecord,
  SceneDocument,
  SceneRecord,
  StoredPrimitiveAsset,
} from "./types";
import type { StructuredBezierPath } from "../src/core/assets/structuredBezierPath";
import type { StructuredBezierPath3D } from "../src/core/assets/structuredBezierPath3d";
import { validatePrefabDocument } from "./prefabDocument";
import { validateSceneDocument } from "./sceneDocument";
import { toDataRelativePath as getDataRelativePath } from "./persistence/dataPaths";
import { writeJsonDocumentFile } from "./persistence/documentFiles";
import {
  createPrimitiveAssetStore,
  type CreatePrimitiveAssetInput,
} from "./stores/primitiveAssetStore";

const PROJECTS_DIR_NAME = "projects";
const DATABASE_FILE_NAME = "ivg.sqlite";
const SCENES_DIR_NAME = "scenes";
const PREFABS_DIR_NAME = "prefabs";

export type { CreatePrimitiveAssetInput } from "./stores/primitiveAssetStore";

export type CreateSceneInput = {
  projectId: string;
  name: string;
  document: SceneDocument;
};

export type CreatePrefabInput = {
  projectId: string;
  name: string;
  document: PrefabDocument;
};

export type DataStore = {
  dataDir: string;
  ensureReady: () => Promise<void>;
  close: () => void;
  countProjects: () => number;
  listProjects: () => ProjectRecord[];
  createProject: (name: string) => Promise<ProjectRecord>;
  deleteProject: (projectId: string) => Promise<void>;
  listPrimitiveAssets: (projectId: string) => StoredPrimitiveAsset[];
  createPrimitiveAsset: (
    input: CreatePrimitiveAssetInput,
  ) => Promise<StoredPrimitiveAsset>;
  updatePrimitiveAssetPath: (
    projectId: string,
    assetId: string,
    bezierPath: StructuredBezierPath,
  ) => Promise<StoredPrimitiveAsset>;
  convertPrimitiveAssetTo3DCurve: (
    projectId: string,
    assetId: string,
  ) => Promise<StoredPrimitiveAsset>;
  updatePrimitiveAssetCurve3D: (
    projectId: string,
    assetId: string,
    bezierPath3d: StructuredBezierPath3D,
  ) => Promise<StoredPrimitiveAsset>;
  deletePrimitiveAsset: (projectId: string, assetId: string) => Promise<void>;
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

export function createDataStore(dataDir: string): DataStore {
  const resolvedDataDir = resolve(dataDir);
  const projectsDir = join(resolvedDataDir, PROJECTS_DIR_NAME);
  const databasePath = join(resolvedDataDir, DATABASE_FILE_NAME);

  /**
   * Runtime project data is intentionally kept outside Git. SQLite stores the
   * searchable metadata, while normalized SVG files stay beside each project so
   * future tools can inspect project-native assets without decoding DB blobs.
   */
  mkdirSync(resolvedDataDir, { recursive: true });
  const database = new DatabaseSync(databasePath);

  async function ensureReady(): Promise<void> {
    await mkdir(projectsDir, { recursive: true });
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS primitive_assets (
        id TEXT NOT NULL,
        projectId TEXT NOT NULL,
        name TEXT NOT NULL,
        sourceFilename TEXT NOT NULL,
        sourcePath TEXT NOT NULL,
        assetKind TEXT NOT NULL DEFAULT 'filledPath',
        viewBox TEXT NOT NULL,
        pathD TEXT NOT NULL,
        fill TEXT NOT NULL,
        fillRule TEXT NOT NULL,
        stroke TEXT,
        strokeWidth REAL,
        bezierPath TEXT,
        bezierPath3d TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (projectId, id),
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS scenes (
        id TEXT NOT NULL,
        projectId TEXT NOT NULL,
        name TEXT NOT NULL,
        dataPath TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (projectId, id),
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS prefabs (
        id TEXT NOT NULL,
        projectId TEXT NOT NULL,
        name TEXT NOT NULL,
        dataPath TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (projectId, id),
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);
    ensurePrimitiveAssetColumn(
      "assetKind",
      "TEXT NOT NULL DEFAULT 'filledPath'",
    );
    ensurePrimitiveAssetColumn("stroke", "TEXT");
    ensurePrimitiveAssetColumn("strokeWidth", "REAL");
    ensurePrimitiveAssetColumn("bezierPath", "TEXT");
    ensurePrimitiveAssetColumn("bezierPath3d", "TEXT");
  }

  function close(): void {
    database.close();
  }

  function countProjects(): number {
    const row = database
      .prepare("SELECT COUNT(*) AS count FROM projects")
      .get() as { count: number };

    return row.count;
  }

  function runDatabaseTransaction<T>(operation: () => T): T {
    database.exec("BEGIN IMMEDIATE;");

    try {
      const result = operation();
      database.exec("COMMIT;");
      return result;
    } catch (error) {
      database.exec("ROLLBACK;");
      throw error;
    }
  }

  function listProjects(): ProjectRecord[] {
    return database
      .prepare("SELECT id, name, createdAt, updatedAt FROM projects ORDER BY createdAt")
      .all() as ProjectRecord[];
  }

  async function createProject(name: string): Promise<ProjectRecord> {
    const trimmedName = name.trim();

    if (!trimmedName) {
      throw new Error("Project name is required.");
    }

    const projectId = createUniqueProjectId(trimmedName);
    const timestamp = new Date().toISOString();
    const project: ProjectRecord = {
      id: projectId,
      name: trimmedName,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    runDatabaseTransaction(() => {
      database
        .prepare(
          "INSERT INTO projects (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)",
        )
        .run(project.id, project.name, project.createdAt, project.updatedAt);
    });

    await mkdir(getProjectDir(project.id), { recursive: true });

    return project;
  }

  async function deleteProject(projectId: string): Promise<void> {
    /**
     * Project ids normally come from slugified project names, but API route
     * parameters are still untrusted. Confirming the record before deriving a
     * filesystem path prevents arbitrary path removal through crafted ids.
     */
    assertProjectExists(projectId);
    runDatabaseTransaction(() => {
      database.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
    });
    await rm(getProjectDir(projectId), { recursive: true, force: true });
  }

  const primitiveAssetStore = createPrimitiveAssetStore({
    database,
    resolvedDataDir,
    assertProjectExists,
    getProjectDir,
    toDataRelativePath,
    runDatabaseTransaction,
    createUniqueId,
    slugifyName,
  });

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

    await writePrefabDocument(dataPath, input.document);
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

    await writePrefabDocument(join(resolvedDataDir, prefab.dataPath), document);
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

    await writeSceneDocument(dataPath, input.document);
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

    await writeSceneDocument(join(resolvedDataDir, scene.dataPath), document);
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

  function createUniqueProjectId(name: string): string {
    const baseId = slugifyName(name);
    const existingIds = new Set(listProjects().map((project) => project.id));

    return createUniqueId(baseId, existingIds);
  }

  function createUniquePrefabId(projectId: string, name: string): string {
    const baseId = slugifyName(name);
    const existingIds = new Set(listPrefabs(projectId).map((prefab) => prefab.id));

    return createUniqueId(baseId, existingIds);
  }

  function createUniqueSceneId(projectId: string, name: string): string {
    const baseId = slugifyName(name);
    const existingIds = new Set(listScenes(projectId).map((scene) => scene.id));

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

  function assertProjectExists(projectId: string): void {
    const row = database
      .prepare("SELECT id FROM projects WHERE id = ?")
      .get(projectId) as { id: string } | undefined;

    if (!row) {
      throw new Error(`Project "${projectId}" does not exist.`);
    }
  }

  function getProjectDir(projectId: string): string {
    return join(projectsDir, projectId);
  }

  function getScenesDir(projectId: string): string {
    return join(getProjectDir(projectId), SCENES_DIR_NAME);
  }

  function getPrefabsDir(projectId: string): string {
    return join(getProjectDir(projectId), PREFABS_DIR_NAME);
  }

  async function writeSceneDocument(
    path: string,
    document: SceneDocument,
  ): Promise<void> {
    await writeJsonDocumentFile(path, document);
  }

  async function writePrefabDocument(
    path: string,
    document: PrefabDocument,
  ): Promise<void> {
    await writeJsonDocumentFile(path, document);
  }

  function toDataRelativePath(path: string): string {
    return getDataRelativePath(resolvedDataDir, path);
  }

  function ensurePrimitiveAssetColumn(name: string, definition: string): void {
    const columns = database
      .prepare("PRAGMA table_info(primitive_assets)")
      .all() as Array<{ name: string }>;

    if (columns.some((column) => column.name === name)) {
      return;
    }

    database.exec(`ALTER TABLE primitive_assets ADD COLUMN ${name} ${definition};`);
  }

  return {
    dataDir: resolvedDataDir,
    ensureReady,
    close,
    countProjects,
    listProjects,
    createProject,
    deleteProject,
    listPrimitiveAssets: primitiveAssetStore.listPrimitiveAssets,
    createPrimitiveAsset: primitiveAssetStore.createPrimitiveAsset,
    updatePrimitiveAssetPath: primitiveAssetStore.updatePrimitiveAssetPath,
    convertPrimitiveAssetTo3DCurve:
      primitiveAssetStore.convertPrimitiveAssetTo3DCurve,
    updatePrimitiveAssetCurve3D: primitiveAssetStore.updatePrimitiveAssetCurve3D,
    deletePrimitiveAsset: primitiveAssetStore.deletePrimitiveAsset,
    listPrefabs,
    createPrefab,
    getPrefab,
    updatePrefab,
    deletePrefab,
    listScenes,
    createScene,
    getScene,
    updateScene,
    deleteScene,
  };
}

export function getDefaultDataDir(): string {
  return process.env.IVG_DATA_DIR ?? resolve(process.cwd(), "data");
}

export function getServerPort(): number {
  const rawPort = process.env.IVG_SERVER_PORT;

  if (!rawPort) {
    return 4317;
  }

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("IVG_SERVER_PORT must be a valid TCP port.");
  }

  return port;
}

function createUniqueId(baseId: string, existingIds: Set<string>): string {
  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  let candidate = `${baseId}-${suffix}`;

  while (existingIds.has(candidate)) {
    suffix += 1;
    candidate = `${baseId}-${suffix}`;
  }

  return candidate;
}

function slugifyName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "item";
}

