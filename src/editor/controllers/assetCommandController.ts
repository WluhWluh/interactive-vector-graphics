import type { PrimitiveSvgAsset } from "../../core/assets/primitiveSvg";
import type {
  SourcePathEditSession,
} from "./pathEditController";
import type { SourcePathEdit3DSession } from "../tools/pathEdit3dCore";

export type AssetSelectionState = {
  assets: PrimitiveSvgAsset[];
  selectedAssetId: string | null;
};

export function applyImportedAsset(
  state: AssetSelectionState,
  asset: PrimitiveSvgAsset,
): AssetSelectionState {
  return {
    assets: replaceAssetByIdOrAppend(state.assets, asset),
    selectedAssetId: asset.id,
  };
}

export function applyUpdatedAsset(
  state: AssetSelectionState,
  updatedAsset: PrimitiveSvgAsset,
): AssetSelectionState {
  return {
    assets: replaceAssetByIdOrAppend(state.assets, updatedAsset),
    selectedAssetId: updatedAsset.id,
  };
}

export function applyDeletedAsset(
  state: AssetSelectionState,
  deletedAssetId: string,
): AssetSelectionState {
  return {
    assets: state.assets.filter((asset) => asset.id !== deletedAssetId),
    selectedAssetId:
      state.selectedAssetId === deletedAssetId ? null : state.selectedAssetId,
  };
}

export function canConvertAssetTo3DCurve(
  asset: PrimitiveSvgAsset | null,
): boolean {
  return asset?.assetKind === "strokePath";
}

export async function runSaveSourcePathEditCommand(input: {
  projectId: string;
  pathEditSession: SourcePathEditSession | null;
  pathEdit3DSession: SourcePathEdit3DSession | null;
  updateAssetPath: (
    projectId: string,
    assetId: string,
    draft: SourcePathEditSession["draft"],
  ) => Promise<PrimitiveSvgAsset>;
  updateAssetCurve3D: (
    projectId: string,
    assetId: string,
    draft: SourcePathEdit3DSession["draft"],
  ) => Promise<PrimitiveSvgAsset>;
}): Promise<PrimitiveSvgAsset | null> {
  if (input.pathEdit3DSession) {
    return input.updateAssetCurve3D(
      input.projectId,
      input.pathEdit3DSession.assetId,
      input.pathEdit3DSession.draft,
    );
  }

  if (input.pathEditSession) {
    return input.updateAssetPath(
      input.projectId,
      input.pathEditSession.assetId,
      input.pathEditSession.draft,
    );
  }

  return null;
}

export async function runConvertAssetTo3DCurveCommand(input: {
  projectId: string;
  assetId: string;
  asset: PrimitiveSvgAsset | null;
  convertAssetTo3DCurve: (
    projectId: string,
    assetId: string,
  ) => Promise<PrimitiveSvgAsset>;
}): Promise<PrimitiveSvgAsset> {
  if (!canConvertAssetTo3DCurve(input.asset)) {
    throw new Error("Only strokePath assets can be converted to 3D curves.");
  }

  return input.convertAssetTo3DCurve(input.projectId, input.assetId);
}

export async function runImportPrimitiveAssetCommand(input: {
  projectId: string;
  file: File;
  uploadAsset: (projectId: string, file: File) => Promise<PrimitiveSvgAsset>;
}): Promise<PrimitiveSvgAsset> {
  return input.uploadAsset(input.projectId, input.file);
}

export async function runDeleteAssetCommand(input: {
  projectId: string;
  assetId: string;
  deleteAsset: (projectId: string, assetId: string) => Promise<void>;
}): Promise<string> {
  await input.deleteAsset(input.projectId, input.assetId);

  return input.assetId;
}

function replaceAssetByIdOrAppend(
  assets: PrimitiveSvgAsset[],
  nextAsset: PrimitiveSvgAsset,
): PrimitiveSvgAsset[] {
  const existingIndex = assets.findIndex((asset) => asset.id === nextAsset.id);

  if (existingIndex < 0) {
    return [...assets, nextAsset];
  }

  return assets.map((asset, index) =>
    index === existingIndex ? nextAsset : asset,
  );
}
