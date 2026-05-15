import type { PrimitiveSvgAsset } from "../../core/assets/primitiveAssetTypes";
import type {
  PrefabAnimation,
  PrefabDocument,
  PrefabNode,
  PrefabRecord,
  ProjectRecord,
  SceneNode,
  SceneRecord,
} from "../api";
import { TimelineStagingPoseStore } from "../timeline/stagingPose";
import type { EditorTool } from "../tools/toolController";
import type { PendingPrefabClipboard } from "../controllers/prefabAssemblyController";
import type { PrefabTrackProperty } from "../api";
import type {
  InPlacePathEditSession,
} from "../controllers/inPlacePathEditController";
import type {
  SourcePathEditSession,
} from "../controllers/sourcePathEditController";
import type { SourcePathEdit3DSession } from "../tools/pathEdit3dCore";
import type { PathEditDragState } from "../tools/pathEditCore";
import {
  createEmptyPrefabAnimation,
  type PrefabSelectionId,
} from "./prefabState";
import { cloneStructuredBezierPath } from "../../core/assets/structuredBezierPath";
import { cloneStructuredBezierPath3D } from "../../core/assets/structuredBezierPath3d";

export type EditorMode = "asset" | "path" | "scene";

export type TimelinePointerDrag = {
  keyframeId: string;
  property: PrefabTrackProperty;
};

export type EditorAppState = {
  projects: ProjectRecord[];
  assets: PrimitiveSvgAsset[];
  prefabs: PrefabRecord[];
  prefabNodes: PrefabNode[];
  prefabDocuments: Map<string, PrefabDocument>;
  scenes: SceneRecord[];
  sceneNodes: SceneNode[];
  editorMode: EditorMode;
  selectedProjectId: string | null;
  selectedAssetId: string | null;
  selectedPrefabId: string | null;
  loadedPrefabId: string | null;
  selectedPrefabNodeId: PrefabSelectionId | null;
  prefabAnimation: PrefabAnimation;
  timelineStagingPoses: TimelineStagingPoseStore;
  timelineCurrentTimeMs: number;
  isTimelinePlaying: boolean;
  selectedTimelineKeyframeId: string | null;
  timelinePointerDrag: TimelinePointerDrag | null;
  activeEditorTool: EditorTool;
  selectedSceneId: string | null;
  loadedSceneId: string | null;
  selectedSceneNodeId: string | null;
  pendingPrefabClipboard: PendingPrefabClipboard | null;
  pathEditSession: SourcePathEditSession | null;
  pathEdit3DSession: SourcePathEdit3DSession | null;
  pathEditDragState: PathEditDragState | null;
  pathEditHoveredControl: PathEditDragState | null;
  inPlacePathEditSession: InPlacePathEditSession | null;
  inPlacePathEditDragState: PathEditDragState | null;
  inPlacePathEditHoveredControl: PathEditDragState | null;
  inPlacePathEditCameraDragActive: boolean;
  lastImportError: string | null;
  nextSceneNodeNumber: number;
  nextPrefabNodeNumber: number;
};

export type ProjectDomainState = Pick<
  EditorAppState,
  "projects" | "selectedProjectId" | "lastImportError"
>;

export type AssetDomainState = Pick<
  EditorAppState,
  "assets" | "selectedAssetId"
>;

export type PrefabDomainState = Pick<
  EditorAppState,
  | "prefabs"
  | "prefabNodes"
  | "prefabDocuments"
  | "selectedPrefabId"
  | "loadedPrefabId"
  | "selectedPrefabNodeId"
  | "pendingPrefabClipboard"
  | "nextPrefabNodeNumber"
>;

export type SceneDomainState = Pick<
  EditorAppState,
  | "scenes"
  | "sceneNodes"
  | "selectedSceneId"
  | "loadedSceneId"
  | "selectedSceneNodeId"
  | "nextSceneNodeNumber"
>;

export type TimelineDomainState = Pick<
  EditorAppState,
  | "prefabAnimation"
  | "timelineStagingPoses"
  | "timelineCurrentTimeMs"
  | "isTimelinePlaying"
  | "selectedTimelineKeyframeId"
  | "timelinePointerDrag"
>;

export type ToolDomainState = Pick<EditorAppState, "activeEditorTool" | "editorMode">;

export type PathEditDomainState = Pick<
  EditorAppState,
  | "pathEditSession"
  | "pathEdit3DSession"
  | "pathEditDragState"
  | "pathEditHoveredControl"
  | "inPlacePathEditSession"
  | "inPlacePathEditDragState"
  | "inPlacePathEditHoveredControl"
  | "inPlacePathEditCameraDragActive"
>;

export type EditorAppStateStore = {
  getMutableState: () => EditorAppState;
  getSnapshot: () => EditorAppState;
  patch: (patch: Partial<EditorAppState>) => EditorAppState;
  getProjectState: () => ProjectDomainState;
  patchProjectState: (patch: Partial<ProjectDomainState>) => ProjectDomainState;
  getAssetState: () => AssetDomainState;
  patchAssetState: (patch: Partial<AssetDomainState>) => AssetDomainState;
  getPrefabState: () => PrefabDomainState;
  patchPrefabState: (patch: Partial<PrefabDomainState>) => PrefabDomainState;
  getSceneState: () => SceneDomainState;
  patchSceneState: (patch: Partial<SceneDomainState>) => SceneDomainState;
  getTimelineState: () => TimelineDomainState;
  patchTimelineState: (patch: Partial<TimelineDomainState>) => TimelineDomainState;
  getToolState: () => ToolDomainState;
  patchToolState: (patch: Partial<ToolDomainState>) => ToolDomainState;
  getPathEditState: () => PathEditDomainState;
  patchPathEditState: (patch: Partial<PathEditDomainState>) => PathEditDomainState;
};

export function createInitialEditorAppState(input: {
  rootPrefabNodeId: string;
  defaultPrefabSnapFps: number;
}): EditorAppState {
  return {
    projects: [],
    assets: [],
    prefabs: [],
    prefabNodes: [],
    prefabDocuments: new Map(),
    scenes: [],
    sceneNodes: [],
    editorMode: "asset",
    selectedProjectId: null,
    selectedAssetId: null,
    selectedPrefabId: null,
    loadedPrefabId: null,
    selectedPrefabNodeId: input.rootPrefabNodeId,
    prefabAnimation: createEmptyPrefabAnimation(input.defaultPrefabSnapFps),
    timelineStagingPoses: new TimelineStagingPoseStore(),
    timelineCurrentTimeMs: 0,
    isTimelinePlaying: false,
    selectedTimelineKeyframeId: null,
    timelinePointerDrag: null,
    activeEditorTool: "translate",
    selectedSceneId: null,
    loadedSceneId: null,
    selectedSceneNodeId: null,
    pendingPrefabClipboard: null,
    pathEditSession: null,
    pathEdit3DSession: null,
    pathEditDragState: null,
    pathEditHoveredControl: null,
    inPlacePathEditSession: null,
    inPlacePathEditDragState: null,
    inPlacePathEditHoveredControl: null,
    inPlacePathEditCameraDragActive: false,
    lastImportError: null,
    nextSceneNodeNumber: 1,
    nextPrefabNodeNumber: 1,
  };
}

export function createEditorAppStateStore(
  initialState: EditorAppState,
): EditorAppStateStore {
  const state = cloneEditorAppState(initialState);
  const applyPatch = (patch: Partial<EditorAppState>): void => {
    Object.assign(state, patch);
  };

  return {
    getMutableState: () => state,
    getSnapshot: () => cloneEditorAppState(state),
    patch: (patch) => {
      applyPatch(patch);

      return cloneEditorAppState(state);
    },
    getProjectState: () => cloneProjectDomainState(state),
    patchProjectState: (patch) => {
      applyPatch(patch);

      return cloneProjectDomainState(state);
    },
    getAssetState: () => cloneAssetDomainState(state),
    patchAssetState: (patch) => {
      applyPatch(patch);

      return cloneAssetDomainState(state);
    },
    getPrefabState: () => clonePrefabDomainState(state),
    patchPrefabState: (patch) => {
      applyPatch(patch);

      return clonePrefabDomainState(state);
    },
    getSceneState: () => cloneSceneDomainState(state),
    patchSceneState: (patch) => {
      applyPatch(patch);

      return cloneSceneDomainState(state);
    },
    getTimelineState: () => cloneTimelineDomainState(state),
    patchTimelineState: (patch) => {
      applyPatch(patch);

      return cloneTimelineDomainState(state);
    },
    getToolState: () => cloneToolDomainState(state),
    patchToolState: (patch) => {
      applyPatch(patch);

      return cloneToolDomainState(state);
    },
    getPathEditState: () => clonePathEditDomainState(state),
    patchPathEditState: (patch) => {
      applyPatch(patch);

      return clonePathEditDomainState(state);
    },
  };
}

export function cloneEditorAppState(state: EditorAppState): EditorAppState {
  return {
    ...state,
    projects: [...state.projects],
    assets: [...state.assets],
    prefabs: [...state.prefabs],
    prefabNodes: [...state.prefabNodes],
    prefabDocuments: new Map(state.prefabDocuments),
    scenes: [...state.scenes],
    sceneNodes: [...state.sceneNodes],
    timelinePointerDrag: cloneTimelinePointerDrag(state.timelinePointerDrag),
    pathEditSession: cloneSourcePathEditSession(state.pathEditSession),
    pathEdit3DSession: cloneSourcePathEdit3DSession(state.pathEdit3DSession),
    pathEditDragState: clonePathEditDragState(state.pathEditDragState),
    pathEditHoveredControl: clonePathEditDragState(state.pathEditHoveredControl),
    inPlacePathEditSession: cloneInPlacePathEditSession(
      state.inPlacePathEditSession,
    ),
    inPlacePathEditDragState: clonePathEditDragState(
      state.inPlacePathEditDragState,
    ),
    inPlacePathEditHoveredControl: clonePathEditDragState(
      state.inPlacePathEditHoveredControl,
    ),
  };
}

function cloneProjectDomainState(state: EditorAppState): ProjectDomainState {
  return {
    projects: [...state.projects],
    selectedProjectId: state.selectedProjectId,
    lastImportError: state.lastImportError,
  };
}

function cloneAssetDomainState(state: EditorAppState): AssetDomainState {
  return {
    assets: [...state.assets],
    selectedAssetId: state.selectedAssetId,
  };
}

function clonePrefabDomainState(state: EditorAppState): PrefabDomainState {
  return {
    prefabs: [...state.prefabs],
    prefabNodes: [...state.prefabNodes],
    prefabDocuments: new Map(state.prefabDocuments),
    selectedPrefabId: state.selectedPrefabId,
    loadedPrefabId: state.loadedPrefabId,
    selectedPrefabNodeId: state.selectedPrefabNodeId,
    pendingPrefabClipboard: state.pendingPrefabClipboard
      ? { ...state.pendingPrefabClipboard }
      : null,
    nextPrefabNodeNumber: state.nextPrefabNodeNumber,
  };
}

function cloneSceneDomainState(state: EditorAppState): SceneDomainState {
  return {
    scenes: [...state.scenes],
    sceneNodes: [...state.sceneNodes],
    selectedSceneId: state.selectedSceneId,
    loadedSceneId: state.loadedSceneId,
    selectedSceneNodeId: state.selectedSceneNodeId,
    nextSceneNodeNumber: state.nextSceneNodeNumber,
  };
}

function cloneTimelineDomainState(state: EditorAppState): TimelineDomainState {
  return {
    prefabAnimation: state.prefabAnimation,
    timelineStagingPoses: state.timelineStagingPoses,
    timelineCurrentTimeMs: state.timelineCurrentTimeMs,
    isTimelinePlaying: state.isTimelinePlaying,
    selectedTimelineKeyframeId: state.selectedTimelineKeyframeId,
    timelinePointerDrag: cloneTimelinePointerDrag(state.timelinePointerDrag),
  };
}

function cloneToolDomainState(state: EditorAppState): ToolDomainState {
  return {
    activeEditorTool: state.activeEditorTool,
    editorMode: state.editorMode,
  };
}

function clonePathEditDomainState(state: EditorAppState): PathEditDomainState {
  return {
    pathEditSession: cloneSourcePathEditSession(state.pathEditSession),
    pathEdit3DSession: cloneSourcePathEdit3DSession(state.pathEdit3DSession),
    pathEditDragState: clonePathEditDragState(state.pathEditDragState),
    pathEditHoveredControl: clonePathEditDragState(state.pathEditHoveredControl),
    inPlacePathEditSession: cloneInPlacePathEditSession(
      state.inPlacePathEditSession,
    ),
    inPlacePathEditDragState: clonePathEditDragState(
      state.inPlacePathEditDragState,
    ),
    inPlacePathEditHoveredControl: clonePathEditDragState(
      state.inPlacePathEditHoveredControl,
    ),
    inPlacePathEditCameraDragActive: state.inPlacePathEditCameraDragActive,
  };
}

function cloneSourcePathEditSession(
  session: SourcePathEditSession | null,
): SourcePathEditSession | null {
  return session
    ? {
        assetId: session.assetId,
        draft: cloneStructuredBezierPath(session.draft),
        selected: session.selected ? { ...session.selected } : null,
      }
    : null;
}

function cloneInPlacePathEditSession(
  session: InPlacePathEditSession | null,
): InPlacePathEditSession | null {
  return session
    ? {
        nodeId: session.nodeId,
        assetId: session.assetId,
        draft: cloneStructuredBezierPath(session.draft),
        selected: session.selected ? { ...session.selected } : null,
      }
    : null;
}

function cloneSourcePathEdit3DSession(
  session: SourcePathEdit3DSession | null,
): SourcePathEdit3DSession | null {
  return session
    ? {
        assetId: session.assetId,
        draft: cloneStructuredBezierPath3D(session.draft),
        selected: session.selected ? { ...session.selected } : null,
      }
    : null;
}

function clonePathEditDragState(
  dragState: PathEditDragState | null,
): PathEditDragState | null {
  return dragState ? { ...dragState } : null;
}

function cloneTimelinePointerDrag(
  dragState: TimelinePointerDrag | null,
): TimelinePointerDrag | null {
  return dragState ? { ...dragState } : null;
}
