import type { PrimitiveSvgAsset } from "../../core/assets/primitiveSvg";
import type { PrefabRecord, ProjectRecord, SceneRecord } from "../api";
import { chooseStableSelection } from "../tools/editorUtils";

export type ProjectRefreshResult = {
  nextSelectedProjectId: string | null;
  shouldClearWorkspace: boolean;
};

export type AssetRefreshResult = {
  nextSelectedAssetId: string | null;
  missingPathEditAssetId: string | null;
  missingPathEdit3DAssetId: string | null;
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
