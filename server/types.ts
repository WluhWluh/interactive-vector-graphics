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
export type SceneTrackEasing = "linear" | "step" | "easeInOut";
export type SceneTrackTargetKind = "node" | "camera";
export type SceneTrackProperty =
  | "position"
  | "rotation"
  | "scale"
  | "target"
  | "fov"
  | "zoom";
export type SceneKeyframeValue = number | Vector3Tuple;

export type SceneDocument = {
  version: 2;
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
    activeClipId: string | null;
    clips: Array<{
      id: string;
      name: string;
      duration: number;
      tracks: Array<{
        id: string;
        target: {
          kind: SceneTrackTargetKind;
          nodeId?: string;
          property: SceneTrackProperty;
        };
        keyframes: Array<{
          time: number;
          value: SceneKeyframeValue;
          easing: SceneTrackEasing;
        }>;
      }>;
    }>;
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
