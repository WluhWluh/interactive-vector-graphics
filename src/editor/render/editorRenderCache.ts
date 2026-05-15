import type {
  AssetAssemblyBillboardInput,
  BillboardFrameDataCache,
  SceneLayoutBillboardInput,
} from "./billboardFrameData";
import {
  createRenderInvalidation,
  type RenderDirtyFlags,
} from "./renderInvalidation";

export type EditorRenderCache = {
  flags: RenderDirtyFlags;
  markAllDirty: () => void;
  markAssetBillboardsDirty: () => void;
  markSceneBillboardsDirty: () => void;
  markVectorDirty: () => void;
  markPaperDirty: () => void;
  markThreeDirty: () => void;
  clearFrameDirtyFlags: () => void;
  getAssetAssemblyBillboards: (
    input: AssetAssemblyBillboardInput,
  ) => ReturnType<BillboardFrameDataCache["getAssetAssemblyBillboards"]>;
  getSceneLayoutBillboards: (
    input: SceneLayoutBillboardInput,
  ) => ReturnType<BillboardFrameDataCache["getSceneLayoutBillboards"]>;
  getAssetAssemblyBillboardCount: () => number;
  getSceneLayoutBillboardCount: () => number;
};

export function createEditorRenderCache(
  billboardFrameDataCache: BillboardFrameDataCache,
): EditorRenderCache {
  const invalidation = createRenderInvalidation();

  return {
    flags: invalidation.flags,
    markAllDirty: invalidation.markAllDirty,
    markAssetBillboardsDirty: invalidation.markAssetBillboardsDirty,
    markSceneBillboardsDirty: invalidation.markSceneBillboardsDirty,
    markVectorDirty: invalidation.markVectorDirty,
    markPaperDirty: invalidation.markPaperDirty,
    markThreeDirty: invalidation.markThreeDirty,
    clearFrameDirtyFlags: invalidation.clearFrameDirtyFlags,
    getAssetAssemblyBillboards: (input) =>
      billboardFrameDataCache.getAssetAssemblyBillboards(
        input,
        invalidation.flags,
      ),
    getSceneLayoutBillboards: (input) =>
      billboardFrameDataCache.getSceneLayoutBillboards(input, invalidation.flags),
    getAssetAssemblyBillboardCount: () =>
      billboardFrameDataCache.getAssetAssemblyBillboardCount(),
    getSceneLayoutBillboardCount: () =>
      billboardFrameDataCache.getSceneLayoutBillboardCount(),
  };
}
