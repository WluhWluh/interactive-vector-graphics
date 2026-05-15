import type { DatabaseSync } from "node:sqlite";
import { mkdir, rm } from "node:fs/promises";
import type { ProjectRecord } from "../types";

export type ProjectStore = {
  countProjects: () => number;
  listProjects: () => ProjectRecord[];
  createProject: (name: string) => Promise<ProjectRecord>;
  deleteProject: (projectId: string) => Promise<void>;
  assertProjectExists: (projectId: string) => void;
  getProjectDir: (projectId: string) => string;
};

export type ProjectStoreDependencies = {
  database: DatabaseSync;
  runDatabaseTransaction: <T>(operation: () => T) => T;
  getProjectDir: (projectId: string) => string;
  createUniqueId: (baseId: string, existingIds: Set<string>) => string;
  slugifyName: (name: string) => string;
};

export function createProjectStore(
  dependencies: ProjectStoreDependencies,
): ProjectStore {
  const {
    database,
    runDatabaseTransaction,
    getProjectDir,
    createUniqueId,
    slugifyName,
  } = dependencies;

  function countProjects(): number {
    const row = database
      .prepare("SELECT COUNT(*) AS count FROM projects")
      .get() as { count: number };

    return row.count;
  }

  function listProjects(): ProjectRecord[] {
    return database
      .prepare(
        "SELECT id, name, createdAt, updatedAt FROM projects ORDER BY createdAt",
      )
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

  function assertProjectExists(projectId: string): void {
    const row = database
      .prepare("SELECT id FROM projects WHERE id = ?")
      .get(projectId) as { id: string } | undefined;

    if (!row) {
      throw new Error(`Project "${projectId}" does not exist.`);
    }
  }

  function createUniqueProjectId(name: string): string {
    const baseId = slugifyName(name);
    const existingIds = new Set(listProjects().map((project) => project.id));

    return createUniqueId(baseId, existingIds);
  }

  return {
    countProjects,
    listProjects,
    createProject,
    deleteProject,
    assertProjectExists,
    getProjectDir,
  };
}
