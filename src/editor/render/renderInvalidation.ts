export type RenderDirtyFlags = {
  assetBillboards: boolean;
  sceneBillboards: boolean;
  vectorLayer: boolean;
  paperLayer: boolean;
  threeLayer: boolean;
  uiShell: boolean;
  camera: boolean;
  pose: boolean;
  timeline: boolean;
};

export type RenderInvalidation = {
  flags: RenderDirtyFlags;
  markAllDirty: () => void;
  markUiShellDirty: () => void;
  markCameraDirty: () => void;
  markPoseDirty: () => void;
  markTimelineDirty: () => void;
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
    uiShell: true,
    camera: true,
    pose: true,
    timeline: true,
  };

  return {
    flags,
    markAllDirty: () => {
      flags.assetBillboards = true;
      flags.sceneBillboards = true;
      flags.vectorLayer = true;
      flags.paperLayer = true;
      flags.threeLayer = true;
      flags.uiShell = true;
      flags.camera = true;
      flags.pose = true;
      flags.timeline = true;
    },
    markUiShellDirty: () => {
      flags.uiShell = true;
    },
    markCameraDirty: () => {
      flags.camera = true;
      flags.vectorLayer = true;
      flags.paperLayer = true;
      flags.threeLayer = true;
    },
    markPoseDirty: () => {
      flags.pose = true;
      flags.assetBillboards = true;
      flags.sceneBillboards = true;
      flags.vectorLayer = true;
      flags.paperLayer = true;
      flags.threeLayer = true;
    },
    markTimelineDirty: () => {
      flags.timeline = true;
      flags.pose = true;
      flags.assetBillboards = true;
      flags.vectorLayer = true;
      flags.paperLayer = true;
      flags.threeLayer = true;
    },
    markAssetBillboardsDirty: () => {
      flags.assetBillboards = true;
      flags.pose = true;
      flags.vectorLayer = true;
      flags.paperLayer = true;
      flags.threeLayer = true;
    },
    markSceneBillboardsDirty: () => {
      flags.sceneBillboards = true;
      flags.pose = true;
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
      flags.uiShell = false;
      flags.camera = false;
      flags.pose = false;
      flags.timeline = false;
    },
  };
}
