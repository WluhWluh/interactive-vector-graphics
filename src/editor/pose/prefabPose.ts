import {
  cloneStructuredBezierPath,
  type StructuredBezierPath,
} from "../../core/assets/structuredBezierPath";
import type { PrimitiveSvgAsset } from "../../core/assets/primitiveSvg";
import type { PrefabAnimationClip, PrefabNode } from "../api";
import { clonePrefabNode } from "../state/documentNodes";
import {
  clampTimelineTimeMs,
  evaluatePrefabPathTrack,
  evaluatePrefabTrack,
  isPrefabPathTrack,
  isPrefabVectorTrack,
} from "../timeline/prefabTimelineCore";
import {
  cloneTimelineStagingTransform,
  getPrefabNodesWithTimelineStagingPose,
  getTimelineStagingWorldTransform,
  type TimelineStagingPose,
  type TimelineStagingPoseStore,
} from "../timeline/stagingPose";
import type { TransformSnapshot } from "../tools/prefabTransform";

export type PrefabPoseSnapshot = {
  nodes: PrefabNode[];
  pathOverrides: Map<string, StructuredBezierPath>;
};

export function evaluatePrefabPose(input: {
  nodes: PrefabNode[];
  activeClip: PrefabAnimationClip | null;
  currentTimeMs: number;
}): PrefabPoseSnapshot {
  const nodes = input.nodes.map(clonePrefabNode);
  const pathOverrides = new Map<string, StructuredBezierPath>();

  if (!input.activeClip) {
    return {
      nodes,
      pathOverrides,
    };
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const timeMs = clampTimelineTimeMs(input.currentTimeMs, input.activeClip);

  for (const track of input.activeClip.tracks) {
    if (isPrefabVectorTrack(track)) {
      const node = nodeById.get(track.target.nodeId);

      if (!node) {
        continue;
      }

      const value = evaluatePrefabTrack(track, timeMs);

      if (value) {
        node[track.target.property] = value;
      }

      continue;
    }

    if (isPrefabPathTrack(track)) {
      const path = evaluatePrefabPathTrack(track, timeMs);

      if (path) {
        pathOverrides.set(track.target.nodeId, path);
      }
    }
  }

  return {
    nodes,
    pathOverrides,
  };
}

export function getSelectedTimelineStagingPose(input: {
  selectedNode: PrefabNode | null;
  activeClip: PrefabAnimationClip | null;
  assetsById: Map<string, PrimitiveSvgAsset>;
  stagingPoses: TimelineStagingPoseStore;
}): TimelineStagingPose | null {
  if (!input.activeClip || !input.selectedNode) {
    return null;
  }

  const asset =
    input.selectedNode.kind === "primitive" && input.selectedNode.assetId
      ? input.assetsById.get(input.selectedNode.assetId) ?? null
      : null;

  return input.stagingPoses.getOrCreate(input.selectedNode, input.activeClip, asset);
}

export function getSelectedTimelineStagingTransform(input: {
  selectedNode: PrefabNode | null;
  activeClip: PrefabAnimationClip | null;
  assetsById: Map<string, PrimitiveSvgAsset>;
  stagingPoses: TimelineStagingPoseStore;
}): TransformSnapshot | null {
  const pose = getSelectedTimelineStagingPose(input);

  return pose ? cloneTimelineStagingTransform(pose) : null;
}

export function getPrefabNodesWithStagingPose(input: {
  nodes: PrefabNode[];
  stagingPose: TimelineStagingPose;
}): PrefabNode[] {
  return getPrefabNodesWithTimelineStagingPose(input.nodes, input.stagingPose);
}

export function getStagingWorldTransform(input: {
  nodes: PrefabNode[];
  stagingPose: TimelineStagingPose;
}): TransformSnapshot {
  return getTimelineStagingWorldTransform(input.nodes, input.stagingPose);
}

export function clonePathOverrideForNode(
  snapshot: PrefabPoseSnapshot,
  nodeId: string,
  fallbackPath: StructuredBezierPath,
): StructuredBezierPath {
  return cloneStructuredBezierPath(
    snapshot.pathOverrides.get(nodeId) ?? fallbackPath,
  );
}
