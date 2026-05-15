import {
  cloneStructuredBezierPath,
  type StructuredBezierPath,
} from "../../core/assets/structuredBezierPath";
import type {
  PrefabAnimation,
  PrefabAnimationClip,
  PrefabAnimationTrack,
  PrefabPathAnimationKeyframe,
  PrefabPathAnimationTrack,
  PrefabTrackEasing,
  PrefabVectorAnimationKeyframe,
  PrefabVectorAnimationTrack,
  PrefabVectorTrackProperty,
} from "../api";
import type { Vector3Tuple } from "../threeEditorViewport";
import {
  clampTimelineTimeMs,
  clonePrefabAnimationClip,
  clonePrefabAnimationKeyframe,
  clonePrefabAnimationTrack,
  clonePrefabPathAnimationKeyframe,
  isPrefabPathTrack,
  isPrefabVectorTrack,
  snapTimelineTimeMs,
} from "../timeline/prefabTimelineCore";
import { createUniqueId, slugifyTimelineName } from "../tools/editorUtils";

export type TimelineKeyframeSelection = {
  track: PrefabAnimationTrack;
  keyframe: PrefabAnimationTrack["keyframes"][number];
};

export type TimelineUpsertResult = {
  clip: PrefabAnimationClip;
  selectedKeyframeId: string | null;
};

export type TimelineUpdateKeyframeResult = {
  clip: PrefabAnimationClip;
  selectedKeyframeId: string;
  currentTimeMs: number;
};

export type TimelinePlaybackResult = {
  currentTimeMs: number;
  isPlaying: boolean;
};

export function getActiveTimelineClip(
  animation: PrefabAnimation,
): PrefabAnimationClip | null {
  return animation.activeClipId
    ? (animation.clips.find((clip) => clip.id === animation.activeClipId) ?? null)
    : null;
}

export function createTimelineClip(
  animation: PrefabAnimation,
  input: {
    name: string;
    durationMs: number;
    loop: boolean;
  },
): { animation: PrefabAnimation; clip: PrefabAnimationClip } {
  const clip: PrefabAnimationClip = {
    id: createUniqueTimelineClipId(animation, input.name),
    name: input.name,
    durationMs: input.durationMs,
    loop: input.loop,
    tracks: [],
  };

  return {
    animation: {
      ...animation,
      activeClipId: clip.id,
      clips: [...animation.clips.map(clonePrefabAnimationClip), clip],
    },
    clip,
  };
}

export function deleteActiveTimelineClip(
  animation: PrefabAnimation,
): { animation: PrefabAnimation; deletedClipId: string | null } {
  const activeClip = getActiveTimelineClip(animation);

  if (!activeClip) {
    return {
      animation,
      deletedClipId: null,
    };
  }

  return {
    animation: {
      ...animation,
      activeClipId: null,
      clips: animation.clips
        .filter((clip) => clip.id !== activeClip.id)
        .map(clonePrefabAnimationClip),
    },
    deletedClipId: activeClip.id,
  };
}

export function selectTimelineClip(
  animation: PrefabAnimation,
  clipId: string,
): { animation: PrefabAnimation; clip: PrefabAnimationClip | null } {
  const clip = animation.clips.find((candidate) => candidate.id === clipId);

  if (!clip) {
    return {
      animation,
      clip: null,
    };
  }

  return {
    animation: {
      ...animation,
      activeClipId: clip.id,
      clips: animation.clips.map(clonePrefabAnimationClip),
    },
    clip,
  };
}

export function selectBasePoseTimeline(animation: PrefabAnimation): PrefabAnimation {
  return {
    ...animation,
    activeClipId: null,
    clips: animation.clips.map(clonePrefabAnimationClip),
  };
}

export function updateActiveTimelineClip(
  animation: PrefabAnimation,
  nextClip: PrefabAnimationClip,
): PrefabAnimation {
  return {
    ...animation,
    activeClipId: nextClip.id,
    clips: animation.clips.map((clip) =>
      clip.id === nextClip.id ? clonePrefabAnimationClip(nextClip) : clonePrefabAnimationClip(clip),
    ),
  };
}

export function getSelectedTimelineKeyframe(
  clip: PrefabAnimationClip,
  selectedKeyframeId: string | null,
): TimelineKeyframeSelection | null {
  if (!selectedKeyframeId) {
    return null;
  }

  for (const track of clip.tracks) {
    const keyframe = track.keyframes.find(
      (candidate) => candidate.id === selectedKeyframeId,
    );

    if (keyframe) {
      return {
        track,
        keyframe,
      };
    }
  }

  return null;
}

export function advanceTimelinePlayback(input: {
  isPlaying: boolean;
  activeClip: PrefabAnimationClip | null;
  currentTimeMs: number;
  deltaSeconds: number;
}): TimelinePlaybackResult {
  if (!input.isPlaying) {
    return {
      currentTimeMs: input.currentTimeMs,
      isPlaying: false,
    };
  }

  const { activeClip } = input;

  if (!activeClip || activeClip.durationMs <= 0) {
    return {
      currentTimeMs: input.currentTimeMs,
      isPlaying: false,
    };
  }

  const nextTimeMs = input.currentTimeMs + input.deltaSeconds * 1000;

  if (nextTimeMs > activeClip.durationMs) {
    if (activeClip.loop) {
      return {
        currentTimeMs: Math.round(nextTimeMs % activeClip.durationMs),
        isPlaying: true,
      };
    }

    return {
      currentTimeMs: activeClip.durationMs,
      isPlaying: false,
    };
  }

  return {
    currentTimeMs: Math.round(nextTimeMs),
    isPlaying: true,
  };
}

export function parseTimelineDurationInput(
  value: string,
): number | null {
  const duration = Number(value.trim());

  return Number.isFinite(duration) &&
    duration >= 0 &&
    Number.isInteger(duration)
    ? Math.round(duration)
    : null;
}

export function parseTimelineSnapFpsInput(value: string): number | null {
  const snapFps = Number(value.trim());

  return Number.isFinite(snapFps) && snapFps >= 1 && snapFps <= 240
    ? snapFps
    : null;
}

export function parseVectorKeyframeValueInput(input: {
  x: string;
  y: string;
  z: string;
  round: (value: number) => number;
}): Vector3Tuple | null {
  const x = Number(input.x.trim());
  const y = Number(input.y.trim());
  const z = Number(input.z.trim());

  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)
    ? [input.round(x), input.round(y), input.round(z)]
    : null;
}

export function parseTimelineEasingInput(
  value: string,
): PrefabTrackEasing | null {
  return value === "linear" || value === "step" || value === "easeInOut"
    ? value
    : null;
}

export function upsertPrefabVectorKeyframe(
  clip: PrefabAnimationClip,
  input: {
    nodeId: string;
    property: PrefabVectorTrackProperty;
    timeMs: number;
    value: Vector3Tuple;
    easing: PrefabTrackEasing;
    snapFps: number;
  },
): TimelineUpsertResult {
  const trackId = `${input.nodeId}-${input.property}`;
  const tracks = clip.tracks.map(clonePrefabAnimationTrack);
  let track = tracks.find(
    (candidate): candidate is PrefabVectorAnimationTrack =>
      isPrefabVectorTrack(candidate) &&
      candidate.target.nodeId === input.nodeId &&
      candidate.target.property === input.property,
  );

  if (!track) {
    track = {
      id: createUniqueTimelineTrackId(trackId, tracks),
      target: {
        nodeId: input.nodeId,
        property: input.property,
      },
      keyframes: [],
    };
    tracks.push(track);
  }

  const snappedTimeMs = snapTimelineTimeMs(input.timeMs, input.snapFps);
  const nextKeyframe = {
    id: "",
    timeMs: snappedTimeMs,
    value: [...input.value] as Vector3Tuple,
    easing: input.easing,
  };
  const existingIndex = track.keyframes.findIndex(
    (keyframe) => keyframe.timeMs === snappedTimeMs,
  );
  let selectedKeyframeId: string | null = null;

  if (existingIndex >= 0) {
    const existingKeyframe = track.keyframes[existingIndex];
    track.keyframes[existingIndex] = {
      ...nextKeyframe,
      id: existingKeyframe?.id ?? createUniqueTimelineKeyframeId(track),
    };
    selectedKeyframeId = track.keyframes[existingIndex]?.id ?? null;
  } else {
    const createdKeyframe = {
      ...nextKeyframe,
      id: createUniqueTimelineKeyframeId(track),
    };
    track.keyframes.push(createdKeyframe);
    selectedKeyframeId = createdKeyframe.id;
  }

  track.keyframes.sort((a, b) => a.timeMs - b.timeMs);

  return {
    clip: {
      ...clip,
      tracks,
    },
    selectedKeyframeId,
  };
}

export function upsertPrefabPathKeyframe(
  clip: PrefabAnimationClip,
  input: {
    nodeId: string;
    timeMs: number;
    value: StructuredBezierPath;
    easing: PrefabTrackEasing;
    snapFps: number;
  },
): TimelineUpsertResult {
  const trackId = `${input.nodeId}-path`;
  const tracks = clip.tracks.map(clonePrefabAnimationTrack);
  let track = tracks.find(
    (candidate): candidate is PrefabPathAnimationTrack =>
      isPrefabPathTrack(candidate) && candidate.target.nodeId === input.nodeId,
  );

  if (!track) {
    track = {
      id: createUniqueTimelineTrackId(trackId, tracks),
      target: {
        nodeId: input.nodeId,
        property: "path",
      },
      keyframes: [],
    };
    tracks.push(track);
  }

  const snappedTimeMs = snapTimelineTimeMs(input.timeMs, input.snapFps);
  const nextKeyframe: PrefabPathAnimationKeyframe = {
    id: "",
    timeMs: snappedTimeMs,
    value: cloneStructuredBezierPath(input.value),
    easing: input.easing,
  };
  const existingIndex = track.keyframes.findIndex(
    (keyframe) => keyframe.timeMs === snappedTimeMs,
  );
  let selectedKeyframeId: string | null = null;

  if (existingIndex >= 0) {
    const existingKeyframe = track.keyframes[existingIndex];
    track.keyframes[existingIndex] = {
      ...nextKeyframe,
      id: existingKeyframe?.id ?? createUniqueTimelineKeyframeId(track),
    };
    selectedKeyframeId = track.keyframes[existingIndex]?.id ?? null;
  } else {
    const createdKeyframe = {
      ...nextKeyframe,
      id: createUniqueTimelineKeyframeId(track),
    };
    track.keyframes.push(createdKeyframe);
    selectedKeyframeId = createdKeyframe.id;
  }

  track.keyframes.sort((a, b) => a.timeMs - b.timeMs);

  return {
    clip: {
      ...clip,
      tracks,
    },
    selectedKeyframeId,
  };
}

export function deleteTimelineKeyframe(
  activeClip: PrefabAnimationClip,
  selected: TimelineKeyframeSelection,
): PrefabAnimationClip {
  return {
    ...activeClip,
    tracks: activeClip.tracks.map((track) => {
      if (track.id !== selected.track.id) {
        return clonePrefabAnimationTrack(track);
      }

      if (isPrefabPathTrack(track)) {
        return {
          ...track,
          keyframes: track.keyframes
            .filter((keyframe) => keyframe.id !== selected.keyframe.id)
            .map(clonePrefabPathAnimationKeyframe),
        };
      }

      return {
        ...track,
        keyframes: track.keyframes
          .filter((keyframe) => keyframe.id !== selected.keyframe.id)
          .map(clonePrefabAnimationKeyframe),
      };
    }),
  };
}

export function updateTimelineKeyframe(
  activeClip: PrefabAnimationClip,
  selected: TimelineKeyframeSelection,
  nextKeyframe: PrefabVectorAnimationKeyframe | PrefabPathAnimationKeyframe,
): TimelineUpdateKeyframeResult {
  const nextTimeMs = clampTimelineTimeMs(nextKeyframe.timeMs, activeClip);
  const nextClip = {
    ...activeClip,
    tracks: activeClip.tracks.map((track) => {
      if (track.id !== selected.track.id) {
        return clonePrefabAnimationTrack(track);
      }

      if (isPrefabPathTrack(selected.track) && isPrefabPathTrack(track)) {
        const pathKeyframe = nextKeyframe as PrefabPathAnimationKeyframe;
        const nextKeyframes = track.keyframes
          .filter((keyframe) => keyframe.id !== selected.keyframe.id)
          .filter((keyframe) => keyframe.timeMs !== nextTimeMs)
          .map(clonePrefabPathAnimationKeyframe);

        nextKeyframes.push({
          ...pathKeyframe,
          timeMs: nextTimeMs,
          value: cloneStructuredBezierPath(pathKeyframe.value),
        });
        nextKeyframes.sort((a, b) => a.timeMs - b.timeMs);

        return {
          ...track,
          keyframes: nextKeyframes,
        };
      }

      if (isPrefabVectorTrack(selected.track) && isPrefabVectorTrack(track)) {
        const vectorKeyframe = nextKeyframe as PrefabVectorAnimationKeyframe;
        const nextKeyframes = track.keyframes
          .filter((keyframe) => keyframe.id !== selected.keyframe.id)
          .filter((keyframe) => keyframe.timeMs !== nextTimeMs)
          .map(clonePrefabAnimationKeyframe);

        nextKeyframes.push({
          ...vectorKeyframe,
          timeMs: nextTimeMs,
          value: [...vectorKeyframe.value],
        });
        nextKeyframes.sort((a, b) => a.timeMs - b.timeMs);

        return {
          ...track,
          keyframes: nextKeyframes,
        };
      }

      return clonePrefabAnimationTrack(track);
    }),
  };

  return {
    clip: nextClip,
    selectedKeyframeId: nextKeyframe.id,
    currentTimeMs: nextTimeMs,
  };
}

function createUniqueTimelineClipId(
  animation: PrefabAnimation,
  name: string,
): string {
  return createUniqueId(
    slugifyTimelineName(name),
    new Set(animation.clips.map((clip) => clip.id)),
  );
}

function createUniqueTimelineTrackId(
  baseId: string,
  tracks: PrefabAnimationTrack[],
): string {
  return createUniqueId(baseId, new Set(tracks.map((track) => track.id)));
}

function createUniqueTimelineKeyframeId(track: PrefabAnimationTrack): string {
  const baseId = `${track.id}-key`;
  return createUniqueId(
    baseId,
    new Set(track.keyframes.map((keyframe) => keyframe.id)),
  );
}
