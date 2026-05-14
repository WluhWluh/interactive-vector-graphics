import "../styles.css";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { PrimitiveSvgAsset } from "../core/assets/primitiveSvg";
import {
  cloneStructuredBezierPath,
  structuredBezierToPathD,
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
  createPrefab,
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
  uploadAsset,
  type PrefabAnimation,
  type PrefabAnimationClip,
  type PrefabAnimationTrack,
  type PrefabPathAnimationKeyframe,
  type PrefabPathAnimationTrack,
  type PrefabVectorAnimationKeyframe,
  type PrefabVectorAnimationTrack,
  type PrefabVectorTrackProperty,
  type PrefabTrackEasing,
  type PrefabTrackProperty,
  type PrefabDocument,
  type PrefabNode,
  type PrefabRecord,
  type ProjectRecord,
  type SceneDocument,
  type SceneNode,
  type ScenePrefabInstanceNode,
  type ScenePrimitiveNode,
  type SceneRecord,
} from "./api";
import {
  addBezierPoints,
  createPathEditSession,
  dragPathEditControl as dragPathEditCoreControl,
  findNearestPathEditControl,
  getPathEditComponentPoint,
  getPathEditControls,
  getPathEditScreenControls as getCorePathEditScreenControls,
  getPathEditSegment,
  getSelectedPathEditSegment,
  roundBezierValue,
  selectPathEditControl as selectPathEditCoreControl,
  setPathEditComponentAxisValue,
  type PathEditComponent,
  type PathEditControl,
  type PathEditDragState,
  type PathEditScreenControl,
  type PathEditSession,
  type PathEditViewportAdapter,
} from "./pathEditCore";
import {
  ThreeEditorViewport,
  tupleToVector,
  type CameraProjection,
  type EditorTransformNode,
  type TransformMode,
  type Vector3Tuple,
} from "./threeEditorViewport";

type EditorMode = "asset" | "path" | "scene";
type TransformProperty = "position" | "rotation" | "scale";
type EditorTool = TransformMode | "path";
type TimelineVectorProperty = PrefabVectorTrackProperty;
type TimelineLaneProperty = PrefabTrackProperty;
type TimelinePointerDrag = {
  keyframeId: string;
  property: PrefabTrackProperty;
};
type TimelineStagingPose = TransformSnapshot & {
  nodeId: string;
  clipId: string;
  pathDraft?: StructuredBezierPath;
};
type SceneCreateSource = "empty" | "current";
type PrefabSelectionId = string | typeof PREFAB_ROOT_NODE_ID;
type PrefabClipboardMode = "copy" | "cut";
type PendingPrefabClipboard = {
  mode: PrefabClipboardMode;
  sourceNodeId: string;
};
type SourcePathEditSession = PathEditSession & {
  assetId: string;
};
type InPlacePathEditSession = PathEditSession & {
  nodeId: string;
  assetId: string;
};
type CollapsibleModuleId =
  | "projects"
  | "primitive-assets"
  | "prefabs"
  | "prefab-contents"
  | "source-path-assets"
  | "scene-documents"
  | "scene-contents";

type EditorElements = {
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
  assetList: HTMLUListElement;
  pathAssetList: HTMLUListElement;
  editPathButton: HTMLButtonElement;
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

type TransformSnapshot = {
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
};

type DrawableBillboard = {
  id: string;
  asset: PrimitiveSvgAsset;
  transform: TransformSnapshot;
  selected: boolean;
  opacity?: number;
  ghost?: boolean;
  pathOverride?: StructuredBezierPath;
};

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

type PrefabNodeTreeEntry = {
  node: PrefabNode;
  depth: number;
};

const COLLAPSIBLE_MODULE_IDS: CollapsibleModuleId[] = [
  "projects",
  "primitive-assets",
  "prefabs",
  "prefab-contents",
  "source-path-assets",
  "scene-documents",
  "scene-contents",
];
const COLLAPSED_MODULE_COOKIE_NAME = "ivg_editor_collapsed_modules";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const EXPANDED_ARROW = "▴";
const COLLAPSED_ARROW = "▾";
const PREFAB_ROOT_NODE_ID = "__prefab-root__";
const TIMELINE_VECTOR_PROPERTIES: TimelineVectorProperty[] = [
  "position",
  "rotation",
  "scale",
];
const TIMELINE_LANE_PROPERTIES: TimelineLaneProperty[] = [
  ...TIMELINE_VECTOR_PROPERTIES,
  "path",
];
const EDITOR_TOOL_TO_PREFAB_PROPERTY: Record<EditorTool, PrefabTrackProperty> = {
  translate: "position",
  rotate: "rotation",
  scale: "scale",
  path: "path",
};
const PREFAB_PROPERTY_TO_EDITOR_TOOL: Record<PrefabTrackProperty, EditorTool> = {
  position: "translate",
  rotation: "rotate",
  scale: "scale",
  path: "path",
};
const DEFAULT_PREFAB_SNAP_FPS = 10;
const DEFAULT_TIMELINE_DURATION_MS = 1000;
const PATH_EDIT_HIT_RADIUS = 10;

const stage = new CanvasStage(["vector-canvas", "paper-canvas"]);
const threeViewport = new ThreeEditorViewport();
const elements = getEditorElements();
const collapsedModuleIds = readCollapsedModuleCookie();

let projects: ProjectRecord[] = [];
let assets: PrimitiveSvgAsset[] = [];
let prefabs: PrefabRecord[] = [];
let prefabNodes: PrefabNode[] = [];
let prefabDocuments = new Map<string, PrefabDocument>();
let scenes: SceneRecord[] = [];
let sceneNodes: SceneNode[] = [];
let editorMode: EditorMode = "asset";
let selectedProjectId: string | null = null;
let selectedAssetId: string | null = null;
let selectedPrefabId: string | null = null;
let loadedPrefabId: string | null = null;
let selectedPrefabNodeId: PrefabSelectionId | null = PREFAB_ROOT_NODE_ID;
let prefabAnimation: PrefabAnimation = createEmptyPrefabAnimation();
let timelineStagingPoses = new Map<string, TimelineStagingPose>();
let timelineCurrentTimeMs = 0;
let isTimelinePlaying = false;
let selectedTimelineKeyframeId: string | null = null;
let timelinePointerDrag: TimelinePointerDrag | null = null;
let activeEditorTool: EditorTool = "translate";
let selectedSceneId: string | null = null;
let loadedSceneId: string | null = null;
let selectedSceneNodeId: string | null = null;
let pendingPrefabClipboard: PendingPrefabClipboard | null = null;
let pathEditSession: SourcePathEditSession | null = null;
let pathEditDragState: PathEditDragState | null = null;
let pathEditHoveredControl: PathEditDragState | null = null;
let inPlacePathEditSession: InPlacePathEditSession | null = null;
let inPlacePathEditDragState: PathEditDragState | null = null;
let inPlacePathEditHoveredControl: PathEditDragState | null = null;
let inPlacePathEditCameraDragActive = false;
let lastImportError: string | null = null;
let lastFrameTime = performance.now();
let nextSceneNodeNumber = 1;
let nextPrefabNodeNumber = 1;
let pendingCameraInspectorRender = false;

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
        assetId: string | null;
        selectedSegmentId: string | null;
        selectedComponent: PathEditComponent | null;
        hoveredSegmentId: string | null;
        hoveredComponent: PathEditComponent | null;
        hasDraft: boolean;
        draftBezierPath: StructuredBezierPath | null;
        controls: PathEditScreenControl[];
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
    renderEditorShell();
    exposeEditorDebugHooks();
  });
  threeViewport.setCallbacks({
    onSelectionChange: (nodeId) => {
      if (editorMode === "asset") {
        exitPathTool();
        selectedPrefabNodeId = nodeId;
        syncSelectionFromPrefabNode();
      } else if (editorMode === "scene") {
        selectedSceneNodeId = nodeId;
        syncSelectionFromSceneNode();
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
    onCameraChange: () => {
      if (editorMode === "scene") {
        loadedSceneId = null;
      }
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
    projects = await listProjects();
    const nextProjectId = chooseStableSelection(
      selectedProjectId,
      projects.map((project) => project.id),
    );

    if (selectedProjectId !== nextProjectId) {
      clearProjectWorkspace();
    }

    selectedProjectId = nextProjectId;
    await refreshAssets();
    await refreshPrefabs();
    await refreshScenes();
    lastImportError = null;
    hideError();
  } catch (error) {
    setImportError(error);
  }
}

async function refreshAssets(): Promise<void> {
  if (!selectedProjectId) {
    assets = [];
    selectedAssetId = null;
    renderEditorShell();
    exposeEditorDebugHooks();
    return;
  }

  assets = await listAssets(selectedProjectId);
  selectedAssetId = chooseStableSelection(
    selectedAssetId,
    assets.map((asset) => asset.id),
  );
  if (
    pathEditSession &&
    !assets.some((asset) => asset.id === pathEditSession?.assetId)
  ) {
    pathEditSession = null;
    pathEditDragState = null;
    setImportError(new Error("Path edit asset no longer exists."));
    return;
  }
  renderEditorShell();
  exposeEditorDebugHooks();
}

async function refreshPrefabs(): Promise<void> {
  if (!selectedProjectId) {
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

  prefabs = await listPrefabs(selectedProjectId);
  const nextDocuments = new Map<string, PrefabDocument>();

  await Promise.all(
    prefabs.map(async (prefab) => {
      try {
        const detail = await getPrefab(selectedProjectId!, prefab.id);
        nextDocuments.set(prefab.id, detail.document);
      } catch (error) {
        console.error(error);
      }
    }),
  );

  prefabDocuments = nextDocuments;
  selectedPrefabId = chooseStableSelection(
    selectedPrefabId,
    prefabs.map((prefab) => prefab.id),
  );

  if (loadedPrefabId && !prefabs.some((prefab) => prefab.id === loadedPrefabId)) {
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
  if (!selectedProjectId) {
    scenes = [];
    selectedSceneId = null;
    loadedSceneId = null;
    renderEditorShell();
    exposeEditorDebugHooks();
    return;
  }

  scenes = await listScenes(selectedProjectId);
  selectedSceneId = chooseStableSelection(
    selectedSceneId,
    scenes.map((scene) => scene.id),
  );

  if (loadedSceneId && !scenes.some((scene) => scene.id === loadedSceneId)) {
    loadedSceneId = null;
  }

  renderEditorShell();
  exposeEditorDebugHooks();
}

async function createProjectFromInput(): Promise<void> {
  const name = elements.projectNameInput.value.trim();

  if (!name) {
    setImportError(new Error("Project name is required."));
    return;
  }

  try {
    const project = await createProject(name);
    elements.projectNameInput.value = "";
    clearProjectWorkspace();
    selectedProjectId = project.id;
    lastImportError = null;
    hideError();
    await refreshProjects();
  } catch (error) {
    setImportError(error);
  }
}

async function deleteSelectedProject(): Promise<void> {
  if (!selectedProjectId) {
    return;
  }

  try {
    await deleteProject(selectedProjectId);
    selectedProjectId = null;
    clearProjectWorkspace();
    lastImportError = null;
    hideError();
    await refreshProjects();
  } catch (error) {
    setImportError(error);
  }
}

async function savePathEditSession(): Promise<void> {
  if (!selectedProjectId || !pathEditSession) {
    return;
  }

  try {
    const updatedAsset = await updateAssetPath(
      selectedProjectId,
      pathEditSession.assetId,
      pathEditSession.draft,
    );
    assets = assets.map((asset) =>
      asset.id === updatedAsset.id ? updatedAsset : asset,
    );
    selectedAssetId = updatedAsset.id;
    pathEditSession = null;
    pathEditDragState = null;
    lastImportError = null;
    hideError();
    rebuildViewportProxies();
    renderEditorShell();
    exposeEditorDebugHooks();
  } catch (error) {
    setImportError(error);
  }
}

function startPathEditSession(asset: PrimitiveSvgAsset): void {
  selectedAssetId = asset.id;
  editorMode = "path";
  pathEditSession = {
    ...createPathEditSession(asset.bezierPath),
    assetId: asset.id,
  };
  pathEditDragState = null;
  exitPathTool();
  lastImportError = null;
  hideError();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function cancelPathEditSession(): void {
  pathEditSession = null;
  pathEditDragState = null;
  renderEditorShell();
  exposeEditorDebugHooks();
}

async function importSelectedFile(): Promise<void> {
  const file = elements.fileInput.files?.[0];

  if (!file || !selectedProjectId) {
    elements.fileInput.value = "";
    if (!selectedProjectId) {
      setImportError(new Error("Create or select a project before importing SVG."));
    }
    return;
  }

  try {
    const asset = await uploadAsset(selectedProjectId, file);
    selectedAssetId = asset.id;
    if (selectedPrefabNodeId === PREFAB_ROOT_NODE_ID) {
      selectedPrefabNodeId = null;
    }
    lastImportError = null;
    hideError();
    elements.fileInput.value = "";
    await refreshAssets();
    selectedAssetId = asset.id;
    renderEditorShell();
    exposeEditorDebugHooks();
  } catch (error) {
    setImportError(error);
  }
}

async function deleteSelectedAsset(): Promise<void> {
  if (!selectedProjectId || !selectedAssetId) {
    return;
  }

  try {
    const deletedAssetId = selectedAssetId;
    await deleteAsset(selectedProjectId, selectedAssetId);
    if (pathEditSession?.assetId === deletedAssetId) {
      pathEditSession = null;
      pathEditDragState = null;
    }
    if (inPlacePathEditSession?.assetId === deletedAssetId) {
      exitPathTool();
    }
    pruneTimelineStagingPoses({ assetIds: new Set([deletedAssetId]) });
    selectedAssetId = null;
    lastImportError = null;
    hideError();
    await refreshAssets();
    rebuildViewportProxies();
  } catch (error) {
    setImportError(error);
  }
}

async function createPrefabFromInput(): Promise<void> {
  if (!selectedProjectId) {
    setImportError(new Error("Create or select a project before creating a prefab."));
    return;
  }

  const name = elements.prefabNameInput.value.trim();

  if (!name) {
    setImportError(new Error("Prefab name is required."));
    return;
  }

  try {
    const result = await createPrefab(
      selectedProjectId,
      name,
      createCurrentPrefabDocument(),
    );

    elements.prefabNameInput.value = "";
    selectedPrefabId = result.prefab.id;
    loadedPrefabId = result.prefab.id;
    applyPrefabDocument(result.document);
    prefabDocuments.set(result.prefab.id, result.document);
    lastImportError = null;
    hideError();
    await refreshPrefabs();
  } catch (error) {
    setImportError(error);
  }
}

async function loadSelectedPrefab(): Promise<void> {
  if (!selectedProjectId || !selectedPrefabId) {
    setImportError(new Error("Select a saved prefab before loading."));
    return;
  }

  try {
    const result = await getPrefab(selectedProjectId, selectedPrefabId);
    selectedPrefabId = result.prefab.id;
    loadedPrefabId = result.prefab.id;
    prefabDocuments.set(result.prefab.id, result.document);
    applyPrefabDocument(result.document);
    setEditorMode("asset");
    lastImportError = null;
    hideError();
  } catch (error) {
    setImportError(error);
  }
}

async function saveSelectedPrefab(): Promise<void> {
  if (!selectedProjectId || !selectedPrefabId) {
    setImportError(new Error("Select a saved prefab before saving."));
    return;
  }

  try {
    const result = await savePrefab(
      selectedProjectId,
      selectedPrefabId,
      createCurrentPrefabDocument(),
    );

    selectedPrefabId = result.prefab.id;
    loadedPrefabId = result.prefab.id;
    prefabDocuments.set(result.prefab.id, result.document);
    lastImportError = null;
    hideError();
    await refreshPrefabs();
  } catch (error) {
    setImportError(error);
  }
}

async function deleteSelectedPrefab(): Promise<void> {
  if (!selectedProjectId || !selectedPrefabId) {
    return;
  }

  try {
    const deletedPrefabId = selectedPrefabId;
    await deletePrefab(selectedProjectId, deletedPrefabId);
    prefabDocuments.delete(deletedPrefabId);

    if (loadedPrefabId === deletedPrefabId) {
      prefabNodes = [];
      resetPrefabTimelineState();
      selectedPrefabNodeId = PREFAB_ROOT_NODE_ID;
      pendingPrefabClipboard = null;
      loadedPrefabId = null;
    }

    selectedPrefabId = null;
    lastImportError = null;
    hideError();
    await refreshPrefabs();
    rebuildViewportProxies();
  } catch (error) {
    setImportError(error);
  }
}

function createPrefabGroup(): void {
  if (!selectedProjectId) {
    setImportError(new Error("Create or select a project before editing a prefab."));
    return;
  }

  const nodeNumber = nextPrefabNodeNumber;
  const node: PrefabNode = {
    id: createNextPrefabNodeId(),
    kind: "group",
    parentId: getParentIdForNewPrefabNode(),
    name: `Group ${nodeNumber}`,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    billboardMode: "spherical",
  };

  prefabNodes = [...prefabNodes, node];
  selectedPrefabNodeId = node.id;
  pauseTimeline();
  loadedPrefabId = null;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function addSelectedAssetToPrefab(): void {
  const selectedAsset = getSelectedAsset();

  if (!selectedProjectId || !selectedAsset) {
    setImportError(new Error("Select an SVG primitive asset before adding it."));
    return;
  }

  const node: PrefabNode = {
    id: createNextPrefabNodeId(),
    kind: "primitive",
    parentId: getParentIdForNewPrefabNode(),
    assetId: selectedAsset.id,
    name: selectedAsset.name,
    position: [0, 1, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    billboardMode: "spherical",
  };

  prefabNodes = [...prefabNodes, node];
  selectedPrefabNodeId = node.id;
  selectedAssetId = selectedAsset.id;
  pauseTimeline();
  loadedPrefabId = null;
  lastImportError = null;
  hideError();
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function deleteSelectedPrefabNode(): void {
  if (!selectedPrefabNodeId || selectedPrefabNodeId === PREFAB_ROOT_NODE_ID) {
    return;
  }

  const deletedNodeIds = getPrefabNodeAndDescendantIds(selectedPrefabNodeId);
  if (
    inPlacePathEditSession &&
    deletedNodeIds.has(inPlacePathEditSession.nodeId)
  ) {
    exitPathTool();
  }
  pruneTimelineStagingPoses({ nodeIds: deletedNodeIds });
  prefabNodes = prefabNodes.filter((node) => !deletedNodeIds.has(node.id));
  selectedPrefabNodeId = PREFAB_ROOT_NODE_ID;
  clearInvalidPrefabClipboard();
  pauseTimeline();
  loadedPrefabId = null;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

async function addSelectedPrefabToScene(): Promise<void> {
  if (!selectedProjectId || !selectedPrefabId) {
    setImportError(new Error("Select a prefab before adding a scene instance."));
    return;
  }

  if (!prefabDocuments.has(selectedPrefabId)) {
    const result = await getPrefab(selectedProjectId, selectedPrefabId);
    prefabDocuments.set(result.prefab.id, result.document);
  }

  const node: ScenePrefabInstanceNode = {
    id: `node-${nextSceneNodeNumber}`,
    kind: "prefabInstance",
    prefabId: selectedPrefabId,
    position: [0, 1, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };

  nextSceneNodeNumber += 1;
  sceneNodes = [...sceneNodes, node];
  selectedSceneNodeId = node.id;
  loadedSceneId = null;
  setEditorMode("scene");
  lastImportError = null;
  hideError();
}

async function createSceneFromInput(source: SceneCreateSource): Promise<void> {
  if (!selectedProjectId) {
    setImportError(new Error("Create or select a project before creating a scene."));
    return;
  }

  const name = elements.sceneNameInput.value.trim();

  if (!name) {
    setImportError(new Error("Scene name is required."));
    return;
  }

  try {
    const result = await createScene(
      selectedProjectId,
      name,
      source === "empty" ? createEmptySceneDocument() : createCurrentSceneDocument(),
    );

    elements.sceneNameInput.value = "";
    selectedSceneId = result.scene.id;
    loadedSceneId = result.scene.id;
    applySceneDocument(result.document);
    setEditorMode("scene");
    lastImportError = null;
    hideError();
    await refreshScenes();
  } catch (error) {
    setImportError(error);
  }
}

async function saveSelectedScene(): Promise<void> {
  if (!selectedProjectId || !selectedSceneId) {
    setImportError(new Error("Select a saved scene before saving."));
    return;
  }

  try {
    const result = await saveScene(
      selectedProjectId,
      selectedSceneId,
      createCurrentSceneDocument(),
    );

    selectedSceneId = result.scene.id;
    loadedSceneId = result.scene.id;
    lastImportError = null;
    hideError();
    await refreshScenes();
  } catch (error) {
    setImportError(error);
  }
}

async function loadSelectedScene(): Promise<void> {
  if (!selectedProjectId || !selectedSceneId) {
    setImportError(new Error("Select a saved scene before loading."));
    return;
  }

  try {
    const result = await getScene(selectedProjectId, selectedSceneId);
    applySceneDocument(result.document);
    selectedSceneId = result.scene.id;
    loadedSceneId = result.scene.id;
    setEditorMode("scene");
    lastImportError = null;
    hideError();
  } catch (error) {
    setImportError(error);
  }
}

async function deleteSelectedScene(): Promise<void> {
  if (!selectedProjectId || !selectedSceneId) {
    return;
  }

  try {
    const deletedSceneId = selectedSceneId;
    await deleteScene(selectedProjectId, deletedSceneId);

    if (loadedSceneId === deletedSceneId) {
      clearSceneLayout();
    }

    selectedSceneId = null;
    lastImportError = null;
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

  sceneNodes = sceneNodes.filter((node) => node.id !== selectedSceneNodeId);
  selectedSceneNodeId = null;
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
  if (tool === "path" && !canUsePathTool()) {
    discardInPlacePathEditSession();
    activeEditorTool = threeViewport.currentTransformMode;
    threeViewport.setTransformControlsVisible(true);
    renderEditorShell();
    exposeEditorDebugHooks();
    return;
  }

  if (tool === "path") {
    activeEditorTool = "path";
    threeViewport.setTransformControlsVisible(false);
    threeViewport.setOrbitControlsEnabled(true);
    startInPlacePathEditSession();
    return;
  }

  activeEditorTool = tool;
  threeViewport.setTransformMode(tool);
  threeViewport.setTransformControlsVisible(true);
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

  const stagingPose = getOrCreateTimelineStagingPose(selectedNode, activeClip, asset);

  pauseTimeline();
  inPlacePathEditSession = {
    draft: stagingPose.pathDraft
      ? cloneStructuredBezierPath(stagingPose.pathDraft)
      : cloneStructuredBezierPath(asset.bezierPath),
    selected:
      inPlacePathEditSession?.nodeId === selectedNode.id
        ? inPlacePathEditSession.selected
        : {
            segmentId:
              stagingPose.pathDraft?.segments[0]?.id ??
              asset.bezierPath.segments[0]?.id ??
              "",
            component: "anchor",
          },
    nodeId: selectedNode.id,
    assetId: asset.id,
  };
  stagingPose.pathDraft = cloneStructuredBezierPath(inPlacePathEditSession.draft);
  inPlacePathEditDragState = null;
  lastImportError = null;
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

function exitPathTool(): void {
  discardInPlacePathEditSession();
  activeEditorTool = threeViewport.currentTransformMode;
  threeViewport.setTransformControlsVisible(true);
}

function setEditorMode(mode: EditorMode): void {
  if (mode !== "asset" || editorMode !== "asset") {
    exitPathTool();
  }
  editorMode = mode;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function clearProjectWorkspace(): void {
  exitPathTool();
  assets = [];
  prefabs = [];
  prefabDocuments = new Map();
  scenes = [];
  prefabNodes = [];
  resetPrefabTimelineState();
  sceneNodes = [];
  selectedAssetId = null;
  selectedPrefabId = null;
  loadedPrefabId = null;
  selectedPrefabNodeId = PREFAB_ROOT_NODE_ID;
  pendingPrefabClipboard = null;
  selectedSceneId = null;
  loadedSceneId = null;
  selectedSceneNodeId = null;
  pathEditSession = null;
  pathEditDragState = null;
  nextPrefabNodeNumber = 1;
  nextSceneNodeNumber = 1;
  threeViewport.clearNodes();
}

function clearSceneLayout(): void {
  sceneNodes = [];
  selectedSceneNodeId = null;
  loadedSceneId = null;
  pathEditDragState = null;
  nextSceneNodeNumber = 1;

  if (editorMode === "scene") {
    rebuildViewportProxies();
  }
}

function createCurrentPrefabDocument(): PrefabDocument {
  return {
    version: 4,
    nodes: prefabNodes.map(clonePrefabNode),
    animation: clonePrefabAnimation(prefabAnimation),
  };
}

function applyPrefabDocument(document: PrefabDocument): void {
  exitPathTool();
  prefabNodes = document.nodes.map(clonePrefabNode);
  prefabAnimation = clonePrefabAnimation(document.animation);
  timelineStagingPoses = new Map();
  timelineCurrentTimeMs = 0;
  isTimelinePlaying = false;
  selectedTimelineKeyframeId = null;
  selectedPrefabNodeId = prefabNodes[0]?.id ?? PREFAB_ROOT_NODE_ID;
  clearInvalidPrefabClipboard();
  nextPrefabNodeNumber = getNextNodeNumber(
    prefabNodes.map((node) => node.id),
    "prefab-node",
  );
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function createCurrentSceneDocument(): SceneDocument {
  return {
    version: 2,
    camera: threeViewport.getCameraSnapshot(),
    nodes: sceneNodes.map(cloneSceneNode),
    animation: {
      fps: 24,
      activeClipId: null,
      clips: [],
    },
  };
}

function createEmptySceneDocument(): SceneDocument {
  return {
    version: 2,
    camera: threeViewport.getDefaultCameraSnapshot(),
    nodes: [],
    animation: {
      fps: 24,
      activeClipId: null,
      clips: [],
    },
  };
}

function applySceneDocument(document: SceneDocument): void {
  threeViewport.applyCameraSnapshot(document.camera);
  sceneNodes = document.nodes.map(cloneSceneNode);
  selectedSceneNodeId = sceneNodes[0]?.id ?? null;
  nextSceneNodeNumber = getNextNodeNumber(
    sceneNodes.map((node) => node.id),
    "node",
  );
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function rebuildViewportProxies(): void {
  threeViewport.clearNodes();

  if (!selectedProjectId) {
    return;
  }

  if (editorMode === "asset") {
    const worldTransforms = getPrefabWorldTransforms(prefabNodes);
    const activeClip = getActiveTimelineClip();

    for (const node of prefabNodes) {
      const isSelected =
        activeClip &&
        selectedPrefabNodeId !== PREFAB_ROOT_NODE_ID &&
        node.id === selectedPrefabNodeId;
      const stagingPose = isSelected ? getOrCreateTimelineStagingPose(node, activeClip) : null;
      const worldTransform = stagingPose
        ? getTimelineStagingWorldTransform(stagingPose)
        : matrixToTransform(worldTransforms.get(node.id) ?? transformToMatrix(node));
      const proxyNode: EditorTransformNode = {
        id: node.id,
        ...worldTransform,
      };
      const asset =
        node.kind === "primitive" && node.assetId
          ? getAssetById(node.assetId)
          : null;
      threeViewport.addOrUpdateNode(proxyNode, asset ?? undefined);
    }

    threeViewport.setSelectedNode(
      selectedPrefabNodeId === PREFAB_ROOT_NODE_ID ? null : selectedPrefabNodeId,
    );
    return;
  }

  for (const node of sceneNodes) {
    const asset = node.kind === "primitive" ? getAssetById(node.assetId) : null;
    threeViewport.addOrUpdateNode(node, asset ?? undefined);
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
      const localTransform = getLocalTransformFromPrefabWorldTransform(node, worldNode);
      stagingPose.position = [...localTransform.position];
      stagingPose.rotation = [...localTransform.rotation];
      stagingPose.scale = [...localTransform.scale];
      return;
    }

    const worldNode: EditorTransformNode = {
      id: node.id,
      position: [...node.position],
      rotation: [...node.rotation],
      scale: [...node.scale],
    };

    threeViewport.syncNodeFromProxy(worldNode);
    applyWorldTransformToPrefabNode(node, worldNode);
    loadedPrefabId = null;

    /**
     * TransformControls fires continuously while the user drags a handle. Do
     * not rebuild the proxy scene here: clearing and recreating the selected
     * Three object detaches the active handle and makes group dragging feel like
     * it stops after a tiny movement. Instead, keep the selected proxy alive and
     * only refresh the world-space transforms of the other prefab proxies.
     */
    syncPrefabProxyWorldTransforms(node.id);

    return;
  }

  const node = getSceneNode(nodeId);

  if (!node) {
    return;
  }

  threeViewport.syncNodeFromProxy(node);
  loadedSceneId = null;
}

function syncSelectionFromPrefabNode(): void {
  if (selectedPrefabNodeId === PREFAB_ROOT_NODE_ID) {
    return;
  }

  const node = selectedPrefabNodeId ? getPrefabNode(selectedPrefabNodeId) : null;

  if (node?.kind === "primitive" && node.assetId) {
    selectedAssetId = node.assetId;
  }
}

function getActiveTimelineClip(): PrefabAnimationClip | null {
  return prefabAnimation.activeClipId
    ? (prefabAnimation.clips.find(
        (clip) => clip.id === prefabAnimation.activeClipId,
      ) ?? null)
    : null;
}

function getActiveTimelineProperty(): PrefabTrackProperty {
  return EDITOR_TOOL_TO_PREFAB_PROPERTY[activeEditorTool];
}

function setActiveTimelineProperty(property: PrefabTrackProperty): void {
  setActiveEditorTool(PREFAB_PROPERTY_TO_EDITOR_TOOL[property]);
}

function updateActiveTimelineClip(nextClip: PrefabAnimationClip): void {
  prefabAnimation = {
    ...prefabAnimation,
    activeClipId: nextClip.id,
    clips: prefabAnimation.clips.map((clip) =>
      clip.id === nextClip.id ? clonePrefabAnimationClip(nextClip) : clonePrefabAnimationClip(clip),
    ),
  };
}

function updateTimelinePlayback(deltaSeconds: number): void {
  if (!isTimelinePlaying) {
    return;
  }

  const activeClip = getActiveTimelineClip();

  if (!activeClip || activeClip.durationMs <= 0) {
    isTimelinePlaying = false;
    renderEditorShell();
    exposeEditorDebugHooks();
    return;
  }

  const nextTimeMs = timelineCurrentTimeMs + deltaSeconds * 1000;

  if (nextTimeMs > activeClip.durationMs) {
    if (activeClip.loop) {
      timelineCurrentTimeMs = Math.round(nextTimeMs % activeClip.durationMs);
    } else {
      timelineCurrentTimeMs = activeClip.durationMs;
      isTimelinePlaying = false;
    }
  } else {
    timelineCurrentTimeMs = Math.round(nextTimeMs);
  }

  renderPrefabTimeline();
  exposeEditorDebugHooks();
}

function getEvaluatedPrefabNodes(): PrefabNode[] {
  const nodes = prefabNodes.map(clonePrefabNode);
  const activeClip = getActiveTimelineClip();

  if (!activeClip) {
    return nodes;
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const timeMs = clampTimelineTimeMs(timelineCurrentTimeMs, activeClip);

  for (const track of activeClip.tracks) {
    if (!isPrefabVectorTrack(track)) {
      continue;
    }

    const node = nodeById.get(track.target.nodeId);

    if (!node) {
      continue;
    }

    const value = evaluatePrefabTrack(track, timeMs);

    if (value) {
      node[track.target.property] = value;
    }
  }

  return nodes;
}

function evaluatePrefabTrack(
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

function getEvaluatedPrefabPathOverrides(): Map<string, StructuredBezierPath> {
  const overrides = new Map<string, StructuredBezierPath>();
  const activeClip = getActiveTimelineClip();

  if (!activeClip) {
    return overrides;
  }

  const timeMs = clampTimelineTimeMs(timelineCurrentTimeMs, activeClip);

  for (const track of activeClip.tracks) {
    if (!isPrefabPathTrack(track)) {
      continue;
    }

    const path = evaluatePrefabPathTrack(track, timeMs);

    if (path) {
      overrides.set(track.target.nodeId, path);
    }
  }

  return overrides;
}

function evaluatePrefabPathTrack(
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

function canInterpolateBezierPaths(
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

function interpolateBezierPaths(
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

function upsertPrefabKeyframe(
  clip: PrefabAnimationClip,
  input: {
    nodeId: string;
    property: PrefabVectorTrackProperty;
    timeMs: number;
    value: Vector3Tuple;
    easing: PrefabTrackEasing;
  },
): PrefabAnimationClip {
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

  const snappedTimeMs = snapTimelineTimeMs(input.timeMs);
  const nextKeyframe = {
    id: "",
    timeMs: snappedTimeMs,
    value: [...input.value] as Vector3Tuple,
    easing: input.easing,
  };
  const existingIndex = track.keyframes.findIndex(
    (keyframe) => keyframe.timeMs === snappedTimeMs,
  );

  if (existingIndex >= 0) {
    const existingKeyframe = track.keyframes[existingIndex];
    track.keyframes[existingIndex] = {
      ...nextKeyframe,
      id: existingKeyframe?.id ?? createUniqueTimelineKeyframeId(track),
    };
    selectedTimelineKeyframeId = track.keyframes[existingIndex]?.id ?? null;
  } else {
    const createdKeyframe = {
      ...nextKeyframe,
      id: createUniqueTimelineKeyframeId(track),
    };
    track.keyframes.push(createdKeyframe);
    selectedTimelineKeyframeId = createdKeyframe.id;
  }

  track.keyframes.sort((a, b) => a.timeMs - b.timeMs);

  return {
    ...clip,
    tracks,
  };
}

function upsertPrefabPathKeyframe(
  clip: PrefabAnimationClip,
  input: {
    nodeId: string;
    timeMs: number;
    value: StructuredBezierPath;
    easing: PrefabTrackEasing;
  },
): PrefabAnimationClip {
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

  const snappedTimeMs = snapTimelineTimeMs(input.timeMs);
  const nextKeyframe: PrefabPathAnimationKeyframe = {
    id: "",
    timeMs: snappedTimeMs,
    value: cloneStructuredBezierPath(input.value),
    easing: input.easing,
  };
  const existingIndex = track.keyframes.findIndex(
    (keyframe) => keyframe.timeMs === snappedTimeMs,
  );

  if (existingIndex >= 0) {
    const existingKeyframe = track.keyframes[existingIndex];
    track.keyframes[existingIndex] = {
      ...nextKeyframe,
      id: existingKeyframe?.id ?? createUniqueTimelineKeyframeId(track),
    };
    selectedTimelineKeyframeId = track.keyframes[existingIndex]?.id ?? null;
  } else {
    const createdKeyframe = {
      ...nextKeyframe,
      id: createUniqueTimelineKeyframeId(track),
    };
    track.keyframes.push(createdKeyframe);
    selectedTimelineKeyframeId = createdKeyframe.id;
  }

  track.keyframes.sort((a, b) => a.timeMs - b.timeMs);

  return {
    ...clip,
    tracks,
  };
}

function createTimelineClipFromInput(): void {
  if (!selectedProjectId) {
    setImportError(new Error("Create or select a project before creating a clip."));
    return;
  }

  const name = elements.timelineClipNameInput.value.trim();

  if (!name) {
    setImportError(new Error("Clip name is required."));
    return;
  }

  const clip: PrefabAnimationClip = {
    id: createUniqueTimelineClipId(name),
    name,
    durationMs: DEFAULT_TIMELINE_DURATION_MS,
    loop: true,
    tracks: [],
  };

  prefabAnimation = {
    ...prefabAnimation,
    activeClipId: clip.id,
    clips: [...prefabAnimation.clips.map(clonePrefabAnimationClip), clip],
  };
  timelineCurrentTimeMs = 0;
  isTimelinePlaying = false;
  selectedTimelineKeyframeId = null;
  loadedPrefabId = null;
  elements.timelineClipNameInput.value = "";
  lastImportError = null;
  hideError();
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function deleteSelectedTimelineClip(): void {
  const activeClip = getActiveTimelineClip();

  if (!activeClip) {
    return;
  }

  prefabAnimation = {
    ...prefabAnimation,
    activeClipId: null,
    clips: prefabAnimation.clips
      .filter((clip) => clip.id !== activeClip.id)
      .map(clonePrefabAnimationClip),
  };
  pruneTimelineStagingPoses({ clipIds: new Set([activeClip.id]) });
  if (inPlacePathEditSession) {
    exitPathTool();
  }
  timelineCurrentTimeMs = 0;
  isTimelinePlaying = false;
  selectedTimelineKeyframeId = null;
  loadedPrefabId = null;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function selectTimelineClip(clipId: string): void {
  const clip = prefabAnimation.clips.find((candidate) => candidate.id === clipId);

  if (!clip) {
    return;
  }

  prefabAnimation = {
    ...prefabAnimation,
    activeClipId: clip.id,
    clips: prefabAnimation.clips.map(clonePrefabAnimationClip),
  };
  timelineCurrentTimeMs = clampTimelineTimeMs(timelineCurrentTimeMs, clip);
  isTimelinePlaying = false;
  if (activeEditorTool === "path") {
    startInPlacePathEditSession();
  }
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function selectBasePoseTimeline(): void {
  prefabAnimation = {
    ...prefabAnimation,
    activeClipId: null,
    clips: prefabAnimation.clips.map(clonePrefabAnimationClip),
  };
  timelineCurrentTimeMs = 0;
  isTimelinePlaying = false;
  selectedTimelineKeyframeId = null;
  timelinePointerDrag = null;
  if (activeEditorTool === "path") {
    exitPathTool();
  }
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function playTimeline(): void {
  const activeClip = getActiveTimelineClip();

  if (!activeClip || activeClip.durationMs <= 0) {
    return;
  }

  isTimelinePlaying = true;
  renderEditorShell();
  exposeEditorDebugHooks();
}

function pauseTimeline(): void {
  if (!isTimelinePlaying) {
    return;
  }

  isTimelinePlaying = false;
  renderEditorShell();
  exposeEditorDebugHooks();
}

function stopTimeline(): void {
  isTimelinePlaying = false;
  timelineCurrentTimeMs = 0;
  selectedTimelineKeyframeId = null;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function scrubTimelineTo(timeMs: number): void {
  const activeClip = getActiveTimelineClip();

  if (!activeClip || !Number.isFinite(timeMs)) {
    return;
  }

  timelineCurrentTimeMs = clampTimelineTimeMs(Math.round(timeMs), activeClip);
  isTimelinePlaying = false;
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
  const nextDuration = Number(elements.timelineDurationInput.value.trim());

  if (
    !activeClip ||
    !Number.isFinite(nextDuration) ||
    nextDuration < 0 ||
    !Number.isInteger(nextDuration)
  ) {
    renderEditorShell();
    return;
  }

  const durationMs = Math.round(nextDuration);
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
  const nextSnapFps = Number(elements.timelineSnapFpsInput.value.trim());

  if (!Number.isFinite(nextSnapFps) || nextSnapFps < 1 || nextSnapFps > 240) {
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
  const x = Number(elements.timelineKeyframeValueXInput.value.trim());
  const y = Number(elements.timelineKeyframeValueYInput.value.trim());
  const z = Number(elements.timelineKeyframeValueZInput.value.trim());

  if (
    !selected ||
    !isPrefabVectorTrack(selected.track) ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(z)
  ) {
    renderEditorShell();
    return;
  }

  updateSelectedTimelineKeyframe({
    ...selected.keyframe,
    value: [roundTransformValue(x), roundTransformValue(y), roundTransformValue(z)],
  });
}

function applySelectedKeyframeEasingInput(): void {
  const activeClip = getActiveTimelineClip();
  const selected = activeClip ? getSelectedTimelineKeyframe(activeClip) : null;
  const easing = elements.timelineKeyframeEasingSelect.value as PrefabTrackEasing;

  if (
    !selected ||
    !isPrefabVectorTrack(selected.track) ||
    !["linear", "step", "easeInOut"].includes(easing)
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

  if (!isPrefabVectorTrack(selected.track)) {
    const nextClip: PrefabAnimationClip = {
      ...activeClip,
      tracks: activeClip.tracks.map((track) =>
        track.id === selected.track.id && isPrefabPathTrack(track)
          ? {
              ...track,
              keyframes: track.keyframes
                .filter((keyframe) => keyframe.id !== selected.keyframe.id)
                .map(clonePrefabPathAnimationKeyframe),
            }
          : clonePrefabAnimationTrack(track),
      ),
    };

    selectedTimelineKeyframeId = null;
    updateActiveTimelineClip(nextClip);
    loadedPrefabId = null;
    rebuildViewportProxies();
    renderEditorShell();
    exposeEditorDebugHooks();
    return;
  }

  const selectedVectorTrack = selected.track;
  const nextClip: PrefabAnimationClip = {
    ...activeClip,
    tracks: activeClip.tracks.map((track) =>
      track.id === selectedVectorTrack.id && isPrefabVectorTrack(track)
        ? {
            ...track,
            keyframes: track.keyframes
              .filter((keyframe) => keyframe.id !== selected.keyframe.id)
              .map(clonePrefabAnimationKeyframe),
          }
        : clonePrefabAnimationTrack(track),
    ),
  };

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

  selectedTimelineKeyframeId = nextKeyframe.id;
  timelineCurrentTimeMs = nextTimeMs;
  updateActiveTimelineClip(nextClip);
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

    const nextClip = upsertPrefabPathKeyframe(clonePrefabAnimationClip(activeClip), {
      nodeId: selectedNode.id,
      timeMs,
      value: pathDraft,
      easing: "linear",
    });

    updateActiveTimelineClip(nextClip);
    timelineCurrentTimeMs = timeMs;
    loadedPrefabId = null;
    lastImportError = null;
    hideError();
    rebuildViewportProxies();
    renderEditorShell();
    exposeEditorDebugHooks();
    return;
  }

  if (!isPrefabVectorTrackProperty(property)) {
    return;
  }

  let nextClip = clonePrefabAnimationClip(activeClip);

  nextClip = upsertPrefabKeyframe(nextClip, {
    nodeId: selectedNode.id,
    property,
    timeMs,
    value: [...stagingPose[property]],
    easing: "linear",
  });

  updateActiveTimelineClip(nextClip);
  timelineCurrentTimeMs = timeMs;
  loadedPrefabId = null;
  lastImportError = null;
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
    const evaluatedPathForSnap =
      getEvaluatedPrefabPathOverrides().get(selectedNode.id) ?? asset.bezierPath;

    stagingPose.pathDraft = cloneStructuredBezierPath(evaluatedPathForSnap);

    if (inPlacePathEditSession?.nodeId === selectedNode.id) {
      const previousSelection = inPlacePathEditSession.selected;
      inPlacePathEditSession.draft = cloneStructuredBezierPath(evaluatedPathForSnap);
      inPlacePathEditSession.selected =
      previousSelection &&
      inPlacePathEditSession.draft.segments.some(
        (segment) => segment.id === previousSelection.segmentId,
      )
        ? previousSelection
        : {
            segmentId: inPlacePathEditSession.draft.segments[0]?.id ?? "",
            component: "anchor",
          };
    }
  }

  pauseTimeline();
  lastImportError = null;
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
  if (!selectedPrefabNodeId || selectedPrefabNodeId === PREFAB_ROOT_NODE_ID) {
    return;
  }

  if (!getPrefabNode(selectedPrefabNodeId)) {
    setImportError(new Error("Select an existing prefab node before copy or cut."));
    return;
  }

  pendingPrefabClipboard = {
    mode,
    sourceNodeId: selectedPrefabNodeId,
  };
  renderEditorShell();
  exposeEditorDebugHooks();
}

function pastePendingPrefabClipboard(): void {
  if (!pendingPrefabClipboard) {
    return;
  }

  const clipboard = pendingPrefabClipboard;
  const sourceNode = getPrefabNode(clipboard.sourceNodeId);

  if (!sourceNode) {
    pendingPrefabClipboard = null;
    setImportError(new Error("The copied or cut prefab node no longer exists."));
    return;
  }

  const targetParentId = getPasteParentId();

  if (targetParentId === undefined) {
    pendingPrefabClipboard = null;
    setImportError(new Error("Select an existing paste target."));
    return;
  }

  if (
    clipboard.mode === "cut" &&
    targetParentId &&
    getPrefabNodeAndDescendantIds(sourceNode.id).has(targetParentId)
  ) {
    setImportError(new Error("Cannot paste a group or node inside itself."));
    return;
  }

  if (clipboard.mode === "copy") {
    copyPrefabSubtree(sourceNode, targetParentId);
  } else {
    cutPrefabSubtree(sourceNode, targetParentId);
  }

  pendingPrefabClipboard = null;
  loadedPrefabId = null;
  lastImportError = null;
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
    selectedAssetId = node.assetId;
  } else {
    selectedPrefabId = node.prefabId;
  }
}

function syncPrefabProxyWorldTransforms(exceptNodeId: string | null = null): void {
  const worldTransforms = getPrefabWorldTransforms(prefabNodes);

  for (const node of prefabNodes) {
    if (node.id === exceptNodeId) {
      continue;
    }

    const worldTransform = worldTransforms.get(node.id);

    if (!worldTransform) {
      continue;
    }

    threeViewport.syncProxyFromNode({
      id: node.id,
      ...matrixToTransform(worldTransform),
    });
  }
}

function toggleCollapsibleModule(moduleId: CollapsibleModuleId): void {
  if (collapsedModuleIds.has(moduleId)) {
    collapsedModuleIds.delete(moduleId);
  } else {
    collapsedModuleIds.add(moduleId);
  }

  writeCollapsedModuleCookie();
  renderCollapsibleModules();
  exposeEditorDebugHooks();
}

function renderCollapsibleModules(): void {
  for (const moduleId of COLLAPSIBLE_MODULE_IDS) {
    const moduleElement = getCollapsibleModule(moduleId);
    const body = getCollapsibleModuleBody(moduleElement, moduleId);
    const button = getModuleCollapseButton(moduleId);
    const collapsed = collapsedModuleIds.has(moduleId);

    moduleElement.dataset.collapsed = String(collapsed);
    body.hidden = collapsed;
    button.textContent = collapsed ? COLLAPSED_ARROW : EXPANDED_ARROW;
    button.setAttribute("aria-expanded", String(!collapsed));
  }
}

function readCollapsedModuleCookie(): Set<CollapsibleModuleId> {
  const rawValue = document.cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${COLLAPSED_MODULE_COOKIE_NAME}=`))
    ?.slice(COLLAPSED_MODULE_COOKIE_NAME.length + 1);

  if (!rawValue) {
    return new Set();
  }

  const allowedIds = new Set(COLLAPSIBLE_MODULE_IDS);
  const decodedValue = decodeURIComponent(rawValue);
  const moduleIds = decodedValue
    .split(",")
    .filter((value): value is CollapsibleModuleId =>
      allowedIds.has(value as CollapsibleModuleId),
    );

  return new Set(moduleIds);
}

function writeCollapsedModuleCookie(): void {
  const value = encodeURIComponent(
    COLLAPSIBLE_MODULE_IDS.filter((moduleId) =>
      collapsedModuleIds.has(moduleId),
    ).join(","),
  );

  document.cookie = [
    `${COLLAPSED_MODULE_COOKIE_NAME}=${value}`,
    "path=/",
    `max-age=${COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ].join("; ");
}

function getCollapsibleModule(moduleId: CollapsibleModuleId): HTMLElement {
  const element = document.querySelector(
    `[data-collapsible-module="${moduleId}"]`,
  );

  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected collapsible module "${moduleId}" to exist.`);
  }

  return element;
}

function getCollapsibleModuleBody(
  moduleElement: HTMLElement,
  moduleId: CollapsibleModuleId,
): HTMLElement {
  const body = moduleElement.querySelector(".collapsible-module-body");

  if (!(body instanceof HTMLElement)) {
    throw new Error(`Expected collapsible body for module "${moduleId}".`);
  }

  return body;
}

function getModuleCollapseButton(moduleId: CollapsibleModuleId): HTMLButtonElement {
  const button = document.querySelector(
    `[data-module-collapse-button="${moduleId}"]`,
  );

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Expected collapse button for module "${moduleId}".`);
  }

  return button;
}

function getEditorElements(): EditorElements {
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
    assetList: getRequiredElement("asset-list", HTMLUListElement),
    pathAssetList: getRequiredElement("path-asset-list", HTMLUListElement),
    editPathButton: getRequiredElement("edit-path-button", HTMLButtonElement),
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

function renderEditorShell(): void {
  renderProjectList();
  renderAssetList();
  renderPathAssetList();
  renderPrefabList();
  renderPrefabNodeList();
  renderPrefabTimeline();
  renderSceneList();
  renderSceneNodeList();
  renderSourcePathEditPanel();
  renderInspector();
  renderCollapsibleModules();
  elements.assetModePanel.hidden = editorMode !== "asset";
  elements.pathModePanel.hidden = editorMode !== "path";
  elements.sceneModePanel.hidden = editorMode !== "scene";
  elements.assetModeButton.dataset.selected = String(editorMode === "asset");
  elements.pathModeButton.dataset.selected = String(editorMode === "path");
  elements.sceneModeButton.dataset.selected = String(editorMode === "scene");
  document.body.dataset.pathEditActive = String(
    editorMode === "path" && Boolean(pathEditSession),
  );
  const validInPlacePathEditSession =
    editorMode === "asset" &&
    activeEditorTool === "path" &&
    inPlacePathEditSession
      ? inPlacePathEditSession
      : null;
  document.body.dataset.inPlacePathEditActive = String(
    Boolean(validInPlacePathEditSession),
  );
  elements.fileInput.disabled = !selectedProjectId;
  elements.deleteProjectButton.disabled = !selectedProjectId;
  elements.prefabNameInput.disabled = !selectedProjectId;
  elements.createPrefabButton.disabled = !selectedProjectId;
  elements.loadPrefabButton.disabled = !selectedProjectId || !selectedPrefabId;
  elements.savePrefabButton.disabled = !selectedProjectId || !selectedPrefabId;
  elements.deletePrefabButton.disabled = !selectedProjectId || !selectedPrefabId;
  elements.createPrefabGroupButton.disabled = !selectedProjectId;
  const selectedRealPrefabNode =
    selectedPrefabNodeId !== null && selectedPrefabNodeId !== PREFAB_ROOT_NODE_ID;
  elements.deletePrefabNodeButton.disabled = !selectedRealPrefabNode;
  elements.prefabCopyButton.textContent = pendingPrefabClipboard ? "Paste" : "Copy";
  elements.prefabCutButton.textContent = pendingPrefabClipboard ? "Cancel" : "Cut";
  elements.prefabCopyButton.disabled = pendingPrefabClipboard
    ? !selectedPrefabNodeId
    : !selectedRealPrefabNode;
  elements.prefabCutButton.disabled = pendingPrefabClipboard
    ? false
    : !selectedRealPrefabNode;
  const activeTimelineClip = getActiveTimelineClip();
  elements.prefabTimelinePanel.hidden = editorMode !== "asset";
  elements.timelineClipNameInput.disabled = !selectedProjectId;
  elements.timelineCreateClipButton.disabled = !selectedProjectId;
  elements.timelineDeleteClipButton.disabled = !activeTimelineClip;
  elements.timelinePlayButton.disabled =
    !activeTimelineClip || activeTimelineClip.durationMs <= 0;
  elements.timelinePauseButton.disabled = !isTimelinePlaying;
  elements.timelineStopButton.disabled =
    !activeTimelineClip && timelineCurrentTimeMs === 0;
  elements.timelineTimeInput.disabled = !activeTimelineClip;
  elements.timelineDurationInput.disabled = !activeTimelineClip;
  elements.timelineSnapFpsInput.disabled = !selectedProjectId;
  elements.timelineLoopInput.disabled = !activeTimelineClip;
  elements.timelineScrubInput.disabled = !activeTimelineClip;
  const activeTimelineProperty = getActiveTimelineProperty();
  elements.timelineAddKeyframeButton.disabled =
    !activeTimelineClip ||
    !selectedRealPrefabNode ||
    (activeTimelineProperty === "path" && !validInPlacePathEditSession);
  elements.timelineSnapBaseButton.disabled =
    !activeTimelineClip || !selectedRealPrefabNode;
  elements.sceneNameInput.disabled = !selectedProjectId;
  elements.createSceneButton.disabled = !selectedProjectId;
  elements.cloneSceneButton.disabled = !selectedProjectId;
  elements.loadSceneButton.disabled = !selectedProjectId || !selectedSceneId;
  elements.saveSceneButton.disabled = !selectedProjectId || !selectedSceneId;
  elements.deleteSceneButton.disabled = !selectedProjectId || !selectedSceneId;
  elements.addNodeButton.disabled = !selectedProjectId || !selectedAssetId;
  elements.addPrefabInstanceButton.disabled = !selectedProjectId || !selectedPrefabId;
  elements.deleteAssetButton.disabled = !selectedProjectId || !selectedAssetId;
  elements.deleteSceneNodeButton.disabled = !selectedSceneNodeId;
  elements.editPathButton.disabled = !selectedProjectId || !selectedAssetId;
  elements.savePathButton.disabled = !pathEditSession;
  elements.cancelPathButton.disabled = !pathEditSession;
  elements.projectionToggleButton.textContent =
    threeViewport.currentProjection === "perspective"
      ? "Perspective"
      : "Orthographic";
  elements.transformTranslateButton.dataset.selected = String(
    activeEditorTool === "translate",
  );
  elements.transformRotateButton.dataset.selected = String(
    activeEditorTool === "rotate",
  );
  elements.transformScaleButton.dataset.selected = String(
    activeEditorTool === "scale",
  );
  const canEditInPlacePath = canUsePathTool();
  elements.transformPathButton.disabled = !canEditInPlacePath;
  elements.transformPathButton.dataset.selected = String(
    activeEditorTool === "path",
  );
}

function renderProjectList(): void {
  elements.projectList.replaceChildren(
    ...projects.map((project) => {
      const item = document.createElement("li");
      const button = document.createElement("button");

      button.type = "button";
      button.className = "asset-list-item";
      button.dataset.projectId = project.id;
      button.dataset.selected = String(project.id === selectedProjectId);
      button.textContent = project.name;
      button.addEventListener("click", () => {
        if (selectedProjectId !== project.id) {
          clearProjectWorkspace();
        }

        selectedProjectId = project.id;
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
    ...assets.map((asset) => {
      const item = document.createElement("li");
      const button = document.createElement("button");

      button.type = "button";
      button.className = "asset-list-item";
      button.dataset.assetId = asset.id;
      button.dataset.selected = String(asset.id === selectedAssetId);
      button.textContent = `${asset.assetKind === "strokePath" ? "Stroke" : "Fill"}: ${asset.name}`;
      button.addEventListener("click", () => {
        selectedAssetId = asset.id;
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
    ...assets.map((asset) => {
      const item = document.createElement("li");
      const button = document.createElement("button");

      button.type = "button";
      button.className = "asset-list-item";
      button.dataset.selected = String(asset.id === selectedAssetId);
      button.textContent = `${asset.assetKind === "strokePath" ? "Stroke" : "Fill"}: ${asset.name}`;
      button.addEventListener("click", () => {
        selectedAssetId = asset.id;
        if (pathEditSession && pathEditSession.assetId !== asset.id) {
          pathEditSession = null;
          pathEditDragState = null;
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
        if (selectedPrefabNodeId !== node.id) {
          exitPathTool();
        }
        selectedPrefabNodeId = node.id;
        syncSelectionFromPrefabNode();
        if (editorMode === "asset") {
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

function renderPrefabTimeline(): void {
  const activeClip = getActiveTimelineClip();
  const activeProperty = getActiveTimelineProperty();
  const basePoseItem = document.createElement("li");
  const basePoseButton = document.createElement("button");

  basePoseButton.type = "button";
  basePoseButton.className = "timeline-clip-item";
  basePoseButton.dataset.clipId = "__base-pose__";
  basePoseButton.dataset.selected = String(prefabAnimation.activeClipId === null);
  basePoseButton.textContent = "Base Pose";
  basePoseButton.addEventListener("click", () => {
    selectBasePoseTimeline();
  });
  basePoseItem.append(basePoseButton);

  const clipButtons = prefabAnimation.clips.map((clip) => {
    const item = document.createElement("li");
    const button = document.createElement("button");

    button.type = "button";
    button.className = "timeline-clip-item";
    button.dataset.clipId = clip.id;
    button.dataset.selected = String(clip.id === prefabAnimation.activeClipId);
    button.textContent = `${clip.name} (${clip.durationMs} ms)`;
    button.addEventListener("click", () => {
      selectTimelineClip(clip.id);
    });

    item.append(button);
    return item;
  });

  elements.timelineClipList.replaceChildren(basePoseItem, ...clipButtons);
  elements.timelineTimeInput.value = String(timelineCurrentTimeMs);
  elements.timelineDurationInput.value = activeClip
    ? String(activeClip.durationMs)
    : String(DEFAULT_TIMELINE_DURATION_MS);
  elements.timelineSnapFpsInput.value = formatTimelineNumber(prefabAnimation.snapFps);
  elements.timelineLoopInput.checked = activeClip?.loop ?? false;
  elements.timelineScrubInput.max = String(Math.max(activeClip?.durationMs ?? 1, 1));
  elements.timelineScrubInput.value = String(clampTimelineTimeMs(timelineCurrentTimeMs, activeClip));

  if (!activeClip) {
    elements.timelineTrackLanes.replaceChildren();
    elements.timelineKeyframeEditor.hidden = true;
    elements.timelineStatus.textContent =
      "Base Pose: editing prefab defaults outside animation";
    return;
  }

  const selectedNode =
    selectedPrefabNodeId && selectedPrefabNodeId !== PREFAB_ROOT_NODE_ID
      ? getPrefabNode(selectedPrefabNodeId)
      : null;
  const trackCount = activeClip.tracks.length;
  const keyframeCount = activeClip.tracks.reduce(
    (total, track) => total + track.keyframes.length,
    0,
  );

  renderTimelineTrackLanes(activeClip, selectedNode, activeProperty);
  renderTimelineKeyframeEditor(activeClip);

  elements.timelineStatus.textContent = selectedNode
    ? `${activeClip.name}: ${trackCount} tracks, ${keyframeCount} keyframes`
    : `${activeClip.name}: select a real prefab node to add keyframes`;
}

function renderTimelineTrackLanes(
  activeClip: PrefabAnimationClip,
  selectedNode: PrefabNode | null,
  activeProperty: PrefabTrackProperty,
): void {
  const lanes = TIMELINE_LANE_PROPERTIES.map((property) => {
    const lane = document.createElement("div");
    const labelButton = document.createElement("button");
    const trackBar = document.createElement("div");
    const isActive = property === activeProperty;

    lane.className = "timeline-track-lane";
    labelButton.type = "button";
    labelButton.className = "timeline-track-label";
    labelButton.dataset.timelineProperty = property;
    labelButton.dataset.active = String(isActive);
    labelButton.textContent = getTimelinePropertyLabel(property);
    labelButton.addEventListener("click", () => {
      setActiveTimelineProperty(property);
    });

    trackBar.className = "timeline-track-bar";
    trackBar.dataset.timelineProperty = property;
    trackBar.dataset.active = String(isActive);
    appendTimelineSnapTicks(trackBar, activeClip);
    trackBar.addEventListener("click", (event) => {
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
    });

    const track =
      selectedNode && activeClip
        ? findTimelineTrack(activeClip, selectedNode.id, property)
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
      marker.dataset.selected = String(keyframe.id === selectedTimelineKeyframeId);
      marker.style.left = `${Math.min(Math.max(left, 0), 100)}%`;
      marker.ariaLabel = `${getTimelinePropertyLabel(property)} keyframe ${keyframe.timeMs} ms`;
      marker.addEventListener("click", (event) => {
        event.stopPropagation();
        if (property !== getActiveTimelineProperty()) {
          setActiveTimelineProperty(property);
          return;
        }

        selectedTimelineKeyframeId = keyframe.id;
        timelineCurrentTimeMs = keyframe.timeMs;
        isTimelinePlaying = false;
        renderEditorShell();
        exposeEditorDebugHooks();
      });
      marker.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
        if (property !== getActiveTimelineProperty()) {
          setActiveTimelineProperty(property);
          return;
        }

        selectedTimelineKeyframeId = keyframe.id;
        timelinePointerDrag = {
          keyframeId: keyframe.id,
          property,
        };
        marker.setPointerCapture(event.pointerId);
      });
      trackBar.append(marker);
    }

    lane.append(labelButton, trackBar);
    return lane;
  });

  elements.timelineTrackLanes.replaceChildren(...lanes);
}

function appendTimelineSnapTicks(
  trackBar: HTMLElement,
  activeClip: PrefabAnimationClip,
): void {
  const fragment = document.createDocumentFragment();

  for (const timeMs of getTimelineSnapTickTimes(activeClip)) {
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

function renderTimelineKeyframeEditor(activeClip: PrefabAnimationClip): void {
  const selected = getSelectedTimelineKeyframe(activeClip);

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

  if (!selectedProjectId) {
    status.textContent = "Create or select a project";
    elements.pathEditFields.append(status);
    return;
  }

  if (!selectedAsset) {
    status.textContent = "Select a primitive asset";
    elements.pathEditFields.append(status);
    return;
  }

  if (!pathEditSession || pathEditSession.assetId !== selectedAsset.id) {
    status.textContent = "Click Edit Path to edit the selected asset source.";
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
      createPathEditPointInputRow(
        selectedSegment,
        pathEditSession.selected.component,
      ),
    );
  }
}

function renderInspector(): void {
  elements.inspectorFields.replaceChildren();

  const selectedProject = getSelectedProject();
  const camera = threeViewport.getCameraSnapshot();

  if (!selectedProject) {
    appendInspectorRow("Status", "Create or select a project");
    return;
  }

  appendInspectorRow("Mode", getEditorModeLabel(editorMode));
  appendInspectorRow("Project", selectedProject.name);
  appendInspectorRow("Project ID", selectedProject.id);
  appendInspectorRow("Projection", camera.projection);
  appendInspectorRow("Camera Pos", camera.position.join(", "));
  appendInspectorRow("Camera Target", camera.target.join(", "));

  if (editorMode === "asset" || editorMode === "path") {
    renderAssetModeInspector();
  } else {
    renderSceneModeInspector();
  }
}

function renderAssetModeInspector(): void {
  const selectedPrefab = getSelectedPrefab();
  const selectedNode =
    selectedPrefabNodeId && selectedPrefabNodeId !== PREFAB_ROOT_NODE_ID
      ? getPrefabNode(selectedPrefabNodeId)
      : null;
  const inspectedAsset =
    selectedNode?.kind === "primitive" && selectedNode.assetId
      ? getAssetById(selectedNode.assetId)
      : getSelectedAsset();

  appendInspectorRow("Selected Prefab", selectedPrefab?.name ?? "None");
  appendInspectorRow("Loaded Prefab", loadedPrefabId ?? "None");
  appendAssetInspectorRows(inspectedAsset);

  if (selectedPrefabNodeId === PREFAB_ROOT_NODE_ID) {
    appendInspectorRow("Prefab Node", "Root Group");
    appendInspectorRow("Kind", "virtual group");
    appendInspectorRow("Parent", "None");
    return;
  }

  if (!selectedNode) {
    appendInspectorRow("Prefab Node", "No node selected");
    return;
  }

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

  const editableTransform = getAssetModeEditableTransform(selectedNode);

  appendTransformInspectorRow("Position", editableTransform, "position");
  appendTransformInspectorRow("Rotation", editableTransform, "rotation");
  appendTransformInspectorRow("Scale", editableTransform, "scale");
  appendInspectorRow("Billboard", selectedNode.billboardMode);
  renderInPlacePathEditInspector(selectedNode);
}

function renderSceneModeInspector(): void {
  const selectedScene = getSelectedScene();
  const selectedNode = selectedSceneNodeId ? getSceneNode(selectedSceneNodeId) : null;

  appendInspectorRow("Selected Scene", selectedScene?.name ?? "None");
  appendInspectorRow("Loaded Scene", loadedSceneId ?? "None");

  if (!selectedNode) {
    appendInspectorRow("Scene Node", "No node selected");
    return;
  }

  appendInspectorRow("Scene Node", selectedNode.id);
  appendInspectorRow("Kind", selectedNode.kind);

  if (selectedNode.kind === "primitive") {
    const asset = getAssetById(selectedNode.assetId);

    appendAssetInspectorRows(asset);
    appendInspectorRow("Node Asset", selectedNode.assetId);
    if (!asset) {
      appendInspectorRow("Missing Asset", selectedNode.assetId);
    }
    appendInspectorRow("Billboard", selectedNode.billboardMode);
  } else {
    const prefab = getPrefabRecordById(selectedNode.prefabId);

    appendInspectorRow("Prefab", prefab?.name ?? "Missing Prefab");
    appendInspectorRow("Prefab ID", selectedNode.prefabId);
    if (!getPrefabDocumentById(selectedNode.prefabId)) {
      appendInspectorRow("Missing Prefab", selectedNode.prefabId);
    }
  }

  appendTransformInspectorRow("Position", selectedNode, "position");
  appendTransformInspectorRow("Rotation", selectedNode, "rotation");
  appendTransformInspectorRow("Scale", selectedNode, "scale");
}

function appendAssetInspectorRows(asset: PrimitiveSvgAsset | null): void {
  if (!asset) {
    appendInspectorRow("Asset", "No primitive selected");
    return;
  }

  appendInspectorRow("Asset ID", asset.id);
  appendInspectorRow("Type", asset.assetKind);
  appendInspectorRow("Name", asset.name);
  appendInspectorRow("Source", asset.sourceUrl);
  appendInspectorRow("ViewBox", asset.viewBox.join(", "));
  appendInspectorRow("Bezier Segments", String(asset.bezierPath.segments.length));
  appendInspectorRow("Closed Path", asset.bezierPath.closed ? "true" : "false");

  if (asset.assetKind === "strokePath") {
    appendInspectorRow("Stroke", asset.stroke);
    appendInspectorRow("Stroke Width", String(asset.strokeWidth));
    appendInspectorRow("Line Cap", "round");
    appendInspectorRow("Line Join", "round");
  } else {
    appendInspectorRow("Fill", asset.fill);
    appendInspectorRow("Fill Rule", asset.fillRule);
  }

  appendInspectorRow("Path Length", `${asset.pathD.length} chars`);
  appendInspectorRow("Source Path Edit", "Use the Source Path Edit mode");
}

function getAssetModeEditableTransform(node: PrefabNode): EditorTransformNode {
  const stagingTransform = getActiveTimelineClip()
    ? getSelectedTimelineStagingTransform()
    : null;

  return {
    id: node.id,
    position: stagingTransform?.position ?? [...node.position],
    rotation: stagingTransform?.rotation ?? [...node.rotation],
    scale: stagingTransform?.scale ?? [...node.scale],
  };
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
  const term = document.createElement("dt");
  const description = document.createElement("dd");

  term.textContent = label;
  description.append(
    createPathEditPointInputRow(segment, component, {
      session,
      ariaPrefix: "In-place path",
      onApplied: () => {
        syncInPlacePathSessionToStagingPose();
        renderInspector();
        exposeEditorDebugHooks();
      },
    }),
  );
  elements.inspectorFields.append(term, description);
}

function appendInspectorActionRow(label: string, onClick: () => void): void {
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  const button = document.createElement("button");

  term.textContent = "Action";
  button.type = "button";
  button.className = "editor-button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  description.append(button);
  elements.inspectorFields.append(term, description);
}

function appendInspectorRow(label: string, value: string): void {
  const term = document.createElement("dt");
  const description = document.createElement("dd");

  term.textContent = label;
  description.textContent = value;
  elements.inspectorFields.append(term, description);
}

function createPathEditPointInputRow(
  segment: BezierSegment,
  component: PathEditComponent,
  options?: {
    session?: PathEditSession;
    ariaPrefix?: string;
    onApplied?: () => void;
  },
): HTMLDivElement {
  const row = document.createElement("div");
  const point = getPathEditComponentPoint(segment, component);
  const session = options?.session ?? pathEditSession;
  const ariaPrefix = options?.ariaPrefix ?? "Path";

  row.className = "path-edit-point-row";

  point.forEach((value, axisIndex) => {
    const input = document.createElement("input");
    const axisName = axisIndex === 0 ? "X" : "Y";

    input.className = "transform-number-input";
    input.type = "text";
    input.inputMode = "decimal";
    input.ariaLabel = `${ariaPrefix} ${component} ${axisName}`;
    input.value = formatTransformValue(value);
    input.addEventListener("focus", () => {
      input.dataset.previousValue = input.value;
    });
    input.addEventListener("blur", () => {
      applyPathEditPointInput(
        input,
        session,
        segment.id,
        component,
        axisIndex,
        options?.onApplied,
      );
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
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  const editor = document.createElement("div");

  term.textContent = label;
  editor.className = "transform-input-row";

  node[property].forEach((value, axisIndex) => {
    const input = document.createElement("input");
    const axisName = ["X", "Y", "Z"][axisIndex] ?? "?";

    input.className = "transform-number-input";
    input.type = "text";
    input.inputMode = "decimal";
    input.dataset.transformProperty = property;
    input.dataset.transformAxis = axisName.toLowerCase();
    input.ariaLabel = `${label} ${axisName}`;
    input.value = formatTransformValue(value);
    input.addEventListener("focus", () => {
      input.dataset.previousValue = input.value;
    });
    input.addEventListener("blur", () => {
      applyTransformInput(input, node.id, property, axisIndex);
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

    editor.append(input);
  });

  description.append(editor);
  elements.inspectorFields.append(term, description);
}

function applyTransformInput(
  input: HTMLInputElement,
  nodeId: string,
  property: TransformProperty,
  axisIndex: number,
): void {
  const node = editorMode === "asset" ? getPrefabNode(nodeId) : getSceneNode(nodeId);
  const parsedValue = Number(input.value.trim());
  const editableNode =
    editorMode === "asset" && node
      ? getAssetModeEditableTransform(node as PrefabNode)
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
  stage.clearAll();
  if (editorMode === "path") {
    renderPathEditFrame();
    return;
  }

  threeViewport.render(stage.size);

  const context = stage.getLayer("vector-canvas").context;

  if (!selectedProjectId) {
    drawCenteredStatus(context, stage.size, "Create or select a project");
    return;
  }

  if (editorMode === "asset") {
    const drawables = getAssetAssemblyBillboards();

    if (drawables.length > 0) {
      drawBillboards(context, drawables);
      renderInPlacePathEditOverlay();
      return;
    }

    const selectedAsset = getSelectedAsset();
    if (selectedAsset) {
      drawPrimitivePreview(context, stage.size, selectedAsset);
      return;
    }

    drawCenteredStatus(context, stage.size, "Import SVG primitives and assemble a prefab");
    return;
  }

  const drawables = getSceneLayoutBillboards();

  if (drawables.length === 0) {
    drawCenteredStatus(context, stage.size, "Add a prefab instance to the scene");
    return;
  }

  drawBillboards(context, drawables);
}

function renderPathEditFrame(): void {
  const vectorContext = stage.getLayer("vector-canvas").context;
  const paperContext = stage.getLayer("paper-canvas").context;
  const asset = pathEditSession ? getAssetById(pathEditSession.assetId) : null;

  if (!selectedProjectId) {
    drawCenteredStatus(vectorContext, stage.size, "Create or select a project");
    return;
  }

  if (!pathEditSession) {
    const selectedAsset = getSelectedAsset();

    if (selectedAsset) {
      drawPrimitivePreview(vectorContext, stage.size, selectedAsset);
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

  drawPathEditPreview(vectorContext, previewAsset);
  drawPathEditControls(
    paperContext,
    previewAsset,
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
      asset,
      session,
      adapter,
      inPlacePathEditHoveredControl,
    );
  }
}

function buildPathEditPathD(path: StructuredBezierPath): string {
  return path.segments.length > 0 ? structuredBezierToPathD(path) : "";
}

function getAssetAssemblyBillboards(): DrawableBillboard[] {
  const pathOverrides = getEvaluatedPrefabPathOverrides();
  const evaluatedDrawables = flattenPrefabBillboards(
    getEvaluatedPrefabNodes(),
    new Matrix4(),
    (nodeId) => nodeId === selectedPrefabNodeId,
    "",
    pathOverrides,
  );
  const ghostDrawables = getSelectedPrefabTimelineGhostBillboards();

  return [
    ...evaluatedDrawables,
    ...ghostDrawables,
  ];
}

function getSelectedPrefabTimelineGhostBillboards(): DrawableBillboard[] {
  const activeClip = getActiveTimelineClip();
  const selectedNode = getSelectedPrefabNode();

  if (!activeClip || !selectedNode) {
    return [];
  }

  const selectedAsset =
    selectedNode.kind === "primitive" && selectedNode.assetId
      ? getAssetById(selectedNode.assetId)
      : null;
  const stagingPose = getOrCreateTimelineStagingPose(
    selectedNode,
    activeClip,
    selectedAsset,
  );
  const stagedNodes = getPrefabNodesWithTimelineStagingPose(stagingPose);
  const stagedWorldTransforms = getPrefabWorldTransforms(stagedNodes);
  const selectedNodeIds =
    selectedNode.kind === "group"
      ? getPrefabNodeAndDescendantIds(selectedNode.id)
      : new Set([selectedNode.id]);
  const drawables: DrawableBillboard[] = [];

  for (const node of stagedNodes) {
    if (node.kind !== "primitive" || !selectedNodeIds.has(node.id) || !node.assetId) {
      continue;
    }

    const asset = getAssetById(node.assetId);
    const worldTransform = stagedWorldTransforms.get(node.id);

    if (!asset || !worldTransform) {
      continue;
    }

    drawables.push({
      id: `${node.id}:timeline-staging-ghost`,
      asset,
      transform: matrixToTransform(worldTransform),
      selected: false,
      opacity: 0.5,
      ghost: true,
      pathOverride: node.id === stagingPose.nodeId ? stagingPose.pathDraft : undefined,
    });
  }

  return drawables;
}

function getSceneLayoutBillboards(): DrawableBillboard[] {
  const drawables: DrawableBillboard[] = [];

  for (const node of sceneNodes) {
    if (node.kind === "primitive") {
      const asset = getAssetById(node.assetId);

      if (asset) {
        drawables.push({
          id: node.id,
          asset,
          transform: cloneTransform(node),
          selected: node.id === selectedSceneNodeId,
        });
      }

      continue;
    }

    const document = getPrefabDocumentById(node.prefabId);

    if (!document) {
      continue;
    }

    drawables.push(
      ...flattenPrefabBillboards(
        document.nodes,
        transformToMatrix(node),
        () => node.id === selectedSceneNodeId,
        `${node.id}/`,
      ),
    );
  }

  return drawables;
}

function flattenPrefabBillboards(
  nodes: PrefabNode[],
  baseMatrix: Matrix4,
  isSelected: (nodeId: string) => boolean,
  idPrefix = "",
  pathOverrides: Map<string, StructuredBezierPath> = new Map(),
): DrawableBillboard[] {
  const worldTransforms = getPrefabWorldTransforms(nodes, baseMatrix);
  const drawables: DrawableBillboard[] = [];

  for (const node of nodes) {
    if (node.kind !== "primitive") {
      continue;
    }

    const asset = node.assetId ? getAssetById(node.assetId) : null;
    const matrix = worldTransforms.get(node.id);

    if (!asset || !matrix) {
      continue;
    }

    drawables.push({
      id: `${idPrefix}${node.id}`,
      asset,
      transform: matrixToTransform(matrix),
      selected: isSelected(node.id),
      pathOverride: pathOverrides.get(node.id),
    });
  }

  return drawables;
}

function drawBillboards(
  context: CanvasRenderingContext2D,
  drawables: DrawableBillboard[],
): void {
  const sortedDrawables = drawables
    .map((drawable) => {
      const worldPosition = tupleToVector(drawable.transform.position);
      const projected = threeViewport.projectWorldPosition(worldPosition, stage.size);

      if (!projected) {
        return null;
      }

      return {
        ...drawable,
        projected,
        screenScale: threeViewport.getDistanceScale(worldPosition, 1),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => {
      const ghostOrder = Number(Boolean(a.ghost)) - Number(Boolean(b.ghost));

      return ghostOrder === 0 ? b.projected.depth - a.projected.depth : ghostOrder;
    });

  for (const drawable of sortedDrawables) {
    drawBillboardNode(context, drawable);
  }
}

function drawBillboardNode(
  context: CanvasRenderingContext2D,
  drawable: DrawableBillboard & {
    projected: { x: number; y: number };
    screenScale: number;
  },
): void {
  const {
    asset,
    transform,
    projected,
    screenScale,
    selected,
    opacity = 1,
    ghost = false,
  } = drawable;
  const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] = asset.viewBox;
  const largestDimension = Math.max(viewBoxWidth, viewBoxHeight);
  const assetScale = screenScale / largestDimension;
  const drawAsset = drawable.pathOverride
    ? createPrimitiveAssetPathPreview(asset, drawable.pathOverride)
    : asset;
  const ghostColor = ghost ? getPrimitiveGhostColor(asset) : null;

  context.save();
  context.globalAlpha *= opacity;
  context.translate(projected.x, projected.y);
  context.rotate(transform.rotation[2]);
  context.scale(assetScale * transform.scale[0], assetScale * transform.scale[1]);
  context.translate(
    -(viewBoxX + viewBoxWidth / 2),
    -(viewBoxY + viewBoxHeight / 2),
  );
  drawPrimitiveAssetPath(context, drawAsset, ghostColor ?? undefined);

  if (selected || ghost) {
    context.lineWidth = 3 / Math.max(assetScale, 0.001);
    context.strokeStyle = ghostColor ?? "#ffcf4a";
    context.setLineDash(ghost ? [8 / Math.max(assetScale, 0.001)] : []);
    context.strokeRect(viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight);
  }

  context.restore();
}

function createPrimitiveAssetPathPreview(
  asset: PrimitiveSvgAsset,
  bezierPath: StructuredBezierPath,
): PrimitiveSvgAsset {
  const pathD = buildPathEditPathD(bezierPath);

  return {
    ...asset,
    bezierPath,
    pathD,
    path: new Path2D(pathD),
  };
}

function drawPrimitiveAssetPath(
  context: CanvasRenderingContext2D,
  asset: PrimitiveSvgAsset,
  colorOverride?: string,
): void {
  if (asset.assetKind === "strokePath") {
    context.strokeStyle = colorOverride ?? asset.stroke;
    context.lineWidth = asset.strokeWidth;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.setLineDash([]);
    context.stroke(asset.path);
    return;
  }

  context.fillStyle = colorOverride ?? asset.fill;
  context.fill(asset.path, asset.fillRule);
}

const primitiveGhostColorCache = new Map<string, string>();
const GHOST_COLOR_CANDIDATES: RgbColor[] = [
  { r: 255, g: 207, b: 74 },
  { r: 91, g: 196, b: 191 },
  { r: 244, g: 114, b: 182 },
  { r: 163, g: 230, b: 53 },
  { r: 56, g: 189, b: 248 },
  { r: 249, g: 115, b: 22 },
  { r: 248, g: 250, b: 252 },
];

function getPrimitiveGhostColor(asset: PrimitiveSvgAsset): string {
  const sourceColor = asset.assetKind === "strokePath" ? asset.stroke : asset.fill;
  const cachedColor = primitiveGhostColorCache.get(sourceColor);

  if (cachedColor) {
    return cachedColor;
  }

  const sourceRgb = parseCssColorToRgb(sourceColor);
  const selectedColor = sourceRgb
    ? GHOST_COLOR_CANDIDATES.reduce((best, candidate) =>
        getRgbContrastScore(candidate, sourceRgb) >
        getRgbContrastScore(best, sourceRgb)
          ? candidate
          : best,
      )
    : GHOST_COLOR_CANDIDATES[0];
  const color = rgbToHex(selectedColor);
  primitiveGhostColorCache.set(sourceColor, color);
  return color;
}

function parseCssColorToRgb(color: string): RgbColor | null {
  const canonicalColor = getCanonicalCanvasColor(color);
  const hexMatch = /^#([0-9a-f]{6})$/i.exec(canonicalColor);

  if (hexMatch?.[1]) {
    return {
      r: Number.parseInt(hexMatch[1].slice(0, 2), 16),
      g: Number.parseInt(hexMatch[1].slice(2, 4), 16),
      b: Number.parseInt(hexMatch[1].slice(4, 6), 16),
    };
  }

  const rgbMatch =
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i.exec(
      canonicalColor,
    );

  if (!rgbMatch?.[1] || !rgbMatch[2] || !rgbMatch[3]) {
    return null;
  }

  return {
    r: clampColorChannel(Number(rgbMatch[1])),
    g: clampColorChannel(Number(rgbMatch[2])),
    b: clampColorChannel(Number(rgbMatch[3])),
  };
}

function getCanonicalCanvasColor(color: string): string {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return color;
  }

  context.fillStyle = "#000000";
  context.fillStyle = color;
  return context.fillStyle;
}

function getRgbContrastScore(left: RgbColor, right: RgbColor): number {
  const channelDistance =
    Math.abs(left.r - right.r) +
    Math.abs(left.g - right.g) +
    Math.abs(left.b - right.b);
  const luminanceDistance = Math.abs(getRelativeLuminance(left) - getRelativeLuminance(right));

  return channelDistance + luminanceDistance * 255;
}

function getRelativeLuminance(color: RgbColor): number {
  return (
    0.2126 * normalizeColorChannel(color.r) +
    0.7152 * normalizeColorChannel(color.g) +
    0.0722 * normalizeColorChannel(color.b)
  );
}

function normalizeColorChannel(channel: number): number {
  const value = channel / 255;

  return value <= 0.03928
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function clampColorChannel(channel: number): number {
  return Math.max(0, Math.min(255, Math.round(channel)));
}

function rgbToHex(color: RgbColor): string {
  return `#${[color.r, color.g, color.b]
    .map((channel) => clampColorChannel(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function drawPathEditControls(
  context: CanvasRenderingContext2D,
  asset: PrimitiveSvgAsset,
  session: PathEditSession,
  adapter = getSourcePathEditAdapter(asset),
  hoveredControl: PathEditDragState | null = null,
): void {
  const controls = getPathEditControls(session.draft);

  context.save();
  context.font = "600 12px system-ui, sans-serif";

  for (const segment of session.draft.segments) {
    const anchor = adapter?.pathToScreen(segment.anchor);
    const handleIn = adapter?.pathToScreen(addBezierPoints(segment.anchor, segment.handleIn));
    const handleOut = adapter?.pathToScreen(
      addBezierPoints(segment.anchor, segment.handleOut),
    );

    if (!anchor || !handleIn || !handleOut) {
      continue;
    }

    drawPathEditHandleLine(context, anchor, handleIn);
    drawPathEditHandleLine(context, anchor, handleOut);
  }

  for (const control of controls) {
    const screenPoint = adapter?.pathToScreen(control.point);

    if (!screenPoint) {
      continue;
    }

    const selected =
      session.selected?.segmentId === control.segmentId &&
      session.selected.component === control.component;
    const hovered =
      hoveredControl?.segmentId === control.segmentId &&
      hoveredControl.component === control.component;

    drawPathEditControlPoint(
      context,
      screenPoint,
      control.component,
      selected,
      hovered,
    );
  }

  context.restore();
}

function drawPathEditPreview(
  context: CanvasRenderingContext2D,
  asset: PrimitiveSvgAsset,
): void {
  const transform = getSourcePathEditViewTransform(asset);

  context.save();
  context.translate(transform.offsetX, transform.offsetY);
  context.scale(transform.scale, transform.scale);
  drawPrimitiveAssetPath(context, asset);
  context.restore();
}

function drawPathEditHandleLine(
  context: CanvasRenderingContext2D,
  anchor: BezierPoint,
  handle: BezierPoint,
): void {
  context.save();
  context.strokeStyle = "rgba(238, 244, 255, 0.44)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(anchor[0], anchor[1]);
  context.lineTo(handle[0], handle[1]);
  context.stroke();
  context.restore();
}

function drawPathEditControlPoint(
  context: CanvasRenderingContext2D,
  point: BezierPoint,
  component: PathEditComponent,
  selected: boolean,
  hovered: boolean,
): void {
  context.save();
  context.fillStyle = selected ? "#ffcf4a" : "#5bc4bf";
  context.strokeStyle = hovered ? "#ffffff" : "rgba(17, 24, 39, 0.86)";
  context.lineWidth = hovered ? 3 : 2;

  if (component === "anchor") {
    context.beginPath();
    context.arc(point[0], point[1], selected || hovered ? 6 : 5, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else {
    const size = selected || hovered ? 10 : 8;
    context.fillRect(point[0] - size / 2, point[1] - size / 2, size, size);
    context.strokeRect(point[0] - size / 2, point[1] - size / 2, size, size);
  }

  context.restore();
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

  const control = findNearestPathEditControl(
    getCanvasPointerPoint(event),
    pathEditSession,
    adapter,
    PATH_EDIT_HIT_RADIUS,
  );

  if (!control) {
    updatePathEditHoveredControl(null);
    return;
  }

  pathEditHoveredControl = {
    segmentId: control.segmentId,
    component: control.component,
  };
  pathEditSession.selected = {
    segmentId: control.segmentId,
    component: control.component,
  };
  pathEditDragState = selectPathEditCoreControl(pathEditSession, control);
  event.preventDefault();
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
      ? findNearestPathEditControl(
          getCanvasPointerPoint(event),
          pathEditSession,
          adapter,
          PATH_EDIT_HIT_RADIUS,
        )
      : null;

  updatePathEditHoveredControl(hoveredControl);
}

function updatePathEditHoveredControl(control: PathEditControl | null): void {
  const nextHover = control
    ? {
        segmentId: control.segmentId,
        component: control.component,
      }
    : null;

  if (pathEditSelectionsEqual(pathEditHoveredControl, nextHover)) {
    return;
  }

  pathEditHoveredControl = nextHover;
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

  dragPathEditCoreControl(pathEditSession, pathEditDragState, pathPoint, {
    altKey: event.altKey,
    shiftKey: event.shiftKey,
  });
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

function getSourcePathEditViewTransform(asset: PrimitiveSvgAsset): {
  scale: number;
  offsetX: number;
  offsetY: number;
} {
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
  if (!pathEditSession) {
    return [];
  }

  const asset = getAssetById(pathEditSession.assetId);

  if (!asset) {
    return [];
  }

  return getCorePathEditScreenControls(
    pathEditSession,
    getSourcePathEditAdapter(asset),
  );
}

function selectInPlacePathEditControl(event: PointerEvent | MouseEvent): boolean {
  const session = getValidInPlacePathEditSession();
  const adapter = getInPlacePathEditAdapter();

  if (!session || !adapter) {
    return false;
  }

  const control = findNearestPathEditControl(
    getCanvasPointerPoint(event),
    session,
    adapter,
    PATH_EDIT_HIT_RADIUS,
  );

  if (!control) {
    updateInPlacePathEditHoveredControl(null);
    return false;
  }

  inPlacePathEditHoveredControl = {
    segmentId: control.segmentId,
    component: control.component,
  };
  inPlacePathEditDragState = selectPathEditCoreControl(session, control);
  event.preventDefault();
  event.stopPropagation();
  if ("stopImmediatePropagation" in event) {
    event.stopImmediatePropagation();
  }
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
  const nextHover = control
    ? {
        segmentId: control.segmentId,
        component: control.component,
      }
    : null;

  if (pathEditSelectionsEqual(inPlacePathEditHoveredControl, nextHover)) {
    return;
  }

  inPlacePathEditHoveredControl = nextHover;
  exposeEditorDebugHooks();
}

function clearInPlacePathEditHover(): void {
  updateInPlacePathEditHoveredControl(null);
}

function pathEditSelectionsEqual(
  left: PathEditDragState | null,
  right: PathEditDragState | null,
): boolean {
  return (
    left?.segmentId === right?.segmentId &&
    left?.component === right?.component
  );
}

function findInPlacePathEditControl(
  event: PointerEvent | MouseEvent,
): PathEditControl | null {
  const session = getValidInPlacePathEditSession();
  const adapter = getInPlacePathEditAdapter();

  if (!session || !adapter) {
    return null;
  }

  return findNearestPathEditControl(
    getCanvasPointerPoint(event),
    session,
    adapter,
    PATH_EDIT_HIT_RADIUS,
  );
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

  dragPathEditCoreControl(session, inPlacePathEditDragState, pathPoint, {
    altKey: event.altKey,
    shiftKey: event.shiftKey,
  });
  syncInPlacePathSessionToStagingPose();
  event.preventDefault();
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
  return getCorePathEditScreenControls(
    getValidInPlacePathEditSession(),
    getInPlacePathEditAdapter(),
  );
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
    !activeClip ||
    !node ||
    node.kind !== "primitive" ||
    node.id !== selectedPrefabNodeId ||
    !asset ||
    node.assetId !== asset.id ||
    !stagingPose
  ) {
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
  return projects.find((project) => project.id === selectedProjectId) ?? null;
}

function getSelectedAsset(): PrimitiveSvgAsset | null {
  return selectedAssetId ? getAssetById(selectedAssetId) : null;
}

function getSelectedPrefab(): PrefabRecord | null {
  return selectedPrefabId ? getPrefabRecordById(selectedPrefabId) : null;
}

function getSelectedScene(): SceneRecord | null {
  return scenes.find((scene) => scene.id === selectedSceneId) ?? null;
}

function getAssetById(assetId: string): PrimitiveSvgAsset | null {
  return assets.find((asset) => asset.id === assetId) ?? null;
}

function getPrefabRecordById(prefabId: string): PrefabRecord | null {
  return prefabs.find((prefab) => prefab.id === prefabId) ?? null;
}

function getPrefabDocumentById(prefabId: string): PrefabDocument | null {
  if (prefabId === loadedPrefabId) {
    return createCurrentPrefabDocument();
  }

  return prefabDocuments.get(prefabId) ?? null;
}

function getPrefabNode(nodeId: string): PrefabNode | null {
  return prefabNodes.find((node) => node.id === nodeId) ?? null;
}

function getSceneNode(nodeId: string): SceneNode | null {
  return sceneNodes.find((node) => node.id === nodeId) ?? null;
}

function getParentIdForNewPrefabNode(): string | null {
  if (selectedPrefabNodeId === PREFAB_ROOT_NODE_ID) {
    return null;
  }

  const selectedNode = selectedPrefabNodeId ? getPrefabNode(selectedPrefabNodeId) : null;

  return selectedNode?.kind === "group" ? selectedNode.id : null;
}

function getPasteParentId(): string | null | undefined {
  if (selectedPrefabNodeId === PREFAB_ROOT_NODE_ID) {
    return null;
  }

  const targetNode = selectedPrefabNodeId ? getPrefabNode(selectedPrefabNodeId) : null;

  if (!targetNode) {
    return undefined;
  }

  return targetNode.kind === "group" ? targetNode.id : targetNode.parentId;
}

function getPrefabNodeAndDescendantIds(rootNodeId: string): Set<string> {
  const ids = new Set<string>([rootNodeId]);
  let changed = true;

  while (changed) {
    changed = false;

    for (const node of prefabNodes) {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        changed = true;
      }
    }
  }

  return ids;
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
  if (!selectedTimelineKeyframeId) {
    return null;
  }

  for (const track of clip.tracks) {
    const keyframe = track.keyframes.find(
      (candidate) => candidate.id === selectedTimelineKeyframeId,
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

function getTimelineSnapTickTimes(clip: PrefabAnimationClip): number[] {
  if (clip.durationMs <= 0) {
    return [0];
  }

  const snapFrameMs = getTimelineSnapFrameMs();
  const times = new Set<number>([0, clip.durationMs]);

  for (
    let frameIndex = 1;
    ;
    frameIndex += 1
  ) {
    const timeMs = Math.round(frameIndex * snapFrameMs);

    if (timeMs >= clip.durationMs) {
      break;
    }

    times.add(timeMs);
  }

  return [...times].sort((a, b) => a - b);
}

function getTimelinePropertyLabel(property: PrefabTrackProperty): string {
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

function isPrefabVectorTrackProperty(
  property: PrefabTrackProperty,
): property is PrefabVectorTrackProperty {
  return property === "position" || property === "rotation" || property === "scale";
}

function copyPrefabSubtree(sourceNode: PrefabNode, targetParentId: string | null): void {
  const subtreeIds = getPrefabNodeAndDescendantIds(sourceNode.id);
  const subtreeNodes = prefabNodes.filter((node) => subtreeIds.has(node.id));
  const idMap = new Map<string, string>();

  for (const node of subtreeNodes) {
    idMap.set(node.id, createNextPrefabNodeId());
  }

  const copiedNodes = subtreeNodes.map((node) => {
    const copiedNode = clonePrefabNode(node);
    const nextId = idMap.get(node.id);

    if (!nextId) {
      throw new Error(`Missing copied node id for "${node.id}".`);
    }

    copiedNode.id = nextId;
    copiedNode.parentId =
      node.id === sourceNode.id
        ? targetParentId
        : (idMap.get(node.parentId ?? "") ?? null);

    if (node.id === sourceNode.id) {
      copiedNode.name = `${copiedNode.name} Copy`;
    }

    return copiedNode;
  });

  prefabNodes = [...prefabNodes, ...copiedNodes];
  selectedPrefabNodeId = idMap.get(sourceNode.id) ?? PREFAB_ROOT_NODE_ID;
}

function cutPrefabSubtree(sourceNode: PrefabNode, targetParentId: string | null): void {
  const nextNodes = prefabNodes.map((node) =>
    node.id === sourceNode.id
      ? {
          ...node,
          parentId: targetParentId,
        }
      : node,
  );

  prefabNodes = nextNodes;
  selectedPrefabNodeId = sourceNode.id;
}

function resetPrefabTimelineState(): void {
  prefabAnimation = createEmptyPrefabAnimation();
  timelineStagingPoses = new Map();
  timelineCurrentTimeMs = 0;
  isTimelinePlaying = false;
  selectedTimelineKeyframeId = null;
  timelinePointerDrag = null;
  discardInPlacePathEditSession();
}

function createEmptyPrefabAnimation(): PrefabAnimation {
  return {
    snapFps: DEFAULT_PREFAB_SNAP_FPS,
    activeClipId: null,
    clips: [],
  };
}

function getTimelineStagingKey(clipId: string, nodeId: string): string {
  return `${clipId}/${nodeId}`;
}

function getSelectedPrefabNode(): PrefabNode | null {
  return selectedPrefabNodeId && selectedPrefabNodeId !== PREFAB_ROOT_NODE_ID
    ? getPrefabNode(selectedPrefabNodeId)
    : null;
}

function canUsePathTool(): boolean {
  return Boolean(
    editorMode === "asset" &&
      getActiveTimelineClip() &&
      getSelectedInPlacePathNodeAndAsset(),
  );
}

function getTimelineStagingPose(
  nodeId: string,
  clip: PrefabAnimationClip | null = getActiveTimelineClip(),
): TimelineStagingPose | null {
  if (!clip) {
    return null;
  }

  return timelineStagingPoses.get(getTimelineStagingKey(clip.id, nodeId)) ?? null;
}

function getOrCreateTimelineStagingPose(
  node: PrefabNode,
  clip: PrefabAnimationClip,
  asset?: PrimitiveSvgAsset | null,
): TimelineStagingPose {
  const key = getTimelineStagingKey(clip.id, node.id);
  const existing = timelineStagingPoses.get(key);

  if (existing) {
    return existing;
  }

  const pose: TimelineStagingPose = {
    nodeId: node.id,
    clipId: clip.id,
    position: [...node.position],
    rotation: [...node.rotation],
    scale: [...node.scale],
    pathDraft: asset ? cloneStructuredBezierPath(asset.bezierPath) : undefined,
  };

  timelineStagingPoses.set(key, pose);
  return pose;
}

function getPrefabNodesWithTimelineStagingPose(
  pose: TimelineStagingPose,
): PrefabNode[] {
  return prefabNodes.map((node) =>
    node.id === pose.nodeId
      ? {
          ...clonePrefabNode(node),
          position: [...pose.position],
          rotation: [...pose.rotation],
          scale: [...pose.scale],
        }
      : clonePrefabNode(node),
  );
}

function getTimelineStagingWorldTransform(
  pose: TimelineStagingPose,
): TransformSnapshot {
  const stagedNodes = getPrefabNodesWithTimelineStagingPose(pose);
  const worldMatrix =
    getPrefabWorldTransforms(stagedNodes).get(pose.nodeId) ?? transformToMatrix(pose);

  return matrixToTransform(worldMatrix);
}

function getSelectedTimelineStagingPose(): TimelineStagingPose | null {
  const activeClip = getActiveTimelineClip();
  const selectedNode = getSelectedPrefabNode();

  if (!activeClip || !selectedNode) {
    return null;
  }

  const asset =
    selectedNode.kind === "primitive" && selectedNode.assetId
      ? getAssetById(selectedNode.assetId)
      : null;

  return getOrCreateTimelineStagingPose(selectedNode, activeClip, asset);
}

function getSelectedTimelineStagingTransform(): TransformSnapshot | null {
  const pose = getSelectedTimelineStagingPose();

  return pose
    ? {
        position: [...pose.position],
        rotation: [...pose.rotation],
        scale: [...pose.scale],
      }
    : null;
}

function syncInPlacePathSessionToStagingPose(): void {
  const session = inPlacePathEditSession;
  const pose = session ? getTimelineStagingPose(session.nodeId) : null;

  if (!session || !pose) {
    return;
  }

  pose.pathDraft = cloneStructuredBezierPath(session.draft);
}

function pruneTimelineStagingPoses(options?: {
  clipIds?: Set<string>;
  nodeIds?: Set<string>;
  assetIds?: Set<string>;
}): void {
  if (!options) {
    return;
  }

  for (const [key, pose] of [...timelineStagingPoses]) {
    const node = getPrefabNode(pose.nodeId);
    const shouldDelete =
      (options.clipIds && options.clipIds.has(pose.clipId)) ||
      (options.nodeIds && options.nodeIds.has(pose.nodeId)) ||
      (options.assetIds &&
        node?.kind === "primitive" &&
        node.assetId &&
        options.assetIds.has(node.assetId));

    if (shouldDelete) {
      timelineStagingPoses.delete(key);
    }
  }
}

function createUniqueTimelineClipId(name: string): string {
  const baseId = slugifyTimelineName(name);
  const existingIds = new Set(prefabAnimation.clips.map((clip) => clip.id));

  return createUniqueId(baseId, existingIds);
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

function createNextPrefabNodeId(): string {
  const id = `prefab-node-${nextPrefabNodeNumber}`;
  nextPrefabNodeNumber += 1;
  return id;
}

function clearInvalidPrefabClipboard(): void {
  if (
    pendingPrefabClipboard &&
    !getPrefabNode(pendingPrefabClipboard.sourceNodeId)
  ) {
    pendingPrefabClipboard = null;
  }
}

function getPrefabNodeTreeEntries(): PrefabNodeTreeEntry[] {
  const entries: PrefabNodeTreeEntry[] = [];
  const childrenByParent = new Map<string | null, PrefabNode[]>();

  for (const node of prefabNodes) {
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }

  function appendChildren(parentId: string | null, depth: number): void {
    for (const node of childrenByParent.get(parentId) ?? []) {
      entries.push({ node, depth });
      appendChildren(node.id, depth + 1);
    }
  }

  appendChildren(null, 0);
  return entries;
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

function getPrefabWorldTransforms(
  nodes: PrefabNode[],
  baseMatrix = new Matrix4(),
): Map<string, Matrix4> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const cache = new Map<string, Matrix4>();

  function resolve(node: PrefabNode): Matrix4 {
    const cached = cache.get(node.id);

    if (cached) {
      return cached.clone();
    }

    const local = transformToMatrix(node);
    const parent = node.parentId ? nodeById.get(node.parentId) : null;
    const world = parent
      ? resolve(parent).multiply(local)
      : baseMatrix.clone().multiply(local);

    cache.set(node.id, world.clone());
    return world;
  }

  for (const node of nodes) {
    resolve(node);
  }

  return cache;
}

function applyWorldTransformToPrefabNode(
  node: PrefabNode,
  worldTransform: EditorTransformNode,
): void {
  const localTransform = getLocalTransformFromPrefabWorldTransform(node, worldTransform);
  node.position = localTransform.position;
  node.rotation = localTransform.rotation;
  node.scale = localTransform.scale;
}

function getLocalTransformFromPrefabWorldTransform(
  node: PrefabNode,
  worldTransform: EditorTransformNode,
): TransformSnapshot {
  const worldMatrix = transformToMatrix(worldTransform);
  const parent = node.parentId ? getPrefabNode(node.parentId) : null;

  if (!parent) {
    return cloneTransform(worldTransform);
  }

  const parentWorldMatrix =
    getPrefabWorldTransforms(prefabNodes).get(parent.id) ?? transformToMatrix(parent);
  const localMatrix = parentWorldMatrix.clone().invert().multiply(worldMatrix);

  return matrixToTransform(localMatrix);
}

function transformToMatrix(transform: TransformSnapshot): Matrix4 {
  const position = tupleToVector(transform.position);
  const rotation = new Quaternion().setFromEuler(
    new Euler(transform.rotation[0], transform.rotation[1], transform.rotation[2], "XYZ"),
  );
  const scale = tupleToVector(transform.scale);

  return new Matrix4().compose(position, rotation, scale);
}

function matrixToTransform(matrix: Matrix4): TransformSnapshot {
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();

  matrix.decompose(position, rotation, scale);

  return {
    position: vectorToTuple(position),
    rotation: eulerToTuple(new Euler().setFromQuaternion(rotation, "XYZ")),
    scale: vectorToTuple(scale),
  };
}

function cloneTransform(transform: TransformSnapshot): TransformSnapshot {
  return {
    position: [...transform.position],
    rotation: [...transform.rotation],
    scale: [...transform.scale],
  };
}

function clonePrefabAnimation(animation: PrefabAnimation): PrefabAnimation {
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

function clonePrefabAnimationClip(clip: PrefabAnimationClip): PrefabAnimationClip {
  return {
    id: clip.id,
    name: clip.name,
    durationMs: clip.durationMs,
    loop: clip.loop,
    tracks: clip.tracks.map(clonePrefabAnimationTrack),
  };
}

function clonePrefabAnimationTrack(
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

function clonePrefabAnimationKeyframe(
  keyframe: PrefabVectorAnimationKeyframe,
): PrefabVectorAnimationKeyframe {
  return {
    id: keyframe.id,
    timeMs: keyframe.timeMs,
    value: [...keyframe.value],
    easing: keyframe.easing,
  };
}

function clonePrefabPathAnimationKeyframe(
  keyframe: PrefabPathAnimationKeyframe,
): PrefabPathAnimationKeyframe {
  return {
    id: keyframe.id,
    timeMs: keyframe.timeMs,
    value: cloneStructuredBezierPath(keyframe.value),
    easing: keyframe.easing,
  };
}

function isPrefabVectorTrack(
  track: PrefabAnimationTrack,
): track is PrefabVectorAnimationTrack {
  return track.target.property !== "path";
}

function isPrefabPathTrack(
  track: PrefabAnimationTrack,
): track is Extract<PrefabAnimationTrack, { target: { property: "path" } }> {
  return track.target.property === "path";
}

function clonePrefabNode(node: PrefabNode): PrefabNode {
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

function cloneSceneNode(node: SceneNode): SceneNode {
  if (node.kind === "primitive") {
    const primitiveNode: ScenePrimitiveNode = {
      id: node.id,
      kind: "primitive",
      assetId: node.assetId,
      position: [...node.position],
      rotation: [...node.rotation],
      scale: [...node.scale],
      billboardMode: node.billboardMode,
    };

    return primitiveNode;
  }

  const prefabInstanceNode: ScenePrefabInstanceNode = {
    id: node.id,
    kind: "prefabInstance",
    prefabId: node.prefabId,
    position: [...node.position],
    rotation: [...node.rotation],
    scale: [...node.scale],
  };

  return prefabInstanceNode;
}

function chooseStableSelection(
  currentId: string | null,
  availableIds: string[],
): string | null {
  if (currentId && availableIds.includes(currentId)) {
    return currentId;
  }

  return availableIds[0] ?? null;
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

function getNextNodeNumber(ids: string[], prefix: string): number {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}-(\\d+)$`);
  const largestExistingNumber = ids.reduce((largest, id) => {
    const match = pattern.exec(id);
    const value = match ? Number(match[1]) : 0;

    return Number.isFinite(value) ? Math.max(largest, value) : largest;
  }, 0);

  return largestExistingNumber + 1;
}

function createUniqueId(baseId: string, existingIds: Set<string>): string {
  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;

  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

function slugifyTimelineName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "clip";
}

function formatTransformValue(value: number): string {
  return String(roundTransformValue(value));
}

function roundTransformValue(value: number): number {
  return Number(value.toFixed(4));
}

function formatTimelineNumber(value: number): string {
  return String(roundTimelineNumber(value));
}

function roundTimelineNumber(value: number): number {
  return Number(value.toFixed(3));
}

function clampTimelineTimeMs(
  timeMs: number,
  clip: PrefabAnimationClip | null,
): number {
  if (!clip || !Number.isFinite(timeMs)) {
    return 0;
  }

  return Math.round(Math.min(Math.max(timeMs, 0), clip.durationMs));
}

function snapTimelineTimeMs(timeMs: number): number {
  if (!Number.isFinite(timeMs)) {
    return 0;
  }

  const frameMs = getTimelineSnapFrameMs();
  return Math.round(Math.round(timeMs / frameMs) * frameMs);
}

function snapAndClampTimelineTimeMs(
  timeMs: number,
  clip: PrefabAnimationClip | null,
): number {
  return clampTimelineTimeMs(snapTimelineTimeMs(timeMs), clip);
}

function getTimelineSnapFrameMs(): number {
  return 1000 / Math.min(Math.max(prefabAnimation.snapFps, 1), 240);
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

function vectorToTuple(value: Vector3): Vector3Tuple {
  return [roundTransformValue(value.x), roundTransformValue(value.y), roundTransformValue(value.z)];
}

function eulerToTuple(value: Euler): Vector3Tuple {
  return [roundTransformValue(value.x), roundTransformValue(value.y), roundTransformValue(value.z)];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function setImportError(error: unknown): void {
  const message = error instanceof Error ? error.message : "Unknown error";
  lastImportError = message;
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
  window.__vectorEditorDebug = {
    getProjects: () => [...projects],
    getAssets: () =>
      assets.map((asset) => ({
        id: asset.id,
        assetKind: asset.assetKind,
        name: asset.name,
        sourceUrl: asset.sourceUrl,
        viewBox: asset.viewBox,
        fill: asset.assetKind === "filledPath" ? asset.fill : "none",
        fillRule: asset.assetKind === "filledPath" ? asset.fillRule : "nonzero",
        stroke: asset.assetKind === "strokePath" ? asset.stroke : null,
        strokeWidth: asset.assetKind === "strokePath" ? asset.strokeWidth : null,
        bezierPath: asset.bezierPath,
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
      getPathEditState: () => ({
        assetId: pathEditSession?.assetId ?? null,
        selectedSegmentId: pathEditSession?.selected?.segmentId ?? null,
        selectedComponent: pathEditSession?.selected?.component ?? null,
        hoveredSegmentId: pathEditHoveredControl?.segmentId ?? null,
        hoveredComponent: pathEditHoveredControl?.component ?? null,
        hasDraft: Boolean(pathEditSession),
        draftBezierPath: pathEditSession
          ? cloneStructuredBezierPath(pathEditSession.draft)
        : null,
      controls: getPathEditScreenControls(),
    }),
    getInPlacePathEditState: () => ({
      nodeId: inPlacePathEditSession?.nodeId ?? null,
      assetId: inPlacePathEditSession?.assetId ?? null,
      active: Boolean(getValidInPlacePathEditSession()),
      hasDraft: Boolean(inPlacePathEditSession),
      selectedSegmentId: inPlacePathEditSession?.selected?.segmentId ?? null,
      selectedComponent: inPlacePathEditSession?.selected?.component ?? null,
      hoveredSegmentId: inPlacePathEditHoveredControl?.segmentId ?? null,
      hoveredComponent: inPlacePathEditHoveredControl?.component ?? null,
      draftBezierPath: inPlacePathEditSession
        ? cloneStructuredBezierPath(inPlacePathEditSession.draft)
        : null,
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
      };
    },
    getActiveEditorTool: () => activeEditorTool,
    getScenes: () => [...scenes],
    getEditorMode: () => editorMode,
    getSelectedProjectId: () => selectedProjectId,
    getSelectedAssetId: () => selectedAssetId,
    getSelectedPrefabId: () => selectedPrefabId,
    getLoadedPrefabId: () => loadedPrefabId,
    getSelectedSceneId: () => selectedSceneId,
    getLoadedSceneId: () => loadedSceneId,
    getLastImportError: () => lastImportError,
    getCollapsedModules: () =>
      COLLAPSIBLE_MODULE_IDS.filter((moduleId) =>
        collapsedModuleIds.has(moduleId),
      ),
  };
}
