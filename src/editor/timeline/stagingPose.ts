import type { PrimitiveSvgAsset } from "../../core/assets/primitiveSvg";
import {
  cloneStructuredBezierPath,
  type StructuredBezierPath,
} from "../../core/assets/structuredBezierPath";
import type { PrefabAnimationClip, PrefabNode } from "../api";
import { clonePrefabNode } from "../state/documentNodes";
import {
  cloneTransform,
  getPrefabWorldTransforms,
  matrixToTransform,
  transformToMatrix,
  type TransformSnapshot,
} from "../tools/prefabTransform";

export type TimelineStagingPose = TransformSnapshot & {
  nodeId: string;
  clipId: string;
  pathDraft?: StructuredBezierPath;
};

export type TimelineStagingPruneOptions = {
  clipIds?: Set<string>;
  nodeIds?: Set<string>;
  assetIds?: Set<string>;
};

export class TimelineStagingPoseStore {
  private readonly poses = new Map<string, TimelineStagingPose>();

  clear(): void {
    this.poses.clear();
  }

  get(
    nodeId: string,
    clip: PrefabAnimationClip | null,
  ): TimelineStagingPose | null {
    if (!clip) {
      return null;
    }

    return this.poses.get(getTimelineStagingKey(clip.id, nodeId)) ?? null;
  }

  getOrCreate(
    node: PrefabNode,
    clip: PrefabAnimationClip,
    asset?: PrimitiveSvgAsset | null,
  ): TimelineStagingPose {
    const key = getTimelineStagingKey(clip.id, node.id);
    const existing = this.poses.get(key);

    if (existing) {
      return existing;
    }

    const pose: TimelineStagingPose = {
      nodeId: node.id,
      clipId: clip.id,
      position: [...node.position],
      rotation: [...node.rotation],
      scale: [...node.scale],
      pathDraft: asset ? cloneStructuredBezierPath(asset.bezierPath) : undefined,
    };

    this.poses.set(key, pose);
    return pose;
  }

  syncPathDraft(nodeId: string, pathDraft: StructuredBezierPath): void {
    for (const pose of this.poses.values()) {
      if (pose.nodeId === nodeId) {
        pose.pathDraft = cloneStructuredBezierPath(pathDraft);
      }
    }
  }

  prune(
    options: TimelineStagingPruneOptions | undefined,
    getNodeById: (nodeId: string) => PrefabNode | null,
  ): void {
    if (!options) {
      return;
    }

    for (const [key, pose] of [...this.poses]) {
      const node = getNodeById(pose.nodeId);
      const shouldDelete =
        (options.clipIds && options.clipIds.has(pose.clipId)) ||
        (options.nodeIds && options.nodeIds.has(pose.nodeId)) ||
        (options.assetIds &&
          node?.kind === "primitive" &&
          node.assetId &&
          options.assetIds.has(node.assetId));

      if (shouldDelete) {
        this.poses.delete(key);
      }
    }
  }
}

export function getPrefabNodesWithTimelineStagingPose(
  nodes: PrefabNode[],
  pose: TimelineStagingPose,
): PrefabNode[] {
  return nodes.map((node) =>
    node.id === pose.nodeId
      ? {
          ...clonePrefabNode(node),
          position: [...pose.position],
          rotation: [...pose.rotation],
          scale: [...pose.scale],
        }
      : clonePrefabNode(node),
  );
}

export function getTimelineStagingWorldTransform(
  nodes: PrefabNode[],
  pose: TimelineStagingPose,
): TransformSnapshot {
  const stagedNodes = getPrefabNodesWithTimelineStagingPose(nodes, pose);
  const worldMatrix =
    getPrefabWorldTransforms(stagedNodes).get(pose.nodeId) ?? transformToMatrix(pose);

  return matrixToTransform(worldMatrix);
}

export function cloneTimelineStagingTransform(
  pose: TimelineStagingPose,
): TransformSnapshot {
  return cloneTransform(pose);
}

function getTimelineStagingKey(clipId: string, nodeId: string): string {
  return `${clipId}/${nodeId}`;
}
