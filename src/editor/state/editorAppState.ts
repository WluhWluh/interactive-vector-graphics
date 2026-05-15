import type { PrimitiveSvgAsset } from "../../core/assets/primitiveSvg";
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
import {
  createEmptyPrefabAnimation,
  type PrefabSelectionId,
} from "./prefabState";

export type EditorMode = "asset" | "path" | "scene";

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
  activeEditorTool: EditorTool;
  selectedSceneId: string | null;
  loadedSceneId: string | null;
  selectedSceneNodeId: string | null;
  pendingPrefabClipboard: PendingPrefabClipboard | null;
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
>;

export type ToolDomainState = Pick<EditorAppState, "activeEditorTool" | "editorMode">;

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
    activeEditorTool: "translate",
    selectedSceneId: null,
    loadedSceneId: null,
    selectedSceneNodeId: null,
    pendingPrefabClipboard: null,
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
  };
}

function cloneToolDomainState(state: EditorAppState): ToolDomainState {
  return {
    activeEditorTool: state.activeEditorTool,
    editorMode: state.editorMode,
  };
}
