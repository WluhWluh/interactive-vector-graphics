import type { PrefabAnimation, PrefabDocument, PrefabNode } from "../api";
import { clonePrefabAnimation } from "../timeline/prefabTimelineCore";
import { getNextNodeNumber } from "../tools/editorUtils";
import { clonePrefabNode } from "./documentNodes";

export type AppliedPrefabDocumentState = {
  nodes: PrefabNode[];
  animation: PrefabAnimation;
  selectedNodeId: string;
  nextNodeNumber: number;
};

export function createEmptyPrefabAnimation(snapFps: number): PrefabAnimation {
  return {
    snapFps,
    activeClipId: null,
    clips: [],
  };
}

export function createPrefabDocument(
  nodes: PrefabNode[],
  animation: PrefabAnimation,
): PrefabDocument {
  return {
    version: 4,
    nodes: nodes.map(clonePrefabNode),
    animation: clonePrefabAnimation(animation),
  };
}

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
