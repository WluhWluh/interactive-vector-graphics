import {
  cloneStructuredBezierPath,
  type BezierPoint,
  type StructuredBezierPath,
} from "../../core/assets/structuredBezierPath";
import type {
  PrefabAnimationClip,
  PrefabPathAnimationTrack,
  PrefabTrackProperty,
  PrefabVectorAnimationTrack,
  Vector3Tuple,
} from "../../core/documents/prefabDocument";

export {
  clonePrefabAnimation,
  clonePrefabAnimationClip,
  clonePrefabAnimationKeyframe,
  clonePrefabAnimationTrack,
  clonePrefabPathAnimationKeyframe,
  isPrefabPathTrack,
  isPrefabVectorTrack,
  isPrefabVectorTrackProperty,
} from "../../core/documents/prefabDocument";

export function evaluatePrefabTrack(
  track: PrefabVectorAnimationTrack,
  timeMs: number,
): Vector3Tuple | null {
  const keyframes = [...track.keyframes].sort((a, b) => a.timeMs - b.timeMs);

  if (keyframes.length === 0) {
    return null;
  }

  const firstKeyframe = keyframes[0];
  const lastKeyframe = keyframes[keyframes.length - 1];

  if (!firstKeyframe || !lastKeyframe) {
    return null;
  }

  if (timeMs <= firstKeyframe.timeMs) {
    return [...firstKeyframe.value];
  }

  if (timeMs >= lastKeyframe.timeMs) {
    return [...lastKeyframe.value];
  }

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const current = keyframes[index];
    const next = keyframes[index + 1];

    if (!current || !next || timeMs < current.timeMs || timeMs > next.timeMs) {
      continue;
    }

    if (current.easing === "step" || current.timeMs === next.timeMs) {
      return [...current.value];
    }

    const span = next.timeMs - current.timeMs;
    const rawProgress = (timeMs - current.timeMs) / span;
    const progress =
      current.easing === "easeInOut"
        ? smoothstep(rawProgress)
        : rawProgress;

    return lerpVector3(current.value, next.value, progress);
  }

  return null;
}

export function evaluatePrefabPathTrack(
  track: PrefabPathAnimationTrack,
  timeMs: number,
): StructuredBezierPath | null {
  const keyframes = [...track.keyframes].sort((a, b) => a.timeMs - b.timeMs);

  if (keyframes.length === 0) {
    return null;
  }

  const firstKeyframe = keyframes[0];
  const lastKeyframe = keyframes[keyframes.length - 1];

  if (!firstKeyframe || !lastKeyframe) {
    return null;
  }

  if (timeMs <= firstKeyframe.timeMs) {
    return cloneStructuredBezierPath(firstKeyframe.value);
  }

  if (timeMs >= lastKeyframe.timeMs) {
    return cloneStructuredBezierPath(lastKeyframe.value);
  }

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const current = keyframes[index];
    const next = keyframes[index + 1];

    if (!current || !next || timeMs < current.timeMs || timeMs > next.timeMs) {
      continue;
    }

    if (
      current.easing === "step" ||
      current.timeMs === next.timeMs ||
      !canInterpolateBezierPaths(current.value, next.value)
    ) {
      return cloneStructuredBezierPath(current.value);
    }

    const span = next.timeMs - current.timeMs;
    const rawProgress = (timeMs - current.timeMs) / span;
    const progress =
      current.easing === "easeInOut"
        ? smoothstep(rawProgress)
        : rawProgress;

    return interpolateBezierPaths(current.value, next.value, progress);
  }

  return null;
}

export function canInterpolateBezierPaths(
  start: StructuredBezierPath,
  end: StructuredBezierPath,
): boolean {
  return (
    start.closed === end.closed &&
    start.segments.length === end.segments.length &&
    start.segments.every(
      (segment, index) => segment.id === end.segments[index]?.id,
    )
  );
}

export function interpolateBezierPaths(
  start: StructuredBezierPath,
  end: StructuredBezierPath,
  progress: number,
): StructuredBezierPath {
  return {
    version: 1,
    closed: start.closed,
    segments: start.segments.map((segment, index) => {
      const endSegment = end.segments[index] ?? segment;

      return {
        id: segment.id,
        anchor: lerpBezierPoint(segment.anchor, endSegment.anchor, progress),
        handleIn: lerpBezierPoint(segment.handleIn, endSegment.handleIn, progress),
        handleOut: lerpBezierPoint(segment.handleOut, endSegment.handleOut, progress),
      };
    }),
  };
}

export function getTimelinePropertyLabel(property: PrefabTrackProperty): string {
  switch (property) {
    case "position":
      return "Position";
    case "rotation":
      return "Rotation";
    case "scale":
      return "Scale";
    case "path":
      return "Path";
  }
}

export function clampTimelineTimeMs(
  timeMs: number,
  clip: PrefabAnimationClip | null,
): number {
  if (!clip || !Number.isFinite(timeMs)) {
    return 0;
  }

  return Math.round(Math.min(Math.max(timeMs, 0), clip.durationMs));
}

export function getTimelineSnapFrameMs(snapFps: number): number {
  return 1000 / Math.min(Math.max(snapFps, 1), 240);
}

export function snapTimelineTimeMs(timeMs: number, snapFps: number): number {
  if (!Number.isFinite(timeMs)) {
    return 0;
  }

  const frameMs = getTimelineSnapFrameMs(snapFps);
  return Math.round(Math.round(timeMs / frameMs) * frameMs);
}

export function snapAndClampTimelineTimeMs(
  timeMs: number,
  clip: PrefabAnimationClip | null,
  snapFps: number,
): number {
  return clampTimelineTimeMs(snapTimelineTimeMs(timeMs, snapFps), clip);
}

export function getTimelineSnapTickTimes(
  clip: PrefabAnimationClip,
  snapFps: number,
): number[] {
  if (clip.durationMs <= 0) {
    return [0];
  }

  const snapFrameMs = getTimelineSnapFrameMs(snapFps);
  const times = new Set<number>([0, clip.durationMs]);

  for (let frameIndex = 1; ; frameIndex += 1) {
    const timeMs = Math.round(frameIndex * snapFrameMs);

    if (timeMs >= clip.durationMs) {
      break;
    }

    times.add(timeMs);
  }

  return [...times].sort((a, b) => a - b);
}

function smoothstep(value: number): number {
  const clamped = Math.min(Math.max(value, 0), 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function lerpVector3(
  start: Vector3Tuple,
  end: Vector3Tuple,
  progress: number,
): Vector3Tuple {
  return [
    roundTransformValue(start[0] + (end[0] - start[0]) * progress),
    roundTransformValue(start[1] + (end[1] - start[1]) * progress),
    roundTransformValue(start[2] + (end[2] - start[2]) * progress),
  ];
}

function lerpBezierPoint(
  start: BezierPoint,
  end: BezierPoint,
  progress: number,
): BezierPoint {
  return [
    roundBezierValue(start[0] + (end[0] - start[0]) * progress),
    roundBezierValue(start[1] + (end[1] - start[1]) * progress),
  ];
}

function roundTransformValue(value: number): number {
  return Number(value.toFixed(4));
}

function roundBezierValue(value: number): number {
  return Number(value.toFixed(4));
}
