import {
  cloneStructuredBezierPath,
  type StructuredBezierPath,
} from "../../core/assets/structuredBezierPath";
import type {
  PrefabNode,
  PrefabPathTrackProperty,
  PrefabTrackProperty,
  PrefabVectorTrackProperty,
} from "../api";
import type { Vector3Tuple } from "../threeEditorViewport";
import type { TimelineStagingPose } from "../timeline/stagingPose";

export type PrefabPoseVectorProperty = PrefabVectorTrackProperty;
export type PrefabPosePathProperty = PrefabPathTrackProperty;

export type PrefabPosePropertyAdapter =
  | {
      property: PrefabPoseVectorProperty;
      valueKind: "vector";
      readBaseValue: (node: PrefabNode) => Vector3Tuple;
      readStagingValue: (pose: TimelineStagingPose) => Vector3Tuple;
      writeStagingValue: (
        pose: TimelineStagingPose,
        value: Vector3Tuple,
      ) => void;
    }
  | {
      property: PrefabPosePathProperty;
      valueKind: "path";
      readStagingValue: (
        pose: TimelineStagingPose,
      ) => StructuredBezierPath | null;
      writeStagingValue: (
        pose: TimelineStagingPose,
        value: StructuredBezierPath,
      ) => void;
    };

export const PREFAB_POSE_PROPERTY_ADAPTERS: readonly PrefabPosePropertyAdapter[] = [
  createVectorPosePropertyAdapter("position"),
  createVectorPosePropertyAdapter("rotation"),
  createVectorPosePropertyAdapter("scale"),
  {
    property: "path",
    valueKind: "path",
    readStagingValue: (pose) =>
      pose.pathDraft ? cloneStructuredBezierPath(pose.pathDraft) : null,
    writeStagingValue: (pose, value) => {
      pose.pathDraft = cloneStructuredBezierPath(value);
    },
  },
];

export function getPrefabPosePropertyAdapter(
  property: PrefabTrackProperty,
): PrefabPosePropertyAdapter {
  const adapter = PREFAB_POSE_PROPERTY_ADAPTERS.find(
    (candidate) => candidate.property === property,
  );

  if (!adapter) {
    throw new Error(`Unknown prefab pose property "${property}".`);
  }

  return adapter;
}

export function isVectorPosePropertyAdapter(
  adapter: PrefabPosePropertyAdapter,
): adapter is Extract<PrefabPosePropertyAdapter, { valueKind: "vector" }> {
  return adapter.valueKind === "vector";
}

export function isPathPosePropertyAdapter(
  adapter: PrefabPosePropertyAdapter,
): adapter is Extract<PrefabPosePropertyAdapter, { valueKind: "path" }> {
  return adapter.valueKind === "path";
}

function createVectorPosePropertyAdapter(
  property: PrefabPoseVectorProperty,
): Extract<PrefabPosePropertyAdapter, { valueKind: "vector" }> {
  return {
    property,
    valueKind: "vector",
    readBaseValue: (node) => [...node[property]],
    readStagingValue: (pose) => [...pose[property]],
    writeStagingValue: (pose, value) => {
      pose[property] = [...value];
    },
  };
}
