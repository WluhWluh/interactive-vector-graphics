import type { StructuredBezierPath } from "../../core/assets/structuredBezierPath";
import type { StructuredBezierPath3D } from "../../core/assets/structuredBezierPath3d";
import type { ViewMorphProfile } from "../../core/assets/viewMorphProfile";
import type {
  PrefabAnimation,
  PrefabNode,
  PrefabRecord,
  PrefabTrackProperty,
  ProjectRecord,
  SceneNode,
  SceneRecord,
} from "../api";
import type { CameraProjection, ThreeEditorViewport } from "../threeEditorViewport";
import type { TransformSnapshot } from "../tools/prefabTransform";
import type { EditorTool } from "../tools/toolController";
import type { PathEditComponent, PathEditScreenControl } from "../tools/pathEditCore";
import type { Curve3DControlDescriptor } from "../three/viewportObjects";
import type { PrefabClipboardMode } from "../controllers/prefabAssemblyController";
import type { EditorMode } from "../state/editorAppState";
import type { CollapsibleModuleId } from "../ui/collapsibleModules";
import type { createEditorRenderCache } from "../render/editorRenderCache";

export type VectorEditorDebugApi = {
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
    viewMorphProfile: ViewMorphProfile | null;
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
    transformMode: ThreeEditorViewport["currentTransformMode"];
    viewportProxies: ReturnType<ThreeEditorViewport["getProxySnapshot"]>;
  };
  getRenderCache: () => {
    flags: ReturnType<typeof createEditorRenderCache>["flags"];
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
  getAppStateSnapshot: () => unknown;
};

export function installEditorDebugHooks(api: VectorEditorDebugApi): void {
  window.__vectorEditorDebug = api;
}

declare global {
  interface Window {
    __vectorEditorDebug?: VectorEditorDebugApi;
  }
}
