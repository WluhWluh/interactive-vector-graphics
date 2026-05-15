import type { PrimitiveSvgAsset } from "../../core/assets/primitiveSvg";
import type {
  PrefabNode,
  PrefabRecord,
  ProjectRecord,
  SceneNode,
  SceneRecord,
} from "../api";
import type { EditorTransformNode } from "../threeEditorViewport";
import type { TransformSnapshot } from "../tools/prefabTransform";

export type InspectorHeaderModel =
  | {
      hasProject: false;
    }
  | {
      hasProject: true;
      project: ProjectRecord;
      camera: {
        projection: string;
        position: [number, number, number];
        target: [number, number, number];
      };
    };

export type AssetModeInspectorModel = {
  selectedPrefab: PrefabRecord | null;
  loadedPrefabId: string | null;
  selectedNode: PrefabNode | null;
  selectedNodeIsRoot: boolean;
  inspectedAsset: PrimitiveSvgAsset | null;
  editableTransform: EditorTransformNode | null;
};

export type SceneModeInspectorModel = {
  selectedScene: SceneRecord | null;
  loadedSceneId: string | null;
  selectedNode: SceneNode | null;
  inspectedAsset: PrimitiveSvgAsset | null;
  prefabName: string | null;
  prefabExists: boolean;
};

export function createInspectorHeaderModel(input: {
  selectedProject: ProjectRecord | null;
  camera: {
    projection: string;
    position: [number, number, number];
    target: [number, number, number];
  };
}): InspectorHeaderModel {
  return input.selectedProject
    ? {
        hasProject: true,
        project: input.selectedProject,
        camera: input.camera,
      }
    : { hasProject: false };
}

export function createAssetModeInspectorModel(input: {
  selectedPrefab: PrefabRecord | null;
  loadedPrefabId: string | null;
  selectedNodeId: string | null;
  rootNodeId: string;
  getPrefabNode: (nodeId: string) => PrefabNode | null;
  selectedAsset: PrimitiveSvgAsset | null;
  getAssetById: (assetId: string) => PrimitiveSvgAsset | null;
  stagingTransform: TransformSnapshot | null;
}): AssetModeInspectorModel {
  const selectedNode =
    input.selectedNodeId && input.selectedNodeId !== input.rootNodeId
      ? input.getPrefabNode(input.selectedNodeId)
      : null;
  const inspectedAsset =
    selectedNode?.kind === "primitive" && selectedNode.assetId
      ? input.getAssetById(selectedNode.assetId)
      : input.selectedAsset;

  return {
    selectedPrefab: input.selectedPrefab,
    loadedPrefabId: input.loadedPrefabId,
    selectedNode,
    selectedNodeIsRoot: input.selectedNodeId === input.rootNodeId,
    inspectedAsset,
    editableTransform: selectedNode
      ? createEditableTransform(selectedNode, input.stagingTransform)
      : null,
  };
}

export function createSceneModeInspectorModel(input: {
  selectedScene: SceneRecord | null;
  loadedSceneId: string | null;
  selectedNodeId: string | null;
  getSceneNode: (nodeId: string) => SceneNode | null;
  getAssetById: (assetId: string) => PrimitiveSvgAsset | null;
  getPrefabNameById: (prefabId: string) => string | null;
  hasPrefabDocument: (prefabId: string) => boolean;
}): SceneModeInspectorModel {
  const selectedNode = input.selectedNodeId
    ? input.getSceneNode(input.selectedNodeId)
    : null;
  const inspectedAsset =
    selectedNode?.kind === "primitive"
      ? input.getAssetById(selectedNode.assetId)
      : null;

  return {
    selectedScene: input.selectedScene,
    loadedSceneId: input.loadedSceneId,
    selectedNode,
    inspectedAsset,
    prefabName:
      selectedNode?.kind === "prefabInstance"
        ? input.getPrefabNameById(selectedNode.prefabId)
        : null,
    prefabExists:
      selectedNode?.kind === "prefabInstance"
        ? input.hasPrefabDocument(selectedNode.prefabId)
        : true,
  };
}

function createEditableTransform(
  node: PrefabNode,
  stagingTransform: TransformSnapshot | null,
): EditorTransformNode {
  return {
    id: node.id,
    position: stagingTransform?.position ?? [...node.position],
    rotation: stagingTransform?.rotation ?? [...node.rotation],
    scale: stagingTransform?.scale ?? [...node.scale],
  };
}
