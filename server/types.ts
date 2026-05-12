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

export type Vector3Tuple = [number, number, number];

export type SceneDocument = {
  version: 1;
  camera: {
    projection: "perspective" | "orthographic";
    position: Vector3Tuple;
    target: Vector3Tuple;
    fov: number;
    zoom: number;
    near: number;
    far: number;
  };
  nodes: Array<{
    id: string;
    assetId: string;
    position: Vector3Tuple;
    rotation: Vector3Tuple;
    scale: Vector3Tuple;
    billboardMode: "spherical";
  }>;
  animation: {
    fps: 24;
    duration: 0;
    tracks: [];
  };
};

export type SceneRecord = {
  id: string;
  projectId: string;
  name: string;
  dataPath: string;
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

export type ScenesResponse = {
  scenes: SceneRecord[];
};

export type CreateSceneResponse = {
  scene: SceneRecord;
  document: SceneDocument;
};

export type SceneDetailResponse = {
  scene: SceneRecord;
  document: SceneDocument;
};
