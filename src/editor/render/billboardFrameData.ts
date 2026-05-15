import { Matrix4 } from "three";
import type { PrimitiveSvgAsset } from "../../core/assets/primitiveAssetTypes";
import type { StructuredBezierPath } from "../../core/assets/structuredBezierPath";
import type { PrefabAnimationClip, PrefabDocument, PrefabNode } from "../api";
import type { SceneNode } from "../api";
import type { RenderDirtyFlags } from "./renderInvalidation";
import type { DrawableBillboard } from "./billboardRenderer";
import type { TimelineStagingPose } from "../timeline/stagingPose";
import {
  cloneTransform,
  getPrefabWorldTransforms,
  matrixToTransform,
  transformToMatrix,
} from "../tools/prefabTransform";
import { getPrefabNodeAndDescendantIds } from "../state/documentNodes";
import { getPrefabNodesWithStagingPose } from "../pose/prefabPose";

export type BillboardFrameDataContext = {
  getAssetById: (assetId: string) => PrimitiveSvgAsset | null;
  getPrefabDocumentById: (prefabId: string) => PrefabDocument | null;
  getOrCreateTimelineStagingPose: (
    node: PrefabNode,
    clip: PrefabAnimationClip,
    asset?: PrimitiveSvgAsset | null,
  ) => TimelineStagingPose;
};

export type AssetAssemblyBillboardInput = {
  nodes: PrefabNode[];
  evaluatedNodes: PrefabNode[];
  selectedNodeId: string | null;
  activeClip: PrefabAnimationClip | null;
  selectedNode: PrefabNode | null;
  pathOverrides: Map<string, StructuredBezierPath>;
};

export type SceneLayoutBillboardInput = {
  nodes: SceneNode[];
  selectedNodeId: string | null;
};

export class BillboardFrameDataCache {
  private assetAssemblyBillboards: DrawableBillboard[] = [];
  private sceneLayoutBillboards: DrawableBillboard[] = [];

  constructor(private readonly context: BillboardFrameDataContext) {}

  getAssetAssemblyBillboards(
    input: AssetAssemblyBillboardInput,
    dirtyFlags: RenderDirtyFlags,
  ): DrawableBillboard[] {
    if (dirtyFlags.assetBillboards) {
      this.assetAssemblyBillboards = getAssetAssemblyBillboards(
        input,
        this.context,
      );
    }

    return this.assetAssemblyBillboards;
  }

  getSceneLayoutBillboards(
    input: SceneLayoutBillboardInput,
    dirtyFlags: RenderDirtyFlags,
  ): DrawableBillboard[] {
    if (dirtyFlags.sceneBillboards) {
      this.sceneLayoutBillboards = getSceneLayoutBillboards(input, this.context);
    }

    return this.sceneLayoutBillboards;
  }

  getAssetAssemblyBillboardCount(): number {
    return this.assetAssemblyBillboards.length;
  }

  getSceneLayoutBillboardCount(): number {
    return this.sceneLayoutBillboards.length;
  }
}

export function getAssetAssemblyBillboards(
  input: AssetAssemblyBillboardInput,
  context: BillboardFrameDataContext,
): DrawableBillboard[] {
  const evaluatedDrawables = flattenPrefabBillboards(
    {
      nodes: input.evaluatedNodes,
      baseMatrix: new Matrix4(),
      isSelected: (nodeId) => nodeId === input.selectedNodeId,
      pathOverrides: input.pathOverrides,
    },
    context,
  );
  const ghostDrawables = getSelectedPrefabTimelineGhostBillboards(input, context);

  return [
    ...evaluatedDrawables,
    ...ghostDrawables,
  ];
}

function getSelectedPrefabTimelineGhostBillboards(
  input: AssetAssemblyBillboardInput,
  context: BillboardFrameDataContext,
): DrawableBillboard[] {
  if (!input.activeClip || !input.selectedNode) {
    return [];
  }

  const selectedAsset =
    input.selectedNode.kind === "primitive" && input.selectedNode.assetId
      ? context.getAssetById(input.selectedNode.assetId)
      : null;
  const stagingPose = context.getOrCreateTimelineStagingPose(
    input.selectedNode,
    input.activeClip,
    selectedAsset,
  );
  const stagedNodes = getPrefabNodesWithStagingPose({
    nodes: input.nodes,
    stagingPose,
  });
  const stagedWorldTransforms = getPrefabWorldTransforms(stagedNodes);
  const selectedNodeIds =
    input.selectedNode.kind === "group"
      ? getPrefabNodeAndDescendantIds(stagedNodes, input.selectedNode.id)
      : new Set([input.selectedNode.id]);
  const drawables: DrawableBillboard[] = [];

  for (const node of stagedNodes) {
    if (node.kind !== "primitive" || !selectedNodeIds.has(node.id) || !node.assetId) {
      continue;
    }

    const asset = context.getAssetById(node.assetId);
    const worldTransform = stagedWorldTransforms.get(node.id);

    if (!asset || !worldTransform) {
      continue;
    }

    drawables.push({
      id: `${node.id}:timeline-staging-ghost`,
      asset,
      transform: matrixToTransform(worldTransform),
      selected: false,
      opacity: 0.5,
      ghost: true,
      pathOverride: node.id === stagingPose.nodeId ? stagingPose.pathDraft : undefined,
    });
  }

  return drawables;
}

export function getSceneLayoutBillboards(
  input: SceneLayoutBillboardInput,
  context: BillboardFrameDataContext,
): DrawableBillboard[] {
  const drawables: DrawableBillboard[] = [];

  for (const node of input.nodes) {
    if (node.kind === "primitive") {
      const asset = context.getAssetById(node.assetId);

      if (asset) {
        drawables.push({
          id: node.id,
          asset,
          transform: cloneTransform(node),
          selected: node.id === input.selectedNodeId,
        });
      }

      continue;
    }

    const document = context.getPrefabDocumentById(node.prefabId);

    if (!document) {
      continue;
    }

    drawables.push(
      ...flattenPrefabBillboards(
        {
          nodes: document.nodes,
          baseMatrix: transformToMatrix(node),
          isSelected: () => node.id === input.selectedNodeId,
          idPrefix: `${node.id}/`,
        },
        context,
      ),
    );
  }

  return drawables;
}

function flattenPrefabBillboards(
  input: {
    nodes: PrefabNode[];
    baseMatrix: Matrix4;
    isSelected: (nodeId: string) => boolean;
    idPrefix?: string;
    pathOverrides?: Map<string, StructuredBezierPath>;
  },
  context: BillboardFrameDataContext,
): DrawableBillboard[] {
  const worldTransforms = getPrefabWorldTransforms(input.nodes, input.baseMatrix);
  const drawables: DrawableBillboard[] = [];

  for (const node of input.nodes) {
    if (node.kind !== "primitive") {
      continue;
    }

    const asset = node.assetId ? context.getAssetById(node.assetId) : null;
    const matrix = worldTransforms.get(node.id);

    if (!asset || !matrix) {
      continue;
    }

    drawables.push({
      id: `${input.idPrefix ?? ""}${node.id}`,
      asset,
      transform: matrixToTransform(matrix),
      selected: input.isSelected(node.id),
      pathOverride: input.pathOverrides?.get(node.id),
    });
  }

  return drawables;
}
