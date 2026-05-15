import type {
  PrefabDocument,
  SceneDocument,
  SceneNode,
  ScenePrefabInstanceNode,
  SceneRecord,
} from "../api";

export type SceneDocumentState = {
  selectedSceneId: string | null;
  loadedSceneId: string | null;
};

export type SceneDocumentDetail = {
  scene: SceneRecord;
  document: SceneDocument;
};

export type ScenePrefabDocumentCache = {
  prefabDocuments: Map<string, PrefabDocument>;
};

export function applyLoadedSceneDocument(
  detail: SceneDocumentDetail,
): SceneDocumentState {
  return {
    selectedSceneId: detail.scene.id,
    loadedSceneId: detail.scene.id,
  };
}

export function applySavedSceneDocument(
  detail: SceneDocumentDetail,
): SceneDocumentState {
  return applyLoadedSceneDocument(detail);
}

export function applyDeletedSceneDocument(
  state: SceneDocumentState,
  deletedSceneId: string,
): SceneDocumentState & { deletedLoadedScene: boolean } {
  const deletedLoadedScene = state.loadedSceneId === deletedSceneId;

  return {
    selectedSceneId:
      state.selectedSceneId === deletedSceneId ? null : state.selectedSceneId,
    loadedSceneId: deletedLoadedScene ? null : state.loadedSceneId,
    deletedLoadedScene,
  };
}

export function cachePrefabDocumentForScene(
  state: ScenePrefabDocumentCache,
  prefabId: string,
  document: PrefabDocument,
): ScenePrefabDocumentCache {
  const prefabDocuments = new Map(state.prefabDocuments);
  prefabDocuments.set(prefabId, document);

  return { prefabDocuments };
}

export function addPrefabInstanceToScene(input: {
  nodes: SceneNode[];
  prefabId: string;
  nodeNumber: number;
}): {
  nodes: SceneNode[];
  selectedSceneNodeId: string;
  nextSceneNodeNumber: number;
} {
  const node: ScenePrefabInstanceNode = {
    id: `node-${input.nodeNumber}`,
    kind: "prefabInstance",
    prefabId: input.prefabId,
    position: [0, 1, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };

  return {
    nodes: [...input.nodes, node],
    selectedSceneNodeId: node.id,
    nextSceneNodeNumber: input.nodeNumber + 1,
  };
}

export function deleteSceneNodeById(
  nodes: SceneNode[],
  nodeId: string,
): { nodes: SceneNode[]; selectedSceneNodeId: string | null } {
  return {
    nodes: nodes.filter((node) => node.id !== nodeId),
    selectedSceneNodeId: null,
  };
}
