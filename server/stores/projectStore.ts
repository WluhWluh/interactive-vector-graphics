import type { DatabaseSync } from "node:sqlite";
import { mkdir, rm } from "node:fs/promises";
import type { ProjectRecord } from "../types";
import type { ProjectId } from "../../src/core/contracts/ids";

export type ProjectStore = {
  countProjects: () => number;
  listProjects: () => ProjectRecord[];
  createProject: (name: string) => Promise<ProjectRecord>;
  renameProject: (projectId: string, name: string) => ProjectRecord;
  deleteProject: (projectId: string) => Promise<void>;
  assertProjectExists: (projectId: string) => void;
  getProjectDir: (projectId: string) => string;
};

export type ProjectStoreDependencies = {
  database: DatabaseSync;
  runDatabaseTransaction: <T>(operation: () => T) => T;
  getProjectDir: (projectId: string) => string;
  createProjectId: () => ProjectId;
};

export function createProjectStore(
  dependencies: ProjectStoreDependencies,
): ProjectStore {
  const {
    database,
    runDatabaseTransaction,
    getProjectDir,
    createProjectId,
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

    const projectId = createProjectId();
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

  function renameProject(projectId: string, name: string): ProjectRecord {
    const trimmedName = name.trim();

    if (!trimmedName) {
      throw new Error("Project name is required.");
    }

    const existingProject = getProjectRecord(projectId);
    const timestamp = new Date().toISOString();
    const renamedProject: ProjectRecord = {
      ...existingProject,
      name: trimmedName,
      updatedAt: timestamp,
    };

    runDatabaseTransaction(() => {
      database
        .prepare("UPDATE projects SET name = ?, updatedAt = ? WHERE id = ?")
        .run(renamedProject.name, renamedProject.updatedAt, projectId);
    });

    return renamedProject;
  }

  async function deleteProject(projectId: string): Promise<void> {
    /**
     * Project ids are opaque, but API route parameters are still untrusted.
     * Confirming the record before deriving a filesystem path prevents
     * arbitrary path removal through crafted ids.
     */
    assertProjectExists(projectId);
    runDatabaseTransaction(() => {
      database.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
    });
    await rm(getProjectDir(projectId), { recursive: true, force: true });
  }

  function assertProjectExists(projectId: string): void {
    getProjectRecord(projectId);
  }

  function getProjectRecord(projectId: string): ProjectRecord {
    const row = database
      .prepare("SELECT id, name, createdAt, updatedAt FROM projects WHERE id = ?")
      .get(projectId) as ProjectRecord | undefined;

    if (!row) {
      throw new Error(`Project "${projectId}" does not exist.`);
    }

    return row;
  }

  return {
    countProjects,
    listProjects,
    createProject,
    renameProject,
    deleteProject,
    assertProjectExists,
    getProjectDir,
  };
}
