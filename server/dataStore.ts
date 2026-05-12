import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { ProjectIndexFile, ProjectRecord } from "./types";

const INDEX_FILE_NAME = "projects.json";
const PROJECTS_DIR_NAME = "projects";

export type DataStore = {
  dataDir: string;
  ensureReady: () => Promise<void>;
  countProjects: () => Promise<number>;
  listProjects: () => Promise<ProjectRecord[]>;
  createProject: (name: string) => Promise<ProjectRecord>;
};

export function createDataStore(dataDir: string): DataStore {
  const resolvedDataDir = resolve(dataDir);
  const indexPath = join(resolvedDataDir, INDEX_FILE_NAME);
  const projectsDir = join(resolvedDataDir, PROJECTS_DIR_NAME);

  async function ensureReady(): Promise<void> {
    await mkdir(projectsDir, { recursive: true });

    try {
      await readIndex();
    } catch (error) {
      if (isMissingFileError(error)) {
        await writeIndex({ version: 1, projects: [] });
        return;
      }

      throw error;
    }
  }

  async function countProjects(): Promise<number> {
    const index = await readIndex();
    return index.projects.length;
  }

  async function listProjects(): Promise<ProjectRecord[]> {
    const index = await readIndex();
    return [...index.projects];
  }

  async function createProject(name: string): Promise<ProjectRecord> {
    const trimmedName = name.trim();

    if (!trimmedName) {
      throw new Error("Project name is required.");
    }

    const index = await readIndex();
    const projectId = createUniqueProjectId(trimmedName, index.projects);
    const timestamp = new Date().toISOString();
    const project: ProjectRecord = {
      id: projectId,
      name: trimmedName,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    index.projects.push(project);
    await mkdir(join(projectsDir, projectId), { recursive: true });
    await writeIndex(index);

    return project;
  }

  async function readIndex(): Promise<ProjectIndexFile> {
    const raw = await readFile(indexPath, "utf8");
    const parsed = JSON.parse(raw) as ProjectIndexFile;

    if (parsed.version !== 1 || !Array.isArray(parsed.projects)) {
      throw new Error(`Invalid project index file at ${indexPath}.`);
    }

    return parsed;
  }

  async function writeIndex(index: ProjectIndexFile): Promise<void> {
    await mkdir(resolvedDataDir, { recursive: true });
    await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  }

  return {
    dataDir: resolvedDataDir,
    ensureReady,
    countProjects,
    listProjects,
    createProject,
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

function createUniqueProjectId(
  name: string,
  projects: ProjectRecord[],
): string {
  const baseId = slugifyProjectName(name);
  const existingIds = new Set(projects.map((project) => project.id));

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

function slugifyProjectName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "project";
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
