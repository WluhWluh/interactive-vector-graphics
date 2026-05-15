import type { PrimitiveSvgAsset } from "../../core/assets/primitiveSvg";
import type { PrefabDocument, PrefabNode, PrefabRecord } from "../api";
import { clonePrefabNode, getPrefabNodeAndDescendantIds } from "../state/documentNodes";
import type { PrefabSelectionId } from "../state/prefabState";

export type PrefabClipboardMode = "copy" | "cut";

export type PendingPrefabClipboard = {
  mode: PrefabClipboardMode;
  sourceNodeId: string;
};

export type PrefabNodeIdAllocator = () => string;

export type PrefabAssemblyMutation = {
  nodes: PrefabNode[];
  selectedNodeId: PrefabSelectionId;
};

export type PrefabDocumentCacheState = {
  selectedPrefabId: string | null;
  loadedPrefabId: string | null;
  prefabDocuments: Map<string, PrefabDocument>;
};

export type PrefabDocumentDetail = {
  prefab: PrefabRecord;
  document: PrefabDocument;
};

export function applyLoadedPrefabDocument(
  state: PrefabDocumentCacheState,
  detail: PrefabDocumentDetail,
): PrefabDocumentCacheState {
  const prefabDocuments = new Map(state.prefabDocuments);
  prefabDocuments.set(detail.prefab.id, detail.document);

  return {
    selectedPrefabId: detail.prefab.id,
    loadedPrefabId: detail.prefab.id,
    prefabDocuments,
  };
}

export function applySavedPrefabDocument(
  state: PrefabDocumentCacheState,
  detail: PrefabDocumentDetail,
): PrefabDocumentCacheState {
  return applyLoadedPrefabDocument(state, detail);
}

export function applyDeletedPrefabDocument(
  state: PrefabDocumentCacheState,
  deletedPrefabId: string,
): PrefabDocumentCacheState & { deletedLoadedPrefab: boolean } {
  const prefabDocuments = new Map(state.prefabDocuments);
  prefabDocuments.delete(deletedPrefabId);
  const deletedLoadedPrefab = state.loadedPrefabId === deletedPrefabId;

  return {
    selectedPrefabId:
      state.selectedPrefabId === deletedPrefabId ? null : state.selectedPrefabId,
    loadedPrefabId: deletedLoadedPrefab ? null : state.loadedPrefabId,
    prefabDocuments,
    deletedLoadedPrefab,
  };
}

export function getParentIdForNewPrefabNode(
  nodes: PrefabNode[],
  selectedNodeId: PrefabSelectionId | null,
  rootNodeId: string,
): string | null {
  if (selectedNodeId === rootNodeId) {
    return null;
  }

  const selectedNode = selectedNodeId
    ? nodes.find((node) => node.id === selectedNodeId)
    : null;

  return selectedNode?.kind === "group" ? selectedNode.id : null;
}

export function getPasteParentId(
  nodes: PrefabNode[],
  selectedNodeId: PrefabSelectionId | null,
  rootNodeId: string,
): string | null | undefined {
  if (selectedNodeId === rootNodeId) {
    return null;
  }

  const targetNode = selectedNodeId
    ? nodes.find((node) => node.id === selectedNodeId)
    : null;

  if (!targetNode) {
    return undefined;
  }

  return targetNode.kind === "group" ? targetNode.id : targetNode.parentId;
}

export function createPrefabGroupNode(
  nodes: PrefabNode[],
  selectedNodeId: PrefabSelectionId | null,
  rootNodeId: string,
  nodeId: string,
  nodeNumber: number,
): PrefabAssemblyMutation {
  const node: PrefabNode = {
    id: nodeId,
    kind: "group",
    parentId: getParentIdForNewPrefabNode(nodes, selectedNodeId, rootNodeId),
    name: `Group ${nodeNumber}`,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    billboardMode: "spherical",
  };

  return {
    nodes: [...nodes, node],
    selectedNodeId: node.id,
  };
}

export function addPrimitiveAssetToPrefab(
  nodes: PrefabNode[],
  selectedNodeId: PrefabSelectionId | null,
  rootNodeId: string,
  asset: PrimitiveSvgAsset,
  nodeId: string,
): PrefabAssemblyMutation {
  const node: PrefabNode = {
    id: nodeId,
    kind: "primitive",
    parentId: getParentIdForNewPrefabNode(nodes, selectedNodeId, rootNodeId),
    assetId: asset.id,
    name: asset.name,
    position: [0, 1, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    billboardMode: "spherical",
  };

  return {
    nodes: [...nodes, node],
    selectedNodeId: node.id,
  };
}

export function deletePrefabNodeSubtree(
  nodes: PrefabNode[],
  rootNodeId: string,
  nodeId: string,
): PrefabAssemblyMutation & { deletedNodeIds: Set<string> } {
  const deletedNodeIds = getPrefabNodeAndDescendantIds(nodes, nodeId);

  return {
    nodes: nodes.filter((node) => !deletedNodeIds.has(node.id)),
    selectedNodeId: rootNodeId,
    deletedNodeIds,
  };
}

export function startPrefabClipboard(
  mode: PrefabClipboardMode,
  selectedNodeId: PrefabSelectionId | null,
  rootNodeId: string,
): PendingPrefabClipboard | null {
  if (!selectedNodeId || selectedNodeId === rootNodeId) {
    return null;
  }

  return {
    mode,
    sourceNodeId: selectedNodeId,
  };
}

export function clearInvalidPrefabClipboard(
  clipboard: PendingPrefabClipboard | null,
  nodes: PrefabNode[],
): PendingPrefabClipboard | null {
  if (clipboard && !nodes.some((node) => node.id === clipboard.sourceNodeId)) {
    return null;
  }

  return clipboard;
}

export function pastePrefabClipboard(
  nodes: PrefabNode[],
  clipboard: PendingPrefabClipboard,
  selectedNodeId: PrefabSelectionId | null,
  rootNodeId: string,
  allocateNodeId: PrefabNodeIdAllocator,
): PrefabAssemblyMutation | { error: string } {
  const sourceNode = nodes.find((node) => node.id === clipboard.sourceNodeId);

  if (!sourceNode) {
    return { error: "The copied or cut prefab node no longer exists." };
  }

  const targetParentId = getPasteParentId(nodes, selectedNodeId, rootNodeId);

  if (targetParentId === undefined) {
    return { error: "Select an existing paste target." };
  }

  if (
    clipboard.mode === "cut" &&
    targetParentId &&
    getPrefabNodeAndDescendantIds(nodes, sourceNode.id).has(targetParentId)
  ) {
    return { error: "Cannot paste a group or node inside itself." };
  }

  return clipboard.mode === "copy"
    ? copyPrefabSubtree(nodes, sourceNode, targetParentId, allocateNodeId, rootNodeId)
    : cutPrefabSubtree(nodes, sourceNode, targetParentId);
}

export function copyPrefabSubtree(
  nodes: PrefabNode[],
  sourceNode: PrefabNode,
  targetParentId: string | null,
  allocateNodeId: PrefabNodeIdAllocator,
  rootNodeId: string,
): PrefabAssemblyMutation {
  const subtreeIds = getPrefabNodeAndDescendantIds(nodes, sourceNode.id);
  const subtreeNodes = nodes.filter((node) => subtreeIds.has(node.id));
  const idMap = new Map<string, string>();

  for (const node of subtreeNodes) {
    idMap.set(node.id, allocateNodeId());
  }

  const copiedNodes = subtreeNodes.map((node) => {
    const copiedNode = clonePrefabNode(node);
    const nextId = idMap.get(node.id);

    if (!nextId) {
      throw new Error(`Missing copied node id for "${node.id}".`);
    }

    copiedNode.id = nextId;
    copiedNode.parentId =
      node.id === sourceNode.id
        ? targetParentId
        : (idMap.get(node.parentId ?? "") ?? null);

    if (node.id === sourceNode.id) {
      copiedNode.name = `${copiedNode.name} Copy`;
    }

    return copiedNode;
  });

  return {
    nodes: [...nodes, ...copiedNodes],
    selectedNodeId: idMap.get(sourceNode.id) ?? rootNodeId,
  };
}

export function cutPrefabSubtree(
  nodes: PrefabNode[],
  sourceNode: PrefabNode,
  targetParentId: string | null,
): PrefabAssemblyMutation {
  return {
    nodes: nodes.map((node) =>
      node.id === sourceNode.id
        ? {
            ...node,
            parentId: targetParentId,
          }
        : node,
    ),
    selectedNodeId: sourceNode.id,
  };
}
