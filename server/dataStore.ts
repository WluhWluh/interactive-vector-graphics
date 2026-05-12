import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { ProjectRecord, StoredPrimitiveAsset } from "./types";

const PROJECTS_DIR_NAME = "projects";
const DATABASE_FILE_NAME = "ivg.sqlite";

type StoredPrimitiveAssetRow = Omit<StoredPrimitiveAsset, "viewBox"> & {
  viewBox: string;
};

export type CreatePrimitiveAssetInput = {
  projectId: string;
  name: string;
  sourceFilename: string;
  svgText: string;
  viewBox: [number, number, number, number];
  pathD: string;
  fill: string;
  fillRule: "nonzero" | "evenodd";
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
  deletePrimitiveAsset: (projectId: string, assetId: string) => Promise<void>;
};

export function createDataStore(dataDir: string): DataStore {
  const resolvedDataDir = resolve(dataDir);
  const projectsDir = join(resolvedDataDir, PROJECTS_DIR_NAME);
  const databasePath = join(resolvedDataDir, DATABASE_FILE_NAME);

  /**
   * Runtime project data is intentionally kept outside Git. SQLite stores the
   * searchable metadata, while the original uploaded SVG text stays beside the
   * project so future tools can inspect or migrate assets without decoding DB
   * blobs.
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
        viewBox TEXT NOT NULL,
        pathD TEXT NOT NULL,
        fill TEXT NOT NULL,
        fillRule TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (projectId, id),
        FOREIGN KEY (projectId) REFERENCES projects(id) ON DELETE CASCADE
      );
    `);
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

    database
      .prepare(
        "INSERT INTO projects (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)",
      )
      .run(project.id, project.name, project.createdAt, project.updatedAt);

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
    database.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
    await rm(getProjectDir(projectId), { recursive: true, force: true });
  }

  function listPrimitiveAssets(projectId: string): StoredPrimitiveAsset[] {
    assertProjectExists(projectId);

    const rows = database
      .prepare(
        `
        SELECT id, projectId, name, sourceFilename, sourcePath, viewBox, pathD,
          fill, fillRule, createdAt, updatedAt
        FROM primitive_assets
        WHERE projectId = ?
        ORDER BY createdAt
      `,
      )
      .all(projectId) as StoredPrimitiveAssetRow[];

    return rows.map(hydratePrimitiveAssetRow);
  }

  async function createPrimitiveAsset(
    input: CreatePrimitiveAssetInput,
  ): Promise<StoredPrimitiveAsset> {
    assertProjectExists(input.projectId);

    const assetId = createUniqueAssetId(input.projectId, input.name);
    const timestamp = new Date().toISOString();
    const sourcePath = join(
      getProjectDir(input.projectId),
      "primitives",
      `${assetId}.svg`,
    );
    const relativeSourcePath = toDataRelativePath(sourcePath);
    const asset: StoredPrimitiveAsset = {
      id: assetId,
      projectId: input.projectId,
      name: input.name.trim(),
      sourceFilename: input.sourceFilename,
      sourcePath: relativeSourcePath,
      viewBox: input.viewBox,
      pathD: input.pathD,
      fill: input.fill,
      fillRule: input.fillRule,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await mkdir(dirname(sourcePath), { recursive: true });
    await writeFile(sourcePath, input.svgText, "utf8");
    database
      .prepare(
        `
        INSERT INTO primitive_assets (
          id, projectId, name, sourceFilename, sourcePath, viewBox, pathD,
          fill, fillRule, createdAt, updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        asset.id,
        asset.projectId,
        asset.name,
        asset.sourceFilename,
        asset.sourcePath,
        JSON.stringify(asset.viewBox),
        asset.pathD,
        asset.fill,
        asset.fillRule,
        asset.createdAt,
        asset.updatedAt,
      );

    return asset;
  }

  async function deletePrimitiveAsset(
    projectId: string,
    assetId: string,
  ): Promise<void> {
    assertProjectExists(projectId);

    const row = database
      .prepare(
        "SELECT sourcePath FROM primitive_assets WHERE projectId = ? AND id = ?",
      )
      .get(projectId, assetId) as { sourcePath: string } | undefined;

    database
      .prepare("DELETE FROM primitive_assets WHERE projectId = ? AND id = ?")
      .run(projectId, assetId);

    if (row) {
      await rm(join(resolvedDataDir, row.sourcePath), { force: true });
    }
  }

  function createUniqueProjectId(name: string): string {
    const baseId = slugifyName(name);
    const existingIds = new Set(listProjects().map((project) => project.id));

    return createUniqueId(baseId, existingIds);
  }

  function createUniqueAssetId(projectId: string, name: string): string {
    const baseId = slugifyName(name);
    const existingIds = new Set(
      listPrimitiveAssets(projectId).map((asset) => asset.id),
    );

    return createUniqueId(baseId, existingIds);
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

  function toDataRelativePath(path: string): string {
    return path.slice(resolvedDataDir.length + 1).replaceAll("\\", "/");
  }

  return {
    dataDir: resolvedDataDir,
    ensureReady,
    close,
    countProjects,
    listProjects,
    createProject,
    deleteProject,
    listPrimitiveAssets,
    createPrimitiveAsset,
    deletePrimitiveAsset,
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

function hydratePrimitiveAssetRow(
  row: StoredPrimitiveAssetRow,
): StoredPrimitiveAsset {
  return {
    ...row,
    viewBox: JSON.parse(row.viewBox) as [number, number, number, number],
    fillRule: row.fillRule === "evenodd" ? "evenodd" : "nonzero",
  };
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
