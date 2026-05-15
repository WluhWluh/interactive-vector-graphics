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
