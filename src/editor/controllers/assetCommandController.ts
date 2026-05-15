import type { PrimitiveSvgAsset } from "../../core/assets/primitiveSvg";

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
