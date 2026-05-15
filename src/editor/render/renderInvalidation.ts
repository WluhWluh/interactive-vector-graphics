export type RenderDirtyFlags = {
  assetBillboards: boolean;
  sceneBillboards: boolean;
  vectorLayer: boolean;
  paperLayer: boolean;
  threeLayer: boolean;
};

export type RenderInvalidation = {
  flags: RenderDirtyFlags;
  markAllDirty: () => void;
  markAssetBillboardsDirty: () => void;
  markSceneBillboardsDirty: () => void;
  markVectorDirty: () => void;
  markPaperDirty: () => void;
  markThreeDirty: () => void;
  clearFrameDirtyFlags: () => void;
};

export function createRenderInvalidation(): RenderInvalidation {
  const flags: RenderDirtyFlags = {
    assetBillboards: true,
    sceneBillboards: true,
    vectorLayer: true,
    paperLayer: true,
    threeLayer: true,
  };

  return {
    flags,
    markAllDirty: () => {
      flags.assetBillboards = true;
      flags.sceneBillboards = true;
      flags.vectorLayer = true;
      flags.paperLayer = true;
      flags.threeLayer = true;
    },
    markAssetBillboardsDirty: () => {
      flags.assetBillboards = true;
      flags.vectorLayer = true;
      flags.paperLayer = true;
      flags.threeLayer = true;
    },
    markSceneBillboardsDirty: () => {
      flags.sceneBillboards = true;
      flags.vectorLayer = true;
      flags.paperLayer = true;
      flags.threeLayer = true;
    },
    markVectorDirty: () => {
      flags.vectorLayer = true;
    },
    markPaperDirty: () => {
      flags.paperLayer = true;
    },
    markThreeDirty: () => {
      flags.threeLayer = true;
    },
    clearFrameDirtyFlags: () => {
      flags.assetBillboards = false;
      flags.sceneBillboards = false;
      flags.vectorLayer = false;
      flags.paperLayer = false;
      flags.threeLayer = false;
    },
  };
}
