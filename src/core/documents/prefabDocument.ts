import { cloneStructuredBezierPath } from "../assets/structuredBezierPath";
import type { StructuredBezierPath } from "../assets/structuredBezierPath";

export const PREFAB_DOCUMENT_VERSION = 4;
export const DEFAULT_PREFAB_SNAP_FPS = 10;

export type Vector3Tuple = [number, number, number];

export type PrefabNode = {
  id: string;
  kind: "group" | "primitive";
  parentId: string | null;
  assetId?: string;
  name: string;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
  billboardMode: "spherical";
};

export type PrefabTrackEasing = "linear" | "step" | "easeInOut";
export type PrefabVectorTrackProperty = "position" | "rotation" | "scale";
export type PrefabPathTrackProperty = "path";
export type PrefabTrackProperty =
  | PrefabVectorTrackProperty
  | PrefabPathTrackProperty;

export type PrefabVectorAnimationKeyframe = {
  id: string;
  timeMs: number;
  value: Vector3Tuple;
  easing: PrefabTrackEasing;
};

export type PrefabPathAnimationKeyframe = {
  id: string;
  timeMs: number;
  value: StructuredBezierPath;
  easing: PrefabTrackEasing;
};

export type PrefabAnimationKeyframe =
  | PrefabVectorAnimationKeyframe
  | PrefabPathAnimationKeyframe;

export type PrefabVectorAnimationTrack = {
  id: string;
  target: {
    nodeId: string;
    property: PrefabVectorTrackProperty;
  };
  keyframes: PrefabVectorAnimationKeyframe[];
};

export type PrefabPathAnimationTrack = {
  id: string;
  target: {
    nodeId: string;
    property: PrefabPathTrackProperty;
  };
  keyframes: PrefabPathAnimationKeyframe[];
};

export type PrefabAnimationTrack =
  | PrefabVectorAnimationTrack
  | PrefabPathAnimationTrack;

export type PrefabAnimationClip = {
  id: string;
  name: string;
  durationMs: number;
  loop: boolean;
  tracks: PrefabAnimationTrack[];
};

export type PrefabAnimation = {
  snapFps: number;
  activeClipId: string | null;
  clips: PrefabAnimationClip[];
};

export type PrefabDocument = {
  version: typeof PREFAB_DOCUMENT_VERSION;
  nodes: PrefabNode[];
  animation: PrefabAnimation;
};

export function createEmptyPrefabAnimation(
  snapFps = DEFAULT_PREFAB_SNAP_FPS,
): PrefabAnimation {
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
    version: PREFAB_DOCUMENT_VERSION,
    nodes: nodes.map(clonePrefabNode),
    animation: clonePrefabAnimation(animation),
  };
}

export function clonePrefabNode(node: PrefabNode): PrefabNode {
  if (node.kind === "group") {
    return {
      id: node.id,
      kind: "group",
      parentId: node.parentId,
      name: node.name,
      position: [...node.position],
      rotation: [...node.rotation],
      scale: [...node.scale],
      billboardMode: node.billboardMode,
    };
  }

  return {
    id: node.id,
    kind: "primitive",
    parentId: node.parentId,
    assetId: node.assetId,
    name: node.name,
    position: [...node.position],
    rotation: [...node.rotation],
    scale: [...node.scale],
    billboardMode: node.billboardMode,
  };
}

export function clonePrefabAnimation(animation: PrefabAnimation): PrefabAnimation {
  const clips = animation.clips.map(clonePrefabAnimationClip);
  const activeClipId =
    animation.activeClipId && clips.some((clip) => clip.id === animation.activeClipId)
      ? animation.activeClipId
      : null;

  return {
    snapFps: animation.snapFps,
    activeClipId,
    clips,
  };
}

export function clonePrefabAnimationClip(
  clip: PrefabAnimationClip,
): PrefabAnimationClip {
  return {
    id: clip.id,
    name: clip.name,
    durationMs: clip.durationMs,
    loop: clip.loop,
    tracks: clip.tracks.map(clonePrefabAnimationTrack),
  };
}

export function clonePrefabAnimationTrack(
  track: PrefabAnimationTrack,
): PrefabAnimationTrack {
  if (isPrefabPathTrack(track)) {
    return {
      id: track.id,
      target: {
        nodeId: track.target.nodeId,
        property: "path",
      },
      keyframes: track.keyframes.map(clonePrefabPathAnimationKeyframe),
    };
  }

  return {
    id: track.id,
    target: {
      nodeId: track.target.nodeId,
      property: track.target.property,
    },
    keyframes: track.keyframes.map(clonePrefabAnimationKeyframe),
  };
}

export function clonePrefabAnimationKeyframe(
  keyframe: PrefabVectorAnimationKeyframe,
): PrefabVectorAnimationKeyframe {
  return {
    id: keyframe.id,
    timeMs: keyframe.timeMs,
    value: [...keyframe.value],
    easing: keyframe.easing,
  };
}

export function clonePrefabPathAnimationKeyframe(
  keyframe: PrefabPathAnimationKeyframe,
): PrefabPathAnimationKeyframe {
  return {
    id: keyframe.id,
    timeMs: keyframe.timeMs,
    value: cloneStructuredBezierPath(keyframe.value),
    easing: keyframe.easing,
  };
}

export function clonePrefabDocument(document: PrefabDocument): PrefabDocument {
  return createPrefabDocument(document.nodes, document.animation);
}

export function isPrefabVectorTrack(
  track: PrefabAnimationTrack,
): track is PrefabVectorAnimationTrack {
  return track.target.property !== "path";
}

export function isPrefabPathTrack(
  track: PrefabAnimationTrack,
): track is PrefabPathAnimationTrack {
  return track.target.property === "path";
}

export function isPrefabVectorTrackProperty(
  property: PrefabTrackProperty,
): property is PrefabVectorTrackProperty {
  return property !== "path";
}
