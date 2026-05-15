import { clonePrefabNode, type PrefabNode } from "../../core/documents/prefabDocument";
import type { SceneNode } from "../api";

export type PrefabNodeTreeEntry = {
  node: PrefabNode;
  depth: number;
};

export function getPrefabNodeTreeEntries(
  nodes: PrefabNode[],
): PrefabNodeTreeEntry[] {
  const entries: PrefabNodeTreeEntry[] = [];
  const childrenByParent = new Map<string | null, PrefabNode[]>();

  for (const node of nodes) {
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }

  function appendChildren(parentId: string | null, depth: number): void {
    for (const node of childrenByParent.get(parentId) ?? []) {
      entries.push({ node, depth });
      appendChildren(node.id, depth + 1);
    }
  }

  appendChildren(null, 0);
  return entries;
}

export function getPrefabNodeAndDescendantIds(
  nodes: PrefabNode[],
  rootNodeId: string,
): Set<string> {
  const ids = new Set<string>([rootNodeId]);
  let changed = true;

  while (changed) {
    changed = false;

    for (const node of nodes) {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        changed = true;
      }
    }
  }

  return ids;
}

export { clonePrefabNode };

export function cloneSceneNode(node: SceneNode): SceneNode {
  if (node.kind === "primitive") {
    return {
      id: node.id,
      kind: "primitive",
      assetId: node.assetId,
      position: [...node.position],
      rotation: [...node.rotation],
      scale: [...node.scale],
      billboardMode: node.billboardMode,
    };
  }

  return {
    id: node.id,
    kind: "prefabInstance",
    prefabId: node.prefabId,
    position: [...node.position],
    rotation: [...node.rotation],
    scale: [...node.scale],
  };
}
