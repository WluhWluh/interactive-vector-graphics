import type { PrefabNode, SceneNode } from "../api";

export type PrefabNodeSelectionSync = {
  selectedAssetId: string | null | undefined;
};

export function getPrefabNodeSelectionSync(
  node: PrefabNode | null,
): PrefabNodeSelectionSync {
  return {
    selectedAssetId:
      node?.kind === "primitive" && node.assetId ? node.assetId : undefined,
  };
}

export type SceneNodeSelectionSync = {
  selectedAssetId: string | null | undefined;
  selectedPrefabId: string | null | undefined;
};

export function getSceneNodeSelectionSync(
  node: SceneNode | null,
): SceneNodeSelectionSync {
  if (!node) {
    return {
      selectedAssetId: undefined,
      selectedPrefabId: undefined,
    };
  }

  return node.kind === "primitive"
    ? {
        selectedAssetId: node.assetId,
        selectedPrefabId: undefined,
      }
    : {
        selectedAssetId: undefined,
        selectedPrefabId: node.prefabId,
      };
}

export function shouldClearRootPrefabAssetSelection(
  selectedPrefabNodeId: string | null,
  rootNodeId: string,
): boolean {
  return selectedPrefabNodeId === rootNodeId;
}
