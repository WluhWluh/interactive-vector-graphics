export {};

declare global {
  interface Window {
    __vectorStageDebug?: {
      getPrimitiveAssets: () => Array<{
        id: string;
        name: string;
        sourceUrl: string;
        viewBox: [number, number, number, number];
        fill: string;
        fillRule: string;
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
        name: string;
        sourceUrl: string;
        viewBox: [number, number, number, number];
        fill: string;
        fillRule: string;
        pathD: string;
      }>;
      getSelectedProjectId: () => string | null;
      getSelectedAssetId: () => string | null;
      getLastImportError: () => string | null;
      getEditorMode: () => "asset" | "scene";
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
      };
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
        | "scene-documents"
        | "scene-contents"
      >;
    };
  }
}
