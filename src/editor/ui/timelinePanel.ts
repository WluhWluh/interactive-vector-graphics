import type {
  PrefabAnimation,
  PrefabAnimationClip,
  PrefabAnimationTrack,
  PrefabNode,
  PrefabTrackProperty,
} from "../api";
import {
  getTimelinePropertyLabel,
  getTimelineSnapTickTimes,
  isPrefabVectorTrack,
} from "../timeline/prefabTimelineCore";
import { formatTimelineNumber, formatTransformValue } from "../tools/editorUtils";
import type { EditorElements } from "./editorDom";

export type TimelinePanelRenderInput = {
  elements: EditorElements;
  animation: PrefabAnimation;
  currentTimeMs: number;
  defaultDurationMs: number;
  activeClip: PrefabAnimationClip | null;
  selectedNode: PrefabNode | null;
  activeProperty: PrefabTrackProperty;
  laneProperties: PrefabTrackProperty[];
  selectedKeyframeId: string | null;
  getTrack: (
    clip: PrefabAnimationClip,
    nodeId: string,
    property: PrefabTrackProperty,
  ) => PrefabAnimationTrack | null;
  getSelectedKeyframe: (clip: PrefabAnimationClip) => {
    track: PrefabAnimationTrack;
    keyframe: PrefabAnimationTrack["keyframes"][number];
  } | null;
  onSelectBasePose: () => void;
  onSelectClip: (clipId: string) => void;
  onSelectProperty: (property: PrefabTrackProperty) => void;
  onTrackClick: (property: PrefabTrackProperty, event: MouseEvent) => void;
  onKeyframeClick: (
    property: PrefabTrackProperty,
    keyframeId: string,
    timeMs: number,
    event: MouseEvent,
  ) => void;
  onKeyframePointerDown: (
    property: PrefabTrackProperty,
    keyframeId: string,
    event: PointerEvent,
  ) => void;
};

export function renderTimelinePanel(input: TimelinePanelRenderInput): void {
  const {
    elements,
    animation,
    currentTimeMs,
    defaultDurationMs,
    activeClip,
  } = input;
  const basePoseItem = document.createElement("li");
  const basePoseButton = document.createElement("button");

  basePoseButton.type = "button";
  basePoseButton.className = "timeline-clip-item";
  basePoseButton.dataset.clipId = "__base-pose__";
  basePoseButton.dataset.selected = String(animation.activeClipId === null);
  basePoseButton.textContent = "Base Pose";
  basePoseButton.addEventListener("click", () => {
    input.onSelectBasePose();
  });
  basePoseItem.append(basePoseButton);

  const clipButtons = animation.clips.map((clip) => {
    const item = document.createElement("li");
    const button = document.createElement("button");

    button.type = "button";
    button.className = "timeline-clip-item";
    button.dataset.clipId = clip.id;
    button.dataset.selected = String(clip.id === animation.activeClipId);
    button.textContent = `${clip.name} (${clip.durationMs} ms)`;
    button.addEventListener("click", () => {
      input.onSelectClip(clip.id);
    });

    item.append(button);
    return item;
  });

  elements.timelineClipList.replaceChildren(basePoseItem, ...clipButtons);
  elements.timelineTimeInput.value = String(currentTimeMs);
  elements.timelineDurationInput.value = activeClip
    ? String(activeClip.durationMs)
    : String(defaultDurationMs);
  elements.timelineSnapFpsInput.value = formatTimelineNumber(animation.snapFps);
  elements.timelineLoopInput.checked = activeClip?.loop ?? false;
  elements.timelineScrubInput.max = String(Math.max(activeClip?.durationMs ?? 1, 1));
  elements.timelineScrubInput.value = String(
    clampTimelineTimeForPanel(currentTimeMs, activeClip),
  );

  if (!activeClip) {
    elements.timelineTrackLanes.replaceChildren();
    elements.timelineKeyframeEditor.hidden = true;
    elements.timelineStatus.textContent =
      "Base Pose: editing prefab defaults outside animation";
    return;
  }

  const trackCount = activeClip.tracks.length;
  const keyframeCount = activeClip.tracks.reduce(
    (total, track) => total + track.keyframes.length,
    0,
  );

  renderTimelineTrackLanes(input, activeClip);
  renderTimelineKeyframeEditor(input, activeClip);

  elements.timelineStatus.textContent = input.selectedNode
    ? `${activeClip.name}: ${trackCount} tracks, ${keyframeCount} keyframes`
    : `${activeClip.name}: select a real prefab node to add keyframes`;
}

function renderTimelineTrackLanes(
  input: TimelinePanelRenderInput,
  activeClip: PrefabAnimationClip,
): void {
  const lanes = input.laneProperties.map((property) => {
    const lane = document.createElement("div");
    const labelButton = document.createElement("button");
    const trackBar = document.createElement("div");
    const isActive = property === input.activeProperty;

    lane.className = "timeline-track-lane";
    labelButton.type = "button";
    labelButton.className = "timeline-track-label";
    labelButton.dataset.timelineProperty = property;
    labelButton.dataset.active = String(isActive);
    labelButton.textContent = getTimelinePropertyLabel(property);
    labelButton.addEventListener("click", () => {
      input.onSelectProperty(property);
    });

    trackBar.className = "timeline-track-bar";
    trackBar.dataset.timelineProperty = property;
    trackBar.dataset.active = String(isActive);
    appendTimelineSnapTicks(trackBar, activeClip, input.animation.snapFps);
    trackBar.addEventListener("click", (event) => {
      input.onTrackClick(property, event);
    });

    const track =
      input.selectedNode && activeClip
        ? input.getTrack(activeClip, input.selectedNode.id, property)
        : null;

    for (const keyframe of track?.keyframes ?? []) {
      const marker = document.createElement("button");
      const left =
        activeClip.durationMs > 0
          ? (keyframe.timeMs / activeClip.durationMs) * 100
          : 0;

      marker.type = "button";
      marker.className = "timeline-keyframe-marker";
      marker.dataset.keyframeId = keyframe.id;
      marker.dataset.selected = String(keyframe.id === input.selectedKeyframeId);
      marker.style.left = `${Math.min(Math.max(left, 0), 100)}%`;
      marker.ariaLabel = `${getTimelinePropertyLabel(property)} keyframe ${keyframe.timeMs} ms`;
      marker.addEventListener("click", (event) => {
        input.onKeyframeClick(property, keyframe.id, keyframe.timeMs, event);
      });
      marker.addEventListener("pointerdown", (event) => {
        input.onKeyframePointerDown(property, keyframe.id, event);
        marker.setPointerCapture(event.pointerId);
      });
      trackBar.append(marker);
    }

    lane.append(labelButton, trackBar);
    return lane;
  });

  input.elements.timelineTrackLanes.replaceChildren(...lanes);
}

function appendTimelineSnapTicks(
  trackBar: HTMLElement,
  activeClip: PrefabAnimationClip,
  snapFps: number,
): void {
  const fragment = document.createDocumentFragment();

  for (const timeMs of getTimelineSnapTickTimes(activeClip, snapFps)) {
    const tick = document.createElement("span");
    const left =
      activeClip.durationMs > 0 ? (timeMs / activeClip.durationMs) * 100 : 0;

    tick.className = "timeline-snap-tick";
    tick.dataset.timeMs = String(timeMs);
    tick.dataset.major = String(
      timeMs === 0 || timeMs === activeClip.durationMs || timeMs % 1000 === 0,
    );
    tick.style.left = `${Math.min(Math.max(left, 0), 100)}%`;
    fragment.append(tick);
  }

  trackBar.append(fragment);
}

function renderTimelineKeyframeEditor(
  input: TimelinePanelRenderInput,
  activeClip: PrefabAnimationClip,
): void {
  const selected = input.getSelectedKeyframe(activeClip);
  const { elements } = input;

  if (!selected || !isPrefabVectorTrack(selected.track)) {
    elements.timelineKeyframeEditor.hidden = true;
    return;
  }

  const keyframe = selected.track.keyframes.find(
    (candidate) => candidate.id === selected.keyframe.id,
  );

  if (!keyframe) {
    elements.timelineKeyframeEditor.hidden = true;
    return;
  }

  elements.timelineKeyframeEditor.hidden = false;
  elements.timelineKeyframeTimeInput.value = String(keyframe.timeMs);
  elements.timelineKeyframeValueXInput.value = formatTransformValue(
    keyframe.value[0],
  );
  elements.timelineKeyframeValueYInput.value = formatTransformValue(
    keyframe.value[1],
  );
  elements.timelineKeyframeValueZInput.value = formatTransformValue(
    keyframe.value[2],
  );
  elements.timelineKeyframeEasingSelect.value = keyframe.easing;
}

function clampTimelineTimeForPanel(
  timeMs: number,
  clip: PrefabAnimationClip | null,
): number {
  if (!clip || !Number.isFinite(timeMs)) {
    return 0;
  }

  return Math.round(Math.min(Math.max(timeMs, 0), clip.durationMs));
}
