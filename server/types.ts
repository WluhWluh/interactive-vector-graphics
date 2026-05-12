export type ProjectRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectIndexFile = {
  version: 1;
  projects: ProjectRecord[];
};

export type HealthResponse = {
  ok: true;
  dataDir: string;
  projectCount: number;
};

export type ProjectsResponse = {
  projects: ProjectRecord[];
};

export type CreateProjectResponse = {
  project: ProjectRecord;
};
