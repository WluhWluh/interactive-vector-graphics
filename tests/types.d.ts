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
      getExperimentScene: () => {
        camera: {
          projection: "perspective" | "orthographic";
          position: [number, number, number];
          target: [number, number, number];
          fov: number;
          zoom: number;
        };
        nodes: Array<{
          id: string;
          assetId: string;
          position: [number, number, number];
          rotation: [number, number, number];
          scale: [number, number, number];
          billboardMode: "spherical";
        }>;
        selectedNodeId: string | null;
        transformMode: "translate" | "rotate" | "scale";
      };
    };
  }
}
