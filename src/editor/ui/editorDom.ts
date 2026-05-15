export type EditorElements = {
  assetModeButton: HTMLButtonElement;
  pathModeButton: HTMLButtonElement;
  sceneModeButton: HTMLButtonElement;
  assetModePanel: HTMLElement;
  pathModePanel: HTMLElement;
  sceneModePanel: HTMLElement;
  projectForm: HTMLFormElement;
  projectNameInput: HTMLInputElement;
  projectList: HTMLUListElement;
  deleteProjectButton: HTMLButtonElement;
  prefabNameInput: HTMLInputElement;
  prefabList: HTMLUListElement;
  createPrefabButton: HTMLButtonElement;
  loadPrefabButton: HTMLButtonElement;
  savePrefabButton: HTMLButtonElement;
  deletePrefabButton: HTMLButtonElement;
  prefabNodeList: HTMLUListElement;
  createPrefabGroupButton: HTMLButtonElement;
  prefabCopyButton: HTMLButtonElement;
  prefabCutButton: HTMLButtonElement;
  deletePrefabNodeButton: HTMLButtonElement;
  prefabTimelinePanel: HTMLElement;
  timelineClipNameInput: HTMLInputElement;
  timelineCreateClipButton: HTMLButtonElement;
  timelineClipList: HTMLUListElement;
  timelineDeleteClipButton: HTMLButtonElement;
  timelinePlayButton: HTMLButtonElement;
  timelinePauseButton: HTMLButtonElement;
  timelineStopButton: HTMLButtonElement;
  timelineTimeInput: HTMLInputElement;
  timelineDurationInput: HTMLInputElement;
  timelineSnapFpsInput: HTMLInputElement;
  timelineLoopInput: HTMLInputElement;
  timelineScrubInput: HTMLInputElement;
  timelineTrackLanes: HTMLDivElement;
  timelineAddKeyframeButton: HTMLButtonElement;
  timelineSnapBaseButton: HTMLButtonElement;
  timelineStatus: HTMLSpanElement;
  timelineKeyframeEditor: HTMLDivElement;
  timelineKeyframeTimeInput: HTMLInputElement;
  timelineKeyframeValueXInput: HTMLInputElement;
  timelineKeyframeValueYInput: HTMLInputElement;
  timelineKeyframeValueZInput: HTMLInputElement;
  timelineKeyframeEasingSelect: HTMLSelectElement;
  timelineDeleteKeyframeButton: HTMLButtonElement;
  sceneNameInput: HTMLInputElement;
  sceneList: HTMLUListElement;
  createSceneButton: HTMLButtonElement;
  cloneSceneButton: HTMLButtonElement;
  loadSceneButton: HTMLButtonElement;
  saveSceneButton: HTMLButtonElement;
  deleteSceneButton: HTMLButtonElement;
  fileInput: HTMLInputElement;
  createViewMorphProfileButton: HTMLButtonElement;
  assetList: HTMLUListElement;
  pathAssetList: HTMLUListElement;
  editPathButton: HTMLButtonElement;
  create3DCurveButton: HTMLButtonElement;
  savePathButton: HTMLButtonElement;
  cancelPathButton: HTMLButtonElement;
  pathEditFields: HTMLDivElement;
  addNodeButton: HTMLButtonElement;
  addPrefabInstanceButton: HTMLButtonElement;
  deleteAssetButton: HTMLButtonElement;
  sceneNodeList: HTMLUListElement;
  deleteSceneNodeButton: HTMLButtonElement;
  projectionToggleButton: HTMLButtonElement;
  transformTranslateButton: HTMLButtonElement;
  transformRotateButton: HTMLButtonElement;
  transformScaleButton: HTMLButtonElement;
  transformPathButton: HTMLButtonElement;
  resetViewButton: HTMLButtonElement;
  importError: HTMLParagraphElement;
  inspectorFields: HTMLDListElement;
};

export function getEditorElements(): EditorElements {
  return {
    assetModeButton: getRequiredElement("asset-mode-button", HTMLButtonElement),
    pathModeButton: getRequiredElement("path-mode-button", HTMLButtonElement),
    sceneModeButton: getRequiredElement("scene-mode-button", HTMLButtonElement),
    assetModePanel: getRequiredElement("asset-mode-panel", HTMLElement),
    pathModePanel: getRequiredElement("path-mode-panel", HTMLElement),
    sceneModePanel: getRequiredElement("scene-mode-panel", HTMLElement),
    projectForm: getRequiredElement("project-form", HTMLFormElement),
    projectNameInput: getRequiredElement("project-name-input", HTMLInputElement),
    projectList: getRequiredElement("project-list", HTMLUListElement),
    deleteProjectButton: getRequiredElement(
      "delete-project-button",
      HTMLButtonElement,
    ),
    prefabNameInput: getRequiredElement("prefab-name-input", HTMLInputElement),
    prefabList: getRequiredElement("prefab-list", HTMLUListElement),
    createPrefabButton: getRequiredElement(
      "create-prefab-button",
      HTMLButtonElement,
    ),
    loadPrefabButton: getRequiredElement("load-prefab-button", HTMLButtonElement),
    savePrefabButton: getRequiredElement("save-prefab-button", HTMLButtonElement),
    deletePrefabButton: getRequiredElement(
      "delete-prefab-button",
      HTMLButtonElement,
    ),
    prefabNodeList: getRequiredElement("prefab-node-list", HTMLUListElement),
    createPrefabGroupButton: getRequiredElement(
      "create-prefab-group-button",
      HTMLButtonElement,
    ),
    deletePrefabNodeButton: getRequiredElement(
      "delete-prefab-node-button",
      HTMLButtonElement,
    ),
    prefabCopyButton: getRequiredElement("prefab-copy-button", HTMLButtonElement),
    prefabCutButton: getRequiredElement("prefab-cut-button", HTMLButtonElement),
    prefabTimelinePanel: getRequiredElement("prefab-timeline-panel", HTMLElement),
    timelineClipNameInput: getRequiredElement(
      "timeline-clip-name-input",
      HTMLInputElement,
    ),
    timelineCreateClipButton: getRequiredElement(
      "timeline-create-clip-button",
      HTMLButtonElement,
    ),
    timelineClipList: getRequiredElement(
      "timeline-clip-list",
      HTMLUListElement,
    ),
    timelineDeleteClipButton: getRequiredElement(
      "timeline-delete-clip-button",
      HTMLButtonElement,
    ),
    timelinePlayButton: getRequiredElement(
      "timeline-play-button",
      HTMLButtonElement,
    ),
    timelinePauseButton: getRequiredElement(
      "timeline-pause-button",
      HTMLButtonElement,
    ),
    timelineStopButton: getRequiredElement(
      "timeline-stop-button",
      HTMLButtonElement,
    ),
    timelineTimeInput: getRequiredElement(
      "timeline-time-input",
      HTMLInputElement,
    ),
    timelineDurationInput: getRequiredElement(
      "timeline-duration-input",
      HTMLInputElement,
    ),
    timelineSnapFpsInput: getRequiredElement(
      "timeline-snap-fps-input",
      HTMLInputElement,
    ),
    timelineLoopInput: getRequiredElement(
      "timeline-loop-input",
      HTMLInputElement,
    ),
    timelineScrubInput: getRequiredElement(
      "timeline-scrub-input",
      HTMLInputElement,
    ),
    timelineTrackLanes: getRequiredElement(
      "timeline-track-lanes",
      HTMLDivElement,
    ),
    timelineAddKeyframeButton: getRequiredElement(
      "timeline-add-keyframe-button",
      HTMLButtonElement,
    ),
    timelineSnapBaseButton: getRequiredElement(
      "timeline-snap-base-button",
      HTMLButtonElement,
    ),
    timelineStatus: getRequiredElement("timeline-status", HTMLSpanElement),
    timelineKeyframeEditor: getRequiredElement(
      "timeline-keyframe-editor",
      HTMLDivElement,
    ),
    timelineKeyframeTimeInput: getRequiredElement(
      "timeline-keyframe-time-input",
      HTMLInputElement,
    ),
    timelineKeyframeValueXInput: getRequiredElement(
      "timeline-keyframe-value-x-input",
      HTMLInputElement,
    ),
    timelineKeyframeValueYInput: getRequiredElement(
      "timeline-keyframe-value-y-input",
      HTMLInputElement,
    ),
    timelineKeyframeValueZInput: getRequiredElement(
      "timeline-keyframe-value-z-input",
      HTMLInputElement,
    ),
    timelineKeyframeEasingSelect: getRequiredElement(
      "timeline-keyframe-easing-select",
      HTMLSelectElement,
    ),
    timelineDeleteKeyframeButton: getRequiredElement(
      "timeline-delete-keyframe-button",
      HTMLButtonElement,
    ),
    sceneNameInput: getRequiredElement("scene-name-input", HTMLInputElement),
    sceneList: getRequiredElement("scene-list", HTMLUListElement),
    createSceneButton: getRequiredElement(
      "create-scene-button",
      HTMLButtonElement,
    ),
    cloneSceneButton: getRequiredElement(
      "clone-scene-button",
      HTMLButtonElement,
    ),
    loadSceneButton: getRequiredElement("load-scene-button", HTMLButtonElement),
    saveSceneButton: getRequiredElement("save-scene-button", HTMLButtonElement),
    deleteSceneButton: getRequiredElement(
      "delete-scene-button",
      HTMLButtonElement,
    ),
    fileInput: getRequiredElement("svg-file-input", HTMLInputElement),
    createViewMorphProfileButton: getRequiredElement(
      "create-view-morph-profile-button",
      HTMLButtonElement,
    ),
    assetList: getRequiredElement("asset-list", HTMLUListElement),
    pathAssetList: getRequiredElement("path-asset-list", HTMLUListElement),
    editPathButton: getRequiredElement("edit-path-button", HTMLButtonElement),
    create3DCurveButton: getRequiredElement(
      "create-3d-curve-button",
      HTMLButtonElement,
    ),
    savePathButton: getRequiredElement("save-path-button", HTMLButtonElement),
    cancelPathButton: getRequiredElement("cancel-path-button", HTMLButtonElement),
    pathEditFields: getRequiredElement("path-edit-fields", HTMLDivElement),
    addNodeButton: getRequiredElement("add-node-button", HTMLButtonElement),
    addPrefabInstanceButton: getRequiredElement(
      "add-prefab-instance-button",
      HTMLButtonElement,
    ),
    deleteAssetButton: getRequiredElement(
      "delete-asset-button",
      HTMLButtonElement,
    ),
    sceneNodeList: getRequiredElement("scene-node-list", HTMLUListElement),
    deleteSceneNodeButton: getRequiredElement(
      "delete-scene-node-button",
      HTMLButtonElement,
    ),
    projectionToggleButton: getRequiredElement(
      "projection-toggle-button",
      HTMLButtonElement,
    ),
    transformTranslateButton: getRequiredElement(
      "transform-translate-button",
      HTMLButtonElement,
    ),
    transformRotateButton: getRequiredElement(
      "transform-rotate-button",
      HTMLButtonElement,
    ),
    transformScaleButton: getRequiredElement(
      "transform-scale-button",
      HTMLButtonElement,
    ),
    transformPathButton: getRequiredElement("transform-path-button", HTMLButtonElement),
    resetViewButton: getRequiredElement("reset-view-button", HTMLButtonElement),
    importError: getRequiredElement("import-error", HTMLParagraphElement),
    inspectorFields: getRequiredElement("inspector-fields", HTMLDListElement),
  };
}

function getRequiredElement<T extends HTMLElement>(
  id: string,
  constructor: new () => T,
): T {
  const element = document.getElementById(id);

  if (!(element instanceof constructor)) {
    throw new Error(`Expected #${id} to be ${constructor.name}.`);
  }

  return element;
}
