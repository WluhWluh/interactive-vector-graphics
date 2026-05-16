import type { PrimitiveSvgAsset } from "../../core/assets/primitiveAssetTypes";
import type {
  PrefabDocument,
  PrefabRecord,
  ProjectRecord,
  SceneRecord,
} from "../api";
import { chooseStableSelection } from "../tools/editorUtils";

export type ProjectRefreshResult = {
  nextSelectedProjectId: string | null;
  shouldClearWorkspace: boolean;
};

export type AssetRefreshResult = {
  nextSelectedAssetId: string | null;
  missingPathEditAssetId: string | null;
  missingPathEdit3DAssetId: string | null;
  missingViewMorphProfileEditAssetId: string | null;
};

export type PrefabRefreshResult = {
  nextSelectedPrefabId: string | null;
  missingLoadedPrefabId: string | null;
};

export type SceneRefreshResult = {
  nextSelectedSceneId: string | null;
  missingLoadedSceneId: string | null;
};

export function reconcileProjectSelection(
  selectedProjectId: string | null,
  projects: ProjectRecord[],
): ProjectRefreshResult {
  const nextSelectedProjectId = chooseStableSelection(
    selectedProjectId,
    projects.map((project) => project.id),
  );

  return {
    nextSelectedProjectId,
    shouldClearWorkspace: selectedProjectId !== nextSelectedProjectId,
  };
}

export function reconcileAssetSelection(
  selectedAssetId: string | null,
  assets: PrimitiveSvgAsset[],
  pathEditAssetId: string | null,
  pathEdit3DAssetId: string | null,
  viewMorphProfileEditAssetId: string | null,
): AssetRefreshResult {
  const nextSelectedAssetId = chooseStableSelection(
    selectedAssetId,
    assets.map((asset) => asset.id),
  );
  const assetIds = new Set(assets.map((asset) => asset.id));

  return {
    nextSelectedAssetId,
    missingPathEditAssetId:
      pathEditAssetId && !assetIds.has(pathEditAssetId) ? pathEditAssetId : null,
    missingPathEdit3DAssetId:
      pathEdit3DAssetId && !assetIds.has(pathEdit3DAssetId)
        ? pathEdit3DAssetId
        : null,
    missingViewMorphProfileEditAssetId:
      viewMorphProfileEditAssetId && !assetIds.has(viewMorphProfileEditAssetId)
        ? viewMorphProfileEditAssetId
        : null,
  };
}

export function reconcilePrefabSelection(
  selectedPrefabId: string | null,
  loadedPrefabId: string | null,
  prefabs: PrefabRecord[],
): PrefabRefreshResult {
  const nextSelectedPrefabId = chooseStableSelection(
    selectedPrefabId,
    prefabs.map((prefab) => prefab.id),
  );
  const prefabIds = new Set(prefabs.map((prefab) => prefab.id));

  return {
    nextSelectedPrefabId,
    missingLoadedPrefabId:
      loadedPrefabId && !prefabIds.has(loadedPrefabId) ? loadedPrefabId : null,
  };
}

export function reconcileSceneSelection(
  selectedSceneId: string | null,
  loadedSceneId: string | null,
  scenes: SceneRecord[],
): SceneRefreshResult {
  const nextSelectedSceneId = chooseStableSelection(
    selectedSceneId,
    scenes.map((scene) => scene.id),
  );
  const sceneIds = new Set(scenes.map((scene) => scene.id));

  return {
    nextSelectedSceneId,
    missingLoadedSceneId:
      loadedSceneId && !sceneIds.has(loadedSceneId) ? loadedSceneId : null,
  };
}

export function replaceAssetById(
  assets: PrimitiveSvgAsset[],
  updatedAsset: PrimitiveSvgAsset,
): PrimitiveSvgAsset[] {
  return assets.map((asset) =>
    asset.id === updatedAsset.id ? updatedAsset : asset,
  );
}

export function appendAsset(
  assets: PrimitiveSvgAsset[],
  asset: PrimitiveSvgAsset,
): PrimitiveSvgAsset[] {
  return [...assets, asset];
}

export async function loadPrefabDocuments(input: {
  projectId: string;
  prefabs: PrefabRecord[];
  getPrefab: (
    projectId: string,
    prefabId: string,
  ) => Promise<{ prefab: PrefabRecord; document: PrefabDocument }>;
  onError?: (error: unknown) => void;
}): Promise<Map<string, PrefabDocument>> {
  const documents = new Map<string, PrefabDocument>();

  await Promise.all(
    input.prefabs.map(async (prefab) => {
      try {
        const detail = await input.getPrefab(input.projectId, prefab.id);
        documents.set(prefab.id, detail.document);
      } catch (error) {
        input.onError?.(error);
      }
    }),
  );

  return documents;
}

export type ProjectWorkspaceState = {
  assets: PrimitiveSvgAsset[];
  prefabs: PrefabRecord[];
  prefabDocuments: Map<string, PrefabDocument>;
  scenes: SceneRecord[];
  selectedAssetId: string | null;
  selectedPrefabId: string | null;
  loadedPrefabId: string | null;
  selectedSceneId: string | null;
  loadedSceneId: string | null;
  selectedSceneNodeId: string | null;
};

export function createEmptyProjectWorkspaceState(): ProjectWorkspaceState {
  return {
    assets: [],
    prefabs: [],
    prefabDocuments: new Map(),
    scenes: [],
    selectedAssetId: null,
    selectedPrefabId: null,
    loadedPrefabId: null,
    selectedSceneId: null,
    loadedSceneId: null,
    selectedSceneNodeId: null,
  };
}
