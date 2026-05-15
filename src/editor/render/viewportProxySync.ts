import type { PrimitiveSvgAsset } from "../../core/assets/primitiveSvg";
import type { PrefabAnimationClip, PrefabNode, SceneNode } from "../api";
import type { EditorTransformNode } from "../threeEditorViewport";
import type { TimelineStagingPose } from "../timeline/stagingPose";
import {
  applyWorldTransformToPrefabNode,
  getPrefabWorldTransforms,
  getLocalTransformFromPrefabWorldTransform,
  matrixToTransform,
  transformToMatrix,
} from "../tools/prefabTransform";
import type { TransformSnapshot } from "../tools/prefabTransform";

export type ViewportProxyNode = {
  node: EditorTransformNode;
  asset: PrimitiveSvgAsset | null;
};

export type AssetViewportProxyInput = {
  nodes: PrefabNode[];
  selectedNodeId: string | null;
  rootNodeId: string;
  activeClip: PrefabAnimationClip | null;
  getAssetById: (assetId: string) => PrimitiveSvgAsset | null;
  getTimelineStagingPose: (
    nodeId: string,
    activeClip: PrefabAnimationClip | null,
  ) => TimelineStagingPose | null;
  getOrCreateTimelineStagingPose: (
    node: PrefabNode,
    activeClip: PrefabAnimationClip,
    asset?: PrimitiveSvgAsset | null,
  ) => TimelineStagingPose;
  getTimelineStagingWorldTransform: (
    stagingPose: TimelineStagingPose,
  ) => TransformSnapshot;
};

export function createAssetViewportProxyNodes(
  input: AssetViewportProxyInput,
): ViewportProxyNode[] {
  const worldTransforms = getPrefabWorldTransforms(input.nodes);
  const proxyNodes: ViewportProxyNode[] = [];

  for (const node of input.nodes) {
    const selectedForTimeline =
      input.selectedNodeId !== input.rootNodeId && node.id === input.selectedNodeId;
    const asset =
      node.kind === "primitive" && node.assetId
        ? input.getAssetById(node.assetId)
        : null;
    const stagingPose =
      input.getTimelineStagingPose(node.id, input.activeClip) ??
      (input.activeClip && selectedForTimeline
        ? input.getOrCreateTimelineStagingPose(node, input.activeClip, asset)
        : null);
    const worldTransform = stagingPose
      ? input.getTimelineStagingWorldTransform(stagingPose)
      : matrixToTransform(worldTransforms.get(node.id) ?? transformToMatrix(node));

    proxyNodes.push({
      node: {
        id: node.id,
        ...worldTransform,
      },
      asset,
    });
  }

  return proxyNodes;
}

export function createSceneViewportProxyNodes(
  nodes: SceneNode[],
  getAssetById: (assetId: string) => PrimitiveSvgAsset | null,
): ViewportProxyNode[] {
  return nodes.map((node) => ({
    node,
    asset: node.kind === "primitive" ? getAssetById(node.assetId) : null,
  }));
}

export function createPrefabWorldProxyNodes(
  nodes: PrefabNode[],
  exceptNodeId: string | null = null,
): EditorTransformNode[] {
  const worldTransforms = getPrefabWorldTransforms(nodes);
  const proxyNodes: EditorTransformNode[] = [];

  for (const node of nodes) {
    if (node.id === exceptNodeId) {
      continue;
    }

    const worldTransform = worldTransforms.get(node.id);

    if (!worldTransform) {
      continue;
    }

    proxyNodes.push({
      id: node.id,
      ...matrixToTransform(worldTransform),
    });
  }

  return proxyNodes;
}

export function applyViewportTransformToStagingPose(input: {
  nodes: PrefabNode[];
  node: PrefabNode;
  worldNode: EditorTransformNode;
  stagingPose: TimelineStagingPose;
}): void {
  const localTransform = getLocalTransformFromPrefabWorldTransform(
    input.nodes,
    input.node,
    input.worldNode,
  );
  input.stagingPose.position = [...localTransform.position];
  input.stagingPose.rotation = [...localTransform.rotation];
  input.stagingPose.scale = [...localTransform.scale];
}

export function applyViewportTransformToPrefabNode(input: {
  nodes: PrefabNode[];
  node: PrefabNode;
  worldNode: EditorTransformNode;
}): void {
  applyWorldTransformToPrefabNode(input.nodes, input.node, input.worldNode);
}
