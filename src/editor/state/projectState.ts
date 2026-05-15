import type { PrimitiveSvgAsset } from "../../core/assets/primitiveAssetTypes";
import type {
  PrefabDocument,
  PrefabNode,
  PrefabRecord,
  ProjectRecord,
  SceneNode,
  SceneRecord,
} from "../api";

export function findRecordById<T extends { id: string }>(
  records: T[],
  id: string | null,
): T | null {
  return id ? (records.find((record) => record.id === id) ?? null) : null;
}

export function getSelectedProject(
  projects: ProjectRecord[],
  selectedProjectId: string | null,
): ProjectRecord | null {
  return findRecordById(projects, selectedProjectId);
}

export function getSelectedAsset(
  assets: PrimitiveSvgAsset[],
  selectedAssetId: string | null,
): PrimitiveSvgAsset | null {
  return findRecordById(assets, selectedAssetId);
}

export function getSelectedPrefab(
  prefabs: PrefabRecord[],
  selectedPrefabId: string | null,
): PrefabRecord | null {
  return findRecordById(prefabs, selectedPrefabId);
}

export function getSelectedScene(
  scenes: SceneRecord[],
  selectedSceneId: string | null,
): SceneRecord | null {
  return findRecordById(scenes, selectedSceneId);
}

export function getPrefabDocumentById(
  prefabDocuments: Map<string, PrefabDocument>,
  prefabId: string,
  loadedPrefabId: string | null,
  currentDocument: PrefabDocument,
): PrefabDocument | null {
  if (prefabId === loadedPrefabId) {
    return currentDocument;
  }

  return prefabDocuments.get(prefabId) ?? null;
}

export function getNodeById<T extends PrefabNode | SceneNode>(
  nodes: T[],
  nodeId: string,
): T | null {
  return nodes.find((node) => node.id === nodeId) ?? null;
}
