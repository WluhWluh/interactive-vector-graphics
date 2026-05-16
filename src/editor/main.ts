import "../styles.css";
import { Matrix4, Vector3 } from "three";
import type { PrimitiveSvgAsset } from "../core/assets/primitiveAssetTypes";
import {
  canConvertPrimitiveAssetTo3DCurve,
  canKeyframePrimitiveAssetPath,
  primitiveAssetHas3DSourcePath,
  primitiveAssetUsesStrokeStyle,
} from "../core/assets/primitiveAssetCapabilities";
import {
  cloneStructuredBezierPath,
  type BezierPoint,
  type BezierSegment,
  type StructuredBezierPath,
} from "../core/assets/structuredBezierPath";
import { CanvasStage } from "../core/stage/canvasStage";
import {
  drawCenteredStatus,
  drawPrimitivePreview,
} from "../core/stage/primitivePreview";
import {
  drawProjectedCurveCommands,
  projectBezierPath3DToCommands,
  type ProjectedCurveCommand,
} from "../core/assets/projectedBezier3d";
import {
  cloneStructuredBezierPath3D,
  type BezierPoint3D,
  type BezierSegment3D,
  type StructuredBezierPath3D,
} from "../core/assets/structuredBezierPath3d";
import {
  smoothViewMorphPolylineToBezierPath,
} from "../core/assets/viewMorphProfile";
import { structuredBezierToPathD } from "../core/assets/structuredBezierPath";
import {
  createPrefab,
  convertAssetTo3DCurve,
  createProject,
  createScene,
  createViewMorphProfileAsset,
  deleteAsset,
  deletePrefab,
  deleteProject,
  deleteScene,
  getPrefab,
  getScene,
  listAssets,
  listPrefabs,
  listProjects,
  listScenes,
  savePrefab,
  saveScene,
  updateAssetPath,
  updateAssetCurve3D,
  updateViewMorphProfile,
  uploadAsset,
  type PrefabAnimation,
  type PrefabAnimationClip,
  type PrefabAnimationTrack,
  type PrefabPathAnimationKeyframe,
  type PrefabVectorAnimationKeyframe,
  type PrefabTrackProperty,
  type PrefabDocument,
  type PrefabNode,
  type PrefabRecord,
  type ProjectRecord,
  type SceneDocument,
  type SceneNode,
  type SceneRecord,
} from "./api";
import {
  getPathEditComponentPoint,
  getPathEditSegment,
  getSelectedPathEditSegment,
  roundBezierValue,
  type PathEditComponent,
  type PathEditControl,
  type PathEditScreenControl,
  type PathEditSession,
  type PathEditViewportAdapter,
} from "./tools/pathEditCore";
import { applyPathEditCommand } from "./tools/pathEditCommands";
import {
  ThreeEditorViewport,
  tupleToVector,
  vectorToTuple,
  type Curve3DControlDescriptor,
  type EditorTransformNode,
  type TransformMode,
  type Vector3Tuple,
} from "./threeEditorViewport";
import {
  cloneTransform,
  type TransformSnapshot,
} from "./tools/prefabTransform";
import {
  clonePrefabAnimation,
  clonePrefabAnimationClip,
  clonePrefabAnimationTrack,
  clampTimelineTimeMs,
  isPrefabVectorTrack,
  snapAndClampTimelineTimeMs as snapAndClampTimelineTimeMsWithFps,
} from "./timeline/prefabTimelineCore";
import {
  TimelineStagingPoseStore,
  type TimelineStagingPose,
  type TimelineStagingPruneOptions,
} from "./timeline/stagingPose";
import {
  formatTransformValue,
  roundTimelineNumber,
  roundTransformValue,
} from "./tools/editorUtils";
import {
  buildPathEditPathD,
  getAssetKindListLabel,
} from "./render/primitiveAssetDrawing";
import {
  drawBillboards as drawBillboardsWithRenderer,
  type BillboardRendererContext,
  type DrawableBillboard,
} from "./render/billboardRenderer";
import { BillboardFrameDataCache } from "./render/billboardFrameData";
import { renderEditorFrame } from "./render/editorFrameRenderer";
import { createEditorRenderCache } from "./render/editorRenderCache";
import {
  applyViewportTransformToPrefabNode,
  applyViewportTransformToStagingPose,
  createAssetViewportProxyNodes,
  createPrefabWorldProxyNodes,
  createSceneViewportProxyNodes,
} from "./render/viewportProxySync";
import {
  drawPathEditControls,
  drawPathEditPreview,
  drawViewMorphProfileEditControls,
  type SourcePathEditViewTransform,
} from "./render/pathEditDrawing";
import { renderTimelinePanel } from "./ui/timelinePanel";
import { installEditorDebugHooks } from "./debug/editorDebugHooks";
import { createEditorRenderLoop } from "./runtime/editorRenderLoop";
import {
  appendAssetInspectorRows as appendAssetInspectorRowsForUi,
  appendInspectorActionRow as appendInspectorActionRowForUi,
  appendInspectorRow as appendInspectorRowForUi,
  appendPathEditInspectorInputRow as appendPathEditInspectorInputRowForUi,
  appendTransformInspectorRow as appendTransformInspectorRowForUi,
  appendVector3InspectorRow as appendVector3InspectorRowForUi,
  createPathEdit3DPointInputRow as createPathEdit3DPointInputRowForUi,
  createPathEditPointInputRow as createPathEditPointInputRowForUi,
} from "./ui/inspector";
import {
  createAssetModeInspectorModel,
  createInspectorHeaderModel,
  createSceneModeInspectorModel,
} from "./ui/inspectorModel";
import { renderEditorShellFrame } from "./ui/editorShell";
import {
  clonePathOverrideForNode,
  evaluatePrefabPose,
  getSelectedTimelineStagingPose as getSelectedTimelineStagingPoseFromLayers,
  getSelectedTimelineStagingTransform as getSelectedTimelineStagingTransformFromLayers,
  getStagingWorldTransform,
} from "./pose/prefabPose";
import {
  getPrefabPosePropertyAdapter,
  isPathPosePropertyAdapter,
  isVectorPosePropertyAdapter,
} from "./pose/prefabPoseProperties";
import {
  clonePrefabNode,
  cloneSceneNode,
  getPrefabNodeTreeEntries as getPrefabNodeTreeEntriesFromNodes,
  type PrefabNodeTreeEntry,
} from "./state/documentNodes";
import {
  applyPrefabDocumentState,
  createEmptyPrefabAnimation as createEmptyPrefabAnimationState,
  createPrefabDocument,
} from "./state/prefabState";
import {
  applySceneDocumentState,
  createEmptySceneDocument as createEmptySceneDocumentState,
  createSceneDocument,
} from "./state/sceneState";
import {
  createEditorAppStateStore,
  createInitialEditorAppState,
  type EditorMode,
} from "./state/editorAppState";
import {
  dispatchEditorCommand,
  type EditorCommand,
  type EditorCommandResult,
} from "./state/editorCommand";
import {
  findRecordById,
  getNodeById,
  getPrefabDocumentById as getPrefabDocumentByIdFromState,
  getSelectedAsset as getSelectedAssetFromState,
  getSelectedPrefab as getSelectedPrefabFromState,
  getSelectedProject as getSelectedProjectFromState,
  getSelectedScene as getSelectedSceneFromState,
} from "./state/projectState";
import { getEditorElements } from "./ui/editorDom";
import {
  COLLAPSIBLE_MODULE_IDS,
  readCollapsedModuleCookie,
  renderCollapsibleModules as renderCollapsibleModulesForState,
  writeCollapsedModuleCookie,
  type CollapsibleModuleId,
} from "./ui/collapsibleModules";
import { bindEditorUiEvents } from "./ui/editorEventBindings";
import {
  getPathEdit3DComponentPoint,
  getPathEdit3DSegment,
  getSelectedPathEdit3DSegment,
  getSourcePathEdit3DControlId,
  parseSourcePathEdit3DControlId,
  subtractBezierPoints3D,
  type SourcePathEdit3DSession,
} from "./tools/pathEdit3dCore";
import {
  canUsePathToolForSelection,
  getToolDefinition,
  getEditorToolForTimelineProperty,
  getFallbackTransformTool,
  getTimelinePropertyForEditorTool,
  TIMELINE_LANE_PROPERTIES,
  TRANSFORM_TOOL_DEFINITIONS,
  type EditorTool,
  type TransformProperty,
} from "./tools/toolController";
import {
  addPrimitiveAssetToPrefab,
  applyDeletedPrefabDocument,
  applyLoadedPrefabDocument,
  applySavedPrefabDocument,
  clearInvalidPrefabClipboard as clearInvalidPrefabClipboardForState,
  createPrefabGroupNode,
  deletePrefabNodeSubtree,
  pastePrefabClipboard,
  runCreatePrefabCommand,
  runDeletePrefabCommand,
  runLoadPrefabCommand,
  runSavePrefabCommand,
  startPrefabClipboard,
  type PrefabClipboardMode,
} from "./controllers/prefabAssemblyController";
import {
  createEmptyProjectWorkspaceState,
} from "./controllers/projectDataController";
import {
  applyDeletedAsset,
  applyImportedAsset,
  applyUpdatedAsset,
  runCreateViewMorphProfileAssetCommand,
  runConvertAssetTo3DCurveCommand,
  runDeleteAssetCommand,
  runImportPrimitiveAssetCommand,
  runSaveSourcePathEditCommand,
} from "./controllers/assetCommandController";
import {
  addPrefabInstanceToScene,
  applyDeletedSceneDocument,
  applyLoadedSceneDocument,
  applySavedSceneDocument,
  cachePrefabDocumentForScene,
  deleteSceneNodeById,
  runCreateSceneCommand,
  runDeleteSceneCommand,
  runLoadSceneCommand,
  runSaveSceneCommand,
} from "./controllers/sceneCommandController";
import {
  readRequiredInputValue,
  requireCommandValue,
} from "./controllers/editorCommandController";
import { planEditorModeChange } from "./controllers/editorModeController";
import {
  getPrefabNodeSelectionSync,
  getSceneNodeSelectionSync,
  shouldClearRootPrefabAssetSelection,
} from "./controllers/selectionController";
import { bindViewportInteractions } from "./controllers/viewportInteractionController";
import {
  createInPlacePathEditDebugState,
  createSourcePathEditDebugState,
} from "./controllers/pathEditDebugController";
import {
  createInPlacePathEditSession as createInPlacePathEditSessionForState,
  getInPlacePathEditScreenControls as getInPlacePathEditScreenControlsForState,
  isInPlacePathEditSessionValid,
  type InPlacePathEditSession,
} from "./controllers/inPlacePathEditController";
import {
  clearSourcePathEditState,
  getSourcePathEditScreenControls,
  startSourcePathEditState,
} from "./controllers/sourcePathEditController";
import {
  getSourcePathEdit3DControls as getSourcePathEdit3DControlsForState,
  getSourcePathEdit3DHandleLines as getSourcePathEdit3DHandleLinesForState,
} from "./controllers/sourcePathEdit3DController";
import {
  dragPathEditSessionAtPoint,
  findPathEditControlAtPoint,
  getRestoredPathEditSelection,
  pathEditSelectionsEqual,
  selectPathEditSessionControl,
  toPathEditSelection,
} from "./controllers/pathEditSessionControls";
import {
  dragViewMorphProfileEditControl,
  findNearestViewMorphProfileEditControl,
  getSelectedViewMorphProfilePoint,
  getViewMorphProfileEditPlaneRefs,
  getViewMorphProfileEditPath,
  getViewMorphProfileEditScreenControls,
  selectViewMorphProfileEditControl,
  setViewMorphProfileEditPlane,
  setViewMorphProfilePointAxisValue,
  toViewMorphProfileEditSelection,
  viewMorphProfileEditSelectionsEqual,
  type ViewMorphProfileEditControl,
  type ViewMorphProfileEditViewportAdapter,
} from "./tools/viewMorphProfileEditCore";
import {
  advanceTimelinePlayback,
  createTimelineClipCommand,
  deleteActiveTimelineClipCommand,
  deleteTimelineKeyframe,
  getActiveTimelineClip as getActiveTimelineClipFromState,
  getSelectedTimelineKeyframe as getSelectedTimelineKeyframeFromState,
  parseTimelineDurationInput,
  parseTimelineEasingInput,
  parseTimelineSnapFpsInput,
  parseVectorKeyframeValueInput,
  pauseTimelineCommand,
  playTimelineCommand,
  scrubTimelineCommand,
  selectBasePoseTimelineCommand,
  selectTimelineClipCommand,
  stopTimelineCommand,
  updateActiveTimelineClip as updateActiveTimelineClipForState,
  updateTimelineKeyframe,
  upsertPrefabPathKeyframe,
  upsertPrefabVectorKeyframe,
} from "./controllers/timelineController";
import {
  loadAssetRecords,
  loadPrefabRecords,
  loadProjectRecords,
  loadSceneRecords,
} from "./workflows/projectWorkspaceWorkflow";

type SceneCreateSource = "empty" | "current";
const PREFAB_ROOT_NODE_ID = "__prefab-root__";
const DEFAULT_PREFAB_SNAP_FPS = 10;
const DEFAULT_TIMELINE_DURATION_MS = 1000;
const PATH_EDIT_HIT_RADIUS = 10;

const stage = new CanvasStage(["vector-canvas", "paper-canvas"]);
const threeViewport = new ThreeEditorViewport();
const elements = getEditorElements();
let collapsedModuleIds = readCollapsedModuleCookie();
const billboardFrameDataCache = new BillboardFrameDataCache({
  getAssetById,
  getPrefabDocumentById,
  getOrCreateTimelineStagingPose,
});
const renderCache = createEditorRenderCache(billboardFrameDataCache);
const initialAppState = createInitialEditorAppState({
  rootPrefabNodeId: PREFAB_ROOT_NODE_ID,
  defaultPrefabSnapFps: DEFAULT_PREFAB_SNAP_FPS,
});
const appStateStore = createEditorAppStateStore(initialAppState);
const editorState = appStateStore.getMutableState();

let pendingCameraInspectorRender = false;
const renderLoop = createEditorRenderLoop({
  updateTimelinePlayback,
  renderPreviewFrame,
});

stage.getLayer("vector-canvas").canvas.dataset.visualCheck = "editor-ready";
bindEditorEvents();
void refreshProjects();
renderLoop.start();
renderEditorShell();
exposeEditorDebugHooks();

function bindEditorEvents(): void {
  bindEditorUiEvents({
    elements,
    collapsibleModuleIds: COLLAPSIBLE_MODULE_IDS,
    callbacks: {
      onToggleCollapsibleModule: toggleCollapsibleModule,
      onSetEditorMode: setEditorMode,
      onCreateProject: () => void createProjectFromInput(),
      onDeleteProject: () => void deleteSelectedProject(),
      onCreatePrefab: () => void createPrefabFromInput(),
      onLoadPrefab: () => void loadSelectedPrefab(),
      onSavePrefab: () => void saveSelectedPrefab(),
      onDeletePrefab: () => void deleteSelectedPrefab(),
      onCreatePrefabGroup: createPrefabGroup,
      onPrefabClipboardPrimary: handlePrefabClipboardPrimaryAction,
      onPrefabClipboardSecondary: handlePrefabClipboardSecondaryAction,
      onDeletePrefabNode: deleteSelectedPrefabNode,
      onCreateTimelineClip: createTimelineClipFromInput,
      onDeleteTimelineClip: deleteSelectedTimelineClip,
      onPlayTimeline: playTimeline,
      onPauseTimeline: pauseTimeline,
      onStopTimeline: stopTimeline,
      onApplyTimelineTime: applyTimelineTimeInput,
      onApplyTimelineDuration: applyTimelineDurationInput,
      onApplyTimelineSnapFps: applyTimelineSnapFpsInput,
      onApplyTimelineLoop: applyTimelineLoopInput,
      onScrubTimeline: scrubTimelineTo,
      onAddTimelineKeyframe: addKeyframeForSelectedPrefabNode,
      onSnapBaseToTimeline: snapSelectedPrefabBaseToTimeline,
      onApplyTimelineKeyframeTime: applySelectedKeyframeTimeInput,
      onApplyTimelineKeyframeValue: applySelectedKeyframeValueInput,
      onApplyTimelineKeyframeEasing: applySelectedKeyframeEasingInput,
      onDeleteTimelineKeyframe: deleteSelectedTimelineKeyframe,
      onCreateScene: () => void createSceneFromInput("empty"),
      onCloneScene: () => void createSceneFromInput("current"),
      onLoadScene: () => void loadSelectedScene(),
      onSaveScene: () => void saveSelectedScene(),
      onDeleteScene: () => void deleteSelectedScene(),
      onEditPath: () => {
        const asset = getSelectedAsset();

        if (asset) {
          startPathEditSession(asset);
        }
      },
      onSavePath: () => void savePathEditSession(),
      onCancelPath: cancelPathEditSession,
      onCreate3DCurve: () => void create3DCurveCopyFromSelectedAsset(),
      onCreateViewMorphProfile: () => void createViewMorphProfileFromTemplate(),
      onImportFile: () => void importSelectedFile(),
      onAddNode: addSelectedAssetToPrefab,
      onAddPrefabInstance: () => void addSelectedPrefabToScene(),
      onDeleteAsset: () => void deleteSelectedAsset(),
      onDeleteSceneNode: deleteSelectedSceneNode,
      onToggleProjection: toggleProjection,
      onSetEditorTool: setActiveEditorTool,
      onResetView: resetViewport,
    },
  });
  const paperCanvas = stage.getLayer("paper-canvas").canvas;
  const threeOverlayCanvas = document.getElementById("three-overlay-canvas");

  if (!(threeOverlayCanvas instanceof HTMLCanvasElement)) {
    throw new Error("Expected #three-overlay-canvas to be a canvas element.");
  }

  bindViewportInteractions({
    paperCanvas,
    threeOverlayCanvas,
    setViewportCallbacks: (callbacks) => threeViewport.setCallbacks(callbacks),
    selectPathEditControl,
    updatePathEditHover,
    clearPathEditHover,
    selectInPlacePathEditControl,
    onInPlacePathEditCanvasPointerDown: (capturedPathControl) => {
      editorState.inPlacePathEditCameraDragActive =
        Boolean(getValidInPlacePathEditSession()) && !capturedPathControl;

      if (editorState.inPlacePathEditCameraDragActive) {
        clearInPlacePathEditHover();
      }
    },
    updateInPlacePathEditHover,
    clearInPlacePathEditHover,
    dragSelectedTimelineKeyframe,
    dragPathEditControl,
    dragInPlacePathEditControl,
    clearPointerDragState: clearPointerDragState,
    clearMouseDragState: clearMouseDragState,
    onSelectionChange: handleViewportSelectionChange,
    onObjectTransform: handleViewportObjectTransform,
    onCurve3DControlSelection: selectSourcePathEdit3DControlById,
    onCurve3DControlTransform: updateSourcePathEdit3DControlPosition,
    onCameraChange: handleViewportCameraChange,
  });
}

function clearPointerDragState(): void {
  editorState.timelinePointerDrag = null;
  editorState.pathEditDragState = null;
  editorState.pathEditHoveredControl = null;
  editorState.viewMorphProfileEditDragState = null;
  editorState.viewMorphProfileEditHoveredControl = null;
  editorState.inPlacePathEditDragState = null;
  editorState.inPlacePathEditHoveredControl = null;
  editorState.inPlacePathEditCameraDragActive = false;
}

function clearMouseDragState(): void {
  editorState.pathEditDragState = null;
  editorState.pathEditHoveredControl = null;
  editorState.viewMorphProfileEditDragState = null;
  editorState.viewMorphProfileEditHoveredControl = null;
  editorState.inPlacePathEditDragState = null;
  editorState.inPlacePathEditHoveredControl = null;
  editorState.inPlacePathEditCameraDragActive = false;
}

function handleViewportSelectionChange(nodeId: string | null): void {
  if (editorState.editorMode === "asset") {
    editorState.selectedPrefabNodeId = nodeId;
    syncSelectionFromPrefabNode();
    syncActiveToolAfterSelectionChange();
    rebuildViewportProxies();
  } else if (editorState.editorMode === "scene") {
    editorState.selectedSceneNodeId = nodeId;
    syncSelectionFromSceneNode();
    renderCache.markSceneBillboardsDirty();
  }

  renderEditorShell();
  exposeEditorDebugHooks();
}

function handleViewportObjectTransform(nodeId: string): void {
  if (editorState.editorMode === "path") {
    return;
  }
  syncNodeFromViewport(nodeId);
  renderCache.markPoseDirty();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function handleViewportCameraChange(): void {
  if (editorState.editorMode === "scene") {
    editorState.loadedSceneId = null;
  }
  renderCache.markCameraDirty();
  scheduleCameraInspectorRender();
  exposeEditorDebugHooks();
}

function scheduleCameraInspectorRender(): void {
  if (pendingCameraInspectorRender) {
    return;
  }

  pendingCameraInspectorRender = true;
  requestAnimationFrame(() => {
    pendingCameraInspectorRender = false;

    if (
      document.activeElement instanceof HTMLInputElement ||
      document.activeElement instanceof HTMLSelectElement ||
      document.activeElement instanceof HTMLTextAreaElement
    ) {
      return;
    }

    renderInspector();
    exposeEditorDebugHooks();
  });
}

async function refreshProjects(): Promise<void> {
  try {
    const nextProject = await loadProjectRecords({
      selectedProjectId: editorState.selectedProjectId,
      listProjects,
    });
    editorState.projects = nextProject.projects;

    if (nextProject.shouldClearWorkspace) {
      clearProjectWorkspace();
    }

    editorState.selectedProjectId = nextProject.nextSelectedProjectId;
    await refreshAssets();
    await refreshPrefabs();
    await refreshScenes();
    editorState.lastImportError = null;
    hideError();
  } catch (error) {
    setImportError(error);
  }
}

async function refreshAssets(): Promise<void> {
  if (!editorState.selectedProjectId) {
    editorState.assets = [];
    editorState.selectedAssetId = null;
    renderEditorShell();
    exposeEditorDebugHooks();
    return;
  }

  const nextAsset = await loadAssetRecords({
    projectId: editorState.selectedProjectId,
    selectedAssetId: editorState.selectedAssetId,
    pathEditAssetId: editorState.pathEditSession?.assetId ?? null,
    pathEdit3DAssetId: editorState.pathEdit3DSession?.assetId ?? null,
    viewMorphProfileEditAssetId:
      editorState.viewMorphProfileEditSession?.assetId ?? null,
    listAssets,
  });

  editorState.assets = nextAsset.assets;
  editorState.selectedAssetId = nextAsset.nextSelectedAssetId;

  if (nextAsset.missingPathEditAssetId) {
    editorState.pathEditSession = null;
    editorState.pathEditDragState = null;
    setImportError(new Error("Path edit asset no longer exists."));
    return;
  }
  if (nextAsset.missingPathEdit3DAssetId) {
    editorState.pathEdit3DSession = null;
    threeViewport.clearCurve3DControls();
    setImportError(new Error("3D curve edit asset no longer exists."));
    return;
  }
  if (nextAsset.missingViewMorphProfileEditAssetId) {
    editorState.viewMorphProfileEditSession = null;
    editorState.viewMorphProfileEditDragState = null;
    setImportError(new Error("View morph profile edit asset no longer exists."));
    return;
  }
  renderEditorShell();
  exposeEditorDebugHooks();
}

async function refreshPrefabs(): Promise<void> {
  if (!editorState.selectedProjectId) {
    editorState.prefabs = [];
    editorState.prefabDocuments = new Map();
    editorState.selectedPrefabId = null;
    editorState.loadedPrefabId = null;
    editorState.selectedPrefabNodeId = PREFAB_ROOT_NODE_ID;
    editorState.pendingPrefabClipboard = null;
    resetPrefabTimelineState();
    renderEditorShell();
    exposeEditorDebugHooks();
    return;
  }

  const nextPrefab = await loadPrefabRecords({
    projectId: editorState.selectedProjectId,
    selectedPrefabId: editorState.selectedPrefabId,
    loadedPrefabId: editorState.loadedPrefabId,
    listPrefabs,
    getPrefab,
    onDocumentLoadError: (error) => console.error(error),
  });

  editorState.prefabs = nextPrefab.prefabs;
  editorState.prefabDocuments = nextPrefab.prefabDocuments;
  editorState.selectedPrefabId = nextPrefab.nextSelectedPrefabId;

  if (nextPrefab.missingLoadedPrefabId) {
    editorState.loadedPrefabId = null;
    editorState.prefabNodes = [];
    editorState.selectedPrefabNodeId = PREFAB_ROOT_NODE_ID;
    editorState.pendingPrefabClipboard = null;
    resetPrefabTimelineState();
  }

  if (editorState.editorMode === "asset") {
    rebuildViewportProxies();
  }

  renderEditorShell();
  exposeEditorDebugHooks();
}

async function refreshScenes(): Promise<void> {
  if (!editorState.selectedProjectId) {
    editorState.scenes = [];
    editorState.selectedSceneId = null;
    editorState.loadedSceneId = null;
    renderEditorShell();
    exposeEditorDebugHooks();
    return;
  }

  const nextScene = await loadSceneRecords({
    projectId: editorState.selectedProjectId,
    selectedSceneId: editorState.selectedSceneId,
    loadedSceneId: editorState.loadedSceneId,
    listScenes,
  });

  editorState.scenes = nextScene.scenes;
  editorState.selectedSceneId = nextScene.nextSelectedSceneId;

  if (nextScene.missingLoadedSceneId) {
    editorState.loadedSceneId = null;
  }

  renderEditorShell();
  exposeEditorDebugHooks();
}

async function createProjectFromInput(): Promise<void> {
  const nameResult = readRequiredInputValue(
    elements.projectNameInput,
    "Project name is required.",
  );

  if (!nameResult.ok) {
    setImportError(nameResult.error);
    return;
  }

  try {
    const project = await createProject(nameResult.value);
    elements.projectNameInput.value = "";
    clearProjectWorkspace();
    editorState.selectedProjectId = project.id;
    editorState.lastImportError = null;
    hideError();
    await refreshProjects();
  } catch (error) {
    setImportError(error);
  }
}

async function deleteSelectedProject(): Promise<void> {
  if (!editorState.selectedProjectId) {
    return;
  }

  try {
    await deleteProject(editorState.selectedProjectId);
    editorState.selectedProjectId = null;
    clearProjectWorkspace();
    editorState.lastImportError = null;
    hideError();
    await refreshProjects();
  } catch (error) {
    setImportError(error);
  }
}

async function savePathEditSession(): Promise<void> {
  if (
    !editorState.selectedProjectId ||
    (!editorState.pathEditSession &&
      !editorState.pathEdit3DSession &&
      !editorState.viewMorphProfileEditSession)
  ) {
    return;
  }

  try {
    const updatedAsset = await runSaveSourcePathEditCommand({
      projectId: editorState.selectedProjectId,
      pathEditSession: editorState.pathEditSession,
      pathEdit3DSession: editorState.pathEdit3DSession,
      viewMorphProfileEditSession: editorState.viewMorphProfileEditSession,
      updateAssetPath,
      updateAssetCurve3D,
      updateViewMorphProfile,
    });

    if (!updatedAsset) {
      return;
    }
    const nextAssetState = applyUpdatedAsset(
      { assets: editorState.assets, selectedAssetId: editorState.selectedAssetId },
      updatedAsset,
    );
    editorState.assets = nextAssetState.assets;
    editorState.selectedAssetId = nextAssetState.selectedAssetId;
    const nextPathEditState = clearSourcePathEditState();
    editorState.pathEditSession = nextPathEditState.pathEditSession;
    editorState.pathEdit3DSession = nextPathEditState.pathEdit3DSession;
    editorState.viewMorphProfileEditSession =
      nextPathEditState.viewMorphProfileEditSession;
    editorState.pathEditDragState = nextPathEditState.pathEditDragState;
    editorState.viewMorphProfileEditDragState =
      nextPathEditState.viewMorphProfileEditDragState;
    editorState.viewMorphProfileEditHoveredControl = null;
    threeViewport.clearCurve3DControls();
    editorState.lastImportError = null;
    hideError();
    rebuildViewportProxies();
    renderEditorShell();
    exposeEditorDebugHooks();
  } catch (error) {
    setImportError(error);
  }
}

function startPathEditSession(asset: PrimitiveSvgAsset): void {
  editorState.selectedAssetId = asset.id;
  editorState.editorMode = "path";
  threeViewport.clearCurve3DControls();
  const nextPathEditState = startSourcePathEditState(asset);
  editorState.pathEditSession = nextPathEditState.pathEditSession;
  editorState.pathEdit3DSession = nextPathEditState.pathEdit3DSession;
  editorState.viewMorphProfileEditSession =
    nextPathEditState.viewMorphProfileEditSession;
  editorState.pathEditDragState = nextPathEditState.pathEditDragState;
  editorState.viewMorphProfileEditDragState =
    nextPathEditState.viewMorphProfileEditDragState;
  editorState.viewMorphProfileEditHoveredControl = null;

  if (nextPathEditState.mode === "3d") {
    threeViewport.setTransformMode("translate");
    threeViewport.setTransformControlsVisible(true);
    threeViewport.setOrbitControlsEnabled(true);
  }
  exitPathTool();
  editorState.lastImportError = null;
  hideError();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function cancelPathEditSession(): void {
  const nextPathEditState = clearSourcePathEditState();
  editorState.pathEditSession = nextPathEditState.pathEditSession;
  editorState.pathEdit3DSession = nextPathEditState.pathEdit3DSession;
  editorState.viewMorphProfileEditSession =
    nextPathEditState.viewMorphProfileEditSession;
  editorState.pathEditDragState = nextPathEditState.pathEditDragState;
  editorState.viewMorphProfileEditDragState =
    nextPathEditState.viewMorphProfileEditDragState;
  editorState.viewMorphProfileEditHoveredControl = null;
  threeViewport.clearCurve3DControls();
  renderEditorShell();
  exposeEditorDebugHooks();
}

async function create3DCurveCopyFromSelectedAsset(): Promise<void> {
  if (!editorState.selectedProjectId || !editorState.selectedAssetId) {
    return;
  }

  const asset = getSelectedAsset();

  try {
    const convertedAsset = await runConvertAssetTo3DCurveCommand({
      projectId: editorState.selectedProjectId,
      assetId: editorState.selectedAssetId,
      asset,
      convertAssetTo3DCurve,
    });
    const nextAssetState = applyImportedAsset(
      { assets: editorState.assets, selectedAssetId: editorState.selectedAssetId },
      convertedAsset,
    );
    editorState.assets = nextAssetState.assets;
    editorState.selectedAssetId = nextAssetState.selectedAssetId;
    editorState.lastImportError = null;
    hideError();
    startPathEditSession(convertedAsset);
    await refreshAssets();
    editorState.selectedAssetId = convertedAsset.id;
    startPathEditSession(convertedAsset);
  } catch (error) {
    setImportError(error);
  }
}

async function createViewMorphProfileFromTemplate(): Promise<void> {
  if (!editorState.selectedProjectId) {
    setImportError(new Error("Create or select a project before creating a view morph profile."));
    return;
  }

  try {
    const asset = await runCreateViewMorphProfileAssetCommand({
      projectId: editorState.selectedProjectId,
      createViewMorphProfileAsset,
    });
    const nextAssetState = applyImportedAsset(
      { assets: editorState.assets, selectedAssetId: editorState.selectedAssetId },
      asset,
    );
    editorState.assets = nextAssetState.assets;
    editorState.selectedAssetId = nextAssetState.selectedAssetId;
    editorState.lastImportError = null;
    hideError();
    await refreshAssets();
    editorState.selectedAssetId = asset.id;
    renderEditorShell();
    exposeEditorDebugHooks();
  } catch (error) {
    setImportError(error);
  }
}

async function importSelectedFile(): Promise<void> {
  const file = elements.fileInput.files?.[0];

  if (!file || !editorState.selectedProjectId) {
    elements.fileInput.value = "";
    if (!editorState.selectedProjectId) {
      setImportError(new Error("Create or select a project before importing SVG."));
    }
    return;
  }

  try {
    const asset = await runImportPrimitiveAssetCommand({
      projectId: editorState.selectedProjectId,
      file,
      uploadAsset,
    });
    const nextAssetState = applyImportedAsset(
      { assets: editorState.assets, selectedAssetId: editorState.selectedAssetId },
      asset,
    );
    editorState.assets = nextAssetState.assets;
    editorState.selectedAssetId = nextAssetState.selectedAssetId;
    if (
      shouldClearRootPrefabAssetSelection(
        editorState.selectedPrefabNodeId,
        PREFAB_ROOT_NODE_ID,
      )
    ) {
      editorState.selectedPrefabNodeId = null;
    }
    editorState.lastImportError = null;
    hideError();
    elements.fileInput.value = "";
    await refreshAssets();
    editorState.selectedAssetId = asset.id;
    renderEditorShell();
    exposeEditorDebugHooks();
  } catch (error) {
    setImportError(error);
  }
}

async function deleteSelectedAsset(): Promise<void> {
  if (!editorState.selectedProjectId || !editorState.selectedAssetId) {
    return;
  }

  try {
    const deletedAssetId = await runDeleteAssetCommand({
      projectId: editorState.selectedProjectId,
      assetId: editorState.selectedAssetId,
      deleteAsset,
    });
    if (editorState.pathEditSession?.assetId === deletedAssetId) {
      editorState.pathEditSession = null;
      editorState.pathEditDragState = null;
    }
    if (editorState.pathEdit3DSession?.assetId === deletedAssetId) {
      editorState.pathEdit3DSession = null;
      threeViewport.clearCurve3DControls();
    }
    if (editorState.viewMorphProfileEditSession?.assetId === deletedAssetId) {
      editorState.viewMorphProfileEditSession = null;
      editorState.viewMorphProfileEditDragState = null;
      editorState.viewMorphProfileEditHoveredControl = null;
    }
    if (editorState.inPlacePathEditSession?.assetId === deletedAssetId) {
      exitPathTool();
    }
    pruneTimelineStagingPoses({ assetIds: new Set([deletedAssetId]) });
    const nextAssetState = applyDeletedAsset(
      { assets: editorState.assets, selectedAssetId: editorState.selectedAssetId },
      deletedAssetId,
    );
    editorState.assets = nextAssetState.assets;
    editorState.selectedAssetId = nextAssetState.selectedAssetId;
    editorState.lastImportError = null;
    hideError();
    await refreshAssets();
    rebuildViewportProxies();
  } catch (error) {
    setImportError(error);
  }
}

async function createPrefabFromInput(): Promise<void> {
  const projectResult = requireCommandValue(
    editorState.selectedProjectId,
    "Create or select a project before creating a prefab.",
  );

  if (!projectResult.ok) {
    setImportError(projectResult.error);
    return;
  }

  const nameResult = readRequiredInputValue(
    elements.prefabNameInput,
    "Prefab name is required.",
  );

  if (!nameResult.ok) {
    setImportError(nameResult.error);
    return;
  }

  try {
    const result = await runCreatePrefabCommand({
      projectId: projectResult.value,
      name: nameResult.value,
      document: createCurrentPrefabDocument(),
      createPrefab,
    });
    const nextPrefabState = applyLoadedPrefabDocument(
      {
        selectedPrefabId: editorState.selectedPrefabId,
        loadedPrefabId: editorState.loadedPrefabId,
        prefabDocuments: editorState.prefabDocuments,
      },
      result,
    );

    elements.prefabNameInput.value = "";
    editorState.selectedPrefabId = nextPrefabState.selectedPrefabId;
    editorState.loadedPrefabId = nextPrefabState.loadedPrefabId;
    editorState.prefabDocuments = nextPrefabState.prefabDocuments;
    applyPrefabDocument(result.document);
    editorState.lastImportError = null;
    hideError();
    await refreshPrefabs();
  } catch (error) {
    setImportError(error);
  }
}

async function loadSelectedPrefab(): Promise<void> {
  const projectResult = requireCommandValue(
    editorState.selectedProjectId,
    "Select a saved prefab before loading.",
  );
  const prefabResult = requireCommandValue(
    editorState.selectedPrefabId,
    "Select a saved prefab before loading.",
  );

  if (!projectResult.ok) {
    setImportError(projectResult.error);
    return;
  }

  if (!prefabResult.ok) {
    setImportError(prefabResult.error);
    return;
  }

  try {
    const result = await runLoadPrefabCommand({
      projectId: projectResult.value,
      prefabId: prefabResult.value,
      getPrefab,
    });
    const nextPrefabState = applyLoadedPrefabDocument(
      {
        selectedPrefabId: editorState.selectedPrefabId,
        loadedPrefabId: editorState.loadedPrefabId,
        prefabDocuments: editorState.prefabDocuments,
      },
      result,
    );
    editorState.selectedPrefabId = nextPrefabState.selectedPrefabId;
    editorState.loadedPrefabId = nextPrefabState.loadedPrefabId;
    editorState.prefabDocuments = nextPrefabState.prefabDocuments;
    applyPrefabDocument(result.document);
    setEditorMode("asset");
    editorState.lastImportError = null;
    hideError();
  } catch (error) {
    setImportError(error);
  }
}

async function saveSelectedPrefab(): Promise<void> {
  const projectResult = requireCommandValue(
    editorState.selectedProjectId,
    "Select a saved prefab before saving.",
  );
  const prefabResult = requireCommandValue(
    editorState.selectedPrefabId,
    "Select a saved prefab before saving.",
  );

  if (!projectResult.ok) {
    setImportError(projectResult.error);
    return;
  }

  if (!prefabResult.ok) {
    setImportError(prefabResult.error);
    return;
  }

  try {
    const result = await runSavePrefabCommand({
      projectId: projectResult.value,
      prefabId: prefabResult.value,
      document: createCurrentPrefabDocument(),
      savePrefab,
    });
    const nextPrefabState = applySavedPrefabDocument(
      {
        selectedPrefabId: editorState.selectedPrefabId,
        loadedPrefabId: editorState.loadedPrefabId,
        prefabDocuments: editorState.prefabDocuments,
      },
      result,
    );

    editorState.selectedPrefabId = nextPrefabState.selectedPrefabId;
    editorState.loadedPrefabId = nextPrefabState.loadedPrefabId;
    editorState.prefabDocuments = nextPrefabState.prefabDocuments;
    editorState.lastImportError = null;
    hideError();
    await refreshPrefabs();
  } catch (error) {
    setImportError(error);
  }
}

async function deleteSelectedPrefab(): Promise<void> {
  if (!editorState.selectedProjectId || !editorState.selectedPrefabId) {
    return;
  }

  try {
    const deletedPrefabId = await runDeletePrefabCommand({
      projectId: editorState.selectedProjectId,
      prefabId: editorState.selectedPrefabId,
      deletePrefab,
    });
    const nextPrefabState = applyDeletedPrefabDocument(
      {
        selectedPrefabId: editorState.selectedPrefabId,
        loadedPrefabId: editorState.loadedPrefabId,
        prefabDocuments: editorState.prefabDocuments,
      },
      deletedPrefabId,
    );
    editorState.selectedPrefabId = nextPrefabState.selectedPrefabId;
    editorState.loadedPrefabId = nextPrefabState.loadedPrefabId;
    editorState.prefabDocuments = nextPrefabState.prefabDocuments;

    if (nextPrefabState.deletedLoadedPrefab) {
      editorState.prefabNodes = [];
      resetPrefabTimelineState();
      editorState.selectedPrefabNodeId = PREFAB_ROOT_NODE_ID;
      editorState.pendingPrefabClipboard = null;
    }

    editorState.lastImportError = null;
    hideError();
    await refreshPrefabs();
    rebuildViewportProxies();
  } catch (error) {
    setImportError(error);
  }
}

function createPrefabGroup(): void {
  if (!editorState.selectedProjectId) {
    setImportError(new Error("Create or select a project before editing a prefab."));
    return;
  }

  const nodeNumber = editorState.nextPrefabNodeNumber;
  const nextState = createPrefabGroupNode(
    editorState.prefabNodes,
    editorState.selectedPrefabNodeId,
    PREFAB_ROOT_NODE_ID,
    createNextPrefabNodeId(),
    nodeNumber,
  );

  editorState.prefabNodes = nextState.nodes;
  editorState.selectedPrefabNodeId = nextState.selectedNodeId;
  pauseTimeline();
  editorState.loadedPrefabId = null;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function addSelectedAssetToPrefab(): void {
  const selectedAsset = getSelectedAsset();

  if (!editorState.selectedProjectId || !selectedAsset) {
    setImportError(new Error("Select an SVG primitive asset before adding it."));
    return;
  }

  const nextState = addPrimitiveAssetToPrefab(
    editorState.prefabNodes,
    editorState.selectedPrefabNodeId,
    PREFAB_ROOT_NODE_ID,
    selectedAsset,
    createNextPrefabNodeId(),
  );

  editorState.prefabNodes = nextState.nodes;
  editorState.selectedPrefabNodeId = nextState.selectedNodeId;
  editorState.selectedAssetId = selectedAsset.id;
  pauseTimeline();
  editorState.loadedPrefabId = null;
  editorState.lastImportError = null;
  hideError();
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function deleteSelectedPrefabNode(): void {
  if (!editorState.selectedPrefabNodeId || editorState.selectedPrefabNodeId === PREFAB_ROOT_NODE_ID) {
    return;
  }

  const nextState = deletePrefabNodeSubtree(
    editorState.prefabNodes,
    PREFAB_ROOT_NODE_ID,
    editorState.selectedPrefabNodeId,
  );
  const { deletedNodeIds } = nextState;

  if (
    editorState.inPlacePathEditSession &&
    deletedNodeIds.has(editorState.inPlacePathEditSession.nodeId)
  ) {
    exitPathTool();
  }
  pruneTimelineStagingPoses({ nodeIds: deletedNodeIds });
  editorState.prefabNodes = nextState.nodes;
  editorState.selectedPrefabNodeId = nextState.selectedNodeId;
  clearInvalidPrefabClipboard();
  pauseTimeline();
  editorState.loadedPrefabId = null;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

async function addSelectedPrefabToScene(): Promise<void> {
  const projectResult = requireCommandValue(
    editorState.selectedProjectId,
    "Select a prefab before adding a scene instance.",
  );
  const prefabResult = requireCommandValue(
    editorState.selectedPrefabId,
    "Select a prefab before adding a scene instance.",
  );

  if (!projectResult.ok) {
    setImportError(projectResult.error);
    return;
  }

  if (!prefabResult.ok) {
    setImportError(prefabResult.error);
    return;
  }

  if (!editorState.prefabDocuments.has(prefabResult.value)) {
    const result = await getPrefab(projectResult.value, prefabResult.value);
    const nextCache = cachePrefabDocumentForScene(
      { prefabDocuments: editorState.prefabDocuments },
      result.prefab.id,
      result.document,
    );
    editorState.prefabDocuments = nextCache.prefabDocuments;
  }

  const nextSceneState = addPrefabInstanceToScene({
    nodes: editorState.sceneNodes,
    prefabId: prefabResult.value,
    nodeNumber: editorState.nextSceneNodeNumber,
  });
  editorState.sceneNodes = nextSceneState.nodes;
  editorState.selectedSceneNodeId = nextSceneState.selectedSceneNodeId;
  editorState.nextSceneNodeNumber = nextSceneState.nextSceneNodeNumber;
  editorState.loadedSceneId = null;
  setEditorMode("scene");
  editorState.lastImportError = null;
  hideError();
}

async function createSceneFromInput(source: SceneCreateSource): Promise<void> {
  const projectResult = requireCommandValue(
    editorState.selectedProjectId,
    "Create or select a project before creating a scene.",
  );

  if (!projectResult.ok) {
    setImportError(projectResult.error);
    return;
  }

  const nameResult = readRequiredInputValue(
    elements.sceneNameInput,
    "Scene name is required.",
  );

  if (!nameResult.ok) {
    setImportError(nameResult.error);
    return;
  }

  try {
    const result = await runCreateSceneCommand({
      projectId: projectResult.value,
      name: nameResult.value,
      document:
        source === "empty" ? createEmptySceneDocument() : createCurrentSceneDocument(),
      createScene,
    });
    const nextSceneState = applyLoadedSceneDocument(result);

    elements.sceneNameInput.value = "";
    editorState.selectedSceneId = nextSceneState.selectedSceneId;
    editorState.loadedSceneId = nextSceneState.loadedSceneId;
    applySceneDocument(result.document);
    setEditorMode("scene");
    editorState.lastImportError = null;
    hideError();
    await refreshScenes();
  } catch (error) {
    setImportError(error);
  }
}

async function saveSelectedScene(): Promise<void> {
  const projectResult = requireCommandValue(
    editorState.selectedProjectId,
    "Select a saved scene before saving.",
  );
  const sceneResult = requireCommandValue(
    editorState.selectedSceneId,
    "Select a saved scene before saving.",
  );

  if (!projectResult.ok) {
    setImportError(projectResult.error);
    return;
  }

  if (!sceneResult.ok) {
    setImportError(sceneResult.error);
    return;
  }

  try {
    const result = await runSaveSceneCommand({
      projectId: projectResult.value,
      sceneId: sceneResult.value,
      document: createCurrentSceneDocument(),
      saveScene,
    });
    const nextSceneState = applySavedSceneDocument(result);

    editorState.selectedSceneId = nextSceneState.selectedSceneId;
    editorState.loadedSceneId = nextSceneState.loadedSceneId;
    editorState.lastImportError = null;
    hideError();
    await refreshScenes();
  } catch (error) {
    setImportError(error);
  }
}

async function loadSelectedScene(): Promise<void> {
  const projectResult = requireCommandValue(
    editorState.selectedProjectId,
    "Select a saved scene before loading.",
  );
  const sceneResult = requireCommandValue(
    editorState.selectedSceneId,
    "Select a saved scene before loading.",
  );

  if (!projectResult.ok) {
    setImportError(projectResult.error);
    return;
  }

  if (!sceneResult.ok) {
    setImportError(sceneResult.error);
    return;
  }

  try {
    const result = await runLoadSceneCommand({
      projectId: projectResult.value,
      sceneId: sceneResult.value,
      getScene,
    });
    const nextSceneState = applyLoadedSceneDocument(result);
    applySceneDocument(result.document);
    editorState.selectedSceneId = nextSceneState.selectedSceneId;
    editorState.loadedSceneId = nextSceneState.loadedSceneId;
    setEditorMode("scene");
    editorState.lastImportError = null;
    hideError();
  } catch (error) {
    setImportError(error);
  }
}

async function deleteSelectedScene(): Promise<void> {
  if (!editorState.selectedProjectId || !editorState.selectedSceneId) {
    return;
  }

  try {
    const deletedSceneId = await runDeleteSceneCommand({
      projectId: editorState.selectedProjectId,
      sceneId: editorState.selectedSceneId,
      deleteScene,
    });
    const nextSceneState = applyDeletedSceneDocument(
      {
        selectedSceneId: editorState.selectedSceneId,
        loadedSceneId: editorState.loadedSceneId,
      },
      deletedSceneId,
    );

    if (nextSceneState.deletedLoadedScene) {
      clearSceneLayout();
    }

    editorState.selectedSceneId = nextSceneState.selectedSceneId;
    editorState.loadedSceneId = nextSceneState.loadedSceneId;
    editorState.lastImportError = null;
    hideError();
    await refreshScenes();
  } catch (error) {
    setImportError(error);
  }
}

function deleteSelectedSceneNode(): void {
  if (!editorState.selectedSceneNodeId) {
    return;
  }

  const nextSceneState = deleteSceneNodeById(editorState.sceneNodes, editorState.selectedSceneNodeId);
  editorState.sceneNodes = nextSceneState.nodes;
  editorState.selectedSceneNodeId = nextSceneState.selectedSceneNodeId;
  editorState.loadedSceneId = null;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function toggleProjection(): void {
  threeViewport.toggleProjection();
  if (editorState.editorMode === "scene") {
    editorState.loadedSceneId = null;
  }
  renderEditorShell();
  exposeEditorDebugHooks();
}

function resetViewport(): void {
  threeViewport.resetView();
  if (editorState.editorMode === "scene") {
    editorState.loadedSceneId = null;
  }
  renderCache.markAllDirty();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function setActiveEditorTool(tool: EditorTool): void {
  const definition = getToolDefinition(tool);

  if (!canUseTool(tool)) {
    fallbackToTransformTool();
    renderEditorShell();
    exposeEditorDebugHooks();
    return;
  }

  editorState.activeEditorTool = tool;
  threeViewport.setTransformControlsVisible(definition.usesTransformControls);

  if (definition.usesPathOverlay) {
    threeViewport.setOrbitControlsEnabled(true);
    startInPlacePathEditSession();
    return;
  }

  if (isTransformEditorTool(tool)) {
    threeViewport.setTransformMode(tool);
  }

  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function startInPlacePathEditSession(): boolean {
  const activeClip = getActiveTimelineClip();
  const selectedNode =
    editorState.editorMode === "asset" &&
    editorState.selectedPrefabNodeId &&
    editorState.selectedPrefabNodeId !== PREFAB_ROOT_NODE_ID
      ? getPrefabNode(editorState.selectedPrefabNodeId)
      : null;
  const asset =
    selectedNode?.kind === "primitive" && selectedNode.assetId
      ? getAssetById(selectedNode.assetId)
      : null;

  if (!activeClip || !selectedNode || selectedNode.kind !== "primitive" || !asset) {
    exitPathTool();
    renderEditorShell();
    exposeEditorDebugHooks();
    return false;
  }

  if (!canKeyframePrimitiveAssetPath(asset)) {
    setImportError(new Error("3D curve path keyframes are not supported yet."));
    exitPathTool();
    renderEditorShell();
    exposeEditorDebugHooks();
    return false;
  }

  const stagingPose = getOrCreateTimelineStagingPose(selectedNode, activeClip, asset);
  const sessionResult = createInPlacePathEditSessionForState({
    selectedNode,
    asset,
    stagingPose,
    previousSession: editorState.inPlacePathEditSession,
  });

  if (!sessionResult.ok) {
    if (sessionResult.error) {
      setImportError(new Error(sessionResult.error));
    }
    exitPathTool();
    renderEditorShell();
    exposeEditorDebugHooks();
    return false;
  }

  pauseTimeline();
  editorState.inPlacePathEditSession = sessionResult.session;
  stagingPose.pathDraft = cloneStructuredBezierPath(sessionResult.pathDraft);
  editorState.inPlacePathEditDragState = null;
  editorState.lastImportError = null;
  hideError();
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
  return true;
}

function discardInPlacePathEditSession(): void {
  editorState.inPlacePathEditSession = null;
  editorState.inPlacePathEditDragState = null;
  editorState.inPlacePathEditHoveredControl = null;
  editorState.inPlacePathEditCameraDragActive = false;
}

function fallbackToTransformTool(): void {
  discardInPlacePathEditSession();
  editorState.activeEditorTool = getFallbackTransformTool(threeViewport.currentTransformMode);
  threeViewport.setTransformControlsVisible(true);
}

function exitPathTool(): void {
  if (editorState.activeEditorTool === "path") {
    fallbackToTransformTool();
    return;
  }

  discardInPlacePathEditSession();
}

function syncActiveToolAfterSelectionChange(): void {
  if (editorState.activeEditorTool !== "path") {
    discardInPlacePathEditSession();
    return;
  }

  if (canUsePathTool()) {
    startInPlacePathEditSession();
    return;
  }

  fallbackToTransformTool();
}

function setEditorMode(mode: EditorMode): void {
  const modeChange = planEditorModeChange(editorState.editorMode, mode);

  if (modeChange.shouldExitPathTool) {
    exitPathTool();
  }
  if (modeChange.shouldClearSourcePathEdit) {
    editorState.pathEditSession = null;
    editorState.pathEdit3DSession = null;
    editorState.viewMorphProfileEditSession = null;
    editorState.pathEditDragState = null;
    editorState.pathEditHoveredControl = null;
    editorState.viewMorphProfileEditDragState = null;
    editorState.viewMorphProfileEditHoveredControl = null;
  }
  if (modeChange.shouldClearCurve3DControls) {
    threeViewport.clearCurve3DControls();
  }
  editorState.editorMode = modeChange.nextMode;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function clearProjectWorkspace(): void {
  exitPathTool();
  const emptyWorkspace = createEmptyProjectWorkspaceState();
  editorState.assets = emptyWorkspace.assets;
  editorState.prefabs = emptyWorkspace.prefabs;
  editorState.prefabDocuments = emptyWorkspace.prefabDocuments;
  editorState.scenes = emptyWorkspace.scenes;
  editorState.prefabNodes = [];
  resetPrefabTimelineState();
  editorState.sceneNodes = [];
  editorState.selectedAssetId = emptyWorkspace.selectedAssetId;
  editorState.selectedPrefabId = emptyWorkspace.selectedPrefabId;
  editorState.loadedPrefabId = emptyWorkspace.loadedPrefabId;
  editorState.selectedPrefabNodeId = PREFAB_ROOT_NODE_ID;
  editorState.pendingPrefabClipboard = null;
  editorState.selectedSceneId = emptyWorkspace.selectedSceneId;
  editorState.loadedSceneId = emptyWorkspace.loadedSceneId;
  editorState.selectedSceneNodeId = emptyWorkspace.selectedSceneNodeId;
  editorState.pathEditSession = null;
  editorState.pathEdit3DSession = null;
  editorState.viewMorphProfileEditSession = null;
  editorState.pathEditDragState = null;
  editorState.viewMorphProfileEditDragState = null;
  editorState.viewMorphProfileEditHoveredControl = null;
  threeViewport.clearCurve3DControls();
  editorState.nextPrefabNodeNumber = 1;
  editorState.nextSceneNodeNumber = 1;
  threeViewport.clearNodes();
}

function clearSceneLayout(): void {
  editorState.sceneNodes = [];
  editorState.selectedSceneNodeId = null;
  editorState.loadedSceneId = null;
  editorState.pathEditDragState = null;
  editorState.viewMorphProfileEditDragState = null;
  if (editorState.editorMode !== "path") {
    threeViewport.clearCurve3DControls();
  }
  editorState.nextSceneNodeNumber = 1;

  if (editorState.editorMode === "scene") {
    rebuildViewportProxies();
  }
}

function createCurrentPrefabDocument(): PrefabDocument {
  return createPrefabDocument(editorState.prefabNodes, editorState.prefabAnimation);
}

function applyPrefabDocument(document: PrefabDocument): void {
  exitPathTool();
  const nextState = applyPrefabDocumentState(document, PREFAB_ROOT_NODE_ID);

  editorState.prefabNodes = nextState.nodes;
  editorState.prefabAnimation = nextState.animation;
  editorState.timelineStagingPoses = new TimelineStagingPoseStore();
  editorState.timelineCurrentTimeMs = 0;
  editorState.isTimelinePlaying = false;
  editorState.selectedTimelineKeyframeId = null;
  editorState.selectedPrefabNodeId = nextState.selectedNodeId;
  clearInvalidPrefabClipboard();
  editorState.nextPrefabNodeNumber = nextState.nextNodeNumber;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function createCurrentSceneDocument(): SceneDocument {
  return createSceneDocument(threeViewport.getCameraSnapshot(), editorState.sceneNodes);
}

function createEmptySceneDocument(): SceneDocument {
  return createEmptySceneDocumentState(threeViewport.getDefaultCameraSnapshot());
}

function applySceneDocument(document: SceneDocument): void {
  const nextState = applySceneDocumentState(document);

  threeViewport.applyCameraSnapshot(document.camera);
  editorState.sceneNodes = nextState.nodes;
  editorState.selectedSceneNodeId = nextState.selectedNodeId;
  editorState.nextSceneNodeNumber = nextState.nextNodeNumber;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function rebuildViewportProxies(): void {
  renderCache.markAllDirty();
  threeViewport.clearNodes();

  if (!editorState.selectedProjectId) {
    return;
  }

  if (editorState.editorMode === "path") {
    return;
  }

  if (editorState.editorMode === "asset") {
    for (const proxy of createAssetViewportProxyNodes({
      nodes: editorState.prefabNodes,
      selectedNodeId: editorState.selectedPrefabNodeId,
      rootNodeId: PREFAB_ROOT_NODE_ID,
      activeClip: getActiveTimelineClip(),
      getAssetById,
      getTimelineStagingPose,
      getOrCreateTimelineStagingPose,
      getTimelineStagingWorldTransform,
    })) {
      threeViewport.addOrUpdateNode(proxy.node, proxy.asset ?? undefined);
    }

    threeViewport.setSelectedNode(
      editorState.selectedPrefabNodeId === PREFAB_ROOT_NODE_ID ? null : editorState.selectedPrefabNodeId,
    );
    return;
  }

  for (const proxy of createSceneViewportProxyNodes(editorState.sceneNodes, getAssetById)) {
    threeViewport.addOrUpdateNode(proxy.node, proxy.asset ?? undefined);
  }

  threeViewport.setSelectedNode(editorState.selectedSceneNodeId);
}

function syncNodeFromViewport(nodeId: string): void {
  if (editorState.editorMode === "asset") {
    pauseTimeline();
    const node = getPrefabNode(nodeId);

    if (!node) {
      return;
    }

    const activeClip = getActiveTimelineClip();
    const stagingPose =
      activeClip && node.id === editorState.selectedPrefabNodeId
        ? getOrCreateTimelineStagingPose(node, activeClip)
        : null;

    if (stagingPose) {
      const worldNode: EditorTransformNode = {
        id: node.id,
        position: [...stagingPose.position],
        rotation: [...stagingPose.rotation],
        scale: [...stagingPose.scale],
      };

      threeViewport.syncNodeFromProxy(worldNode);
      applyViewportTransformToStagingPose({
        nodes: editorState.prefabNodes,
        node,
        worldNode,
        stagingPose,
      });
      renderCache.markAssetBillboardsDirty();
      return;
    }

    const worldNode: EditorTransformNode = {
      id: node.id,
      position: [...node.position],
      rotation: [...node.rotation],
      scale: [...node.scale],
    };

    threeViewport.syncNodeFromProxy(worldNode);
    applyViewportTransformToPrefabNode({
      nodes: editorState.prefabNodes,
      node,
      worldNode,
    });
    editorState.loadedPrefabId = null;

    /**
     * TransformControls fires continuously while the user drags a handle. Do
     * not rebuild the proxy scene here: clearing and recreating the selected
     * Three object detaches the active handle and makes group dragging feel like
     * it stops after a tiny movement. Instead, keep the selected proxy alive and
     * only refresh the world-space transforms of the other prefab proxies.
     */
    syncPrefabProxyWorldTransforms(node.id);
    renderCache.markAssetBillboardsDirty();

    return;
  }

  const node = getSceneNode(nodeId);

  if (!node) {
    return;
  }

  threeViewport.syncNodeFromProxy(node);
  editorState.loadedSceneId = null;
  renderCache.markSceneBillboardsDirty();
}

function syncSelectionFromPrefabNode(): void {
  if (editorState.selectedPrefabNodeId === PREFAB_ROOT_NODE_ID) {
    return;
  }

  const node = editorState.selectedPrefabNodeId ? getPrefabNode(editorState.selectedPrefabNodeId) : null;
  const sync = getPrefabNodeSelectionSync(node);

  if (sync.selectedAssetId !== undefined) {
    editorState.selectedAssetId = sync.selectedAssetId;
  }
}

function getActiveTimelineClip(): PrefabAnimationClip | null {
  return getActiveTimelineClipFromState(editorState.prefabAnimation);
}

function getActiveTimelineProperty(): PrefabTrackProperty {
  return getTimelinePropertyForEditorTool(editorState.activeEditorTool);
}

function setActiveTimelineProperty(property: PrefabTrackProperty): void {
  setActiveEditorTool(getEditorToolForTimelineProperty(property));
}

function updateActiveTimelineClip(nextClip: PrefabAnimationClip): void {
  editorState.prefabAnimation = updateActiveTimelineClipForState(editorState.prefabAnimation, nextClip);
}

function applyTimelineStatePatch(patch: {
  animation?: PrefabAnimation;
  currentTimeMs?: number;
  isPlaying?: boolean;
  selectedKeyframeId?: string | null;
  timelinePointerDragCleared?: boolean;
}): void {
  if (patch.animation) {
    editorState.prefabAnimation = patch.animation;
  }
  if (patch.currentTimeMs !== undefined) {
    editorState.timelineCurrentTimeMs = patch.currentTimeMs;
  }
  if (patch.isPlaying !== undefined) {
    editorState.isTimelinePlaying = patch.isPlaying;
  }
  if (patch.selectedKeyframeId !== undefined) {
    editorState.selectedTimelineKeyframeId = patch.selectedKeyframeId;
  }
  if (patch.timelinePointerDragCleared) {
    editorState.timelinePointerDrag = null;
  }
}

function updateTimelinePlayback(deltaSeconds: number): void {
  const nextPlayback = advanceTimelinePlayback({
    isPlaying: editorState.isTimelinePlaying,
    activeClip: getActiveTimelineClip(),
    currentTimeMs: editorState.timelineCurrentTimeMs,
    deltaSeconds,
  });

  if (
    nextPlayback.currentTimeMs === editorState.timelineCurrentTimeMs &&
    nextPlayback.isPlaying === editorState.isTimelinePlaying
  ) {
    return;
  }

  editorState.timelineCurrentTimeMs = nextPlayback.currentTimeMs;
  editorState.isTimelinePlaying = nextPlayback.isPlaying;

  renderCache.markAssetBillboardsDirty();
  renderPrefabTimeline();
  exposeEditorDebugHooks();
}

function getEvaluatedPrefabNodes(): PrefabNode[] {
  return getCurrentPrefabPoseSnapshot().nodes;
}

function getEvaluatedPrefabPathOverrides(): Map<string, StructuredBezierPath> {
  return getCurrentPrefabPoseSnapshot().pathOverrides;
}

function getCurrentPrefabPoseSnapshot(): ReturnType<typeof evaluatePrefabPose> {
  return evaluatePrefabPose({
    nodes: editorState.prefabNodes,
    activeClip: getActiveTimelineClip(),
    currentTimeMs: editorState.timelineCurrentTimeMs,
  });
}

function createTimelineClipFromInput(): void {
  if (!editorState.selectedProjectId) {
    setImportError(new Error("Create or select a project before creating a clip."));
    return;
  }

  const name = elements.timelineClipNameInput.value.trim();

  if (!name) {
    setImportError(new Error("Clip name is required."));
    return;
  }

  applyTimelineStatePatch(
    createTimelineClipCommand({
      animation: editorState.prefabAnimation,
      name,
      durationMs: DEFAULT_TIMELINE_DURATION_MS,
      loop: true,
    }),
  );
  editorState.loadedPrefabId = null;
  elements.timelineClipNameInput.value = "";
  editorState.lastImportError = null;
  hideError();
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function deleteSelectedTimelineClip(): void {
  const result = deleteActiveTimelineClipCommand(editorState.prefabAnimation);

  if (!result.deletedClipId) {
    return;
  }

  applyTimelineStatePatch(result);
  pruneTimelineStagingPoses({ clipIds: new Set([result.deletedClipId]) });
  if (editorState.inPlacePathEditSession) {
    exitPathTool();
  }
  editorState.loadedPrefabId = null;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function selectTimelineClip(clipId: string): void {
  const result = selectTimelineClipCommand({
    animation: editorState.prefabAnimation,
    clipId,
    currentTimeMs: editorState.timelineCurrentTimeMs,
  });

  if (!result.selectedClip) {
    return;
  }

  applyTimelineStatePatch(result);
  if (editorState.activeEditorTool === "path") {
    startInPlacePathEditSession();
  }
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function selectBasePoseTimeline(): void {
  applyTimelineStatePatch(selectBasePoseTimelineCommand(editorState.prefabAnimation));
  if (editorState.activeEditorTool === "path") {
    exitPathTool();
  }
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function playTimeline(): void {
  const patch = playTimelineCommand({ activeClip: getActiveTimelineClip() });

  if (!patch) {
    return;
  }

  applyTimelineStatePatch(patch);
  renderEditorShell();
  exposeEditorDebugHooks();
}

function pauseTimeline(): void {
  const patch = pauseTimelineCommand({ isPlaying: editorState.isTimelinePlaying });

  if (!patch) {
    return;
  }

  applyTimelineStatePatch(patch);
  renderEditorShell();
  exposeEditorDebugHooks();
}

function stopTimeline(): void {
  applyTimelineStatePatch(stopTimelineCommand());
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function scrubTimelineTo(timeMs: number): void {
  const patch = scrubTimelineCommand({
    activeClip: getActiveTimelineClip(),
    timeMs,
  });

  if (!patch) {
    return;
  }

  applyTimelineStatePatch(patch);
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function applyTimelineTimeInput(): void {
  const activeClip = getActiveTimelineClip();

  if (!activeClip) {
    return;
  }

  scrubTimelineTo(
    snapAndClampTimelineTimeMs(Number(elements.timelineTimeInput.value.trim()), activeClip),
  );
}

function applyTimelineDurationInput(): void {
  const activeClip = getActiveTimelineClip();
  const durationMs = parseTimelineDurationInput(
    elements.timelineDurationInput.value,
  );

  if (!activeClip || durationMs === null) {
    renderEditorShell();
    return;
  }

  updateActiveTimelineClip({
    ...activeClip,
    durationMs,
    tracks: activeClip.tracks.map(clonePrefabAnimationTrack),
  });
  editorState.timelineCurrentTimeMs = clampTimelineTimeMs(
    editorState.timelineCurrentTimeMs,
    getActiveTimelineClip(),
  );
  editorState.isTimelinePlaying = false;
  editorState.loadedPrefabId = null;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function applyTimelineLoopInput(): void {
  const activeClip = getActiveTimelineClip();

  if (!activeClip) {
    return;
  }

  updateActiveTimelineClip({
    ...activeClip,
    loop: elements.timelineLoopInput.checked,
  });
  editorState.loadedPrefabId = null;
  renderEditorShell();
  exposeEditorDebugHooks();
}

function applyTimelineSnapFpsInput(): void {
  const nextSnapFps = parseTimelineSnapFpsInput(
    elements.timelineSnapFpsInput.value,
  );

  if (nextSnapFps === null) {
    renderEditorShell();
    return;
  }

  editorState.prefabAnimation = {
    ...clonePrefabAnimation(editorState.prefabAnimation),
    snapFps: roundTimelineNumber(nextSnapFps),
  };
  editorState.loadedPrefabId = null;
  renderEditorShell();
  exposeEditorDebugHooks();
}

function applySelectedKeyframeTimeInput(): void {
  const activeClip = getActiveTimelineClip();
  const selected = activeClip ? getSelectedTimelineKeyframe(activeClip) : null;
  const nextTimeMs = Number(elements.timelineKeyframeTimeInput.value.trim());

  if (
    !activeClip ||
    !selected ||
    !isPrefabVectorTrack(selected.track) ||
    !Number.isFinite(nextTimeMs)
  ) {
    renderEditorShell();
    return;
  }

  updateSelectedTimelineKeyframe({
    ...selected.keyframe,
    timeMs: snapAndClampTimelineTimeMs(nextTimeMs, activeClip),
  });
}

function applySelectedKeyframeValueInput(): void {
  const activeClip = getActiveTimelineClip();
  const selected = activeClip ? getSelectedTimelineKeyframe(activeClip) : null;
  const value = parseVectorKeyframeValueInput({
    x: elements.timelineKeyframeValueXInput.value,
    y: elements.timelineKeyframeValueYInput.value,
    z: elements.timelineKeyframeValueZInput.value,
    round: roundTransformValue,
  });

  if (
    !selected ||
    !isPrefabVectorTrack(selected.track) ||
    !value
  ) {
    renderEditorShell();
    return;
  }

  updateSelectedTimelineKeyframe({
    ...selected.keyframe,
    value,
  });
}

function applySelectedKeyframeEasingInput(): void {
  const activeClip = getActiveTimelineClip();
  const selected = activeClip ? getSelectedTimelineKeyframe(activeClip) : null;
  const easing = parseTimelineEasingInput(
    elements.timelineKeyframeEasingSelect.value,
  );

  if (
    !selected ||
    !isPrefabVectorTrack(selected.track) ||
    !easing
  ) {
    renderEditorShell();
    return;
  }

  updateSelectedTimelineKeyframe({
    ...selected.keyframe,
    easing,
  });
}

function deleteSelectedTimelineKeyframe(): void {
  const activeClip = getActiveTimelineClip();
  const selected = activeClip ? getSelectedTimelineKeyframe(activeClip) : null;

  if (!activeClip || !selected) {
    return;
  }

  const nextClip = deleteTimelineKeyframe(activeClip, selected);

  editorState.selectedTimelineKeyframeId = null;
  updateActiveTimelineClip(nextClip);
  editorState.loadedPrefabId = null;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function updateSelectedTimelineKeyframe(
  nextKeyframe: PrefabVectorAnimationKeyframe | PrefabPathAnimationKeyframe,
): void {
  const activeClip = getActiveTimelineClip();
  const selected = activeClip ? getSelectedTimelineKeyframe(activeClip) : null;

  if (!activeClip || !selected) {
    return;
  }

  const result = updateTimelineKeyframe(activeClip, selected, nextKeyframe);

  editorState.selectedTimelineKeyframeId = result.selectedKeyframeId;
  editorState.timelineCurrentTimeMs = result.currentTimeMs;
  updateActiveTimelineClip(result.clip);
  editorState.loadedPrefabId = null;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function dragSelectedTimelineKeyframe(event: PointerEvent): void {
  if (!editorState.timelinePointerDrag) {
    return;
  }

  const activeClip = getActiveTimelineClip();
  const selected = activeClip ? getSelectedTimelineKeyframe(activeClip) : null;

  if (!activeClip || !selected) {
    editorState.timelinePointerDrag = null;
    return;
  }

  const trackBar = document.querySelector(
    `.timeline-track-bar[data-timeline-property="${editorState.timelinePointerDrag.property}"]`,
  );

  if (!(trackBar instanceof HTMLElement)) {
    return;
  }

  const nextTimeMs = timeMsFromTimelinePointer(event, activeClip, trackBar);
  updateSelectedTimelineKeyframe({
    ...selected.keyframe,
    timeMs: nextTimeMs,
  });
}

function addKeyframeForSelectedPrefabNode(): void {
  const activeClip = getActiveTimelineClip();
  const selectedNode = getSelectedPrefabNode();

  if (!activeClip || !selectedNode) {
    setImportError(new Error("Select a real prefab node and an active clip first."));
    return;
  }

  const property = getActiveTimelineProperty();
  const propertyAdapter = getPrefabPosePropertyAdapter(property);
  const timeMs = snapAndClampTimelineTimeMs(editorState.timelineCurrentTimeMs, activeClip);
  const stagingPose = getOrCreateTimelineStagingPose(
    selectedNode,
    activeClip,
    selectedNode.kind === "primitive" && selectedNode.assetId
      ? getAssetById(selectedNode.assetId)
      : null,
  );

  if (isPathPosePropertyAdapter(propertyAdapter)) {
    const pathDraft =
      editorState.inPlacePathEditSession?.nodeId === selectedNode.id
        ? editorState.inPlacePathEditSession.draft
        : propertyAdapter.readStagingValue(stagingPose);

    if (!pathDraft || selectedNode.kind !== "primitive") {
      setImportError(new Error("Use the Path tool to edit a primitive path before adding a keyframe."));
      return;
    }

    const result = upsertPrefabPathKeyframe(clonePrefabAnimationClip(activeClip), {
      nodeId: selectedNode.id,
      timeMs,
      value: pathDraft,
      easing: "linear",
      snapFps: editorState.prefabAnimation.snapFps,
    });

    editorState.selectedTimelineKeyframeId = result.selectedKeyframeId;
    updateActiveTimelineClip(result.clip);
    editorState.timelineCurrentTimeMs = timeMs;
    editorState.loadedPrefabId = null;
    editorState.lastImportError = null;
    hideError();
    rebuildViewportProxies();
    renderEditorShell();
    exposeEditorDebugHooks();
    return;
  }

  if (!isVectorPosePropertyAdapter(propertyAdapter)) {
    return;
  }

  const result = upsertPrefabVectorKeyframe(clonePrefabAnimationClip(activeClip), {
    nodeId: selectedNode.id,
    property: propertyAdapter.property,
    timeMs,
    value: propertyAdapter.readStagingValue(stagingPose),
    easing: "linear",
    snapFps: editorState.prefabAnimation.snapFps,
  });

  editorState.selectedTimelineKeyframeId = result.selectedKeyframeId;
  updateActiveTimelineClip(result.clip);
  editorState.timelineCurrentTimeMs = timeMs;
  editorState.loadedPrefabId = null;
  editorState.lastImportError = null;
  hideError();
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function snapSelectedPrefabBaseToTimeline(): void {
  const activeClip = getActiveTimelineClip();
  const selectedNode = getSelectedPrefabNode();

  if (!activeClip || !selectedNode) {
    setImportError(new Error("Select a real prefab node and an active clip first."));
    return;
  }

  const evaluatedNode = getEvaluatedPrefabNodes().find(
    (node) => node.id === selectedNode.id,
  );

  if (!evaluatedNode) {
    setImportError(new Error("Could not evaluate the selected prefab node."));
    return;
  }

  const asset =
    selectedNode.kind === "primitive" && selectedNode.assetId
      ? getAssetById(selectedNode.assetId)
      : null;
  const stagingPose = getOrCreateTimelineStagingPose(selectedNode, activeClip, asset);

  stagingPose.position = [...evaluatedNode.position];
  stagingPose.rotation = [...evaluatedNode.rotation];
  stagingPose.scale = [...evaluatedNode.scale];

  if (selectedNode.kind === "primitive" && asset) {
    const evaluatedPathForSnap = clonePathOverrideForNode(
      getCurrentPrefabPoseSnapshot(),
      selectedNode.id,
      asset.bezierPath,
    );

    stagingPose.pathDraft = cloneStructuredBezierPath(evaluatedPathForSnap);

    if (editorState.inPlacePathEditSession?.nodeId === selectedNode.id) {
      const previousSelection = editorState.inPlacePathEditSession.selected;
      editorState.inPlacePathEditSession.draft = cloneStructuredBezierPath(evaluatedPathForSnap);
      editorState.inPlacePathEditSession.selected = getRestoredPathEditSelection(
        editorState.inPlacePathEditSession.draft,
        previousSelection,
      );
    }
  }

  pauseTimeline();
  editorState.lastImportError = null;
  hideError();
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function handlePrefabClipboardPrimaryAction(): void {
  if (editorState.pendingPrefabClipboard) {
    pastePendingPrefabClipboard();
    return;
  }

  startPendingPrefabClipboard("copy");
}

function handlePrefabClipboardSecondaryAction(): void {
  if (editorState.pendingPrefabClipboard) {
    editorState.pendingPrefabClipboard = null;
    renderEditorShell();
    exposeEditorDebugHooks();
    return;
  }

  startPendingPrefabClipboard("cut");
}

function startPendingPrefabClipboard(mode: PrefabClipboardMode): void {
  const clipboard = startPrefabClipboard(
    mode,
    editorState.selectedPrefabNodeId,
    PREFAB_ROOT_NODE_ID,
  );

  if (!clipboard) {
    return;
  }

  if (!getPrefabNode(clipboard.sourceNodeId)) {
    setImportError(new Error("Select an existing prefab node before copy or cut."));
    return;
  }

  editorState.pendingPrefabClipboard = clipboard;
  renderEditorShell();
  exposeEditorDebugHooks();
}

function pastePendingPrefabClipboard(): void {
  if (!editorState.pendingPrefabClipboard) {
    return;
  }

  const nextState = pastePrefabClipboard(
    editorState.prefabNodes,
    editorState.pendingPrefabClipboard,
    editorState.selectedPrefabNodeId,
    PREFAB_ROOT_NODE_ID,
    createNextPrefabNodeId,
  );

  if ("error" in nextState) {
    if (nextState.error !== "Cannot paste a group or node inside itself.") {
      editorState.pendingPrefabClipboard = null;
    }
    setImportError(new Error(nextState.error));
    return;
  }

  editorState.prefabNodes = nextState.nodes;
  editorState.selectedPrefabNodeId = nextState.selectedNodeId;
  editorState.pendingPrefabClipboard = null;
  editorState.loadedPrefabId = null;
  editorState.lastImportError = null;
  hideError();
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function syncSelectionFromSceneNode(): void {
  const node = editorState.selectedSceneNodeId ? getSceneNode(editorState.selectedSceneNodeId) : null;
  const sync = getSceneNodeSelectionSync(node);

  if (sync.selectedAssetId !== undefined) {
    editorState.selectedAssetId = sync.selectedAssetId;
  }

  if (sync.selectedPrefabId !== undefined) {
    editorState.selectedPrefabId = sync.selectedPrefabId;
  }
}

function syncPrefabProxyWorldTransforms(exceptNodeId: string | null = null): void {
  for (const proxyNode of createPrefabWorldProxyNodes(editorState.prefabNodes, exceptNodeId)) {
    threeViewport.syncProxyFromNode(proxyNode);
  }
}

function toggleCollapsibleModule(moduleId: CollapsibleModuleId): void {
  applyEditorCommand({
    type: "toggleCollapsedModule",
    moduleId,
    collapsedModuleIds,
  });
}

function renderCollapsibleModules(): void {
  renderCollapsibleModulesForState(collapsedModuleIds);
}

function renderEditorShell(): void {
  renderCache.markUiShellDirty();
  const activeTimelineClip = getActiveTimelineClip();
  const validInPlacePathEditSession =
    editorState.editorMode === "asset" &&
    editorState.activeEditorTool === "path" &&
    editorState.inPlacePathEditSession
      ? editorState.inPlacePathEditSession
      : null;

  renderEditorShellFrame({
    elements,
    mode: editorState.editorMode,
    selectedProjectId: editorState.selectedProjectId,
    selectedAssetId: editorState.selectedAssetId,
    selectedAsset: getSelectedAsset(),
    selectedPrefabId: editorState.selectedPrefabId,
    selectedSceneId: editorState.selectedSceneId,
    selectedSceneNodeId: editorState.selectedSceneNodeId,
    selectedPrefabNodeId: editorState.selectedPrefabNodeId,
    prefabRootNodeId: PREFAB_ROOT_NODE_ID,
    pendingPrefabClipboard: Boolean(editorState.pendingPrefabClipboard),
    hasPathEditSession: Boolean(editorState.pathEditSession),
    hasPathEdit3DSession: Boolean(editorState.pathEdit3DSession),
    hasViewMorphProfileEditSession: Boolean(
      editorState.viewMorphProfileEditSession,
    ),
    hasValidInPlacePathEditSession: Boolean(validInPlacePathEditSession),
    activeTimelineClip,
    timelineCurrentTimeMs: editorState.timelineCurrentTimeMs,
    isTimelinePlaying: editorState.isTimelinePlaying,
    activeTimelineProperty: getActiveTimelineProperty(),
    currentProjection: threeViewport.currentProjection,
    canConvertSelectedAssetTo3DCurve: canConvertPrimitiveAssetTo3DCurve(
      getSelectedAsset(),
    ),
    activeEditorTool: editorState.activeEditorTool,
    canUseTool,
    renderProjectList,
    renderAssetList,
    renderPathAssetList,
    renderPrefabList,
    renderPrefabNodeList,
    renderPrefabTimeline,
    renderSceneList,
    renderSceneNodeList,
    renderSourcePathEditPanel,
    renderInspector,
    renderCollapsibleModules,
  });
}

function renderProjectList(): void {
  elements.projectList.replaceChildren(
    ...editorState.projects.map((project) => {
      const item = document.createElement("li");
      const button = document.createElement("button");

      button.type = "button";
      button.className = "asset-list-item";
      button.dataset.projectId = project.id;
      button.dataset.selected = String(project.id === editorState.selectedProjectId);
      button.textContent = project.name;
      button.addEventListener("click", () => {
        if (editorState.selectedProjectId !== project.id) {
          clearProjectWorkspace();
        }

        editorState.selectedProjectId = project.id;
        void refreshAssets();
        void refreshPrefabs();
        void refreshScenes();
      });

      item.append(button);
      return item;
    }),
  );
}

function renderAssetList(): void {
  elements.assetList.replaceChildren(
    ...editorState.assets.map((asset) => {
      const item = document.createElement("li");
      const button = document.createElement("button");

      button.type = "button";
      button.className = "asset-list-item";
      button.dataset.assetId = asset.id;
      button.dataset.selected = String(asset.id === editorState.selectedAssetId);
      button.textContent = `${getAssetKindListLabel(asset)}: ${asset.name}`;
      button.addEventListener("click", () => {
        editorState.selectedAssetId = asset.id;
        renderEditorShell();
        exposeEditorDebugHooks();
      });

      item.append(button);
      return item;
    }),
  );
}

function renderPathAssetList(): void {
  elements.pathAssetList.replaceChildren(
    ...editorState.assets.map((asset) => {
      const item = document.createElement("li");
      const button = document.createElement("button");

      button.type = "button";
      button.className = "asset-list-item";
      button.dataset.selected = String(asset.id === editorState.selectedAssetId);
      button.textContent = `${getAssetKindListLabel(asset)}: ${asset.name}`;
      button.addEventListener("click", () => {
        editorState.selectedAssetId = asset.id;
        if (editorState.pathEditSession && editorState.pathEditSession.assetId !== asset.id) {
          editorState.pathEditSession = null;
          editorState.pathEditDragState = null;
        }
        if (editorState.pathEdit3DSession && editorState.pathEdit3DSession.assetId !== asset.id) {
          editorState.pathEdit3DSession = null;
          threeViewport.clearCurve3DControls();
        }
        if (
          editorState.viewMorphProfileEditSession &&
          editorState.viewMorphProfileEditSession.assetId !== asset.id
        ) {
          editorState.viewMorphProfileEditSession = null;
          editorState.viewMorphProfileEditDragState = null;
          editorState.viewMorphProfileEditHoveredControl = null;
        }
        renderEditorShell();
        exposeEditorDebugHooks();
      });

      item.append(button);
      return item;
    }),
  );
}

function renderPrefabList(): void {
  elements.prefabList.replaceChildren(
    ...editorState.prefabs.map((prefab) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const loadedMarker = prefab.id === editorState.loadedPrefabId ? " *" : "";

      button.type = "button";
      button.className = "asset-list-item";
      button.dataset.prefabId = prefab.id;
      button.dataset.selected = String(prefab.id === editorState.selectedPrefabId);
      button.textContent = `${prefab.name}${loadedMarker}`;
      button.addEventListener("click", () => {
        editorState.selectedPrefabId = prefab.id;
        renderEditorShell();
        exposeEditorDebugHooks();
      });

      item.append(button);
      return item;
    }),
  );
}

function renderPrefabNodeList(): void {
  const rootItem = document.createElement("li");
  const rootButton = document.createElement("button");

  rootButton.type = "button";
  rootButton.className = "asset-list-item";
  rootButton.dataset.prefabNodeId = PREFAB_ROOT_NODE_ID;
  rootButton.dataset.selected = String(editorState.selectedPrefabNodeId === PREFAB_ROOT_NODE_ID);
  rootButton.textContent = "Group: Root Group";
  rootButton.addEventListener("click", () => {
    if (editorState.selectedPrefabNodeId !== PREFAB_ROOT_NODE_ID) {
      exitPathTool();
    }
    editorState.selectedPrefabNodeId = PREFAB_ROOT_NODE_ID;
    syncActiveToolAfterSelectionChange();
    threeViewport.setSelectedNode(null);
    renderEditorShell();
    exposeEditorDebugHooks();
  });
  rootItem.append(rootButton);

  elements.prefabNodeList.replaceChildren(
    rootItem,
    ...getPrefabNodeTreeEntries().map(({ node, depth }) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const asset =
        node.kind === "primitive" && node.assetId
          ? getAssetById(node.assetId)
          : null;
      const label =
        node.kind === "group"
          ? `Group: ${node.name}`
          : `Primitive: ${asset?.name ?? `Missing ${node.assetId ?? "asset id"}`}`;

      button.type = "button";
      button.className = "asset-list-item";
      button.dataset.prefabNodeId = node.id;
      button.dataset.selected = String(node.id === editorState.selectedPrefabNodeId);
      button.style.paddingLeft = `${12 + depth * 14}px`;
      button.textContent = label;
      button.addEventListener("click", () => {
        editorState.selectedPrefabNodeId = node.id;
        syncSelectionFromPrefabNode();
        syncActiveToolAfterSelectionChange();
        if (editorState.editorMode === "asset") {
          rebuildViewportProxies();
        }
        renderEditorShell();
        exposeEditorDebugHooks();
      });

      item.append(button);
      return item;
    }),
  );
}

function renderPrefabTimeline(): void {
  const activeClip = getActiveTimelineClip();
  const activeProperty = getActiveTimelineProperty();

  if (!activeClip) {
    renderTimelinePanel({
      elements,
      animation: editorState.prefabAnimation,
      currentTimeMs: editorState.timelineCurrentTimeMs,
      defaultDurationMs: DEFAULT_TIMELINE_DURATION_MS,
      activeClip: null,
      selectedNode:
        editorState.selectedPrefabNodeId && editorState.selectedPrefabNodeId !== PREFAB_ROOT_NODE_ID
          ? getPrefabNode(editorState.selectedPrefabNodeId)
          : null,
      activeProperty,
      laneProperties: TIMELINE_LANE_PROPERTIES,
      selectedKeyframeId: editorState.selectedTimelineKeyframeId,
      getTrack: findTimelineTrack,
      getSelectedKeyframe: getSelectedTimelineKeyframe,
      onSelectBasePose: selectBasePoseTimeline,
      onSelectClip: selectTimelineClip,
      onSelectProperty: setActiveTimelineProperty,
      onTrackClick: () => {},
      onKeyframeClick: () => {},
      onKeyframePointerDown: () => {},
    });
    return;
  }

  renderTimelinePanel({
    elements,
    animation: editorState.prefabAnimation,
    currentTimeMs: editorState.timelineCurrentTimeMs,
    defaultDurationMs: DEFAULT_TIMELINE_DURATION_MS,
    activeClip,
    selectedNode:
      editorState.selectedPrefabNodeId && editorState.selectedPrefabNodeId !== PREFAB_ROOT_NODE_ID
        ? getPrefabNode(editorState.selectedPrefabNodeId)
        : null,
    activeProperty,
    laneProperties: TIMELINE_LANE_PROPERTIES,
    selectedKeyframeId: editorState.selectedTimelineKeyframeId,
    getTrack: findTimelineTrack,
    getSelectedKeyframe: getSelectedTimelineKeyframe,
    onSelectBasePose: selectBasePoseTimeline,
    onSelectClip: selectTimelineClip,
    onSelectProperty: setActiveTimelineProperty,
    onTrackClick: (property, event) => {
      if (property !== getActiveTimelineProperty()) {
        setActiveTimelineProperty(property);
        return;
      }

      editorState.timelineCurrentTimeMs = timeMsFromTimelinePointer(event, activeClip);
      editorState.selectedTimelineKeyframeId = null;
      editorState.isTimelinePlaying = false;
      rebuildViewportProxies();
      renderEditorShell();
      exposeEditorDebugHooks();
    },
    onKeyframeClick: (property, keyframeId, timeMs, event) => {
      event.stopPropagation();
      if (property !== getActiveTimelineProperty()) {
        setActiveTimelineProperty(property);
        return;
      }

      editorState.selectedTimelineKeyframeId = keyframeId;
      editorState.timelineCurrentTimeMs = timeMs;
      editorState.isTimelinePlaying = false;
      renderEditorShell();
      exposeEditorDebugHooks();
    },
    onKeyframePointerDown: (property, keyframeId, event) => {
      event.stopPropagation();
      if (property !== getActiveTimelineProperty()) {
        setActiveTimelineProperty(property);
        return;
      }

      editorState.selectedTimelineKeyframeId = keyframeId;
      editorState.timelinePointerDrag = {
        keyframeId,
        property,
      };
    },
  });
}

function renderSceneList(): void {
  elements.sceneList.replaceChildren(
    ...editorState.scenes.map((scene) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const loadedMarker = scene.id === editorState.loadedSceneId ? " *" : "";

      button.type = "button";
      button.className = "asset-list-item";
      button.dataset.sceneId = scene.id;
      button.dataset.selected = String(scene.id === editorState.selectedSceneId);
      button.textContent = `${scene.name}${loadedMarker}`;
      button.addEventListener("click", () => {
        editorState.selectedSceneId = scene.id;
        renderEditorShell();
        exposeEditorDebugHooks();
      });

      item.append(button);
      return item;
    }),
  );
}

function renderSceneNodeList(): void {
  elements.sceneNodeList.replaceChildren(
    ...editorState.sceneNodes.map((node) => {
      const item = document.createElement("li");
      const button = document.createElement("button");

      button.type = "button";
      button.className = "asset-list-item";
      button.dataset.nodeId = node.id;
      button.dataset.selected = String(node.id === editorState.selectedSceneNodeId);
      button.textContent = getSceneNodeLabel(node);
      button.addEventListener("click", () => {
        editorState.selectedSceneNodeId = node.id;
        syncSelectionFromSceneNode();
        if (editorState.editorMode === "scene") {
          threeViewport.setSelectedNode(node.id);
        }
        renderEditorShell();
        exposeEditorDebugHooks();
      });

      item.append(button);
      return item;
    }),
  );
}

function renderSourcePathEditPanel(): void {
  elements.pathEditFields.replaceChildren();

  const selectedAsset = getSelectedAsset();
  const status = document.createElement("span");
  status.className = "path-edit-status";

  if (!editorState.selectedProjectId) {
    status.textContent = "Create or select a project";
    elements.pathEditFields.append(status);
    return;
  }

  if (!selectedAsset) {
    status.textContent = "Select a primitive asset";
    elements.pathEditFields.append(status);
    return;
  }

  if (editorState.pathEdit3DSession && editorState.pathEdit3DSession.assetId === selectedAsset.id) {
    const selectedSegment = getSelectedPathEdit3DSegment(editorState.pathEdit3DSession);
    status.textContent = editorState.pathEdit3DSession.selected
      ? `${editorState.pathEdit3DSession.selected.segmentId} / ${editorState.pathEdit3DSession.selected.component} / 3D`
      : "Select a 3D anchor or handle";
    elements.pathEditFields.append(status);

    if (selectedSegment && editorState.pathEdit3DSession.selected) {
      elements.pathEditFields.append(
        createPathEdit3DPointInputRowForUi(selectedSegment, editorState.pathEdit3DSession.selected.component, {
          onApply: applyPathEdit3DPointInput,
        }),
      );
    }
    return;
  }

  if (
    editorState.viewMorphProfileEditSession &&
    editorState.viewMorphProfileEditSession.assetId === selectedAsset.id
  ) {
    renderViewMorphProfileEditPanel();
    return;
  }

  if (!editorState.pathEditSession || editorState.pathEditSession.assetId !== selectedAsset.id) {
    status.textContent =
      selectedAsset.assetKind === "viewMorphProfile"
        ? "Click Edit Path to edit this view morph profile."
        : primitiveAssetHas3DSourcePath(selectedAsset)
        ? "Click Edit Path to edit this 3D source curve."
        : "Click Edit Path to edit the selected asset source.";
    elements.pathEditFields.append(status);
    return;
  }

  const selectedSegment = getSelectedPathEditSegment(editorState.pathEditSession);
  status.textContent = editorState.pathEditSession.selected
    ? `${editorState.pathEditSession.selected.segmentId} / ${editorState.pathEditSession.selected.component}`
    : "Select an anchor or handle";
  elements.pathEditFields.append(status);

  if (selectedSegment && editorState.pathEditSession.selected) {
    elements.pathEditFields.append(
      createPathEditPointInputRowForUi(selectedSegment, editorState.pathEditSession.selected.component, {
        onApply: (input, segmentId, component, axisIndex) => {
          applyPathEditPointInput(
            input,
            editorState.pathEditSession,
            segmentId,
            component,
            axisIndex,
          );
        },
      }),
    );
  }
}

function renderViewMorphProfileEditPanel(): void {
  const session = editorState.viewMorphProfileEditSession;

  if (!session) {
    return;
  }

  const status = document.createElement("span");
  status.className = "path-edit-status";
  status.textContent = session.selected
    ? `${session.selected.planeId} / ${session.selected.pointId}`
    : "Select a profile point";
  elements.pathEditFields.append(status);

  const planeRow = document.createElement("div");
  planeRow.className = "path-edit-point-row";

  for (const plane of getViewMorphProfileEditPlaneRefs(session.draft)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "editor-button";
    button.textContent = plane.name;
    button.dataset.selected = String(
      session.selectedPlane.kind === plane.kind &&
        session.selectedPlane.planeId === plane.planeId,
    );
    button.addEventListener("click", () => {
      setViewMorphProfileEditPlane(session, plane);
      editorState.viewMorphProfileEditDragState = null;
      editorState.viewMorphProfileEditHoveredControl = null;
      renderCache.markVectorDirty();
      renderCache.markPaperDirty();
      renderEditorShell();
      exposeEditorDebugHooks();
    });
    planeRow.append(button);
  }

  elements.pathEditFields.append(planeRow);

  const selectedPoint = getSelectedViewMorphProfilePoint(session);

  if (selectedPoint) {
    elements.pathEditFields.append(
      createViewMorphProfilePointInputRow(selectedPoint),
    );
  }
}

function createViewMorphProfilePointInputRow(
  control: ViewMorphProfileEditControl,
): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "path-edit-point-row";

  control.point.forEach((value, axisIndex) => {
    const input = document.createElement("input");
    const axisName = axisIndex === 0 ? "X" : "Y";

    input.className = "transform-number-input";
    input.type = "text";
    input.inputMode = "decimal";
    input.ariaLabel = `View morph point ${axisName}`;
    input.value = formatTransformValue(value);
    input.addEventListener("focus", () => {
      input.dataset.previousValue = input.value;
    });
    input.addEventListener("blur", () => {
      applyViewMorphProfilePointInput(input, control, axisIndex);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        input.blur();
      }

      if (event.key === "Escape") {
        input.value = input.dataset.previousValue ?? formatTransformValue(value);
        input.blur();
      }
    });

    row.append(input);
  });

  return row;
}

function renderInspector(): void {
  elements.inspectorFields.replaceChildren();

  const model = createInspectorHeaderModel({
    selectedProject: getSelectedProject(),
    camera: threeViewport.getCameraSnapshot(),
  });

  if (!model.hasProject) {
    appendInspectorRow("Status", "Create or select a project");
    return;
  }

  appendInspectorRow("Mode", getEditorModeLabel(editorState.editorMode));
  appendInspectorRow("Project", model.project.name);
  appendInspectorRow("Project ID", model.project.id);
  appendInspectorRow("Projection", model.camera.projection);
  appendCameraVectorInspectorRow("Camera Pos", "position", model.camera.position);
  appendCameraVectorInspectorRow("Camera Target", "target", model.camera.target);

  if (editorState.editorMode === "asset" || editorState.editorMode === "path") {
    renderAssetModeInspector();
  } else {
    renderSceneModeInspector();
  }
}

function renderAssetModeInspector(): void {
  const model = createAssetModeInspectorModel({
    selectedPrefab: getSelectedPrefab(),
    loadedPrefabId: editorState.loadedPrefabId,
    selectedNodeId: editorState.selectedPrefabNodeId,
    rootNodeId: PREFAB_ROOT_NODE_ID,
    getPrefabNode,
    selectedAsset: getSelectedAsset(),
    getAssetById,
    stagingTransform: getActiveTimelineClip()
      ? getSelectedTimelineStagingTransform()
      : null,
  });

  appendInspectorRow("Selected Prefab", model.selectedPrefab?.name ?? "None");
  appendInspectorRow("Loaded Prefab", model.loadedPrefabId ?? "None");
  appendAssetInspectorRows(model.inspectedAsset);

  if (model.selectedNodeIsRoot) {
    appendInspectorRow("Prefab Node", "Root Group");
    appendInspectorRow("Kind", "virtual group");
    appendInspectorRow("Parent", "None");
    return;
  }

  if (!model.selectedNode || !model.editableTransform) {
    appendInspectorRow("Prefab Node", "No node selected");
    return;
  }

  const selectedNode = model.selectedNode;
  appendInspectorRow("Prefab Node", selectedNode.id);
  appendInspectorRow("Node Name", selectedNode.name);
  appendInspectorRow("Kind", selectedNode.kind);
  appendInspectorRow("Parent", selectedNode.parentId ?? "Root");

  if (selectedNode.kind === "primitive") {
    const assetId = selectedNode.assetId ?? "Missing asset id";
    appendInspectorRow("Node Asset", assetId);
    if (!selectedNode.assetId || !getAssetById(selectedNode.assetId)) {
      appendInspectorRow("Missing Asset", assetId);
    }
  }

  appendTransformInspectorRow("Position", model.editableTransform, "position");
  appendTransformInspectorRow("Rotation", model.editableTransform, "rotation");
  appendTransformInspectorRow("Scale", model.editableTransform, "scale");
  appendInspectorRow("Billboard", selectedNode.billboardMode);
  renderInPlacePathEditInspector(selectedNode);
}

function renderSceneModeInspector(): void {
  const model = createSceneModeInspectorModel({
    selectedScene: getSelectedScene(),
    loadedSceneId: editorState.loadedSceneId,
    selectedNodeId: editorState.selectedSceneNodeId,
    getSceneNode,
    getAssetById,
    getPrefabNameById: (prefabId) => getPrefabRecordById(prefabId)?.name ?? null,
    hasPrefabDocument: (prefabId) => Boolean(getPrefabDocumentById(prefabId)),
  });

  appendInspectorRow("Selected Scene", model.selectedScene?.name ?? "None");
  appendInspectorRow("Loaded Scene", model.loadedSceneId ?? "None");

  if (!model.selectedNode) {
    appendInspectorRow("Scene Node", "No node selected");
    return;
  }

  const selectedNode = model.selectedNode;
  appendInspectorRow("Scene Node", selectedNode.id);
  appendInspectorRow("Kind", selectedNode.kind);

  if (selectedNode.kind === "primitive") {
    appendAssetInspectorRows(model.inspectedAsset);
    appendInspectorRow("Node Asset", selectedNode.assetId);
    if (!model.inspectedAsset) {
      appendInspectorRow("Missing Asset", selectedNode.assetId);
    }
    appendInspectorRow("Billboard", selectedNode.billboardMode);
  } else {
    appendInspectorRow("Prefab", model.prefabName ?? "Missing Prefab");
    appendInspectorRow("Prefab ID", selectedNode.prefabId);
    if (!model.prefabExists) {
      appendInspectorRow("Missing Prefab", selectedNode.prefabId);
    }
  }

  appendTransformInspectorRow("Position", selectedNode, "position");
  appendTransformInspectorRow("Rotation", selectedNode, "rotation");
  appendTransformInspectorRow("Scale", selectedNode, "scale");
}

function appendAssetInspectorRows(asset: PrimitiveSvgAsset | null): void {
  appendAssetInspectorRowsForUi(elements, asset);
}

function renderInPlacePathEditInspector(node: PrefabNode): void {
  if (editorState.editorMode !== "asset" || node.kind !== "primitive") {
    return;
  }

  const session =
    editorState.inPlacePathEditSession?.nodeId === node.id ? editorState.inPlacePathEditSession : null;

  if (!session) {
    appendInspectorRow("In-Place Path", "Use the Path tool to preview-edit this node");
    return;
  }

  const selectedSegment = getSelectedPathEditSegment(session);

  appendInspectorRow("In-Place Path", "Preview only");
  appendInspectorRow(
    "Path Target",
    session.selected
      ? `${session.selected.segmentId} / ${session.selected.component}`
      : "Select an anchor or handle",
  );

  if (selectedSegment && session.selected) {
    appendPathEditInspectorInputRow(
      "Path Point",
      session,
      selectedSegment,
      session.selected.component,
    );
  }

  appendInspectorActionRow("Discard Path Preview", () => {
    exitPathTool();
    renderEditorShell();
    exposeEditorDebugHooks();
  });
}

function appendPathEditInspectorInputRow(
  label: string,
  session: PathEditSession,
  segment: BezierSegment,
  component: PathEditComponent,
): void {
  appendPathEditInspectorInputRowForUi(elements, label, segment, component, {
    ariaPrefix: "In-place path",
    onApply: (input, segmentId, inputComponent, axisIndex) => {
      applyPathEditPointInput(
        input,
        session,
        segmentId,
        inputComponent,
        axisIndex,
        () => {
          syncInPlacePathSessionToStagingPose();
          renderInspector();
          exposeEditorDebugHooks();
        },
      );
    },
  });
}

function appendInspectorActionRow(label: string, onClick: () => void): void {
  appendInspectorActionRowForUi(elements, label, onClick);
}

function appendInspectorRow(label: string, value: string): void {
  appendInspectorRowForUi(elements, label, value);
}

function appendCameraVectorInspectorRow(
  label: string,
  property: "position" | "target",
  value: Vector3Tuple,
): void {
  appendVector3InspectorRowForUi(elements, label, value, {
    onApply: (input, axisIndex) => {
      applyCameraVectorInput(input, property, axisIndex);
    },
  });
}

function applyCameraVectorInput(
  input: HTMLInputElement,
  property: "position" | "target",
  axisIndex: number,
): void {
  const snapshot = threeViewport.getCameraSnapshot();
  const parsedValue = Number(input.value.trim());

  if (!Number.isFinite(parsedValue)) {
    restoreCameraVectorInput(input, snapshot[property], axisIndex);
    return;
  }

  const nextValue = [...snapshot[property]] as Vector3Tuple;
  nextValue[axisIndex] = roundTransformValue(parsedValue);

  const nextSnapshot = {
    ...snapshot,
    [property]: nextValue,
  };

  threeViewport.applyCameraSnapshot(nextSnapshot);
  renderCache.markCameraDirty();
  renderInspector();
  exposeEditorDebugHooks();
}

function restoreCameraVectorInput(
  input: HTMLInputElement,
  value: Vector3Tuple,
  axisIndex: number,
): void {
  input.value =
    input.dataset.previousValue ?? formatTransformValue(value[axisIndex] ?? 0);
}

function applyPathEdit3DPointInput(
  input: HTMLInputElement,
  segmentId: string,
  component: PathEditComponent,
  axisIndex: number,
): void {
  const segment = getPathEdit3DSegment(editorState.pathEdit3DSession, segmentId);
  const parsedValue = Number(input.value.trim());

  if (!editorState.pathEdit3DSession || !segment || !Number.isFinite(parsedValue)) {
    restorePathEdit3DPointInput(input, segment, component, axisIndex);
    return;
  }

  const point = getPathEdit3DComponentPoint(segment, component);
  point[axisIndex] = roundBezierValue(parsedValue);

  if (component === "anchor") {
    segment.anchor = point;
  } else {
    segment[component] = point;
  }

  editorState.pathEdit3DSession.selected = { segmentId, component };
  syncSourcePathEdit3DControls();
  renderSourcePathEditPanel();
  exposeEditorDebugHooks();
}

function restorePathEdit3DPointInput(
  input: HTMLInputElement,
  segment: BezierSegment3D | null,
  component: PathEditComponent,
  axisIndex: number,
): void {
  const point = segment ? getPathEdit3DComponentPoint(segment, component) : null;
  input.value = point
    ? formatTransformValue(point[axisIndex] ?? 0)
    : (input.dataset.previousValue ?? "");
}

function applyViewMorphProfilePointInput(
  input: HTMLInputElement,
  control: ViewMorphProfileEditControl,
  axisIndex: number,
): void {
  const session = editorState.viewMorphProfileEditSession;
  const parsedValue = Number(input.value.trim());
  const selection = {
    kind: control.kind,
    planeId: control.planeId,
    pointId: control.pointId,
  };

  if (
    !session ||
    !Number.isFinite(parsedValue) ||
    !setViewMorphProfilePointAxisValue(
      session,
      selection,
      axisIndex,
      parsedValue,
    )
  ) {
    input.value =
      input.dataset.previousValue ??
      formatTransformValue(control.point[axisIndex] ?? 0);
    return;
  }

  input.value = formatTransformValue(
    getSelectedViewMorphProfilePoint(session)?.point[axisIndex] ?? parsedValue,
  );
  renderCache.markVectorDirty();
  renderCache.markPaperDirty();
  renderSourcePathEditPanel();
  exposeEditorDebugHooks();
}

function applyPathEditPointInput(
  input: HTMLInputElement,
  session: PathEditSession | null,
  segmentId: string,
  component: PathEditComponent,
  axisIndex: number,
  onApplied?: () => void,
): void {
  const segment = getPathEditSegment(session, segmentId);
  const parsedValue = Number(input.value.trim());

  if (!session || !segment || !Number.isFinite(parsedValue)) {
    restorePathEditPointInput(input, segment, component, axisIndex);
    return;
  }

  if (
    !applyPathEditCommand(session, {
      type: "setComponentAxisValue",
      segmentId,
      component,
      axisIndex,
      value: parsedValue,
    }).ok
  ) {
    restorePathEditPointInput(input, segment, component, axisIndex);
    return;
  }

  if (onApplied) {
    onApplied();
  } else {
    renderSourcePathEditPanel();
    exposeEditorDebugHooks();
  }
}

function restorePathEditPointInput(
  input: HTMLInputElement,
  segment: BezierSegment | null,
  component: PathEditComponent,
  axisIndex: number,
): void {
  const point = segment ? getPathEditComponentPoint(segment, component) : null;
  input.value = point
    ? formatTransformValue(point[axisIndex] ?? 0)
    : (input.dataset.previousValue ?? "");
}

function appendTransformInspectorRow(
  label: string,
  node: EditorTransformNode,
  property: TransformProperty,
): void {
  appendTransformInspectorRowForUi(elements, label, node, property, {
    onApply: applyTransformInput,
  });
}

function applyTransformInput(
  input: HTMLInputElement,
  nodeId: string,
  property: TransformProperty,
  axisIndex: number,
): void {
  const node = editorState.editorMode === "asset" ? getPrefabNode(nodeId) : getSceneNode(nodeId);
  const parsedValue = Number(input.value.trim());
  const stagingTransform =
    editorState.editorMode === "asset" && getActiveTimelineClip()
      ? getSelectedTimelineStagingTransform()
      : null;
  const editableNode =
    editorState.editorMode === "asset" && node
      ? {
          id: node.id,
          position: stagingTransform?.position ?? [...node.position],
          rotation: stagingTransform?.rotation ?? [...node.rotation],
          scale: stagingTransform?.scale ?? [...node.scale],
        }
      : node;

  if (!node || !editableNode || !Number.isFinite(parsedValue)) {
    restoreTransformInput(input, editableNode, property, axisIndex);
    return;
  }

  if (property === "scale" && Math.abs(parsedValue) < 0.0001) {
    restoreTransformInput(input, editableNode, property, axisIndex);
    return;
  }

  const nextValue = [...editableNode[property]] as Vector3Tuple;
  nextValue[axisIndex] = roundTransformValue(parsedValue);

  if (editorState.editorMode === "asset") {
    const activeClip = getActiveTimelineClip();

    if (activeClip) {
      const stagingPose = getOrCreateTimelineStagingPose(node as PrefabNode, activeClip);
      stagingPose[property] = nextValue;
      threeViewport.syncProxyFromNode({
        id: node.id,
        ...getTimelineStagingWorldTransform(stagingPose),
      });
      renderCache.markAssetBillboardsDirty();
    } else {
      node[property] = nextValue;
      pauseTimeline();
      editorState.loadedPrefabId = null;
      rebuildViewportProxies();
    }
  } else {
    node[property] = nextValue;
    editorState.loadedSceneId = null;
    threeViewport.syncProxyFromNode(node);
    renderCache.markSceneBillboardsDirty();
  }

  renderEditorShell();
  exposeEditorDebugHooks();
}

function restoreTransformInput(
  input: HTMLInputElement,
  node: EditorTransformNode | null,
  property: TransformProperty,
  axisIndex: number,
): void {
  input.value = node
    ? formatTransformValue(node[property][axisIndex] ?? 0)
    : (input.dataset.previousValue ?? "");
}

function renderPreviewFrame(): void {
  const assetAssemblyBillboards =
    editorState.editorMode === "asset" ? getCachedAssetAssemblyBillboards() : [];
  const sceneLayoutBillboards =
    editorState.editorMode === "scene" ? getCachedSceneLayoutBillboards() : [];

  renderEditorFrame({
    stage,
    mode: editorState.editorMode,
    hasSelectedProject: Boolean(editorState.selectedProjectId),
    selectedAsset: getSelectedAsset(),
    assetAssemblyBillboards,
    sceneLayoutBillboards,
    clearCurve3DControls: () => threeViewport.clearCurve3DControls(),
    renderThreeViewport: () => threeViewport.render(stage.size),
    renderPathEditFrame,
    renderInPlacePathEditOverlay,
    drawBillboards,
    drawSourcePathEdit3DPreview,
  });

  renderCache.clearFrameDirtyFlags();
}

function renderPathEditFrame(): void {
  const vectorContext = stage.getLayer("vector-canvas").context;
  const paperContext = stage.getLayer("paper-canvas").context;
  const asset = editorState.pathEditSession ? getAssetById(editorState.pathEditSession.assetId) : null;
  const asset3d = editorState.pathEdit3DSession
    ? getAssetById(editorState.pathEdit3DSession.assetId)
    : null;
  const viewMorphAsset = editorState.viewMorphProfileEditSession
    ? getAssetById(editorState.viewMorphProfileEditSession.assetId)
    : null;

  if (!editorState.selectedProjectId) {
    drawCenteredStatus(vectorContext, stage.size, "Create or select a project");
    return;
  }

  if (editorState.pathEdit3DSession) {
    threeViewport.render(stage.size);

    if (!asset3d || !primitiveAssetHas3DSourcePath(asset3d)) {
      drawCenteredStatus(vectorContext, stage.size, "3D curve asset is missing");
      threeViewport.clearCurve3DControls();
      return;
    }

    drawSourcePathEdit3DPreview(vectorContext, asset3d, editorState.pathEdit3DSession.draft);
    syncSourcePathEdit3DControls();
    return;
  }

  threeViewport.clearCurve3DControls();

  if (editorState.viewMorphProfileEditSession) {
    if (!viewMorphAsset || viewMorphAsset.assetKind !== "viewMorphProfile") {
      drawCenteredStatus(vectorContext, stage.size, "View morph profile asset is missing");
      return;
    }

    const editPath = getViewMorphProfileEditPath(
      editorState.viewMorphProfileEditSession.draft,
      editorState.viewMorphProfileEditSession.selectedPlane,
    );
    const previewBezierPath = smoothViewMorphPolylineToBezierPath(
      editPath ?? viewMorphAsset.viewMorphProfile.horizontalPlane.path,
    );
    const previewPathD = structuredBezierToPathD(previewBezierPath);
    const previewAsset = {
      ...viewMorphAsset,
      pathD: previewPathD,
      path: new Path2D(previewPathD),
      bezierPath: previewBezierPath,
      viewMorphProfile: editorState.viewMorphProfileEditSession.draft,
    };
    const transform = getSourcePathEditViewTransform(previewAsset);

    drawPathEditPreview(vectorContext, previewAsset, transform);
    drawViewMorphProfileEditControls(
      paperContext,
      editorState.viewMorphProfileEditSession,
      getViewMorphProfileEditAdapter(previewAsset, transform),
      editorState.viewMorphProfileEditHoveredControl,
    );
    return;
  }

  if (!editorState.pathEditSession) {
    const selectedAsset = getSelectedAsset();

    if (selectedAsset) {
      if (primitiveAssetHas3DSourcePath(selectedAsset)) {
        threeViewport.render(stage.size);
        drawSourcePathEdit3DPreview(
          vectorContext,
          selectedAsset,
          selectedAsset.bezierPath3d,
        );
      } else {
        drawPrimitivePreview(vectorContext, stage.size, selectedAsset);
      }
      drawCenteredStatus(paperContext, stage.size, "Click Edit Path to edit source curves");
      return;
    }

    drawCenteredStatus(vectorContext, stage.size, "Select a primitive asset");
    return;
  }

  if (!asset) {
    drawCenteredStatus(vectorContext, stage.size, "Source path asset is missing");
    return;
  }

  const pathD = buildPathEditPathD(editorState.pathEditSession.draft);
  const previewAsset = {
    ...asset,
    pathD,
    path: new Path2D(pathD),
    bezierPath: editorState.pathEditSession.draft,
  };

  drawPathEditPreview(
    vectorContext,
    previewAsset,
    getSourcePathEditViewTransform(previewAsset),
  );
  drawPathEditControls(
    paperContext,
    editorState.pathEditSession,
    getSourcePathEditAdapter(previewAsset),
    editorState.pathEditHoveredControl,
  );
}

function renderInPlacePathEditOverlay(): void {
  const paperContext = stage.getLayer("paper-canvas").context;
  const session = getValidInPlacePathEditSession();
  const asset = session ? getAssetById(session.assetId) : null;

  if (!session || !asset) {
    return;
  }

  const adapter = getInPlacePathEditAdapter();

  if (adapter) {
    drawPathEditControls(
      paperContext,
      session,
      adapter,
      editorState.inPlacePathEditHoveredControl,
    );
  }
}

function getCachedAssetAssemblyBillboards(): DrawableBillboard[] {
  return renderCache.getAssetAssemblyBillboards({
    nodes: editorState.prefabNodes,
    evaluatedNodes: getEvaluatedPrefabNodes(),
    selectedNodeId: editorState.selectedPrefabNodeId,
    activeClip: getActiveTimelineClip(),
    selectedNode: getSelectedPrefabNode(),
    pathOverrides: getEvaluatedPrefabPathOverrides(),
  });
}

function getCachedSceneLayoutBillboards(): DrawableBillboard[] {
  return renderCache.getSceneLayoutBillboards({
    nodes: editorState.sceneNodes,
    selectedNodeId: editorState.selectedSceneNodeId,
  });
}

function drawBillboards(
  context: CanvasRenderingContext2D,
  drawables: DrawableBillboard[],
): void {
  drawBillboardsWithRenderer(context, drawables, getBillboardRendererContext());
}

function getBillboardRendererContext(): BillboardRendererContext {
  return {
    camera: threeViewport.activeCamera,
    viewport: stage.size,
    projectWorldPosition: (position) =>
      threeViewport.projectWorldPosition(tupleToVector(position), stage.size),
    getDistanceScale: (position, worldSize) =>
      threeViewport.getDistanceScale(tupleToVector(position), worldSize),
    getAsset3DLocalToWorldUnitMatrix,
  };
}

function drawSourcePathEdit3DPreview(
  context: CanvasRenderingContext2D,
  asset: Extract<PrimitiveSvgAsset, { assetKind: "bezierCurve3d" }>,
  bezierPath3d: StructuredBezierPath3D,
): ProjectedCurveCommand[] {
  const commands = projectBezierPath3DToCommands(bezierPath3d, {
    camera: threeViewport.activeCamera,
    viewport: stage.size,
    worldMatrix: getAsset3DLocalToWorldUnitMatrix(asset),
  });

  context.save();
  context.strokeStyle = asset.stroke;
  context.lineWidth = asset.strokeWidth;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.setLineDash([]);
  context.beginPath();
  drawProjectedCurveCommands(context, commands);
  context.stroke();
  context.restore();

  return commands;
}

function getAsset3DLocalToWorldUnitMatrix(asset: PrimitiveSvgAsset): Matrix4 {
  const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] = asset.viewBox;
  const largestDimension = Math.max(viewBoxWidth, viewBoxHeight, 1);
  const scale = 1 / largestDimension;

  return new Matrix4()
    .makeTranslation(
      -(viewBoxX + viewBoxWidth / 2),
      -(viewBoxY + viewBoxHeight / 2),
      0,
    )
    .premultiply(new Matrix4().makeScale(scale, -scale, scale));
}

function transformPoint3DToWorldUnit(
  point: BezierPoint3D,
  asset: PrimitiveSvgAsset,
): Vector3Tuple {
  return vectorToTuple(
    new Vector3(point[0], point[1], point[2]).applyMatrix4(
      getAsset3DLocalToWorldUnitMatrix(asset),
    ),
  );
}

function transformPoint3DFromWorldUnit(
  point: Vector3Tuple,
  asset: PrimitiveSvgAsset,
): BezierPoint3D {
  const inverse = getAsset3DLocalToWorldUnitMatrix(asset).invert();
  const local = new Vector3(point[0], point[1], point[2]).applyMatrix4(inverse);

  return [roundBezierValue(local.x), roundBezierValue(local.y), roundBezierValue(local.z)];
}

function selectPathEditControl(event: PointerEvent | MouseEvent): void {
  if (
    editorState.editorMode === "path" &&
    editorState.viewMorphProfileEditSession
  ) {
    selectViewMorphProfileEditControlAtEvent(event);
    return;
  }

  if (editorState.editorMode !== "path" || !editorState.pathEditSession) {
    return;
  }

  const asset = getAssetById(editorState.pathEditSession.assetId);
  const adapter = asset ? getSourcePathEditAdapter(asset) : null;

  if (!asset || !adapter) {
    return;
  }

  const control = findPathEditControlAtPoint({
    point: getCanvasPointerPoint(event),
    session: editorState.pathEditSession,
    adapter,
    hitRadius: PATH_EDIT_HIT_RADIUS,
  });

  if (!control) {
    updatePathEditHoveredControl(null);
    return;
  }

  editorState.pathEditHoveredControl = toPathEditSelection(control);
  editorState.pathEditDragState = selectPathEditSessionControl({
    session: editorState.pathEditSession,
    control,
  });
  event.preventDefault();
  renderCache.markPaperDirty();
  renderSourcePathEditPanel();
  exposeEditorDebugHooks();
}

function selectViewMorphProfileEditControlAtEvent(
  event: PointerEvent | MouseEvent,
): void {
  const session = editorState.viewMorphProfileEditSession;
  const asset = session ? getAssetById(session.assetId) : null;
  const adapter = asset ? getViewMorphProfileEditAdapter(asset) : null;

  if (!session || !asset || !adapter) {
    return;
  }

  const control = findNearestViewMorphProfileEditControl(
    getCanvasPointerPoint(event),
    session,
    adapter,
    PATH_EDIT_HIT_RADIUS,
  );

  if (!control) {
    updateViewMorphProfileHoveredControl(null);
    return;
  }

  editorState.viewMorphProfileEditHoveredControl =
    toViewMorphProfileEditSelection(control);
  editorState.viewMorphProfileEditDragState =
    selectViewMorphProfileEditControl(session, control);
  event.preventDefault();
  renderCache.markPaperDirty();
  renderSourcePathEditPanel();
  exposeEditorDebugHooks();
}

function updatePathEditHover(event: PointerEvent | MouseEvent): void {
  if (
    editorState.editorMode === "path" &&
    editorState.viewMorphProfileEditSession
  ) {
    updateViewMorphProfileHover(event);
    return;
  }

  if (editorState.editorMode !== "path" || !editorState.pathEditSession || editorState.pathEditDragState) {
    if (editorState.pathEditHoveredControl) {
      clearPathEditHover();
    }
    return;
  }

  const asset = getAssetById(editorState.pathEditSession.assetId);
  const adapter = asset ? getSourcePathEditAdapter(asset) : null;
  const hoveredControl =
    asset && adapter
      ? findPathEditControlAtPoint({
          point: getCanvasPointerPoint(event),
          session: editorState.pathEditSession,
          adapter,
          hitRadius: PATH_EDIT_HIT_RADIUS,
        })
      : null;

  updatePathEditHoveredControl(hoveredControl);
}

function updateViewMorphProfileHover(event: PointerEvent | MouseEvent): void {
  if (
    !editorState.viewMorphProfileEditSession ||
    editorState.viewMorphProfileEditDragState
  ) {
    if (editorState.viewMorphProfileEditHoveredControl) {
      clearViewMorphProfileHover();
    }
    return;
  }

  const asset = getAssetById(editorState.viewMorphProfileEditSession.assetId);
  const adapter = asset ? getViewMorphProfileEditAdapter(asset) : null;
  const hoveredControl =
    asset && adapter
      ? findNearestViewMorphProfileEditControl(
          getCanvasPointerPoint(event),
          editorState.viewMorphProfileEditSession,
          adapter,
          PATH_EDIT_HIT_RADIUS,
        )
      : null;

  updateViewMorphProfileHoveredControl(hoveredControl);
}

function updateViewMorphProfileHoveredControl(
  control: ViewMorphProfileEditControl | null,
): void {
  const nextHover = toViewMorphProfileEditSelection(control);

  if (
    viewMorphProfileEditSelectionsEqual(
      editorState.viewMorphProfileEditHoveredControl,
      nextHover,
    )
  ) {
    return;
  }

  editorState.viewMorphProfileEditHoveredControl = nextHover;
  renderCache.markPaperDirty();
  exposeEditorDebugHooks();
}

function updatePathEditHoveredControl(control: PathEditControl | null): void {
  const nextHover = toPathEditSelection(control);

  if (pathEditSelectionsEqual(editorState.pathEditHoveredControl, nextHover)) {
    return;
  }

  editorState.pathEditHoveredControl = nextHover;
  renderCache.markPaperDirty();
  exposeEditorDebugHooks();
}

function clearPathEditHover(): void {
  updatePathEditHoveredControl(null);
  clearViewMorphProfileHover();
}

function clearViewMorphProfileHover(): void {
  updateViewMorphProfileHoveredControl(null);
}

function dragPathEditControl(event: PointerEvent | MouseEvent): void {
  if (
    editorState.editorMode === "path" &&
    editorState.viewMorphProfileEditSession &&
    editorState.viewMorphProfileEditDragState
  ) {
    dragViewMorphProfileControl(event);
    return;
  }

  if (editorState.editorMode !== "path" || !editorState.pathEditSession || !editorState.pathEditDragState) {
    return;
  }

  const asset = getAssetById(editorState.pathEditSession.assetId);
  const adapter = asset ? getSourcePathEditAdapter(asset) : null;

  if (!asset || !adapter) {
    editorState.pathEditDragState = null;
    return;
  }

  const pathPoint = adapter.screenToPath(getCanvasPointerPoint(event));

  if (!pathPoint) {
    return;
  }

  dragPathEditSessionAtPoint({
    session: editorState.pathEditSession,
    dragState: editorState.pathEditDragState,
    point: pathPoint,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
  });
  renderCache.markVectorDirty();
  renderCache.markPaperDirty();
  renderSourcePathEditPanel();
  exposeEditorDebugHooks();
}

function dragViewMorphProfileControl(event: PointerEvent | MouseEvent): void {
  const session = editorState.viewMorphProfileEditSession;
  const asset = session ? getAssetById(session.assetId) : null;
  const adapter = asset ? getViewMorphProfileEditAdapter(asset) : null;

  if (!session || !editorState.viewMorphProfileEditDragState || !asset || !adapter) {
    editorState.viewMorphProfileEditDragState = null;
    return;
  }

  const pathPoint = adapter.screenToPath(getCanvasPointerPoint(event));

  if (!pathPoint) {
    return;
  }

  dragViewMorphProfileEditControl(
    session,
    editorState.viewMorphProfileEditDragState,
    pathPoint,
  );
  renderCache.markVectorDirty();
  renderCache.markPaperDirty();
  renderSourcePathEditPanel();
  exposeEditorDebugHooks();
}

function getCanvasPointerPoint(event: PointerEvent | MouseEvent): BezierPoint {
  const canvas = stage.getLayer("paper-canvas").canvas;
  const rect = canvas.getBoundingClientRect();

  return [
    roundTransformValue(event.clientX - rect.left),
    roundTransformValue(event.clientY - rect.top),
  ];
}

function getSourcePathEditViewTransform(
  asset: PrimitiveSvgAsset,
): SourcePathEditViewTransform {
  const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] = asset.viewBox;
  const targetSize = Math.max(
    220,
    Math.min(stage.size.cssWidth, stage.size.cssHeight) * 0.54,
  );
  const scale = targetSize / Math.max(viewBoxWidth, viewBoxHeight);
  const centerX = stage.size.cssWidth / 2;
  const centerY = stage.size.cssHeight / 2;

  return {
    scale,
    offsetX: centerX - (viewBoxX + viewBoxWidth / 2) * scale,
    offsetY: centerY - (viewBoxY + viewBoxHeight / 2) * scale,
  };
}

function getSourcePathEditAdapter(
  asset: PrimitiveSvgAsset,
): PathEditViewportAdapter {
  const transform = getSourcePathEditViewTransform(asset);

  return {
    pathToScreen: (point) => [
      transform.offsetX + point[0] * transform.scale,
      transform.offsetY + point[1] * transform.scale,
    ],
    screenToPath: (point) => [
      roundBezierValue((point[0] - transform.offsetX) / transform.scale),
      roundBezierValue((point[1] - transform.offsetY) / transform.scale),
    ],
  };
}

function getViewMorphProfileEditAdapter(
  asset: PrimitiveSvgAsset,
  transform = getSourcePathEditViewTransform(asset),
): ViewMorphProfileEditViewportAdapter {
  return {
    pathToScreen: (point) => [
      transform.offsetX + point[0] * transform.scale,
      transform.offsetY + point[1] * transform.scale,
    ],
    screenToPath: (point) => [
      roundBezierValue((point[0] - transform.offsetX) / transform.scale),
      roundBezierValue((point[1] - transform.offsetY) / transform.scale),
    ],
  };
}

function getPathEditScreenControls(): Array<{
  segmentId: string;
  component: PathEditComponent;
  x: number;
  y: number;
}> {
  const asset = editorState.pathEditSession ? getAssetById(editorState.pathEditSession.assetId) : null;

  return getSourcePathEditScreenControls({
    session: editorState.pathEditSession,
    adapter: asset ? getSourcePathEditAdapter(asset) : null,
  });
}

function getViewMorphProfileEditScreenControlsForDebug() {
  const asset = editorState.viewMorphProfileEditSession
    ? getAssetById(editorState.viewMorphProfileEditSession.assetId)
    : null;

  return getViewMorphProfileEditScreenControls(
    editorState.viewMorphProfileEditSession,
    asset ? getViewMorphProfileEditAdapter(asset) : null,
  );
}

function syncSourcePathEdit3DControls(): void {
  if (!editorState.pathEdit3DSession) {
    threeViewport.clearCurve3DControls();
    return;
  }

  const controls = getSourcePathEdit3DControls(editorState.pathEdit3DSession);
  const lines = getSourcePathEdit3DHandleLines(editorState.pathEdit3DSession);

  threeViewport.setCurve3DControls(controls, lines);

  const selectedId = editorState.pathEdit3DSession.selected
    ? getSourcePathEdit3DControlId(
        editorState.pathEdit3DSession.selected.segmentId,
        editorState.pathEdit3DSession.selected.component,
      )
    : null;
  threeViewport.setSelectedCurve3DControl(selectedId);
}

function getSourcePathEdit3DControls(
  session: SourcePathEdit3DSession | null = editorState.pathEdit3DSession,
): Curve3DControlDescriptor[] {
  return getSourcePathEdit3DControlsForState({
    session,
    getAssetById,
    transformPoint3DToWorldUnit,
  });
}

function getSourcePathEdit3DProjectedCommands(): ProjectedCurveCommand[] {
  if (!editorState.pathEdit3DSession) {
    const selectedAsset = getSelectedAsset();

    return selectedAsset && primitiveAssetHas3DSourcePath(selectedAsset)
      ? projectBezierPath3DToCommands(selectedAsset.bezierPath3d, {
          camera: threeViewport.activeCamera,
          viewport: stage.size,
          worldMatrix: getAsset3DLocalToWorldUnitMatrix(selectedAsset),
        })
      : [];
  }

  const asset = getAssetById(editorState.pathEdit3DSession.assetId);

  return projectBezierPath3DToCommands(editorState.pathEdit3DSession.draft, {
    camera: threeViewport.activeCamera,
    viewport: stage.size,
    worldMatrix: asset ? getAsset3DLocalToWorldUnitMatrix(asset) : undefined,
  });
}

function getSourcePathEdit3DHandleLines(
  session: SourcePathEdit3DSession | null = editorState.pathEdit3DSession,
): ReturnType<typeof getSourcePathEdit3DHandleLinesForState> {
  return getSourcePathEdit3DHandleLinesForState({
    session,
    getAssetById,
    transformPoint3DToWorldUnit,
  });
}

function selectSourcePathEdit3DControlById(controlId: string | null): void {
  if (editorState.editorMode !== "path" || !editorState.pathEdit3DSession) {
    return;
  }

  const selection = controlId ? parseSourcePathEdit3DControlId(controlId) : null;
  editorState.pathEdit3DSession.selected = selection;
  syncSourcePathEdit3DControls();
  renderCache.markVectorDirty();
  renderCache.markThreeDirty();
  renderSourcePathEditPanel();
  exposeEditorDebugHooks();
}

function updateSourcePathEdit3DControlPosition(
  controlId: string,
  position: Vector3Tuple,
): void {
  if (editorState.editorMode !== "path" || !editorState.pathEdit3DSession) {
    return;
  }

  const selection = parseSourcePathEdit3DControlId(controlId);

  if (!selection) {
    return;
  }

  const segment = getPathEdit3DSegment(editorState.pathEdit3DSession, selection.segmentId);
  const asset = getAssetById(editorState.pathEdit3DSession.assetId);

  if (!segment || !asset) {
    return;
  }

  const localPosition = transformPoint3DFromWorldUnit(position, asset);

  if (selection.component === "anchor") {
    segment.anchor = localPosition;
  } else {
    segment[selection.component] = subtractBezierPoints3D(
      localPosition,
      segment.anchor,
    );
  }

  editorState.pathEdit3DSession.selected = selection;
  syncSourcePathEdit3DControls();
  renderSourcePathEditPanel();
  exposeEditorDebugHooks();
}

function selectInPlacePathEditControl(event: PointerEvent | MouseEvent): boolean {
  const session = getValidInPlacePathEditSession();
  const adapter = getInPlacePathEditAdapter();

  if (!session || !adapter) {
    return false;
  }

  const control = findPathEditControlAtPoint({
    point: getCanvasPointerPoint(event),
    session,
    adapter,
    hitRadius: PATH_EDIT_HIT_RADIUS,
  });

  if (!control) {
    updateInPlacePathEditHoveredControl(null);
    return false;
  }

  editorState.inPlacePathEditHoveredControl = toPathEditSelection(control);
  editorState.inPlacePathEditDragState = selectPathEditSessionControl({
    session,
    control,
  });
  event.preventDefault();
  event.stopPropagation();
  if ("stopImmediatePropagation" in event) {
    event.stopImmediatePropagation();
  }
  renderCache.markPaperDirty();
  renderInspector();
  exposeEditorDebugHooks();
  return true;
}

function updateInPlacePathEditHover(event: PointerEvent | MouseEvent): void {
  if (
    !getValidInPlacePathEditSession() ||
    editorState.inPlacePathEditDragState ||
    editorState.inPlacePathEditCameraDragActive
  ) {
    if (editorState.inPlacePathEditHoveredControl) {
      clearInPlacePathEditHover();
    }
    return;
  }

  const hoveredControl = findInPlacePathEditControl(event);

  updateInPlacePathEditHoveredControl(hoveredControl);
}

function updateInPlacePathEditHoveredControl(control: PathEditControl | null): void {
  const nextHover = toPathEditSelection(control);

  if (pathEditSelectionsEqual(editorState.inPlacePathEditHoveredControl, nextHover)) {
    return;
  }

  editorState.inPlacePathEditHoveredControl = nextHover;
  renderCache.markPaperDirty();
  exposeEditorDebugHooks();
}

function clearInPlacePathEditHover(): void {
  updateInPlacePathEditHoveredControl(null);
}

function findInPlacePathEditControl(
  event: PointerEvent | MouseEvent,
): PathEditControl | null {
  const session = getValidInPlacePathEditSession();
  const adapter = getInPlacePathEditAdapter();

  if (!session || !adapter) {
    return null;
  }

  return findPathEditControlAtPoint({
    point: getCanvasPointerPoint(event),
    session,
    adapter,
    hitRadius: PATH_EDIT_HIT_RADIUS,
  });
}

function dragInPlacePathEditControl(event: PointerEvent | MouseEvent): void {
  const session = getValidInPlacePathEditSession();
  const adapter = getInPlacePathEditAdapter();

  if (!session || !adapter || !editorState.inPlacePathEditDragState) {
    return;
  }

  const pathPoint = adapter.screenToPath(getCanvasPointerPoint(event));

  if (!pathPoint) {
    return;
  }

  dragPathEditSessionAtPoint({
    session,
    dragState: editorState.inPlacePathEditDragState,
    point: pathPoint,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
  });
  syncInPlacePathSessionToStagingPose();
  event.preventDefault();
  renderCache.markAssetBillboardsDirty();
  renderCache.markPaperDirty();
  renderInspector();
  exposeEditorDebugHooks();
}

function getInPlacePathEditAdapter(): PathEditViewportAdapter | null {
  const session = getValidInPlacePathEditSession();
  const asset = session ? getAssetById(session.assetId) : null;
  const pose = session ? getTimelineStagingPose(session.nodeId) : null;

  if (!session || !asset || !pose) {
    return null;
  }

  const billboard = getBillboardScreenTransform(
    asset,
    getTimelineStagingWorldTransform(pose),
  );

  if (!billboard) {
    return null;
  }

  return {
    pathToScreen: (point) => pathPointToBillboardScreen(point, billboard),
    screenToPath: (point) => billboardScreenPointToPath(point, billboard),
  };
}

function getInPlacePathEditScreenControls(): PathEditScreenControl[] {
  return getInPlacePathEditScreenControlsForState({
    session: getValidInPlacePathEditSession(),
    adapter: getInPlacePathEditAdapter(),
  });
}

function getValidInPlacePathEditSession(): InPlacePathEditSession | null {
  if (editorState.editorMode !== "asset" || editorState.activeEditorTool !== "path" || !editorState.inPlacePathEditSession) {
    return null;
  }

  const node = getPrefabNode(editorState.inPlacePathEditSession.nodeId);
  const asset = getAssetById(editorState.inPlacePathEditSession.assetId);
  const activeClip = getActiveTimelineClip();
  const stagingPose = getTimelineStagingPose(editorState.inPlacePathEditSession.nodeId, activeClip);

  if (
    !isInPlacePathEditSessionValid({
      session: editorState.inPlacePathEditSession,
      selectedNodeId: editorState.selectedPrefabNodeId,
      node,
      asset,
      stagingPose,
      hasActiveClip: Boolean(activeClip),
    })
  ) {
    exitPathTool();
    return null;
  }

  if (!stagingPose) {
    exitPathTool();
    return null;
  }

  if (stagingPose.pathDraft) {
    editorState.inPlacePathEditSession.draft = stagingPose.pathDraft;
  }

  return editorState.inPlacePathEditSession;
}

function getSelectedInPlacePathNodeAndAsset(): {
  node: PrefabNode;
  asset: PrimitiveSvgAsset;
} | null {
  const node =
    editorState.editorMode === "asset" &&
    editorState.selectedPrefabNodeId &&
    editorState.selectedPrefabNodeId !== PREFAB_ROOT_NODE_ID
      ? getPrefabNode(editorState.selectedPrefabNodeId)
      : null;
  const asset =
    node?.kind === "primitive" && node.assetId ? getAssetById(node.assetId) : null;

  return node && node.kind === "primitive" && asset ? { node, asset } : null;
}

function getBillboardScreenTransform(
  asset: PrimitiveSvgAsset,
  transform: TransformSnapshot,
): {
  projected: { x: number; y: number };
  assetScale: number;
  rotation: number;
  nodeScale: [number, number];
  viewBoxCenter: BezierPoint;
} | null {
  const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] = asset.viewBox;
  const worldPosition = tupleToVector(transform.position);
  const projected = threeViewport.projectWorldPosition(worldPosition, stage.size);

  if (!projected) {
    return null;
  }

  const largestDimension = Math.max(viewBoxWidth, viewBoxHeight);
  const screenScale = threeViewport.getDistanceScale(worldPosition, 1);
  const assetScale = screenScale / largestDimension;

  return {
    projected,
    assetScale,
    rotation: transform.rotation[2],
    nodeScale: [transform.scale[0], transform.scale[1]],
    viewBoxCenter: [viewBoxX + viewBoxWidth / 2, viewBoxY + viewBoxHeight / 2],
  };
}

function pathPointToBillboardScreen(
  point: BezierPoint,
  transform: NonNullable<ReturnType<typeof getBillboardScreenTransform>>,
): BezierPoint {
  const localX =
    (point[0] - transform.viewBoxCenter[0]) *
    transform.assetScale *
    transform.nodeScale[0];
  const localY =
    (point[1] - transform.viewBoxCenter[1]) *
    transform.assetScale *
    transform.nodeScale[1];
  const cos = Math.cos(transform.rotation);
  const sin = Math.sin(transform.rotation);

  return [
    roundBezierValue(transform.projected.x + localX * cos - localY * sin),
    roundBezierValue(transform.projected.y + localX * sin + localY * cos),
  ];
}

function billboardScreenPointToPath(
  point: BezierPoint,
  transform: NonNullable<ReturnType<typeof getBillboardScreenTransform>>,
): BezierPoint {
  const dx = point[0] - transform.projected.x;
  const dy = point[1] - transform.projected.y;
  const cos = Math.cos(-transform.rotation);
  const sin = Math.sin(-transform.rotation);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  return [
    roundBezierValue(
      localX / safeBillboardScale(transform.assetScale * transform.nodeScale[0]) +
        transform.viewBoxCenter[0],
    ),
    roundBezierValue(
      localY / safeBillboardScale(transform.assetScale * transform.nodeScale[1]) +
        transform.viewBoxCenter[1],
    ),
  ];
}

function safeBillboardScale(value: number): number {
  if (Math.abs(value) < 0.0001) {
    return value < 0 ? -0.0001 : 0.0001;
  }

  return value;
}

function getSelectedProject(): ProjectRecord | null {
  return getSelectedProjectFromState(editorState.projects, editorState.selectedProjectId);
}

function getSelectedAsset(): PrimitiveSvgAsset | null {
  return getSelectedAssetFromState(editorState.assets, editorState.selectedAssetId);
}

function getSelectedPrefab(): PrefabRecord | null {
  return getSelectedPrefabFromState(editorState.prefabs, editorState.selectedPrefabId);
}

function getSelectedScene(): SceneRecord | null {
  return getSelectedSceneFromState(editorState.scenes, editorState.selectedSceneId);
}

function getAssetById(assetId: string): PrimitiveSvgAsset | null {
  return findRecordById(editorState.assets, assetId);
}

function getAssetsById(): Map<string, PrimitiveSvgAsset> {
  return new Map(editorState.assets.map((asset) => [asset.id, asset]));
}

function getPrefabRecordById(prefabId: string): PrefabRecord | null {
  return findRecordById(editorState.prefabs, prefabId);
}

function getPrefabDocumentById(prefabId: string): PrefabDocument | null {
  return getPrefabDocumentByIdFromState(
    editorState.prefabDocuments,
    prefabId,
    editorState.loadedPrefabId,
    createCurrentPrefabDocument(),
  );
}

function getPrefabNode(nodeId: string): PrefabNode | null {
  return getNodeById(editorState.prefabNodes, nodeId);
}

function getSceneNode(nodeId: string): SceneNode | null {
  return getNodeById(editorState.sceneNodes, nodeId);
}

function findTimelineTrack(
  clip: PrefabAnimationClip,
  nodeId: string,
  property: PrefabTrackProperty,
): PrefabAnimationTrack | null {
  return (
    clip.tracks.find(
      (track) => track.target.nodeId === nodeId && track.target.property === property,
    ) ?? null
  );
}

function getSelectedTimelineKeyframe(
  clip: PrefabAnimationClip,
): {
  track: PrefabAnimationTrack;
  keyframe: PrefabAnimationTrack["keyframes"][number];
} | null {
  return getSelectedTimelineKeyframeFromState(clip, editorState.selectedTimelineKeyframeId);
}

function timeMsFromTimelinePointer(
  event: PointerEvent | MouseEvent,
  clip: PrefabAnimationClip,
  element?: HTMLElement,
): number {
  const target =
    element ??
    (event.currentTarget instanceof HTMLElement ? event.currentTarget : null);

  if (!target) {
    return clampTimelineTimeMs(editorState.timelineCurrentTimeMs, clip);
  }

  const rect = target.getBoundingClientRect();
  const rawRatio = (event.clientX - rect.left) / Math.max(rect.width, 1);
  const ratio = Math.min(Math.max(rawRatio, 0), 1);

  return snapAndClampTimelineTimeMs(Math.round(ratio * clip.durationMs), clip);
}

function resetPrefabTimelineState(): void {
  editorState.prefabAnimation = createEmptyPrefabAnimation();
  editorState.timelineStagingPoses = new TimelineStagingPoseStore();
  editorState.timelineCurrentTimeMs = 0;
  editorState.isTimelinePlaying = false;
  editorState.selectedTimelineKeyframeId = null;
  editorState.timelinePointerDrag = null;
  discardInPlacePathEditSession();
}

function createEmptyPrefabAnimation(): PrefabAnimation {
  return createEmptyPrefabAnimationState(DEFAULT_PREFAB_SNAP_FPS);
}

function getSelectedPrefabNode(): PrefabNode | null {
  return editorState.selectedPrefabNodeId && editorState.selectedPrefabNodeId !== PREFAB_ROOT_NODE_ID
    ? getPrefabNode(editorState.selectedPrefabNodeId)
    : null;
}

function canUsePathTool(): boolean {
  return canUseTool("path");
}

function canUseTool(tool: EditorTool): boolean {
  const selection = getSelectedInPlacePathNodeAndAsset();

  return canUsePathToolForSelection({
    editorMode: editorState.editorMode,
    hasActiveClip: Boolean(getActiveTimelineClip()),
    hasPrimitiveSelection: Boolean(selection),
    assetKind: selection?.asset.assetKind ?? null,
  }) || tool !== "path";
}

function isTransformEditorTool(tool: EditorTool): tool is TransformMode {
  return TRANSFORM_TOOL_DEFINITIONS.some((definition) => definition.id === tool);
}

function getTimelineStagingPose(
  nodeId: string,
  clip: PrefabAnimationClip | null = getActiveTimelineClip(),
): TimelineStagingPose | null {
  return editorState.timelineStagingPoses.get(nodeId, clip);
}

function getOrCreateTimelineStagingPose(
  node: PrefabNode,
  clip: PrefabAnimationClip,
  asset?: PrimitiveSvgAsset | null,
): TimelineStagingPose {
  return editorState.timelineStagingPoses.getOrCreate(node, clip, asset);
}

function getTimelineStagingWorldTransform(
  pose: TimelineStagingPose,
): TransformSnapshot {
  return getStagingWorldTransform({
    nodes: editorState.prefabNodes,
    stagingPose: pose,
  });
}

function getSelectedTimelineStagingPose(): TimelineStagingPose | null {
  return getSelectedTimelineStagingPoseFromLayers({
    selectedNode: getSelectedPrefabNode(),
    activeClip: getActiveTimelineClip(),
    assetsById: getAssetsById(),
    stagingPoses: editorState.timelineStagingPoses,
  });
}

function getSelectedTimelineStagingTransform(): TransformSnapshot | null {
  return getSelectedTimelineStagingTransformFromLayers({
    selectedNode: getSelectedPrefabNode(),
    activeClip: getActiveTimelineClip(),
    assetsById: getAssetsById(),
    stagingPoses: editorState.timelineStagingPoses,
  });
}

function syncInPlacePathSessionToStagingPose(): void {
  const session = editorState.inPlacePathEditSession;
  const pose = session ? getTimelineStagingPose(session.nodeId) : null;

  if (!session || !pose) {
    return;
  }

  editorState.timelineStagingPoses.syncPathDraft(session.nodeId, session.draft);
}

function pruneTimelineStagingPoses(
  options?: TimelineStagingPruneOptions,
): void {
  editorState.timelineStagingPoses.prune(options, getPrefabNode);
}

function createNextPrefabNodeId(): string {
  const id = `prefab-node-${editorState.nextPrefabNodeNumber}`;
  editorState.nextPrefabNodeNumber += 1;
  return id;
}

function clearInvalidPrefabClipboard(): void {
  editorState.pendingPrefabClipboard = clearInvalidPrefabClipboardForState(
    editorState.pendingPrefabClipboard,
    editorState.prefabNodes,
  );
}

function getPrefabNodeTreeEntries(): PrefabNodeTreeEntry[] {
  return getPrefabNodeTreeEntriesFromNodes(editorState.prefabNodes);
}

function getSceneNodeLabel(node: SceneNode): string {
  if (node.kind === "primitive") {
    const asset = getAssetById(node.assetId);
    return asset
      ? `${node.id} Primitive: ${asset.name}`
      : `${node.id} Primitive: Missing ${node.assetId}`;
  }

  const prefab = getPrefabRecordById(node.prefabId);
  return prefab
    ? `${node.id} Prefab: ${prefab.name}`
    : `${node.id} Prefab: Missing ${node.prefabId}`;
}

function getEditorModeLabel(mode: EditorMode): string {
  if (mode === "asset") {
    return "Asset Assembly";
  }

  if (mode === "path") {
    return "Source Path Edit";
  }

  return "Scene Layout";
}

function snapAndClampTimelineTimeMs(
  timeMs: number,
  clip: PrefabAnimationClip | null,
): number {
  return snapAndClampTimelineTimeMsWithFps(
    timeMs,
    clip,
    editorState.prefabAnimation.snapFps,
  );
}

function applyEditorCommand(command: EditorCommand): EditorCommandResult {
  const result = dispatchEditorCommand(editorState, command);

  if (result.collapsedModuleIds) {
    collapsedModuleIds = result.collapsedModuleIds;
  }

  if (result.invalidation.persistCollapsedModules) {
    writeCollapsedModuleCookie(collapsedModuleIds);
    renderCollapsibleModules();
  }

  if (result.invalidation.renderShell) {
    renderEditorShell();
  }

  if (result.invalidation.exposeDebugHooks) {
    exposeEditorDebugHooks();
  }

  return result;
}

function setImportError(error: unknown): void {
  const message = error instanceof Error ? error.message : "Unknown error";
  applyEditorCommand({
    type: "setLastImportError",
    message,
  });
  elements.importError.textContent = message;
  elements.importError.hidden = false;
  elements.fileInput.value = "";
  console.error(error);
}

function hideError(): void {
  if (editorState.lastImportError !== null) {
    applyEditorCommand({ type: "clearLastImportError" });
  }
  elements.importError.hidden = true;
  elements.importError.textContent = "";
}

function exposeEditorDebugHooks(): void {
  installEditorDebugHooks({
    getProjects: () => [...editorState.projects],
    getAssets: () =>
      editorState.assets.map((asset) => ({
        id: asset.id,
        assetKind: asset.assetKind,
        name: asset.name,
        sourceUrl: asset.sourceUrl,
        viewBox: asset.viewBox,
        fill: primitiveAssetUsesStrokeStyle(asset) ? "none" : asset.fill,
        fillRule: primitiveAssetUsesStrokeStyle(asset)
          ? "nonzero"
          : asset.fillRule,
        stroke: primitiveAssetUsesStrokeStyle(asset) ? asset.stroke : null,
        strokeWidth: primitiveAssetUsesStrokeStyle(asset)
          ? asset.strokeWidth
          : null,
        bezierPath: asset.bezierPath,
        bezierPath3d:
          primitiveAssetHas3DSourcePath(asset)
            ? cloneStructuredBezierPath3D(asset.bezierPath3d)
            : null,
        viewMorphProfile:
          asset.assetKind === "viewMorphProfile"
            ? asset.viewMorphProfile
            : null,
        pathD: asset.pathD,
      })),
    getPrefabs: () => [...editorState.prefabs],
    getPrefabAssembly: () => ({
      nodes: editorState.prefabNodes.map(clonePrefabNode),
      selectedPrefabId: editorState.selectedPrefabId,
      loadedPrefabId: editorState.loadedPrefabId,
      selectedPrefabNodeId: editorState.selectedPrefabNodeId,
      pendingClipboard: editorState.pendingPrefabClipboard
        ? { ...editorState.pendingPrefabClipboard }
        : null,
    }),
    getPrefabTimeline: () => {
      const stagingPose = getSelectedTimelineStagingPose();

      return {
        animation: clonePrefabAnimation(editorState.prefabAnimation),
        currentTimeMs: editorState.timelineCurrentTimeMs,
        isPlaying: editorState.isTimelinePlaying,
        selectedClipId: editorState.prefabAnimation.activeClipId,
        activeTrackProperty: getActiveTimelineProperty(),
        selectedKeyframeId: editorState.selectedTimelineKeyframeId,
        evaluatedNodes: getEvaluatedPrefabNodes(),
        evaluatedPathOverrides: [...getEvaluatedPrefabPathOverrides()].map(
          ([nodeId, path]) => ({
            nodeId,
            path: cloneStructuredBezierPath(path),
          }),
        ),
        stagingPose: stagingPose
          ? {
              clipId: stagingPose.clipId,
              nodeId: stagingPose.nodeId,
              transform: cloneTransform(stagingPose),
              hasPathDraft: Boolean(stagingPose.pathDraft),
              pathDraft: stagingPose.pathDraft
                ? cloneStructuredBezierPath(stagingPose.pathDraft)
                : null,
            }
          : null,
      };
    },
    getPathEditState: () =>
      createSourcePathEditDebugState({
        pathEditSession: editorState.pathEditSession,
        pathEdit3DSession: editorState.pathEdit3DSession,
        viewMorphProfileEditSession: editorState.viewMorphProfileEditSession,
        hoveredControl: editorState.pathEditHoveredControl,
        hoveredViewMorphControl: editorState.viewMorphProfileEditHoveredControl,
        controls: getPathEditScreenControls(),
        controls3d: getSourcePathEdit3DControls(),
        viewMorphControls: getViewMorphProfileEditScreenControlsForDebug(),
        projectedCommandCount: getSourcePathEdit3DProjectedCommands().length,
      }),
    getInPlacePathEditState: () =>
      createInPlacePathEditDebugState({
        session: editorState.inPlacePathEditSession,
        active: Boolean(getValidInPlacePathEditSession()),
        hoveredControl: editorState.inPlacePathEditHoveredControl,
        controls: getInPlacePathEditScreenControls(),
      }),
    getExperimentScene: () => {
      const camera = threeViewport.getCameraSnapshot();

      return {
        camera: {
          projection: camera.projection,
          position: camera.position,
          target: camera.target,
          fov: camera.fov,
          zoom: camera.zoom,
          near: camera.near,
          far: camera.far,
        },
        nodes: editorState.sceneNodes.map(cloneSceneNode),
        selectedNodeId: editorState.selectedSceneNodeId,
        transformMode: threeViewport.currentTransformMode,
        viewportProxies: threeViewport.getProxySnapshot(),
      };
    },
    getRenderCache: () => ({
      flags: { ...renderCache.flags },
      cachedAssetAssemblyBillboardCount:
        renderCache.getAssetAssemblyBillboardCount(),
      cachedSceneLayoutBillboardCount: renderCache.getSceneLayoutBillboardCount(),
    }),
    getActiveEditorTool: () => editorState.activeEditorTool,
    getScenes: () => [...editorState.scenes],
    getEditorMode: () => editorState.editorMode,
    getSelectedProjectId: () => editorState.selectedProjectId,
    getSelectedAssetId: () => editorState.selectedAssetId,
    getSelectedPrefabId: () => editorState.selectedPrefabId,
    getLoadedPrefabId: () => editorState.loadedPrefabId,
    getSelectedSceneId: () => editorState.selectedSceneId,
    getLoadedSceneId: () => editorState.loadedSceneId,
    getLastImportError: () => editorState.lastImportError,
    getCollapsedModules: () =>
      COLLAPSIBLE_MODULE_IDS.filter((moduleId) =>
        collapsedModuleIds.has(moduleId),
      ),
    getAppStateSnapshot: () => appStateStore.getSnapshot(),
  });
}







