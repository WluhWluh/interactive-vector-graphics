import type {
  PrimitiveAssetKind,
  PrimitiveFillRule,
} from "../assets/primitiveAssetTypes";
import type { StructuredBezierPath } from "../assets/structuredBezierPath";
import type { StructuredBezierPath3D } from "../assets/structuredBezierPath3d";
import type { ViewMorphProfile } from "../assets/viewMorphProfile";
import type {
  PrefabId,
  PrimitiveAssetId,
  ProjectId,
  SceneId,
} from "./ids";

export type ViewportCameraSnapshot = {
  projection: "perspective" | "orthographic";
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  zoom: number;
  near: number;
  far: number;
};

export type ProjectRecord = {
  id: ProjectId;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type PrefabRecord = {
  id: PrefabId;
  projectId: ProjectId;
  name: string;
  dataPath: string;
  createdAt: string;
  updatedAt: string;
};

export type SceneRecord = {
  id: SceneId;
  projectId: ProjectId;
  name: string;
  dataPath: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredPrimitiveAsset = {
  id: PrimitiveAssetId;
  projectId: ProjectId;
  assetKind: PrimitiveAssetKind;
  name: string;
  sourceFilename: string;
  sourcePath: string;
  viewBox: [number, number, number, number];
  pathD: string;
  fill: string;
  fillRule: PrimitiveFillRule;
  stroke: string | null;
  strokeWidth: number | null;
  bezierPath: StructuredBezierPath;
  bezierPath3d: StructuredBezierPath3D | null;
  viewMorphProfile: ViewMorphProfile | null;
  createdAt: string;
  updatedAt: string;
};
