import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { mkdir } from "node:fs/promises";
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
import { toDataRelativePath as getDataRelativePath } from "./persistence/dataPaths";
import {
  createPrimitiveAssetStore,
  type CreatePrimitiveAssetInput,
} from "./stores/primitiveAssetStore";
import { createProjectStore } from "./stores/projectStore";
import {
  createPrefabStore,
  type CreatePrefabInput,
} from "./stores/prefabStore";
import { createSceneStore, type CreateSceneInput } from "./stores/sceneStore";

const PROJECTS_DIR_NAME = "projects";
const DATABASE_FILE_NAME = "ivg.sqlite";
const SCENES_DIR_NAME = "scenes";
const PREFABS_DIR_NAME = "prefabs";

export type { CreatePrimitiveAssetInput } from "./stores/primitiveAssetStore";
export type { CreatePrefabInput } from "./stores/prefabStore";
export type { CreateSceneInput } from "./stores/sceneStore";

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

  function getProjectDir(projectId: string): string {
    return join(projectsDir, projectId);
  }

  const projectStore = createProjectStore({
    database,
    runDatabaseTransaction,
    getProjectDir,
    createUniqueId,
    slugifyName,
  });

  const primitiveAssetStore = createPrimitiveAssetStore({
    database,
    resolvedDataDir,
    assertProjectExists: projectStore.assertProjectExists,
    getProjectDir,
    toDataRelativePath,
    runDatabaseTransaction,
    createUniqueId,
    slugifyName,
  });

  function getScenesDir(projectId: string): string {
    return join(getProjectDir(projectId), SCENES_DIR_NAME);
  }

  function getPrefabsDir(projectId: string): string {
    return join(getProjectDir(projectId), PREFABS_DIR_NAME);
  }

  const prefabStore = createPrefabStore({
    database,
    resolvedDataDir,
    assertProjectExists: projectStore.assertProjectExists,
    getPrefabsDir,
    toDataRelativePath,
    runDatabaseTransaction,
    createUniqueId,
    slugifyName,
  });

  const sceneStore = createSceneStore({
    database,
    resolvedDataDir,
    assertProjectExists: projectStore.assertProjectExists,
    getScenesDir,
    toDataRelativePath,
    runDatabaseTransaction,
    createUniqueId,
    slugifyName,
  });

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
    countProjects: projectStore.countProjects,
    listProjects: projectStore.listProjects,
    createProject: projectStore.createProject,
    deleteProject: projectStore.deleteProject,
    listPrimitiveAssets: primitiveAssetStore.listPrimitiveAssets,
    createPrimitiveAsset: primitiveAssetStore.createPrimitiveAsset,
    updatePrimitiveAssetPath: primitiveAssetStore.updatePrimitiveAssetPath,
    convertPrimitiveAssetTo3DCurve:
      primitiveAssetStore.convertPrimitiveAssetTo3DCurve,
    updatePrimitiveAssetCurve3D: primitiveAssetStore.updatePrimitiveAssetCurve3D,
    deletePrimitiveAsset: primitiveAssetStore.deletePrimitiveAsset,
    listPrefabs: prefabStore.listPrefabs,
    createPrefab: prefabStore.createPrefab,
    getPrefab: prefabStore.getPrefab,
    updatePrefab: prefabStore.updatePrefab,
    deletePrefab: prefabStore.deletePrefab,
    listScenes: sceneStore.listScenes,
    createScene: sceneStore.createScene,
    getScene: sceneStore.getScene,
    updateScene: sceneStore.updateScene,
    deleteScene: sceneStore.deleteScene,
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

