export {};

type StructuredBezierPathDebug = {
  version: 1;
  closed: boolean;
  segments: Array<{
    id: string;
    anchor: [number, number];
    handleIn: [number, number];
    handleOut: [number, number];
  }>;
};

type StructuredBezierPath3DDebug = {
  version: 1;
  closed: false;
  segments: Array<{
    id: string;
    anchor: [number, number, number];
    handleIn: [number, number, number];
    handleOut: [number, number, number];
  }>;
};

type ViewMorphProfileDebug = {
  version: 1;
  center: [number, number, number];
  verticalPlanes: Array<{
    id: string;
    name: string;
    normal: [number, number, number];
    tangentU: [number, number, number];
    path: {
      points: Array<{
        id: string;
        point: [number, number];
      }>;
    };
  }>;
  horizontalPlane: {
    id: string;
    name: string;
    normal: [0, 1, 0];
    tangentU: [1, 0, 0];
    tangentV: [0, 0, 1];
    path: {
      points: Array<{
        id: string;
        point: [number, number];
      }>;
    };
  };
};

declare global {
  interface Window {
    __vectorStageDebug?: {
      getPrimitiveAssets: () => Array<{
        id: string;
        assetKind: string;
        name: string;
        sourceUrl: string;
        viewBox: [number, number, number, number];
        fill: string;
        fillRule: string;
        stroke: string | null;
        strokeWidth: number | null;
        bezierPath: StructuredBezierPathDebug;
        bezierPath3d: StructuredBezierPath3DDebug | null;
        viewMorphProfile: ViewMorphProfileDebug | null;
        pathD: string;
      }>;
      getAssetLoadState: () => "loading" | "ready" | "error";
    };
    __vectorEditorDebug?: {
      getProjects: () => Array<{
        id: string;
        name: string;
        createdAt: string;
        updatedAt: string;
      }>;
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
        bezierPath: StructuredBezierPathDebug;
        bezierPath3d: StructuredBezierPath3DDebug | null;
        viewMorphProfile: ViewMorphProfileDebug | null;
        pathD: string;
      }>;
      getSelectedProjectId: () => string | null;
      getSelectedAssetId: () => string | null;
      getLastImportError: () => string | null;
      getEditorMode: () => "asset" | "path" | "scene";
      getPrefabs: () => Array<{
        id: string;
        projectId: string;
        name: string;
        dataPath: string;
        createdAt: string;
        updatedAt: string;
      }>;
      getSelectedPrefabId: () => string | null;
      getLoadedPrefabId: () => string | null;
      getPrefabAssembly: () => {
        nodes: Array<{
          id: string;
          kind: "group" | "primitive";
          parentId: string | null;
          assetId?: string;
          name: string;
          position: [number, number, number];
          rotation: [number, number, number];
          scale: [number, number, number];
          billboardMode: "spherical";
        }>;
        selectedPrefabId: string | null;
        loadedPrefabId: string | null;
        selectedPrefabNodeId: string | null;
        pendingClipboard: {
          mode: "copy" | "cut";
          sourceNodeId: string;
        } | null;
      };
      getPrefabTimeline: () => {
        animation: {
          snapFps: number;
          activeClipId: string | null;
          clips: Array<{
            id: string;
            name: string;
            durationMs: number;
            loop: boolean;
            tracks: Array<{
              id: string;
              target: {
                nodeId: string;
                property: "position" | "rotation" | "scale" | "path";
              };
              keyframes: Array<{
                id: string;
                timeMs: number;
                value: [number, number, number] | StructuredBezierPathDebug;
                easing: "linear" | "step" | "easeInOut";
              }>;
            }>;
          }>;
        };
        currentTimeMs: number;
        isPlaying: boolean;
        selectedClipId: string | null;
        activeTrackProperty: "position" | "rotation" | "scale" | "path";
        selectedKeyframeId: string | null;
        evaluatedNodes: Array<{
          id: string;
          kind: "group" | "primitive";
          parentId: string | null;
          assetId?: string;
          name: string;
          position: [number, number, number];
          rotation: [number, number, number];
          scale: [number, number, number];
          billboardMode: "spherical";
        }>;
        evaluatedPathOverrides: Array<{
          nodeId: string;
          path: StructuredBezierPathDebug;
        }>;
        stagingPose: {
          clipId: string;
          nodeId: string;
          transform: {
            position: [number, number, number];
            rotation: [number, number, number];
            scale: [number, number, number];
          };
          hasPathDraft: boolean;
          pathDraft: StructuredBezierPathDebug | null;
        } | null;
      };
      getPathEditState: () => {
        is3d: boolean;
        isViewMorphProfile: boolean;
        assetId: string | null;
        selectedSegmentId: string | null;
        selectedComponent: "anchor" | "handleIn" | "handleOut" | null;
        selectedPlaneId: string | null;
        selectedPointId: string | null;
        viewMorphProfileShowFinalPath: boolean;
        hoveredSegmentId: string | null;
        hoveredComponent: "anchor" | "handleIn" | "handleOut" | null;
        hoveredSegmentId3d: string | null;
        hoveredComponent3d: "anchor" | "handleIn" | "handleOut" | null;
        hoveredPlaneId: string | null;
        hoveredPointId: string | null;
        hasDraft: boolean;
        draftBezierPath: StructuredBezierPathDebug | null;
        draftBezierPath3d: StructuredBezierPath3DDebug | null;
        draftViewMorphProfile: ViewMorphProfileDebug | null;
        controls: Array<{
          segmentId: string;
          component: "anchor" | "handleIn" | "handleOut";
          x: number;
          y: number;
        }>;
        controls3d: Array<{
          id: string;
          segmentId: string;
          component: "anchor" | "handleIn" | "handleOut";
          position: [number, number, number];
          selected: boolean;
        }>;
        viewMorphControls: Array<{
          kind: "vertical" | "horizontal";
          planeId: string;
          pointId: string;
          x: number;
          y: number;
        }>;
        projectedCommandCount: number;
      };
      getInPlacePathEditState: () => {
        nodeId: string | null;
        assetId: string | null;
        active: boolean;
        hasDraft: boolean;
        selectedSegmentId: string | null;
        selectedComponent: "anchor" | "handleIn" | "handleOut" | null;
        hoveredSegmentId: string | null;
        hoveredComponent: "anchor" | "handleIn" | "handleOut" | null;
        draftBezierPath: StructuredBezierPathDebug | null;
        controls: Array<{
          segmentId: string;
          component: "anchor" | "handleIn" | "handleOut";
          x: number;
          y: number;
        }>;
      };
      getExperimentScene: () => {
        camera: {
          projection: "perspective" | "orthographic";
          position: [number, number, number];
          target: [number, number, number];
          fov: number;
          zoom: number;
          near: number;
          far: number;
        };
        nodes: Array<
          | {
              id: string;
              kind: "primitive";
              assetId: string;
              position: [number, number, number];
              rotation: [number, number, number];
              scale: [number, number, number];
              billboardMode: "spherical";
            }
          | {
              id: string;
              kind: "prefabInstance";
              prefabId: string;
              position: [number, number, number];
              rotation: [number, number, number];
              scale: [number, number, number];
            }
        >;
        selectedNodeId: string | null;
        transformMode: "translate" | "rotate" | "scale";
        viewportProxies: Array<{
          nodeId: string;
          position: [number, number, number];
          rotation: [number, number, number];
          scale: [number, number, number];
          selected: boolean;
        }>;
      };
      getActiveEditorTool: () => "translate" | "rotate" | "scale" | "path";
      getScenes: () => Array<{
        id: string;
        projectId: string;
        name: string;
        dataPath: string;
        createdAt: string;
        updatedAt: string;
      }>;
      getSelectedSceneId: () => string | null;
      getLoadedSceneId: () => string | null;
      getCollapsedModules: () => Array<
        | "projects"
        | "primitive-assets"
        | "prefabs"
        | "prefab-contents"
        | "source-path-assets"
        | "scene-documents"
        | "scene-contents"
      >;
    };
  }
}
