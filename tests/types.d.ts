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
      getAssets: () => Array<{
        id: string;
        name: string;
        sourceUrl: string;
        viewBox: [number, number, number, number];
        fill: string;
        fillRule: string;
        pathD: string;
      }>;
      getSelectedAssetId: () => string | null;
      getLastImportError: () => string | null;
    };
  }
}
