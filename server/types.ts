export type ProjectRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredPrimitiveAsset = {
  id: string;
  projectId: string;
  name: string;
  sourceFilename: string;
  sourcePath: string;
  viewBox: [number, number, number, number];
  pathD: string;
  fill: string;
  fillRule: "nonzero" | "evenodd";
  createdAt: string;
  updatedAt: string;
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

export type AssetsResponse = {
  assets: StoredPrimitiveAsset[];
};

export type CreateAssetResponse = {
  asset: StoredPrimitiveAsset;
};
