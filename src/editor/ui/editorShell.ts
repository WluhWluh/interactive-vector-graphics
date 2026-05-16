import type { EditorElements } from "./editorDom";
import type { EditorTool } from "../tools/toolController";
import type { PrefabTrackProperty } from "../api";
import type { PrimitiveSvgAsset } from "../../core/assets/primitiveAssetTypes";
import { getPrimitiveAssetCapabilities } from "../../core/assets/primitiveAssetCapabilities";

export type EditorShellMode = "asset" | "path" | "scene";

export type EditorShellRenderInput = {
  elements: EditorElements;
  mode: EditorShellMode;
  selectedProjectId: string | null;
  selectedAssetId: string | null;
  selectedAsset: PrimitiveSvgAsset | null;
  selectedPrefabId: string | null;
  selectedSceneId: string | null;
  selectedSceneNodeId: string | null;
  selectedPrefabNodeId: string | null;
  prefabRootNodeId: string;
  pendingPrefabClipboard: boolean;
  hasPathEditSession: boolean;
  hasPathEdit3DSession: boolean;
  hasViewMorphProfileEditSession: boolean;
  hasValidInPlacePathEditSession: boolean;
  activeTimelineClip: { durationMs: number } | null;
  timelineCurrentTimeMs: number;
  isTimelinePlaying: boolean;
  activeTimelineProperty: PrefabTrackProperty;
  currentProjection: "perspective" | "orthographic";
  canConvertSelectedAssetTo3DCurve: boolean;
  activeEditorTool: EditorTool;
  canUseTool: (tool: EditorTool) => boolean;
  renderProjectList: () => void;
  renderAssetList: () => void;
  renderPathAssetList: () => void;
  renderPrefabList: () => void;
  renderPrefabNodeList: () => void;
  renderPrefabTimeline: () => void;
  renderSceneList: () => void;
  renderSceneNodeList: () => void;
  renderSourcePathEditPanel: () => void;
  renderInspector: () => void;
  renderCollapsibleModules: () => void;
};

export function renderEditorShellFrame(input: EditorShellRenderInput): void {
  input.renderProjectList();
  input.renderAssetList();
  input.renderPathAssetList();
  input.renderPrefabList();
  input.renderPrefabNodeList();
  input.renderPrefabTimeline();
  input.renderSceneList();
  input.renderSceneNodeList();
  input.renderSourcePathEditPanel();
  input.renderInspector();
  input.renderCollapsibleModules();
  syncEditorShellChrome(input);
}

function syncEditorShellChrome(input: EditorShellRenderInput): void {
  const { elements } = input;

  elements.assetModePanel.hidden = input.mode !== "asset";
  elements.pathModePanel.hidden = input.mode !== "path";
  elements.sceneModePanel.hidden = input.mode !== "scene";
  elements.assetModeButton.dataset.selected = String(input.mode === "asset");
  elements.pathModeButton.dataset.selected = String(input.mode === "path");
  elements.sceneModeButton.dataset.selected = String(input.mode === "scene");
  document.body.dataset.pathEditActive = String(
    input.mode === "path" && input.hasPathEditSession,
  );
  document.body.dataset.pathEdit3dActive = String(
    input.mode === "path" && input.hasPathEdit3DSession,
  );
  document.body.dataset.viewMorphProfileEditActive = String(
    input.mode === "path" && input.hasViewMorphProfileEditSession,
  );
  document.body.dataset.inPlacePathEditActive = String(
    input.hasValidInPlacePathEditSession,
  );

  elements.fileInput.disabled = !input.selectedProjectId;
  elements.createViewMorphProfileButton.disabled = !input.selectedProjectId;
  elements.deleteProjectButton.disabled = !input.selectedProjectId;
  elements.prefabNameInput.disabled = !input.selectedProjectId;
  elements.createPrefabButton.disabled = !input.selectedProjectId;
  elements.loadPrefabButton.disabled =
    !input.selectedProjectId || !input.selectedPrefabId;
  elements.savePrefabButton.disabled =
    !input.selectedProjectId || !input.selectedPrefabId;
  elements.deletePrefabButton.disabled =
    !input.selectedProjectId || !input.selectedPrefabId;
  elements.createPrefabGroupButton.disabled = !input.selectedProjectId;

  const selectedRealPrefabNode =
    input.selectedPrefabNodeId !== null &&
    input.selectedPrefabNodeId !== input.prefabRootNodeId;
  elements.deletePrefabNodeButton.disabled = !selectedRealPrefabNode;
  elements.prefabCopyButton.textContent = input.pendingPrefabClipboard
    ? "Paste"
    : "Copy";
  elements.prefabCutButton.textContent = input.pendingPrefabClipboard
    ? "Cancel"
    : "Cut";
  elements.prefabCopyButton.disabled = input.pendingPrefabClipboard
    ? !input.selectedPrefabNodeId
    : !selectedRealPrefabNode;
  elements.prefabCutButton.disabled = input.pendingPrefabClipboard
    ? false
    : !selectedRealPrefabNode;

  elements.prefabTimelinePanel.hidden = input.mode !== "asset";
  elements.timelineClipNameInput.disabled = !input.selectedProjectId;
  elements.timelineCreateClipButton.disabled = !input.selectedProjectId;
  elements.timelineDeleteClipButton.disabled = !input.activeTimelineClip;
  elements.timelinePlayButton.disabled =
    !input.activeTimelineClip || input.activeTimelineClip.durationMs <= 0;
  elements.timelinePauseButton.disabled = !input.isTimelinePlaying;
  elements.timelineStopButton.disabled =
    !input.activeTimelineClip && input.timelineCurrentTimeMs === 0;
  elements.timelineTimeInput.disabled = !input.activeTimelineClip;
  elements.timelineDurationInput.disabled = !input.activeTimelineClip;
  elements.timelineSnapFpsInput.disabled = !input.selectedProjectId;
  elements.timelineLoopInput.disabled = !input.activeTimelineClip;
  elements.timelineScrubInput.disabled = !input.activeTimelineClip;
  elements.timelineAddKeyframeButton.disabled =
    !input.activeTimelineClip ||
    !selectedRealPrefabNode ||
    (input.activeTimelineProperty === "path" &&
      !input.hasValidInPlacePathEditSession);
  elements.timelineSnapBaseButton.disabled =
    !input.activeTimelineClip || !selectedRealPrefabNode;

  elements.sceneNameInput.disabled = !input.selectedProjectId;
  elements.createSceneButton.disabled = !input.selectedProjectId;
  elements.cloneSceneButton.disabled = !input.selectedProjectId;
  elements.loadSceneButton.disabled =
    !input.selectedProjectId || !input.selectedSceneId;
  elements.saveSceneButton.disabled =
    !input.selectedProjectId || !input.selectedSceneId;
  elements.deleteSceneButton.disabled =
    !input.selectedProjectId || !input.selectedSceneId;
  elements.addNodeButton.disabled =
    !input.selectedProjectId || !input.selectedAssetId;
  elements.addPrefabInstanceButton.disabled =
    !input.selectedProjectId || !input.selectedPrefabId;
  elements.deleteAssetButton.disabled =
    !input.selectedProjectId || !input.selectedAssetId;
  elements.deleteSceneNodeButton.disabled = !input.selectedSceneNodeId;
  elements.editPathButton.disabled =
    !input.selectedProjectId ||
    !input.selectedAssetId ||
    !input.selectedAsset ||
    !getPrimitiveAssetCapabilities(input.selectedAsset).canSourcePathEdit;
  elements.create3DCurveButton.disabled =
    !input.selectedProjectId || !input.canConvertSelectedAssetTo3DCurve;
  elements.savePathButton.disabled =
    !input.hasPathEditSession &&
    !input.hasPathEdit3DSession &&
    !input.hasViewMorphProfileEditSession;
  elements.cancelPathButton.disabled =
    !input.hasPathEditSession &&
    !input.hasPathEdit3DSession &&
    !input.hasViewMorphProfileEditSession;
  elements.projectionToggleButton.textContent =
    input.currentProjection === "perspective" ? "Perspective" : "Orthographic";

  syncToolButtonState(input, elements.transformTranslateButton, "translate");
  syncToolButtonState(input, elements.transformRotateButton, "rotate");
  syncToolButtonState(input, elements.transformScaleButton, "scale");
  syncToolButtonState(input, elements.transformPathButton, "path");
}

function syncToolButtonState(
  input: EditorShellRenderInput,
  button: HTMLButtonElement,
  tool: EditorTool,
): void {
  button.disabled = !input.canUseTool(tool);
  button.dataset.selected = String(input.activeEditorTool === tool);
}
