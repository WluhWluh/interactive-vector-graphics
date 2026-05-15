import {
  createEmptyPrefabAnimation,
  createPrefabDocument,
  clonePrefabAnimation,
  clonePrefabNode,
  type PrefabAnimation,
  type PrefabDocument,
  type PrefabNode,
} from "../../core/documents/prefabDocument";
import { getNextNodeNumber } from "../tools/editorUtils";

export type PrefabSelectionId = string;

export type AppliedPrefabDocumentState = {
  nodes: PrefabNode[];
  animation: PrefabAnimation;
  selectedNodeId: string;
  nextNodeNumber: number;
};

export { createEmptyPrefabAnimation, createPrefabDocument };

export function applyPrefabDocumentState(
  document: PrefabDocument,
  rootNodeId: string,
): AppliedPrefabDocumentState {
  const nodes = document.nodes.map(clonePrefabNode);

  return {
    nodes,
    animation: clonePrefabAnimation(document.animation),
    selectedNodeId: nodes[0]?.id ?? rootNodeId,
    nextNodeNumber: getNextNodeNumber(
      nodes.map((node) => node.id),
      "prefab-node",
    ),
  };
}
