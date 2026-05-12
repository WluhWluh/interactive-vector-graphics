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
    };
  }
}
