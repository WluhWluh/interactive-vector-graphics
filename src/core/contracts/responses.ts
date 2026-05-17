import type { PrefabDocument } from "../documents/prefabDocument";
import type { SceneDocument } from "../documents/sceneDocument";
import type {
  PrefabRecord,
  ProjectRecord,
  SceneRecord,
  StoredPrimitiveAsset,
} from "./records";
import type {
  ImportPackageResponse,
  ProjectPackageManifest,
} from "./package";

export type CreateProjectRequest = {
  name: string;
};

export type RenameProjectRequest = {
  name: string;
};

export type RenameAssetRequest = {
  name: string;
};

export type CreatePrefabRequest = {
  name: string;
  document: PrefabDocument;
};

export type RenamePrefabRequest = {
  name: string;
};

export type CreateSceneRequest = {
  name: string;
  document: SceneDocument;
};

export type RenameSceneRequest = {
  name: string;
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

export type RenameProjectResponse = {
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

export type CreateViewMorphProfileAssetResponse = {
  asset: StoredPrimitiveAsset;
};

export type UpdateAssetCurve3DResponse = {
  asset: StoredPrimitiveAsset;
};

export type UpdateViewMorphProfileResponse = {
  asset: StoredPrimitiveAsset;
};

export type RenameAssetResponse = {
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

export type RenamePrefabResponse = {
  prefab: PrefabRecord;
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

export type RenameSceneResponse = {
  scene: SceneRecord;
};

export type ExportPackageResponse = {
  package: ProjectPackageManifest;
};

export type ImportPackageRequest = {
  package: ProjectPackageManifest;
};

export type { ImportPackageResponse };
