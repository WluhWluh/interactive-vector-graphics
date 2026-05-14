import type { StructuredBezierPath } from "../src/core/assets/structuredBezierPath";
import type { StructuredBezierPath3D } from "../src/core/assets/structuredBezierPath3d";

export type ProjectRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredPrimitiveAsset = {
  id: string;
  projectId: string;
  assetKind: "filledPath" | "strokePath" | "bezierCurve3d";
  name: string;
  sourceFilename: string;
  sourcePath: string;
  viewBox: [number, number, number, number];
  pathD: string;
  fill: string;
  fillRule: "nonzero" | "evenodd";
  stroke: string | null;
  strokeWidth: number | null;
  bezierPath: StructuredBezierPath;
  bezierPath3d: StructuredBezierPath3D | null;
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
export type PrefabTrackEasing = "linear" | "step" | "easeInOut";
export type PrefabVectorTrackProperty = "position" | "rotation" | "scale";
export type PrefabPathTrackProperty = "path";
export type PrefabTrackProperty = PrefabVectorTrackProperty | PrefabPathTrackProperty;
export type PrefabVectorKeyframe = {
  id: string;
  timeMs: number;
  value: Vector3Tuple;
  easing: PrefabTrackEasing;
};
export type PrefabPathKeyframe = {
  id: string;
  timeMs: number;
  value: StructuredBezierPath;
  easing: PrefabTrackEasing;
};
export type PrefabAnimationTrack =
  | {
      id: string;
      target: {
        nodeId: string;
        property: PrefabVectorTrackProperty;
      };
      keyframes: PrefabVectorKeyframe[];
    }
  | {
      id: string;
      target: {
        nodeId: string;
        property: PrefabPathTrackProperty;
      };
      keyframes: PrefabPathKeyframe[];
    };

export type PrefabDocument = {
  version: 4;
  nodes: Array<{
    id: string;
    kind: "group" | "primitive";
    parentId: string | null;
    assetId?: string;
    name: string;
    position: Vector3Tuple;
    rotation: Vector3Tuple;
    scale: Vector3Tuple;
    billboardMode: "spherical";
  }>;
  animation: {
    snapFps: number;
    activeClipId: string | null;
    clips: Array<{
      id: string;
      name: string;
      durationMs: number;
      loop: boolean;
      tracks: PrefabAnimationTrack[];
    }>;
  };
};

export type PrefabRecord = {
  id: string;
  projectId: string;
  name: string;
  dataPath: string;
  createdAt: string;
  updatedAt: string;
};

export type ScenePrimitiveNode = {
  id: string;
  kind: "primitive";
  assetId: string;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
  billboardMode: "spherical";
};

export type ScenePrefabInstanceNode = {
  id: string;
  kind: "prefabInstance";
  prefabId: string;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
};

export type SceneNode = ScenePrimitiveNode | ScenePrefabInstanceNode;

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
  nodes: SceneNode[];
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

export type UpdateAssetPathResponse = {
  asset: StoredPrimitiveAsset;
};

export type ConvertAssetTo3DCurveResponse = {
  asset: StoredPrimitiveAsset;
};

export type UpdateAssetCurve3DResponse = {
  asset: StoredPrimitiveAsset;
};

export type PrefabsResponse = {
  prefabs: PrefabRecord[];
};

export type CreatePrefabResponse = {
  prefab: PrefabRecord;
  document: PrefabDocument;
};

export type PrefabDetailResponse = {
  prefab: PrefabRecord;
  document: PrefabDocument;
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
