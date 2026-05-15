import type { PrimitiveSvgAsset } from "../../core/assets/primitiveSvg";
import type {
  PrefabDocument,
  PrefabRecord,
  ProjectRecord,
  SceneRecord,
} from "../api";
import {
  loadPrefabDocuments,
  reconcileAssetSelection,
  reconcilePrefabSelection,
  reconcileProjectSelection,
  reconcileSceneSelection,
} from "../controllers/projectDataController";

export type ProjectRecordsWorkflowResult = {
  projects: ProjectRecord[];
  nextSelectedProjectId: string | null;
  shouldClearWorkspace: boolean;
};

export type AssetRecordsWorkflowResult = {
  assets: PrimitiveSvgAsset[];
  nextSelectedAssetId: string | null;
  missingPathEditAssetId: string | null;
  missingPathEdit3DAssetId: string | null;
};

export type PrefabRecordsWorkflowResult = {
  prefabs: PrefabRecord[];
  prefabDocuments: Map<string, PrefabDocument>;
  nextSelectedPrefabId: string | null;
  missingLoadedPrefabId: string | null;
};

export type SceneRecordsWorkflowResult = {
  scenes: SceneRecord[];
  nextSelectedSceneId: string | null;
  missingLoadedSceneId: string | null;
};

export async function loadProjectRecords(input: {
  selectedProjectId: string | null;
  listProjects: () => Promise<ProjectRecord[]>;
}): Promise<ProjectRecordsWorkflowResult> {
  const projects = await input.listProjects();
  const selection = reconcileProjectSelection(input.selectedProjectId, projects);

  return {
    projects,
    nextSelectedProjectId: selection.nextSelectedProjectId,
    shouldClearWorkspace: selection.shouldClearWorkspace,
  };
}

export async function loadAssetRecords(input: {
  projectId: string;
  selectedAssetId: string | null;
  pathEditAssetId: string | null;
  pathEdit3DAssetId: string | null;
  listAssets: (projectId: string) => Promise<PrimitiveSvgAsset[]>;
}): Promise<AssetRecordsWorkflowResult> {
  const assets = await input.listAssets(input.projectId);
  const selection = reconcileAssetSelection(
    input.selectedAssetId,
    assets,
    input.pathEditAssetId,
    input.pathEdit3DAssetId,
  );

  return {
    assets,
    nextSelectedAssetId: selection.nextSelectedAssetId,
    missingPathEditAssetId: selection.missingPathEditAssetId,
    missingPathEdit3DAssetId: selection.missingPathEdit3DAssetId,
  };
}

export async function loadPrefabRecords(input: {
  projectId: string;
  selectedPrefabId: string | null;
  loadedPrefabId: string | null;
  listPrefabs: (projectId: string) => Promise<PrefabRecord[]>;
  getPrefab: (
    projectId: string,
    prefabId: string,
  ) => Promise<{ prefab: PrefabRecord; document: PrefabDocument }>;
  onDocumentLoadError?: (error: unknown) => void;
}): Promise<PrefabRecordsWorkflowResult> {
  const prefabs = await input.listPrefabs(input.projectId);
  const prefabDocuments = await loadPrefabDocuments({
    projectId: input.projectId,
    prefabs,
    getPrefab: input.getPrefab,
    onError: input.onDocumentLoadError,
  });
  const selection = reconcilePrefabSelection(
    input.selectedPrefabId,
    input.loadedPrefabId,
    prefabs,
  );

  return {
    prefabs,
    prefabDocuments,
    nextSelectedPrefabId: selection.nextSelectedPrefabId,
    missingLoadedPrefabId: selection.missingLoadedPrefabId,
  };
}

export async function loadSceneRecords(input: {
  projectId: string;
  selectedSceneId: string | null;
  loadedSceneId: string | null;
  listScenes: (projectId: string) => Promise<SceneRecord[]>;
}): Promise<SceneRecordsWorkflowResult> {
  const scenes = await input.listScenes(input.projectId);
  const selection = reconcileSceneSelection(
    input.selectedSceneId,
    input.loadedSceneId,
    scenes,
  );

  return {
    scenes,
    nextSelectedSceneId: selection.nextSelectedSceneId,
    missingLoadedSceneId: selection.missingLoadedSceneId,
  };
}
