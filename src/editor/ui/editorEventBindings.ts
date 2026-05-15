import type { CollapsibleModuleId } from "./collapsibleModules";
import { getModuleCollapseButton } from "./collapsibleModules";
import type { EditorMode } from "../state/editorAppState";
import type { EditorTool } from "../tools/toolController";
import type { getEditorElements } from "./editorDom";

export type EditorEventBindingCallbacks = {
  onToggleCollapsibleModule: (moduleId: CollapsibleModuleId) => void;
  onSetEditorMode: (mode: EditorMode) => void;
  onCreateProject: () => void;
  onDeleteProject: () => void;
  onCreatePrefab: () => void;
  onLoadPrefab: () => void;
  onSavePrefab: () => void;
  onDeletePrefab: () => void;
  onCreatePrefabGroup: () => void;
  onPrefabClipboardPrimary: () => void;
  onPrefabClipboardSecondary: () => void;
  onDeletePrefabNode: () => void;
  onCreateTimelineClip: () => void;
  onDeleteTimelineClip: () => void;
  onPlayTimeline: () => void;
  onPauseTimeline: () => void;
  onStopTimeline: () => void;
  onApplyTimelineTime: () => void;
  onApplyTimelineDuration: () => void;
  onApplyTimelineSnapFps: () => void;
  onApplyTimelineLoop: () => void;
  onScrubTimeline: (timeMs: number) => void;
  onAddTimelineKeyframe: () => void;
  onSnapBaseToTimeline: () => void;
  onApplyTimelineKeyframeTime: () => void;
  onApplyTimelineKeyframeValue: () => void;
  onApplyTimelineKeyframeEasing: () => void;
  onDeleteTimelineKeyframe: () => void;
  onCreateScene: () => void;
  onCloneScene: () => void;
  onLoadScene: () => void;
  onSaveScene: () => void;
  onDeleteScene: () => void;
  onEditPath: () => void;
  onSavePath: () => void;
  onCancelPath: () => void;
  onCreate3DCurve: () => void;
  onImportFile: () => void;
  onAddNode: () => void;
  onAddPrefabInstance: () => void;
  onDeleteAsset: () => void;
  onDeleteSceneNode: () => void;
  onToggleProjection: () => void;
  onSetEditorTool: (tool: EditorTool) => void;
  onResetView: () => void;
};

export function bindEditorUiEvents(input: {
  elements: ReturnType<typeof getEditorElements>;
  collapsibleModuleIds: CollapsibleModuleId[];
  callbacks: EditorEventBindingCallbacks;
}): void {
  const { elements, collapsibleModuleIds, callbacks } = input;

  for (const moduleId of collapsibleModuleIds) {
    const button = getModuleCollapseButton(moduleId);

    button.addEventListener("click", () => {
      callbacks.onToggleCollapsibleModule(moduleId);
    });
  }

  elements.assetModeButton.addEventListener("click", () => {
    callbacks.onSetEditorMode("asset");
  });
  elements.pathModeButton.addEventListener("click", () => {
    callbacks.onSetEditorMode("path");
  });
  elements.sceneModeButton.addEventListener("click", () => {
    callbacks.onSetEditorMode("scene");
  });
  elements.projectForm.addEventListener("submit", (event) => {
    event.preventDefault();
    callbacks.onCreateProject();
  });
  elements.deleteProjectButton.addEventListener("click", () => {
    callbacks.onDeleteProject();
  });
  elements.createPrefabButton.addEventListener("click", () => {
    callbacks.onCreatePrefab();
  });
  elements.loadPrefabButton.addEventListener("click", () => {
    callbacks.onLoadPrefab();
  });
  elements.savePrefabButton.addEventListener("click", () => {
    callbacks.onSavePrefab();
  });
  elements.deletePrefabButton.addEventListener("click", () => {
    callbacks.onDeletePrefab();
  });
  elements.createPrefabGroupButton.addEventListener("click", () => {
    callbacks.onCreatePrefabGroup();
  });
  elements.prefabCopyButton.addEventListener("click", () => {
    callbacks.onPrefabClipboardPrimary();
  });
  elements.prefabCutButton.addEventListener("click", () => {
    callbacks.onPrefabClipboardSecondary();
  });
  elements.deletePrefabNodeButton.addEventListener("click", () => {
    callbacks.onDeletePrefabNode();
  });
  elements.timelineCreateClipButton.addEventListener("click", () => {
    callbacks.onCreateTimelineClip();
  });
  elements.timelineDeleteClipButton.addEventListener("click", () => {
    callbacks.onDeleteTimelineClip();
  });
  elements.timelinePlayButton.addEventListener("click", () => {
    callbacks.onPlayTimeline();
  });
  elements.timelinePauseButton.addEventListener("click", () => {
    callbacks.onPauseTimeline();
  });
  elements.timelineStopButton.addEventListener("click", () => {
    callbacks.onStopTimeline();
  });
  bindBlurAndEnter(elements.timelineTimeInput, callbacks.onApplyTimelineTime);
  bindBlurAndEnter(elements.timelineDurationInput, callbacks.onApplyTimelineDuration);
  bindBlurAndEnter(elements.timelineSnapFpsInput, callbacks.onApplyTimelineSnapFps);
  elements.timelineLoopInput.addEventListener("change", () => {
    callbacks.onApplyTimelineLoop();
  });
  elements.timelineScrubInput.addEventListener("input", () => {
    callbacks.onScrubTimeline(Number(elements.timelineScrubInput.value));
  });
  elements.timelineAddKeyframeButton.addEventListener("click", () => {
    callbacks.onAddTimelineKeyframe();
  });
  elements.timelineSnapBaseButton.addEventListener("click", () => {
    callbacks.onSnapBaseToTimeline();
  });
  bindBlurAndEnter(
    elements.timelineKeyframeTimeInput,
    callbacks.onApplyTimelineKeyframeTime,
  );
  elements.timelineKeyframeValueXInput.addEventListener("blur", () => {
    callbacks.onApplyTimelineKeyframeValue();
  });
  elements.timelineKeyframeValueYInput.addEventListener("blur", () => {
    callbacks.onApplyTimelineKeyframeValue();
  });
  elements.timelineKeyframeValueZInput.addEventListener("blur", () => {
    callbacks.onApplyTimelineKeyframeValue();
  });
  elements.timelineKeyframeEasingSelect.addEventListener("change", () => {
    callbacks.onApplyTimelineKeyframeEasing();
  });
  elements.timelineDeleteKeyframeButton.addEventListener("click", () => {
    callbacks.onDeleteTimelineKeyframe();
  });
  elements.createSceneButton.addEventListener("click", () => {
    callbacks.onCreateScene();
  });
  elements.cloneSceneButton.addEventListener("click", () => {
    callbacks.onCloneScene();
  });
  elements.loadSceneButton.addEventListener("click", () => {
    callbacks.onLoadScene();
  });
  elements.saveSceneButton.addEventListener("click", () => {
    callbacks.onSaveScene();
  });
  elements.deleteSceneButton.addEventListener("click", () => {
    callbacks.onDeleteScene();
  });
  elements.editPathButton.addEventListener("click", () => {
    callbacks.onEditPath();
  });
  elements.savePathButton.addEventListener("click", () => {
    callbacks.onSavePath();
  });
  elements.cancelPathButton.addEventListener("click", () => {
    callbacks.onCancelPath();
  });
  elements.create3DCurveButton.addEventListener("click", () => {
    callbacks.onCreate3DCurve();
  });
  elements.fileInput.addEventListener("change", () => {
    callbacks.onImportFile();
  });
  elements.addNodeButton.addEventListener("click", () => {
    callbacks.onAddNode();
  });
  elements.addPrefabInstanceButton.addEventListener("click", () => {
    callbacks.onAddPrefabInstance();
  });
  elements.deleteAssetButton.addEventListener("click", () => {
    callbacks.onDeleteAsset();
  });
  elements.deleteSceneNodeButton.addEventListener("click", () => {
    callbacks.onDeleteSceneNode();
  });
  elements.projectionToggleButton.addEventListener("click", () => {
    callbacks.onToggleProjection();
  });
  elements.transformTranslateButton.addEventListener("click", () => {
    callbacks.onSetEditorTool("translate");
  });
  elements.transformRotateButton.addEventListener("click", () => {
    callbacks.onSetEditorTool("rotate");
  });
  elements.transformScaleButton.addEventListener("click", () => {
    callbacks.onSetEditorTool("scale");
  });
  elements.transformPathButton.addEventListener("click", () => {
    callbacks.onSetEditorTool("path");
  });
  elements.resetViewButton.addEventListener("click", () => {
    callbacks.onResetView();
  });
}

function bindBlurAndEnter(input: HTMLInputElement, onApply: () => void): void {
  input.addEventListener("blur", () => {
    onApply();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      input.blur();
    }
  });
}
