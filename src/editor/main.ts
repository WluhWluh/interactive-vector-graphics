import "../styles.css";
import { Matrix4, Vector3 } from "three";
import type { PrimitiveSvgAsset } from "../core/assets/primitiveSvg";
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
  createPrefab,
  convertAssetTo3DCurve,
  createProject,
  createScene,
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
  setPathEditComponentAxisValue,
  type PathEditComponent,
  type PathEditControl,
  type PathEditDragState,
  type PathEditScreenControl,
  type PathEditSession,
  type PathEditViewportAdapter,
} from "./tools/pathEditCore";
import {
  ThreeEditorViewport,
  tupleToVector,
  vectorToTuple,
  type CameraProjection,
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
  isPrefabVectorTrackProperty,
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
  type SourcePathEditViewTransform,
} from "./render/pathEditDrawing";
import { renderTimelinePanel } from "./ui/timelinePanel";
import {
  appendAssetInspectorRows as appendAssetInspectorRowsForUi,
  appendInspectorActionRow as appendInspectorActionRowForUi,
  appendInspectorRow as appendInspectorRowForUi,
  appendPathEditInspectorInputRow as appendPathEditInspectorInputRowForUi,
  appendTransformInspectorRow as appendTransformInspectorRowForUi,
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
  clonePrefabNode,
  cloneSceneNode,
  getPrefabNodeTreeEntries as getPrefabNodeTreeEntriesFromNodes,
  type PrefabNodeTreeEntry,
} from "./state/documentNodes";
import {
  applyPrefabDocumentState,
  createEmptyPrefabAnimation as createEmptyPrefabAnimationState,
  createPrefabDocument,
  type PrefabSelectionId,
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
  getModuleCollapseButton,
  readCollapsedModuleCookie,
  renderCollapsibleModules as renderCollapsibleModulesForState,
  writeCollapsedModuleCookie,
  type CollapsibleModuleId,
} from "./ui/collapsibleModules";
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
  type PendingPrefabClipboard,
  type PrefabClipboardMode,
} from "./controllers/prefabAssemblyController";
import {
  createEmptyProjectWorkspaceState,
  loadPrefabDocuments,
  reconcileAssetSelection,
  reconcilePrefabSelection,
  reconcileProjectSelection,
  reconcileSceneSelection,
} from "./controllers/projectDataController";
import {
  applyDeletedAsset,
  applyImportedAsset,
  applyUpdatedAsset,
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
import {
  createInPlacePathEditDebugState,
  createInPlacePathEditSession as createInPlacePathEditSessionForState,
  createSourcePathEditDebugState,
  dragPathEditSessionAtPoint,
  findPathEditControlAtPoint,
  getInPlacePathEditScreenControls as getInPlacePathEditScreenControlsForState,
  getRestoredPathEditSelection,
  getSourcePathEdit3DControls as getSourcePathEdit3DControlsForState,
  getSourcePathEdit3DHandleLines as getSourcePathEdit3DHandleLinesForState,
  getSourcePathEditScreenControls,
  isInPlacePathEditSessionValid,
  pathEditSelectionsEqual,
  selectPathEditSessionControl,
  clearSourcePathEditState,
  startSourcePathEditState,
  toPathEditSelection,
  type InPlacePathEditSession,
  type SourcePathEditSession,
} from "./controllers/pathEditController";
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

type TimelinePointerDrag = {
  keyframeId: string;
  property: PrefabTrackProperty;
};
type SceneCreateSource = "empty" | "current";
const PREFAB_ROOT_NODE_ID = "__prefab-root__";
const DEFAULT_PREFAB_SNAP_FPS = 10;
const DEFAULT_TIMELINE_DURATION_MS = 1000;
const PATH_EDIT_HIT_RADIUS = 10;

const stage = new CanvasStage(["vector-canvas", "paper-canvas"]);
const threeViewport = new ThreeEditorViewport();
const elements = getEditorElements();
const collapsedModuleIds = readCollapsedModuleCookie();
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

let prefabs: PrefabRecord[] = initialAppState.prefabs;
let prefabNodes: PrefabNode[] = initialAppState.prefabNodes;
let prefabDocuments = initialAppState.prefabDocuments;
let scenes: SceneRecord[] = initialAppState.scenes;
let sceneNodes: SceneNode[] = initialAppState.sceneNodes;
let editorMode: EditorMode = initialAppState.editorMode;
let selectedPrefabId: string | null = initialAppState.selectedPrefabId;
let loadedPrefabId: string | null = initialAppState.loadedPrefabId;
let selectedPrefabNodeId: PrefabSelectionId | null =
  initialAppState.selectedPrefabNodeId;
let prefabAnimation: PrefabAnimation = initialAppState.prefabAnimation;
let timelineStagingPoses = initialAppState.timelineStagingPoses;
let timelineCurrentTimeMs = initialAppState.timelineCurrentTimeMs;
let isTimelinePlaying = initialAppState.isTimelinePlaying;
let selectedTimelineKeyframeId: string | null =
  initialAppState.selectedTimelineKeyframeId;
let timelinePointerDrag: TimelinePointerDrag | null = null;
let activeEditorTool: EditorTool = initialAppState.activeEditorTool;
let selectedSceneId: string | null = initialAppState.selectedSceneId;
let loadedSceneId: string | null = initialAppState.loadedSceneId;
let selectedSceneNodeId: string | null = initialAppState.selectedSceneNodeId;
let pendingPrefabClipboard: PendingPrefabClipboard | null =
  initialAppState.pendingPrefabClipboard;
let pathEditSession: SourcePathEditSession | null = null;
let pathEdit3DSession: SourcePathEdit3DSession | null = null;
let pathEditDragState: PathEditDragState | null = null;
let pathEditHoveredControl: PathEditDragState | null = null;
let inPlacePathEditSession: InPlacePathEditSession | null = null;
let inPlacePathEditDragState: PathEditDragState | null = null;
let inPlacePathEditHoveredControl: PathEditDragState | null = null;
let inPlacePathEditCameraDragActive = false;
let lastFrameTime = performance.now();
let nextSceneNodeNumber = initialAppState.nextSceneNodeNumber;
let nextPrefabNodeNumber = initialAppState.nextPrefabNodeNumber;
let pendingCameraInspectorRender = false;

function syncAppStateStore(): void {
  appStateStore.patch({
    prefabs,
    prefabNodes,
    prefabDocuments,
    scenes,
    sceneNodes,
    editorMode,
    selectedPrefabId,
    loadedPrefabId,
    selectedPrefabNodeId,
    prefabAnimation,
    timelineStagingPoses,
    timelineCurrentTimeMs,
    isTimelinePlaying,
    selectedTimelineKeyframeId,
    activeEditorTool,
    selectedSceneId,
    loadedSceneId,
    selectedSceneNodeId,
    pendingPrefabClipboard,
    nextSceneNodeNumber,
    nextPrefabNodeNumber,
  });
}

stage.getLayer("vector-canvas").canvas.dataset.visualCheck = "editor-ready";
bindEditorEvents();
void refreshProjects();
requestAnimationFrame(tick);
renderEditorShell();
exposeEditorDebugHooks();

declare global {
  interface Window {
    __vectorEditorDebug?: {
      getProjects: () => ProjectRecord[];
      getAssets: () => Array<{
        id: string;
        assetKind: string;
        name: string;
        sourceUrl: string;
        viewBox: [number, number, number, number];
        fill: string;
        fillRule: string;
        stroke: string | null;
        strokeWidth: number | null;
        bezierPath: StructuredBezierPath;
        bezierPath3d: StructuredBezierPath3D | null;
        pathD: string;
      }>;
      getPrefabs: () => PrefabRecord[];
      getPrefabAssembly: () => {
        nodes: PrefabNode[];
        selectedPrefabId: string | null;
        loadedPrefabId: string | null;
        selectedPrefabNodeId: string | null;
        pendingClipboard: {
          mode: PrefabClipboardMode;
          sourceNodeId: string;
        } | null;
      };
      getPrefabTimeline: () => {
        animation: PrefabAnimation;
        currentTimeMs: number;
        isPlaying: boolean;
        selectedClipId: string | null;
        activeTrackProperty: PrefabTrackProperty;
        selectedKeyframeId: string | null;
        evaluatedNodes: PrefabNode[];
        evaluatedPathOverrides: Array<{
          nodeId: string;
          path: StructuredBezierPath;
        }>;
        stagingPose: {
          clipId: string;
          nodeId: string;
          transform: TransformSnapshot;
          hasPathDraft: boolean;
          pathDraft: StructuredBezierPath | null;
        } | null;
      };
      getPathEditState: () => {
        is3d: boolean;
        assetId: string | null;
        selectedSegmentId: string | null;
        selectedComponent: PathEditComponent | null;
        hoveredSegmentId: string | null;
        hoveredComponent: PathEditComponent | null;
        hasDraft: boolean;
        draftBezierPath: StructuredBezierPath | null;
        draftBezierPath3d: StructuredBezierPath3D | null;
        controls: PathEditScreenControl[];
        controls3d: Curve3DControlDescriptor[];
        projectedCommandCount: number;
      };
      getInPlacePathEditState: () => {
        nodeId: string | null;
        assetId: string | null;
        active: boolean;
        hasDraft: boolean;
        selectedSegmentId: string | null;
        selectedComponent: PathEditComponent | null;
        hoveredSegmentId: string | null;
        hoveredComponent: PathEditComponent | null;
        draftBezierPath: StructuredBezierPath | null;
        controls: PathEditScreenControl[];
      };
      getExperimentScene: () => {
        camera: {
          projection: CameraProjection;
          position: [number, number, number];
          target: [number, number, number];
          fov: number;
          zoom: number;
          near: number;
          far: number;
        };
        nodes: SceneNode[];
        selectedNodeId: string | null;
        transformMode: TransformMode;
        viewportProxies: ReturnType<ThreeEditorViewport["getProxySnapshot"]>;
      };
      getRenderCache: () => {
        flags: typeof renderCache.flags;
        cachedAssetAssemblyBillboardCount: number;
        cachedSceneLayoutBillboardCount: number;
      };
      getActiveEditorTool: () => EditorTool;
      getScenes: () => SceneRecord[];
      getEditorMode: () => EditorMode;
      getSelectedProjectId: () => string | null;
      getSelectedAssetId: () => string | null;
      getSelectedPrefabId: () => string | null;
      getLoadedPrefabId: () => string | null;
      getSelectedSceneId: () => string | null;
      getLoadedSceneId: () => string | null;
      getLastImportError: () => string | null;
      getCollapsedModules: () => CollapsibleModuleId[];
      getAppStateSnapshot: () => ReturnType<typeof appStateStore.getSnapshot>;
    };
  }
}

function bindEditorEvents(): void {
  for (const moduleId of COLLAPSIBLE_MODULE_IDS) {
    const button = getModuleCollapseButton(moduleId);
    button.addEventListener("click", () => {
      toggleCollapsibleModule(moduleId);
    });
  }

  elements.assetModeButton.addEventListener("click", () => {
    setEditorMode("asset");
  });
  elements.pathModeButton.addEventListener("click", () => {
    setEditorMode("path");
  });
  elements.sceneModeButton.addEventListener("click", () => {
    setEditorMode("scene");
  });
  elements.projectForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void createProjectFromInput();
  });
  elements.deleteProjectButton.addEventListener("click", () => {
    void deleteSelectedProject();
  });
  elements.createPrefabButton.addEventListener("click", () => {
    void createPrefabFromInput();
  });
  elements.loadPrefabButton.addEventListener("click", () => {
    void loadSelectedPrefab();
  });
  elements.savePrefabButton.addEventListener("click", () => {
    void saveSelectedPrefab();
  });
  elements.deletePrefabButton.addEventListener("click", () => {
    void deleteSelectedPrefab();
  });
  elements.createPrefabGroupButton.addEventListener("click", () => {
    createPrefabGroup();
  });
  elements.prefabCopyButton.addEventListener("click", () => {
    handlePrefabClipboardPrimaryAction();
  });
  elements.prefabCutButton.addEventListener("click", () => {
    handlePrefabClipboardSecondaryAction();
  });
  elements.deletePrefabNodeButton.addEventListener("click", () => {
    deleteSelectedPrefabNode();
  });
  elements.timelineCreateClipButton.addEventListener("click", () => {
    createTimelineClipFromInput();
  });
  elements.timelineDeleteClipButton.addEventListener("click", () => {
    deleteSelectedTimelineClip();
  });
  elements.timelinePlayButton.addEventListener("click", () => {
    playTimeline();
  });
  elements.timelinePauseButton.addEventListener("click", () => {
    pauseTimeline();
  });
  elements.timelineStopButton.addEventListener("click", () => {
    stopTimeline();
  });
  elements.timelineTimeInput.addEventListener("blur", () => {
    applyTimelineTimeInput();
  });
  elements.timelineTimeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      elements.timelineTimeInput.blur();
    }
  });
  elements.timelineDurationInput.addEventListener("blur", () => {
    applyTimelineDurationInput();
  });
  elements.timelineDurationInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      elements.timelineDurationInput.blur();
    }
  });
  elements.timelineSnapFpsInput.addEventListener("blur", () => {
    applyTimelineSnapFpsInput();
  });
  elements.timelineSnapFpsInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      elements.timelineSnapFpsInput.blur();
    }
  });
  elements.timelineLoopInput.addEventListener("change", () => {
    applyTimelineLoopInput();
  });
  elements.timelineScrubInput.addEventListener("input", () => {
    scrubTimelineTo(Number(elements.timelineScrubInput.value));
  });
  elements.timelineAddKeyframeButton.addEventListener("click", () => {
    addKeyframeForSelectedPrefabNode();
  });
  elements.timelineSnapBaseButton.addEventListener("click", () => {
    snapSelectedPrefabBaseToTimeline();
  });
  elements.timelineKeyframeTimeInput.addEventListener("blur", () => {
    applySelectedKeyframeTimeInput();
  });
  elements.timelineKeyframeTimeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      elements.timelineKeyframeTimeInput.blur();
    }
  });
  elements.timelineKeyframeValueXInput.addEventListener("blur", () => {
    applySelectedKeyframeValueInput();
  });
  elements.timelineKeyframeValueYInput.addEventListener("blur", () => {
    applySelectedKeyframeValueInput();
  });
  elements.timelineKeyframeValueZInput.addEventListener("blur", () => {
    applySelectedKeyframeValueInput();
  });
  elements.timelineKeyframeEasingSelect.addEventListener("change", () => {
    applySelectedKeyframeEasingInput();
  });
  elements.timelineDeleteKeyframeButton.addEventListener("click", () => {
    deleteSelectedTimelineKeyframe();
  });
  const paperCanvas = stage.getLayer("paper-canvas").canvas;
  const threeOverlayCanvas = document.getElementById("three-overlay-canvas");

  if (!(threeOverlayCanvas instanceof HTMLCanvasElement)) {
    throw new Error("Expected #three-overlay-canvas to be a canvas element.");
  }

  paperCanvas.addEventListener("pointerdown", (event) => {
    selectPathEditControl(event);
  });
  paperCanvas.addEventListener("mousemove", (event) => {
    updatePathEditHover(event);
  });
  paperCanvas.addEventListener("mouseleave", () => {
    clearPathEditHover();
  });
  threeOverlayCanvas.addEventListener(
    "pointerdown",
    (event) => {
      const capturedPathControl = selectInPlacePathEditControl(event);

      inPlacePathEditCameraDragActive =
        Boolean(getValidInPlacePathEditSession()) && !capturedPathControl;

      if (inPlacePathEditCameraDragActive) {
        clearInPlacePathEditHover();
      }
    },
    { capture: true },
  );
  threeOverlayCanvas.addEventListener("mousemove", (event) => {
    updateInPlacePathEditHover(event);
  });
  threeOverlayCanvas.addEventListener("pointermove", (event) => {
    updateInPlacePathEditHover(event);
  });
  threeOverlayCanvas.addEventListener("mouseleave", () => {
    clearInPlacePathEditHover();
  });
  window.addEventListener("pointerdown", (event) => {
    if (event.target !== paperCanvas) {
      selectPathEditControl(event);
    }
  });
  window.addEventListener("mousedown", (event) => {
    if (event.target !== paperCanvas) {
      selectPathEditControl(event);
    }
  });
  window.addEventListener("pointermove", (event) => {
    dragSelectedTimelineKeyframe(event);
    dragPathEditControl(event);
    dragInPlacePathEditControl(event);
  });
  window.addEventListener("mousemove", (event) => {
    dragPathEditControl(event);
    dragInPlacePathEditControl(event);
  });
  window.addEventListener("pointerup", () => {
    timelinePointerDrag = null;
    pathEditDragState = null;
    pathEditHoveredControl = null;
    inPlacePathEditDragState = null;
    inPlacePathEditHoveredControl = null;
    inPlacePathEditCameraDragActive = false;
  });
  window.addEventListener("mouseup", () => {
    pathEditDragState = null;
    pathEditHoveredControl = null;
    inPlacePathEditDragState = null;
    inPlacePathEditHoveredControl = null;
    inPlacePathEditCameraDragActive = false;
  });
  elements.createSceneButton.addEventListener("click", () => {
    void createSceneFromInput("empty");
  });
  elements.cloneSceneButton.addEventListener("click", () => {
    void createSceneFromInput("current");
  });
  elements.loadSceneButton.addEventListener("click", () => {
    void loadSelectedScene();
  });
  elements.saveSceneButton.addEventListener("click", () => {
    void saveSelectedScene();
  });
  elements.deleteSceneButton.addEventListener("click", () => {
    void deleteSelectedScene();
  });
  elements.editPathButton.addEventListener("click", () => {
    const asset = getSelectedAsset();

    if (asset) {
      startPathEditSession(asset);
    }
  });
  elements.savePathButton.addEventListener("click", () => {
    void savePathEditSession();
  });
  elements.cancelPathButton.addEventListener("click", () => {
    cancelPathEditSession();
  });
  elements.create3DCurveButton.addEventListener("click", () => {
    void create3DCurveCopyFromSelectedAsset();
  });
  elements.fileInput.addEventListener("change", () => {
    void importSelectedFile();
  });
  elements.addNodeButton.addEventListener("click", () => {
    addSelectedAssetToPrefab();
  });
  elements.addPrefabInstanceButton.addEventListener("click", () => {
    void addSelectedPrefabToScene();
  });
  elements.deleteAssetButton.addEventListener("click", () => {
    void deleteSelectedAsset();
  });
  elements.deleteSceneNodeButton.addEventListener("click", () => {
    deleteSelectedSceneNode();
  });
  elements.projectionToggleButton.addEventListener("click", () => {
    toggleProjection();
  });
  elements.transformTranslateButton.addEventListener("click", () => {
    setActiveEditorTool("translate");
  });
  elements.transformRotateButton.addEventListener("click", () => {
    setActiveEditorTool("rotate");
  });
  elements.transformScaleButton.addEventListener("click", () => {
    setActiveEditorTool("scale");
  });
  elements.transformPathButton.addEventListener("click", () => {
    setActiveEditorTool("path");
  });
  elements.resetViewButton.addEventListener("click", () => {
    threeViewport.resetView();
    if (editorMode === "scene") {
      loadedSceneId = null;
    }
    renderCache.markAllDirty();
    renderEditorShell();
    exposeEditorDebugHooks();
  });
  threeViewport.setCallbacks({
    onSelectionChange: (nodeId) => {
      if (editorMode === "asset") {
        selectedPrefabNodeId = nodeId;
        syncSelectionFromPrefabNode();
        syncActiveToolAfterSelectionChange();
        rebuildViewportProxies();
      } else if (editorMode === "scene") {
        selectedSceneNodeId = nodeId;
        syncSelectionFromSceneNode();
        renderCache.markSceneBillboardsDirty();
      }

      renderEditorShell();
      exposeEditorDebugHooks();
    },
    onObjectTransform: (nodeId) => {
      if (editorMode === "path") {
        return;
      }
      syncNodeFromViewport(nodeId);
      renderEditorShell();
      exposeEditorDebugHooks();
    },
    onCurve3DControlSelection: (controlId) => {
      selectSourcePathEdit3DControlById(controlId);
    },
    onCurve3DControlTransform: (controlId, position) => {
      updateSourcePathEdit3DControlPosition(controlId, position);
    },
    onCameraChange: () => {
      if (editorMode === "scene") {
        loadedSceneId = null;
      }
      renderCache.markAllDirty();
      scheduleCameraInspectorRender();
      exposeEditorDebugHooks();
    },
  });
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
    editorState.projects = await listProjects();
    const nextProject = reconcileProjectSelection(editorState.selectedProjectId, editorState.projects);

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

  editorState.assets = await listAssets(editorState.selectedProjectId);
  const nextAsset = reconcileAssetSelection(
    editorState.selectedAssetId,
    editorState.assets,
    pathEditSession?.assetId ?? null,
    pathEdit3DSession?.assetId ?? null,
  );

  editorState.selectedAssetId = nextAsset.nextSelectedAssetId;

  if (nextAsset.missingPathEditAssetId) {
    pathEditSession = null;
    pathEditDragState = null;
    setImportError(new Error("Path edit asset no longer exists."));
    return;
  }
  if (nextAsset.missingPathEdit3DAssetId) {
    pathEdit3DSession = null;
    threeViewport.clearCurve3DControls();
    setImportError(new Error("3D curve edit asset no longer exists."));
    return;
  }
  renderEditorShell();
  exposeEditorDebugHooks();
}

async function refreshPrefabs(): Promise<void> {
  if (!editorState.selectedProjectId) {
    prefabs = [];
    prefabDocuments = new Map();
    selectedPrefabId = null;
    loadedPrefabId = null;
    selectedPrefabNodeId = PREFAB_ROOT_NODE_ID;
    pendingPrefabClipboard = null;
    resetPrefabTimelineState();
    renderEditorShell();
    exposeEditorDebugHooks();
    return;
  }

  prefabs = await listPrefabs(editorState.selectedProjectId);
  prefabDocuments = await loadPrefabDocuments({
    projectId: editorState.selectedProjectId,
    prefabs,
    getPrefab,
    onError: (error) => console.error(error),
  });
  const nextPrefab = reconcilePrefabSelection(
    selectedPrefabId,
    loadedPrefabId,
    prefabs,
  );
  selectedPrefabId = nextPrefab.nextSelectedPrefabId;

  if (nextPrefab.missingLoadedPrefabId) {
    loadedPrefabId = null;
    prefabNodes = [];
    selectedPrefabNodeId = PREFAB_ROOT_NODE_ID;
    pendingPrefabClipboard = null;
    resetPrefabTimelineState();
  }

  if (editorMode === "asset") {
    rebuildViewportProxies();
  }

  renderEditorShell();
  exposeEditorDebugHooks();
}

async function refreshScenes(): Promise<void> {
  if (!editorState.selectedProjectId) {
    scenes = [];
    selectedSceneId = null;
    loadedSceneId = null;
    renderEditorShell();
    exposeEditorDebugHooks();
    return;
  }

  scenes = await listScenes(editorState.selectedProjectId);
  const nextScene = reconcileSceneSelection(
    selectedSceneId,
    loadedSceneId,
    scenes,
  );
  selectedSceneId = nextScene.nextSelectedSceneId;

  if (nextScene.missingLoadedSceneId) {
    loadedSceneId = null;
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
  if (!editorState.selectedProjectId || (!pathEditSession && !pathEdit3DSession)) {
    return;
  }

  try {
    const updatedAsset = await runSaveSourcePathEditCommand({
      projectId: editorState.selectedProjectId,
      pathEditSession,
      pathEdit3DSession,
      updateAssetPath,
      updateAssetCurve3D,
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
    pathEditSession = nextPathEditState.pathEditSession;
    pathEdit3DSession = nextPathEditState.pathEdit3DSession;
    pathEditDragState = nextPathEditState.pathEditDragState;
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
  editorMode = "path";
  threeViewport.clearCurve3DControls();
  const nextPathEditState = startSourcePathEditState(asset);
  pathEditSession = nextPathEditState.pathEditSession;
  pathEdit3DSession = nextPathEditState.pathEdit3DSession;
  pathEditDragState = nextPathEditState.pathEditDragState;

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
  pathEditSession = nextPathEditState.pathEditSession;
  pathEdit3DSession = nextPathEditState.pathEdit3DSession;
  pathEditDragState = nextPathEditState.pathEditDragState;
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
    if (selectedPrefabNodeId === PREFAB_ROOT_NODE_ID) {
      selectedPrefabNodeId = null;
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
    if (pathEditSession?.assetId === deletedAssetId) {
      pathEditSession = null;
      pathEditDragState = null;
    }
    if (pathEdit3DSession?.assetId === deletedAssetId) {
      pathEdit3DSession = null;
      threeViewport.clearCurve3DControls();
    }
    if (inPlacePathEditSession?.assetId === deletedAssetId) {
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
      { selectedPrefabId, loadedPrefabId, prefabDocuments },
      result,
    );

    elements.prefabNameInput.value = "";
    selectedPrefabId = nextPrefabState.selectedPrefabId;
    loadedPrefabId = nextPrefabState.loadedPrefabId;
    prefabDocuments = nextPrefabState.prefabDocuments;
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
    selectedPrefabId,
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
      { selectedPrefabId, loadedPrefabId, prefabDocuments },
      result,
    );
    selectedPrefabId = nextPrefabState.selectedPrefabId;
    loadedPrefabId = nextPrefabState.loadedPrefabId;
    prefabDocuments = nextPrefabState.prefabDocuments;
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
    selectedPrefabId,
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
      { selectedPrefabId, loadedPrefabId, prefabDocuments },
      result,
    );

    selectedPrefabId = nextPrefabState.selectedPrefabId;
    loadedPrefabId = nextPrefabState.loadedPrefabId;
    prefabDocuments = nextPrefabState.prefabDocuments;
    editorState.lastImportError = null;
    hideError();
    await refreshPrefabs();
  } catch (error) {
    setImportError(error);
  }
}

async function deleteSelectedPrefab(): Promise<void> {
  if (!editorState.selectedProjectId || !selectedPrefabId) {
    return;
  }

  try {
    const deletedPrefabId = await runDeletePrefabCommand({
      projectId: editorState.selectedProjectId,
      prefabId: selectedPrefabId,
      deletePrefab,
    });
    const nextPrefabState = applyDeletedPrefabDocument(
      { selectedPrefabId, loadedPrefabId, prefabDocuments },
      deletedPrefabId,
    );
    selectedPrefabId = nextPrefabState.selectedPrefabId;
    loadedPrefabId = nextPrefabState.loadedPrefabId;
    prefabDocuments = nextPrefabState.prefabDocuments;

    if (nextPrefabState.deletedLoadedPrefab) {
      prefabNodes = [];
      resetPrefabTimelineState();
      selectedPrefabNodeId = PREFAB_ROOT_NODE_ID;
      pendingPrefabClipboard = null;
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

  const nodeNumber = nextPrefabNodeNumber;
  const nextState = createPrefabGroupNode(
    prefabNodes,
    selectedPrefabNodeId,
    PREFAB_ROOT_NODE_ID,
    createNextPrefabNodeId(),
    nodeNumber,
  );

  prefabNodes = nextState.nodes;
  selectedPrefabNodeId = nextState.selectedNodeId;
  pauseTimeline();
  loadedPrefabId = null;
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
    prefabNodes,
    selectedPrefabNodeId,
    PREFAB_ROOT_NODE_ID,
    selectedAsset,
    createNextPrefabNodeId(),
  );

  prefabNodes = nextState.nodes;
  selectedPrefabNodeId = nextState.selectedNodeId;
  editorState.selectedAssetId = selectedAsset.id;
  pauseTimeline();
  loadedPrefabId = null;
  editorState.lastImportError = null;
  hideError();
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function deleteSelectedPrefabNode(): void {
  if (!selectedPrefabNodeId || selectedPrefabNodeId === PREFAB_ROOT_NODE_ID) {
    return;
  }

  const nextState = deletePrefabNodeSubtree(
    prefabNodes,
    PREFAB_ROOT_NODE_ID,
    selectedPrefabNodeId,
  );
  const { deletedNodeIds } = nextState;

  if (
    inPlacePathEditSession &&
    deletedNodeIds.has(inPlacePathEditSession.nodeId)
  ) {
    exitPathTool();
  }
  pruneTimelineStagingPoses({ nodeIds: deletedNodeIds });
  prefabNodes = nextState.nodes;
  selectedPrefabNodeId = nextState.selectedNodeId;
  clearInvalidPrefabClipboard();
  pauseTimeline();
  loadedPrefabId = null;
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
    selectedPrefabId,
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

  if (!prefabDocuments.has(prefabResult.value)) {
    const result = await getPrefab(projectResult.value, prefabResult.value);
    const nextCache = cachePrefabDocumentForScene(
      { prefabDocuments },
      result.prefab.id,
      result.document,
    );
    prefabDocuments = nextCache.prefabDocuments;
  }

  const nextSceneState = addPrefabInstanceToScene({
    nodes: sceneNodes,
    prefabId: prefabResult.value,
    nodeNumber: nextSceneNodeNumber,
  });
  sceneNodes = nextSceneState.nodes;
  selectedSceneNodeId = nextSceneState.selectedSceneNodeId;
  nextSceneNodeNumber = nextSceneState.nextSceneNodeNumber;
  loadedSceneId = null;
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
    selectedSceneId = nextSceneState.selectedSceneId;
    loadedSceneId = nextSceneState.loadedSceneId;
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
    selectedSceneId,
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

    selectedSceneId = nextSceneState.selectedSceneId;
    loadedSceneId = nextSceneState.loadedSceneId;
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
    selectedSceneId,
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
    selectedSceneId = nextSceneState.selectedSceneId;
    loadedSceneId = nextSceneState.loadedSceneId;
    setEditorMode("scene");
    editorState.lastImportError = null;
    hideError();
  } catch (error) {
    setImportError(error);
  }
}

async function deleteSelectedScene(): Promise<void> {
  if (!editorState.selectedProjectId || !selectedSceneId) {
    return;
  }

  try {
    const deletedSceneId = await runDeleteSceneCommand({
      projectId: editorState.selectedProjectId,
      sceneId: selectedSceneId,
      deleteScene,
    });
    const nextSceneState = applyDeletedSceneDocument(
      { selectedSceneId, loadedSceneId },
      deletedSceneId,
    );

    if (nextSceneState.deletedLoadedScene) {
      clearSceneLayout();
    }

    selectedSceneId = nextSceneState.selectedSceneId;
    loadedSceneId = nextSceneState.loadedSceneId;
    editorState.lastImportError = null;
    hideError();
    await refreshScenes();
  } catch (error) {
    setImportError(error);
  }
}

function deleteSelectedSceneNode(): void {
  if (!selectedSceneNodeId) {
    return;
  }

  const nextSceneState = deleteSceneNodeById(sceneNodes, selectedSceneNodeId);
  sceneNodes = nextSceneState.nodes;
  selectedSceneNodeId = nextSceneState.selectedSceneNodeId;
  loadedSceneId = null;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function toggleProjection(): void {
  threeViewport.toggleProjection();
  if (editorMode === "scene") {
    loadedSceneId = null;
  }
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

  activeEditorTool = tool;
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
    editorMode === "asset" &&
    selectedPrefabNodeId &&
    selectedPrefabNodeId !== PREFAB_ROOT_NODE_ID
      ? getPrefabNode(selectedPrefabNodeId)
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

  if (asset.assetKind === "bezierCurve3d") {
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
    previousSession: inPlacePathEditSession,
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
  inPlacePathEditSession = sessionResult.session;
  stagingPose.pathDraft = cloneStructuredBezierPath(sessionResult.pathDraft);
  inPlacePathEditDragState = null;
  editorState.lastImportError = null;
  hideError();
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
  return true;
}

function discardInPlacePathEditSession(): void {
  inPlacePathEditSession = null;
  inPlacePathEditDragState = null;
  inPlacePathEditHoveredControl = null;
  inPlacePathEditCameraDragActive = false;
}

function fallbackToTransformTool(): void {
  discardInPlacePathEditSession();
  activeEditorTool = getFallbackTransformTool(threeViewport.currentTransformMode);
  threeViewport.setTransformControlsVisible(true);
}

function exitPathTool(): void {
  if (activeEditorTool === "path") {
    fallbackToTransformTool();
    return;
  }

  discardInPlacePathEditSession();
}

function syncActiveToolAfterSelectionChange(): void {
  if (activeEditorTool !== "path") {
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
  if (mode !== "asset" || editorMode !== "asset") {
    exitPathTool();
  }
  if (mode !== "path") {
    pathEditSession = null;
    pathEdit3DSession = null;
    pathEditDragState = null;
    pathEditHoveredControl = null;
    threeViewport.clearCurve3DControls();
  }
  editorMode = mode;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function clearProjectWorkspace(): void {
  exitPathTool();
  const emptyWorkspace = createEmptyProjectWorkspaceState();
  editorState.assets = emptyWorkspace.assets;
  prefabs = emptyWorkspace.prefabs;
  prefabDocuments = emptyWorkspace.prefabDocuments;
  scenes = emptyWorkspace.scenes;
  prefabNodes = [];
  resetPrefabTimelineState();
  sceneNodes = [];
  editorState.selectedAssetId = emptyWorkspace.selectedAssetId;
  selectedPrefabId = emptyWorkspace.selectedPrefabId;
  loadedPrefabId = emptyWorkspace.loadedPrefabId;
  selectedPrefabNodeId = PREFAB_ROOT_NODE_ID;
  pendingPrefabClipboard = null;
  selectedSceneId = emptyWorkspace.selectedSceneId;
  loadedSceneId = emptyWorkspace.loadedSceneId;
  selectedSceneNodeId = emptyWorkspace.selectedSceneNodeId;
  pathEditSession = null;
  pathEdit3DSession = null;
  pathEditDragState = null;
  threeViewport.clearCurve3DControls();
  nextPrefabNodeNumber = 1;
  nextSceneNodeNumber = 1;
  threeViewport.clearNodes();
}

function clearSceneLayout(): void {
  sceneNodes = [];
  selectedSceneNodeId = null;
  loadedSceneId = null;
  pathEditDragState = null;
  if (editorMode !== "path") {
    threeViewport.clearCurve3DControls();
  }
  nextSceneNodeNumber = 1;

  if (editorMode === "scene") {
    rebuildViewportProxies();
  }
}

function createCurrentPrefabDocument(): PrefabDocument {
  return createPrefabDocument(prefabNodes, prefabAnimation);
}

function applyPrefabDocument(document: PrefabDocument): void {
  exitPathTool();
  const nextState = applyPrefabDocumentState(document, PREFAB_ROOT_NODE_ID);

  prefabNodes = nextState.nodes;
  prefabAnimation = nextState.animation;
  timelineStagingPoses = new TimelineStagingPoseStore();
  timelineCurrentTimeMs = 0;
  isTimelinePlaying = false;
  selectedTimelineKeyframeId = null;
  selectedPrefabNodeId = nextState.selectedNodeId;
  clearInvalidPrefabClipboard();
  nextPrefabNodeNumber = nextState.nextNodeNumber;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function createCurrentSceneDocument(): SceneDocument {
  return createSceneDocument(threeViewport.getCameraSnapshot(), sceneNodes);
}

function createEmptySceneDocument(): SceneDocument {
  return createEmptySceneDocumentState(threeViewport.getDefaultCameraSnapshot());
}

function applySceneDocument(document: SceneDocument): void {
  const nextState = applySceneDocumentState(document);

  threeViewport.applyCameraSnapshot(document.camera);
  sceneNodes = nextState.nodes;
  selectedSceneNodeId = nextState.selectedNodeId;
  nextSceneNodeNumber = nextState.nextNodeNumber;
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

  if (editorMode === "path") {
    return;
  }

  if (editorMode === "asset") {
    for (const proxy of createAssetViewportProxyNodes({
      nodes: prefabNodes,
      selectedNodeId: selectedPrefabNodeId,
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
      selectedPrefabNodeId === PREFAB_ROOT_NODE_ID ? null : selectedPrefabNodeId,
    );
    return;
  }

  for (const proxy of createSceneViewportProxyNodes(sceneNodes, getAssetById)) {
    threeViewport.addOrUpdateNode(proxy.node, proxy.asset ?? undefined);
  }

  threeViewport.setSelectedNode(selectedSceneNodeId);
}

function syncNodeFromViewport(nodeId: string): void {
  if (editorMode === "asset") {
    pauseTimeline();
    const node = getPrefabNode(nodeId);

    if (!node) {
      return;
    }

    const activeClip = getActiveTimelineClip();
    const stagingPose =
      activeClip && node.id === selectedPrefabNodeId
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
        nodes: prefabNodes,
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
      nodes: prefabNodes,
      node,
      worldNode,
    });
    loadedPrefabId = null;

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
  loadedSceneId = null;
  renderCache.markSceneBillboardsDirty();
}

function syncSelectionFromPrefabNode(): void {
  if (selectedPrefabNodeId === PREFAB_ROOT_NODE_ID) {
    return;
  }

  const node = selectedPrefabNodeId ? getPrefabNode(selectedPrefabNodeId) : null;

  if (node?.kind === "primitive" && node.assetId) {
    editorState.selectedAssetId = node.assetId;
  }
}

function getActiveTimelineClip(): PrefabAnimationClip | null {
  return getActiveTimelineClipFromState(prefabAnimation);
}

function getActiveTimelineProperty(): PrefabTrackProperty {
  return getTimelinePropertyForEditorTool(activeEditorTool);
}

function setActiveTimelineProperty(property: PrefabTrackProperty): void {
  setActiveEditorTool(getEditorToolForTimelineProperty(property));
}

function updateActiveTimelineClip(nextClip: PrefabAnimationClip): void {
  prefabAnimation = updateActiveTimelineClipForState(prefabAnimation, nextClip);
}

function applyTimelineStatePatch(patch: {
  animation?: PrefabAnimation;
  currentTimeMs?: number;
  isPlaying?: boolean;
  selectedKeyframeId?: string | null;
  timelinePointerDragCleared?: boolean;
}): void {
  if (patch.animation) {
    prefabAnimation = patch.animation;
  }
  if (patch.currentTimeMs !== undefined) {
    timelineCurrentTimeMs = patch.currentTimeMs;
  }
  if (patch.isPlaying !== undefined) {
    isTimelinePlaying = patch.isPlaying;
  }
  if (patch.selectedKeyframeId !== undefined) {
    selectedTimelineKeyframeId = patch.selectedKeyframeId;
  }
  if (patch.timelinePointerDragCleared) {
    timelinePointerDrag = null;
  }
}

function updateTimelinePlayback(deltaSeconds: number): void {
  const nextPlayback = advanceTimelinePlayback({
    isPlaying: isTimelinePlaying,
    activeClip: getActiveTimelineClip(),
    currentTimeMs: timelineCurrentTimeMs,
    deltaSeconds,
  });

  if (
    nextPlayback.currentTimeMs === timelineCurrentTimeMs &&
    nextPlayback.isPlaying === isTimelinePlaying
  ) {
    return;
  }

  timelineCurrentTimeMs = nextPlayback.currentTimeMs;
  isTimelinePlaying = nextPlayback.isPlaying;

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
    nodes: prefabNodes,
    activeClip: getActiveTimelineClip(),
    currentTimeMs: timelineCurrentTimeMs,
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
      animation: prefabAnimation,
      name,
      durationMs: DEFAULT_TIMELINE_DURATION_MS,
      loop: true,
    }),
  );
  loadedPrefabId = null;
  elements.timelineClipNameInput.value = "";
  editorState.lastImportError = null;
  hideError();
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function deleteSelectedTimelineClip(): void {
  const result = deleteActiveTimelineClipCommand(prefabAnimation);

  if (!result.deletedClipId) {
    return;
  }

  applyTimelineStatePatch(result);
  pruneTimelineStagingPoses({ clipIds: new Set([result.deletedClipId]) });
  if (inPlacePathEditSession) {
    exitPathTool();
  }
  loadedPrefabId = null;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function selectTimelineClip(clipId: string): void {
  const result = selectTimelineClipCommand({
    animation: prefabAnimation,
    clipId,
    currentTimeMs: timelineCurrentTimeMs,
  });

  if (!result.selectedClip) {
    return;
  }

  applyTimelineStatePatch(result);
  if (activeEditorTool === "path") {
    startInPlacePathEditSession();
  }
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function selectBasePoseTimeline(): void {
  applyTimelineStatePatch(selectBasePoseTimelineCommand(prefabAnimation));
  if (activeEditorTool === "path") {
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
  const patch = pauseTimelineCommand({ isPlaying: isTimelinePlaying });

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
  timelineCurrentTimeMs = clampTimelineTimeMs(
    timelineCurrentTimeMs,
    getActiveTimelineClip(),
  );
  isTimelinePlaying = false;
  loadedPrefabId = null;
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
  loadedPrefabId = null;
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

  prefabAnimation = {
    ...clonePrefabAnimation(prefabAnimation),
    snapFps: roundTimelineNumber(nextSnapFps),
  };
  loadedPrefabId = null;
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

  selectedTimelineKeyframeId = null;
  updateActiveTimelineClip(nextClip);
  loadedPrefabId = null;
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

  selectedTimelineKeyframeId = result.selectedKeyframeId;
  timelineCurrentTimeMs = result.currentTimeMs;
  updateActiveTimelineClip(result.clip);
  loadedPrefabId = null;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function dragSelectedTimelineKeyframe(event: PointerEvent): void {
  if (!timelinePointerDrag) {
    return;
  }

  const activeClip = getActiveTimelineClip();
  const selected = activeClip ? getSelectedTimelineKeyframe(activeClip) : null;

  if (!activeClip || !selected) {
    timelinePointerDrag = null;
    return;
  }

  const trackBar = document.querySelector(
    `.timeline-track-bar[data-timeline-property="${timelinePointerDrag.property}"]`,
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
  const timeMs = snapAndClampTimelineTimeMs(timelineCurrentTimeMs, activeClip);
  const stagingPose = getOrCreateTimelineStagingPose(
    selectedNode,
    activeClip,
    selectedNode.kind === "primitive" && selectedNode.assetId
      ? getAssetById(selectedNode.assetId)
      : null,
  );

  if (property === "path") {
    const pathDraft =
      inPlacePathEditSession?.nodeId === selectedNode.id
        ? inPlacePathEditSession.draft
        : stagingPose.pathDraft;

    if (!pathDraft || selectedNode.kind !== "primitive") {
      setImportError(new Error("Use the Path tool to edit a primitive path before adding a keyframe."));
      return;
    }

    const result = upsertPrefabPathKeyframe(clonePrefabAnimationClip(activeClip), {
      nodeId: selectedNode.id,
      timeMs,
      value: pathDraft,
      easing: "linear",
      snapFps: prefabAnimation.snapFps,
    });

    selectedTimelineKeyframeId = result.selectedKeyframeId;
    updateActiveTimelineClip(result.clip);
    timelineCurrentTimeMs = timeMs;
    loadedPrefabId = null;
    editorState.lastImportError = null;
    hideError();
    rebuildViewportProxies();
    renderEditorShell();
    exposeEditorDebugHooks();
    return;
  }

  if (!isPrefabVectorTrackProperty(property)) {
    return;
  }

  const result = upsertPrefabVectorKeyframe(clonePrefabAnimationClip(activeClip), {
    nodeId: selectedNode.id,
    property,
    timeMs,
    value: [...stagingPose[property]],
    easing: "linear",
    snapFps: prefabAnimation.snapFps,
  });

  selectedTimelineKeyframeId = result.selectedKeyframeId;
  updateActiveTimelineClip(result.clip);
  timelineCurrentTimeMs = timeMs;
  loadedPrefabId = null;
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

    if (inPlacePathEditSession?.nodeId === selectedNode.id) {
      const previousSelection = inPlacePathEditSession.selected;
      inPlacePathEditSession.draft = cloneStructuredBezierPath(evaluatedPathForSnap);
      inPlacePathEditSession.selected = getRestoredPathEditSelection(
        inPlacePathEditSession.draft,
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
  if (pendingPrefabClipboard) {
    pastePendingPrefabClipboard();
    return;
  }

  startPendingPrefabClipboard("copy");
}

function handlePrefabClipboardSecondaryAction(): void {
  if (pendingPrefabClipboard) {
    pendingPrefabClipboard = null;
    renderEditorShell();
    exposeEditorDebugHooks();
    return;
  }

  startPendingPrefabClipboard("cut");
}

function startPendingPrefabClipboard(mode: PrefabClipboardMode): void {
  const clipboard = startPrefabClipboard(
    mode,
    selectedPrefabNodeId,
    PREFAB_ROOT_NODE_ID,
  );

  if (!clipboard) {
    return;
  }

  if (!getPrefabNode(clipboard.sourceNodeId)) {
    setImportError(new Error("Select an existing prefab node before copy or cut."));
    return;
  }

  pendingPrefabClipboard = clipboard;
  renderEditorShell();
  exposeEditorDebugHooks();
}

function pastePendingPrefabClipboard(): void {
  if (!pendingPrefabClipboard) {
    return;
  }

  const nextState = pastePrefabClipboard(
    prefabNodes,
    pendingPrefabClipboard,
    selectedPrefabNodeId,
    PREFAB_ROOT_NODE_ID,
    createNextPrefabNodeId,
  );

  if ("error" in nextState) {
    if (nextState.error !== "Cannot paste a group or node inside itself.") {
      pendingPrefabClipboard = null;
    }
    setImportError(new Error(nextState.error));
    return;
  }

  prefabNodes = nextState.nodes;
  selectedPrefabNodeId = nextState.selectedNodeId;
  pendingPrefabClipboard = null;
  loadedPrefabId = null;
  editorState.lastImportError = null;
  hideError();
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function syncSelectionFromSceneNode(): void {
  const node = selectedSceneNodeId ? getSceneNode(selectedSceneNodeId) : null;

  if (!node) {
    return;
  }

  if (node.kind === "primitive") {
    editorState.selectedAssetId = node.assetId;
  } else {
    selectedPrefabId = node.prefabId;
  }
}

function syncPrefabProxyWorldTransforms(exceptNodeId: string | null = null): void {
  for (const proxyNode of createPrefabWorldProxyNodes(prefabNodes, exceptNodeId)) {
    threeViewport.syncProxyFromNode(proxyNode);
  }
}

function toggleCollapsibleModule(moduleId: CollapsibleModuleId): void {
  if (collapsedModuleIds.has(moduleId)) {
    collapsedModuleIds.delete(moduleId);
  } else {
    collapsedModuleIds.add(moduleId);
  }

  writeCollapsedModuleCookie(collapsedModuleIds);
  renderCollapsibleModules();
  exposeEditorDebugHooks();
}

function renderCollapsibleModules(): void {
  renderCollapsibleModulesForState(collapsedModuleIds);
}

function renderEditorShell(): void {
  syncAppStateStore();
  renderCache.markAllDirty();
  const activeTimelineClip = getActiveTimelineClip();
  const validInPlacePathEditSession =
    editorMode === "asset" &&
    activeEditorTool === "path" &&
    inPlacePathEditSession
      ? inPlacePathEditSession
      : null;

  renderEditorShellFrame({
    elements,
    mode: editorMode,
    selectedProjectId: editorState.selectedProjectId,
    selectedAssetId: editorState.selectedAssetId,
    selectedPrefabId,
    selectedSceneId,
    selectedSceneNodeId,
    selectedPrefabNodeId,
    prefabRootNodeId: PREFAB_ROOT_NODE_ID,
    pendingPrefabClipboard: Boolean(pendingPrefabClipboard),
    hasPathEditSession: Boolean(pathEditSession),
    hasPathEdit3DSession: Boolean(pathEdit3DSession),
    hasValidInPlacePathEditSession: Boolean(validInPlacePathEditSession),
    activeTimelineClip,
    timelineCurrentTimeMs,
    isTimelinePlaying,
    activeTimelineProperty: getActiveTimelineProperty(),
    currentProjection: threeViewport.currentProjection,
    selectedAssetKind: getSelectedAsset()?.assetKind ?? null,
    activeEditorTool,
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
        if (pathEditSession && pathEditSession.assetId !== asset.id) {
          pathEditSession = null;
          pathEditDragState = null;
        }
        if (pathEdit3DSession && pathEdit3DSession.assetId !== asset.id) {
          pathEdit3DSession = null;
          threeViewport.clearCurve3DControls();
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
    ...prefabs.map((prefab) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const loadedMarker = prefab.id === loadedPrefabId ? " *" : "";

      button.type = "button";
      button.className = "asset-list-item";
      button.dataset.prefabId = prefab.id;
      button.dataset.selected = String(prefab.id === selectedPrefabId);
      button.textContent = `${prefab.name}${loadedMarker}`;
      button.addEventListener("click", () => {
        selectedPrefabId = prefab.id;
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
  rootButton.dataset.selected = String(selectedPrefabNodeId === PREFAB_ROOT_NODE_ID);
  rootButton.textContent = "Group: Root Group";
  rootButton.addEventListener("click", () => {
    if (selectedPrefabNodeId !== PREFAB_ROOT_NODE_ID) {
      exitPathTool();
    }
    selectedPrefabNodeId = PREFAB_ROOT_NODE_ID;
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
      button.dataset.selected = String(node.id === selectedPrefabNodeId);
      button.style.paddingLeft = `${12 + depth * 14}px`;
      button.textContent = label;
      button.addEventListener("click", () => {
        selectedPrefabNodeId = node.id;
        syncSelectionFromPrefabNode();
        syncActiveToolAfterSelectionChange();
        if (editorMode === "asset") {
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
      animation: prefabAnimation,
      currentTimeMs: timelineCurrentTimeMs,
      defaultDurationMs: DEFAULT_TIMELINE_DURATION_MS,
      activeClip: null,
      selectedNode:
        selectedPrefabNodeId && selectedPrefabNodeId !== PREFAB_ROOT_NODE_ID
          ? getPrefabNode(selectedPrefabNodeId)
          : null,
      activeProperty,
      laneProperties: TIMELINE_LANE_PROPERTIES,
      selectedKeyframeId: selectedTimelineKeyframeId,
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
    animation: prefabAnimation,
    currentTimeMs: timelineCurrentTimeMs,
    defaultDurationMs: DEFAULT_TIMELINE_DURATION_MS,
    activeClip,
    selectedNode:
      selectedPrefabNodeId && selectedPrefabNodeId !== PREFAB_ROOT_NODE_ID
        ? getPrefabNode(selectedPrefabNodeId)
        : null,
    activeProperty,
    laneProperties: TIMELINE_LANE_PROPERTIES,
    selectedKeyframeId: selectedTimelineKeyframeId,
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

      timelineCurrentTimeMs = timeMsFromTimelinePointer(event, activeClip);
      selectedTimelineKeyframeId = null;
      isTimelinePlaying = false;
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

      selectedTimelineKeyframeId = keyframeId;
      timelineCurrentTimeMs = timeMs;
      isTimelinePlaying = false;
      renderEditorShell();
      exposeEditorDebugHooks();
    },
    onKeyframePointerDown: (property, keyframeId, event) => {
      event.stopPropagation();
      if (property !== getActiveTimelineProperty()) {
        setActiveTimelineProperty(property);
        return;
      }

      selectedTimelineKeyframeId = keyframeId;
      timelinePointerDrag = {
        keyframeId,
        property,
      };
    },
  });
}

function renderSceneList(): void {
  elements.sceneList.replaceChildren(
    ...scenes.map((scene) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const loadedMarker = scene.id === loadedSceneId ? " *" : "";

      button.type = "button";
      button.className = "asset-list-item";
      button.dataset.sceneId = scene.id;
      button.dataset.selected = String(scene.id === selectedSceneId);
      button.textContent = `${scene.name}${loadedMarker}`;
      button.addEventListener("click", () => {
        selectedSceneId = scene.id;
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
    ...sceneNodes.map((node) => {
      const item = document.createElement("li");
      const button = document.createElement("button");

      button.type = "button";
      button.className = "asset-list-item";
      button.dataset.nodeId = node.id;
      button.dataset.selected = String(node.id === selectedSceneNodeId);
      button.textContent = getSceneNodeLabel(node);
      button.addEventListener("click", () => {
        selectedSceneNodeId = node.id;
        syncSelectionFromSceneNode();
        if (editorMode === "scene") {
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

  if (pathEdit3DSession && pathEdit3DSession.assetId === selectedAsset.id) {
    const selectedSegment = getSelectedPathEdit3DSegment(pathEdit3DSession);
    status.textContent = pathEdit3DSession.selected
      ? `${pathEdit3DSession.selected.segmentId} / ${pathEdit3DSession.selected.component} / 3D`
      : "Select a 3D anchor or handle";
    elements.pathEditFields.append(status);

    if (selectedSegment && pathEdit3DSession.selected) {
      elements.pathEditFields.append(
        createPathEdit3DPointInputRowForUi(selectedSegment, pathEdit3DSession.selected.component, {
          onApply: applyPathEdit3DPointInput,
        }),
      );
    }
    return;
  }

  if (!pathEditSession || pathEditSession.assetId !== selectedAsset.id) {
    status.textContent =
      selectedAsset.assetKind === "bezierCurve3d"
        ? "Click Edit Path to edit this 3D source curve."
        : "Click Edit Path to edit the selected asset source.";
    elements.pathEditFields.append(status);
    return;
  }

  const selectedSegment = getSelectedPathEditSegment(pathEditSession);
  status.textContent = pathEditSession.selected
    ? `${pathEditSession.selected.segmentId} / ${pathEditSession.selected.component}`
    : "Select an anchor or handle";
  elements.pathEditFields.append(status);

  if (selectedSegment && pathEditSession.selected) {
    elements.pathEditFields.append(
      createPathEditPointInputRowForUi(selectedSegment, pathEditSession.selected.component, {
        onApply: (input, segmentId, component, axisIndex) => {
          applyPathEditPointInput(
            input,
            pathEditSession,
            segmentId,
            component,
            axisIndex,
          );
        },
      }),
    );
  }
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

  appendInspectorRow("Mode", getEditorModeLabel(editorMode));
  appendInspectorRow("Project", model.project.name);
  appendInspectorRow("Project ID", model.project.id);
  appendInspectorRow("Projection", model.camera.projection);
  appendInspectorRow("Camera Pos", model.camera.position.join(", "));
  appendInspectorRow("Camera Target", model.camera.target.join(", "));

  if (editorMode === "asset" || editorMode === "path") {
    renderAssetModeInspector();
  } else {
    renderSceneModeInspector();
  }
}

function renderAssetModeInspector(): void {
  const model = createAssetModeInspectorModel({
    selectedPrefab: getSelectedPrefab(),
    loadedPrefabId,
    selectedNodeId: selectedPrefabNodeId,
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
    loadedSceneId,
    selectedNodeId: selectedSceneNodeId,
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
  if (editorMode !== "asset" || node.kind !== "primitive") {
    return;
  }

  const session =
    inPlacePathEditSession?.nodeId === node.id ? inPlacePathEditSession : null;

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

function applyPathEdit3DPointInput(
  input: HTMLInputElement,
  segmentId: string,
  component: PathEditComponent,
  axisIndex: number,
): void {
  const segment = getPathEdit3DSegment(pathEdit3DSession, segmentId);
  const parsedValue = Number(input.value.trim());

  if (!pathEdit3DSession || !segment || !Number.isFinite(parsedValue)) {
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

  pathEdit3DSession.selected = { segmentId, component };
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

  if (!setPathEditComponentAxisValue(session, segmentId, component, axisIndex, parsedValue)) {
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
  const node = editorMode === "asset" ? getPrefabNode(nodeId) : getSceneNode(nodeId);
  const parsedValue = Number(input.value.trim());
  const stagingTransform =
    editorMode === "asset" && getActiveTimelineClip()
      ? getSelectedTimelineStagingTransform()
      : null;
  const editableNode =
    editorMode === "asset" && node
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

  if (editorMode === "asset") {
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
      loadedPrefabId = null;
      rebuildViewportProxies();
    }
  } else {
    node[property] = nextValue;
    loadedSceneId = null;
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

function tick(now: DOMHighResTimeStamp): void {
  const deltaSeconds = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;

  updateTimelinePlayback(deltaSeconds);
  renderPreviewFrame();
  requestAnimationFrame(tick);
}

function renderPreviewFrame(): void {
  const assetAssemblyBillboards =
    editorMode === "asset" ? getCachedAssetAssemblyBillboards() : [];
  const sceneLayoutBillboards =
    editorMode === "scene" ? getCachedSceneLayoutBillboards() : [];

  renderEditorFrame({
    stage,
    mode: editorMode,
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
  const asset = pathEditSession ? getAssetById(pathEditSession.assetId) : null;
  const asset3d = pathEdit3DSession
    ? getAssetById(pathEdit3DSession.assetId)
    : null;

  if (!editorState.selectedProjectId) {
    drawCenteredStatus(vectorContext, stage.size, "Create or select a project");
    return;
  }

  if (pathEdit3DSession) {
    threeViewport.render(stage.size);

    if (!asset3d || asset3d.assetKind !== "bezierCurve3d") {
      drawCenteredStatus(vectorContext, stage.size, "3D curve asset is missing");
      threeViewport.clearCurve3DControls();
      return;
    }

    drawSourcePathEdit3DPreview(vectorContext, asset3d, pathEdit3DSession.draft);
    syncSourcePathEdit3DControls();
    return;
  }

  threeViewport.clearCurve3DControls();

  if (!pathEditSession) {
    const selectedAsset = getSelectedAsset();

    if (selectedAsset) {
      if (selectedAsset.assetKind === "bezierCurve3d") {
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

  const pathD = buildPathEditPathD(pathEditSession.draft);
  const previewAsset = {
    ...asset,
    pathD,
    path: new Path2D(pathD),
    bezierPath: pathEditSession.draft,
  };

  drawPathEditPreview(
    vectorContext,
    previewAsset,
    getSourcePathEditViewTransform(previewAsset),
  );
  drawPathEditControls(
    paperContext,
    pathEditSession,
    getSourcePathEditAdapter(previewAsset),
    pathEditHoveredControl,
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
      inPlacePathEditHoveredControl,
    );
  }
}

function getCachedAssetAssemblyBillboards(): DrawableBillboard[] {
  return renderCache.getAssetAssemblyBillboards({
    nodes: prefabNodes,
    evaluatedNodes: getEvaluatedPrefabNodes(),
    selectedNodeId: selectedPrefabNodeId,
    activeClip: getActiveTimelineClip(),
    selectedNode: getSelectedPrefabNode(),
    pathOverrides: getEvaluatedPrefabPathOverrides(),
  });
}

function getCachedSceneLayoutBillboards(): DrawableBillboard[] {
  return renderCache.getSceneLayoutBillboards({
    nodes: sceneNodes,
    selectedNodeId: selectedSceneNodeId,
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
  if (editorMode !== "path" || !pathEditSession) {
    return;
  }

  const asset = getAssetById(pathEditSession.assetId);
  const adapter = asset ? getSourcePathEditAdapter(asset) : null;

  if (!asset || !adapter) {
    return;
  }

  const control = findPathEditControlAtPoint({
    point: getCanvasPointerPoint(event),
    session: pathEditSession,
    adapter,
    hitRadius: PATH_EDIT_HIT_RADIUS,
  });

  if (!control) {
    updatePathEditHoveredControl(null);
    return;
  }

  pathEditHoveredControl = toPathEditSelection(control);
  pathEditDragState = selectPathEditSessionControl({
    session: pathEditSession,
    control,
  });
  event.preventDefault();
  renderCache.markPaperDirty();
  renderSourcePathEditPanel();
  exposeEditorDebugHooks();
}

function updatePathEditHover(event: PointerEvent | MouseEvent): void {
  if (editorMode !== "path" || !pathEditSession || pathEditDragState) {
    if (pathEditHoveredControl) {
      clearPathEditHover();
    }
    return;
  }

  const asset = getAssetById(pathEditSession.assetId);
  const adapter = asset ? getSourcePathEditAdapter(asset) : null;
  const hoveredControl =
    asset && adapter
      ? findPathEditControlAtPoint({
          point: getCanvasPointerPoint(event),
          session: pathEditSession,
          adapter,
          hitRadius: PATH_EDIT_HIT_RADIUS,
        })
      : null;

  updatePathEditHoveredControl(hoveredControl);
}

function updatePathEditHoveredControl(control: PathEditControl | null): void {
  const nextHover = toPathEditSelection(control);

  if (pathEditSelectionsEqual(pathEditHoveredControl, nextHover)) {
    return;
  }

  pathEditHoveredControl = nextHover;
  renderCache.markPaperDirty();
  exposeEditorDebugHooks();
}

function clearPathEditHover(): void {
  updatePathEditHoveredControl(null);
}

function dragPathEditControl(event: PointerEvent | MouseEvent): void {
  if (editorMode !== "path" || !pathEditSession || !pathEditDragState) {
    return;
  }

  const asset = getAssetById(pathEditSession.assetId);
  const adapter = asset ? getSourcePathEditAdapter(asset) : null;

  if (!asset || !adapter) {
    pathEditDragState = null;
    return;
  }

  const pathPoint = adapter.screenToPath(getCanvasPointerPoint(event));

  if (!pathPoint) {
    return;
  }

  dragPathEditSessionAtPoint({
    session: pathEditSession,
    dragState: pathEditDragState,
    point: pathPoint,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
  });
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

function getPathEditScreenControls(): Array<{
  segmentId: string;
  component: PathEditComponent;
  x: number;
  y: number;
}> {
  const asset = pathEditSession ? getAssetById(pathEditSession.assetId) : null;

  return getSourcePathEditScreenControls({
    session: pathEditSession,
    adapter: asset ? getSourcePathEditAdapter(asset) : null,
  });
}

function syncSourcePathEdit3DControls(): void {
  if (!pathEdit3DSession) {
    threeViewport.clearCurve3DControls();
    return;
  }

  const controls = getSourcePathEdit3DControls(pathEdit3DSession);
  const lines = getSourcePathEdit3DHandleLines(pathEdit3DSession);

  threeViewport.setCurve3DControls(controls, lines);

  const selectedId = pathEdit3DSession.selected
    ? getSourcePathEdit3DControlId(
        pathEdit3DSession.selected.segmentId,
        pathEdit3DSession.selected.component,
      )
    : null;
  threeViewport.setSelectedCurve3DControl(selectedId);
}

function getSourcePathEdit3DControls(
  session: SourcePathEdit3DSession | null = pathEdit3DSession,
): Curve3DControlDescriptor[] {
  return getSourcePathEdit3DControlsForState({
    session,
    getAssetById,
    transformPoint3DToWorldUnit,
  });
}

function getSourcePathEdit3DProjectedCommands(): ProjectedCurveCommand[] {
  if (!pathEdit3DSession) {
    const selectedAsset = getSelectedAsset();

    return selectedAsset?.assetKind === "bezierCurve3d"
      ? projectBezierPath3DToCommands(selectedAsset.bezierPath3d, {
          camera: threeViewport.activeCamera,
          viewport: stage.size,
          worldMatrix: getAsset3DLocalToWorldUnitMatrix(selectedAsset),
        })
      : [];
  }

  const asset = getAssetById(pathEdit3DSession.assetId);

  return projectBezierPath3DToCommands(pathEdit3DSession.draft, {
    camera: threeViewport.activeCamera,
    viewport: stage.size,
    worldMatrix: asset ? getAsset3DLocalToWorldUnitMatrix(asset) : undefined,
  });
}

function getSourcePathEdit3DHandleLines(
  session: SourcePathEdit3DSession | null = pathEdit3DSession,
): ReturnType<typeof getSourcePathEdit3DHandleLinesForState> {
  return getSourcePathEdit3DHandleLinesForState({
    session,
    getAssetById,
    transformPoint3DToWorldUnit,
  });
}

function selectSourcePathEdit3DControlById(controlId: string | null): void {
  if (editorMode !== "path" || !pathEdit3DSession) {
    return;
  }

  const selection = controlId ? parseSourcePathEdit3DControlId(controlId) : null;
  pathEdit3DSession.selected = selection;
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
  if (editorMode !== "path" || !pathEdit3DSession) {
    return;
  }

  const selection = parseSourcePathEdit3DControlId(controlId);

  if (!selection) {
    return;
  }

  const segment = getPathEdit3DSegment(pathEdit3DSession, selection.segmentId);
  const asset = getAssetById(pathEdit3DSession.assetId);

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

  pathEdit3DSession.selected = selection;
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

  inPlacePathEditHoveredControl = toPathEditSelection(control);
  inPlacePathEditDragState = selectPathEditSessionControl({
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
    inPlacePathEditDragState ||
    inPlacePathEditCameraDragActive
  ) {
    if (inPlacePathEditHoveredControl) {
      clearInPlacePathEditHover();
    }
    return;
  }

  const hoveredControl = findInPlacePathEditControl(event);

  updateInPlacePathEditHoveredControl(hoveredControl);
}

function updateInPlacePathEditHoveredControl(control: PathEditControl | null): void {
  const nextHover = toPathEditSelection(control);

  if (pathEditSelectionsEqual(inPlacePathEditHoveredControl, nextHover)) {
    return;
  }

  inPlacePathEditHoveredControl = nextHover;
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

  if (!session || !adapter || !inPlacePathEditDragState) {
    return;
  }

  const pathPoint = adapter.screenToPath(getCanvasPointerPoint(event));

  if (!pathPoint) {
    return;
  }

  dragPathEditSessionAtPoint({
    session,
    dragState: inPlacePathEditDragState,
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
  if (editorMode !== "asset" || activeEditorTool !== "path" || !inPlacePathEditSession) {
    return null;
  }

  const node = getPrefabNode(inPlacePathEditSession.nodeId);
  const asset = getAssetById(inPlacePathEditSession.assetId);
  const activeClip = getActiveTimelineClip();
  const stagingPose = getTimelineStagingPose(inPlacePathEditSession.nodeId, activeClip);

  if (
    !isInPlacePathEditSessionValid({
      session: inPlacePathEditSession,
      selectedNodeId: selectedPrefabNodeId,
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
    inPlacePathEditSession.draft = stagingPose.pathDraft;
  }

  return inPlacePathEditSession;
}

function getSelectedInPlacePathNodeAndAsset(): {
  node: PrefabNode;
  asset: PrimitiveSvgAsset;
} | null {
  const node =
    editorMode === "asset" &&
    selectedPrefabNodeId &&
    selectedPrefabNodeId !== PREFAB_ROOT_NODE_ID
      ? getPrefabNode(selectedPrefabNodeId)
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
  return getSelectedPrefabFromState(prefabs, selectedPrefabId);
}

function getSelectedScene(): SceneRecord | null {
  return getSelectedSceneFromState(scenes, selectedSceneId);
}

function getAssetById(assetId: string): PrimitiveSvgAsset | null {
  return findRecordById(editorState.assets, assetId);
}

function getAssetsById(): Map<string, PrimitiveSvgAsset> {
  return new Map(editorState.assets.map((asset) => [asset.id, asset]));
}

function getPrefabRecordById(prefabId: string): PrefabRecord | null {
  return findRecordById(prefabs, prefabId);
}

function getPrefabDocumentById(prefabId: string): PrefabDocument | null {
  return getPrefabDocumentByIdFromState(
    prefabDocuments,
    prefabId,
    loadedPrefabId,
    createCurrentPrefabDocument(),
  );
}

function getPrefabNode(nodeId: string): PrefabNode | null {
  return getNodeById(prefabNodes, nodeId);
}

function getSceneNode(nodeId: string): SceneNode | null {
  return getNodeById(sceneNodes, nodeId);
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
  return getSelectedTimelineKeyframeFromState(clip, selectedTimelineKeyframeId);
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
    return clampTimelineTimeMs(timelineCurrentTimeMs, clip);
  }

  const rect = target.getBoundingClientRect();
  const rawRatio = (event.clientX - rect.left) / Math.max(rect.width, 1);
  const ratio = Math.min(Math.max(rawRatio, 0), 1);

  return snapAndClampTimelineTimeMs(Math.round(ratio * clip.durationMs), clip);
}

function resetPrefabTimelineState(): void {
  prefabAnimation = createEmptyPrefabAnimation();
  timelineStagingPoses = new TimelineStagingPoseStore();
  timelineCurrentTimeMs = 0;
  isTimelinePlaying = false;
  selectedTimelineKeyframeId = null;
  timelinePointerDrag = null;
  discardInPlacePathEditSession();
}

function createEmptyPrefabAnimation(): PrefabAnimation {
  return createEmptyPrefabAnimationState(DEFAULT_PREFAB_SNAP_FPS);
}

function getSelectedPrefabNode(): PrefabNode | null {
  return selectedPrefabNodeId && selectedPrefabNodeId !== PREFAB_ROOT_NODE_ID
    ? getPrefabNode(selectedPrefabNodeId)
    : null;
}

function canUsePathTool(): boolean {
  return canUseTool("path");
}

function canUseTool(tool: EditorTool): boolean {
  const selection = getSelectedInPlacePathNodeAndAsset();

  return canUsePathToolForSelection({
    editorMode,
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
  return timelineStagingPoses.get(nodeId, clip);
}

function getOrCreateTimelineStagingPose(
  node: PrefabNode,
  clip: PrefabAnimationClip,
  asset?: PrimitiveSvgAsset | null,
): TimelineStagingPose {
  return timelineStagingPoses.getOrCreate(node, clip, asset);
}

function getTimelineStagingWorldTransform(
  pose: TimelineStagingPose,
): TransformSnapshot {
  return getStagingWorldTransform({
    nodes: prefabNodes,
    stagingPose: pose,
  });
}

function getSelectedTimelineStagingPose(): TimelineStagingPose | null {
  return getSelectedTimelineStagingPoseFromLayers({
    selectedNode: getSelectedPrefabNode(),
    activeClip: getActiveTimelineClip(),
    assetsById: getAssetsById(),
    stagingPoses: timelineStagingPoses,
  });
}

function getSelectedTimelineStagingTransform(): TransformSnapshot | null {
  return getSelectedTimelineStagingTransformFromLayers({
    selectedNode: getSelectedPrefabNode(),
    activeClip: getActiveTimelineClip(),
    assetsById: getAssetsById(),
    stagingPoses: timelineStagingPoses,
  });
}

function syncInPlacePathSessionToStagingPose(): void {
  const session = inPlacePathEditSession;
  const pose = session ? getTimelineStagingPose(session.nodeId) : null;

  if (!session || !pose) {
    return;
  }

  timelineStagingPoses.syncPathDraft(session.nodeId, session.draft);
}

function pruneTimelineStagingPoses(
  options?: TimelineStagingPruneOptions,
): void {
  timelineStagingPoses.prune(options, getPrefabNode);
}

function createNextPrefabNodeId(): string {
  const id = `prefab-node-${nextPrefabNodeNumber}`;
  nextPrefabNodeNumber += 1;
  return id;
}

function clearInvalidPrefabClipboard(): void {
  pendingPrefabClipboard = clearInvalidPrefabClipboardForState(
    pendingPrefabClipboard,
    prefabNodes,
  );
}

function getPrefabNodeTreeEntries(): PrefabNodeTreeEntry[] {
  return getPrefabNodeTreeEntriesFromNodes(prefabNodes);
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
    prefabAnimation.snapFps,
  );
}

function setImportError(error: unknown): void {
  const message = error instanceof Error ? error.message : "Unknown error";
  editorState.lastImportError = message;
  elements.importError.textContent = message;
  elements.importError.hidden = false;
  elements.fileInput.value = "";
  console.error(error);
  renderEditorShell();
  exposeEditorDebugHooks();
}

function hideError(): void {
  elements.importError.hidden = true;
  elements.importError.textContent = "";
}

function exposeEditorDebugHooks(): void {
  syncAppStateStore();
  window.__vectorEditorDebug = {
    getProjects: () => [...editorState.projects],
    getAssets: () =>
      editorState.assets.map((asset) => ({
        id: asset.id,
        assetKind: asset.assetKind,
        name: asset.name,
        sourceUrl: asset.sourceUrl,
        viewBox: asset.viewBox,
        fill: asset.assetKind === "filledPath" ? asset.fill : "none",
        fillRule: asset.assetKind === "filledPath" ? asset.fillRule : "nonzero",
        stroke:
          asset.assetKind === "strokePath" || asset.assetKind === "bezierCurve3d"
            ? asset.stroke
            : null,
        strokeWidth:
          asset.assetKind === "strokePath" || asset.assetKind === "bezierCurve3d"
            ? asset.strokeWidth
            : null,
        bezierPath: asset.bezierPath,
        bezierPath3d:
          asset.assetKind === "bezierCurve3d"
            ? cloneStructuredBezierPath3D(asset.bezierPath3d)
            : null,
        pathD: asset.pathD,
      })),
    getPrefabs: () => [...prefabs],
    getPrefabAssembly: () => ({
      nodes: prefabNodes.map(clonePrefabNode),
      selectedPrefabId,
      loadedPrefabId,
      selectedPrefabNodeId,
      pendingClipboard: pendingPrefabClipboard
        ? { ...pendingPrefabClipboard }
        : null,
    }),
    getPrefabTimeline: () => {
      const stagingPose = getSelectedTimelineStagingPose();

      return {
        animation: clonePrefabAnimation(prefabAnimation),
        currentTimeMs: timelineCurrentTimeMs,
        isPlaying: isTimelinePlaying,
        selectedClipId: prefabAnimation.activeClipId,
        activeTrackProperty: getActiveTimelineProperty(),
        selectedKeyframeId: selectedTimelineKeyframeId,
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
        pathEditSession,
        pathEdit3DSession,
        hoveredControl: pathEditHoveredControl,
        controls: getPathEditScreenControls(),
        controls3d: getSourcePathEdit3DControls(),
        projectedCommandCount: getSourcePathEdit3DProjectedCommands().length,
      }),
    getInPlacePathEditState: () =>
      createInPlacePathEditDebugState({
        session: inPlacePathEditSession,
        active: Boolean(getValidInPlacePathEditSession()),
        hoveredControl: inPlacePathEditHoveredControl,
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
        nodes: sceneNodes.map(cloneSceneNode),
        selectedNodeId: selectedSceneNodeId,
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
    getActiveEditorTool: () => activeEditorTool,
    getScenes: () => [...scenes],
    getEditorMode: () => editorMode,
    getSelectedProjectId: () => editorState.selectedProjectId,
    getSelectedAssetId: () => editorState.selectedAssetId,
    getSelectedPrefabId: () => selectedPrefabId,
    getLoadedPrefabId: () => loadedPrefabId,
    getSelectedSceneId: () => selectedSceneId,
    getLoadedSceneId: () => loadedSceneId,
    getLastImportError: () => editorState.lastImportError,
    getCollapsedModules: () =>
      COLLAPSIBLE_MODULE_IDS.filter((moduleId) =>
        collapsedModuleIds.has(moduleId),
      ),
    getAppStateSnapshot: () => appStateStore.getSnapshot(),
  };
}

