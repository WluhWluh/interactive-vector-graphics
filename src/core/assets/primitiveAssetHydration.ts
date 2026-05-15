import {
  cloneStructuredBezierPath,
} from "./structuredBezierPath";
import {
  cloneStructuredBezierPath3D,
} from "./structuredBezierPath3d";
import {
  cloneViewMorphProfile,
  createDefaultViewMorphProfile,
} from "./viewMorphProfile";
import type {
  PrimitiveSvgAsset,
  StoredPrimitiveAssetLike,
} from "./primitiveAssetTypes";

/**
 * Persisted assets are portable metadata plus path strings. Hydration is the
 * browser-only boundary that recreates Path2D and clones structured data before
 * editor/runtime rendering code receives the asset.
 */
export function hydratePrimitiveSvgAsset(
  asset: StoredPrimitiveAssetLike,
): PrimitiveSvgAsset {
  const baseAsset = {
    id: asset.id,
    name: asset.name,
    sourceUrl: asset.sourcePath,
    viewBox: asset.viewBox,
    pathD: asset.pathD,
    path: new Path2D(asset.pathD),
    bezierPath: cloneStructuredBezierPath(asset.bezierPath),
  };

  if (asset.assetKind === "strokePath") {
    return {
      ...baseAsset,
      assetKind: "strokePath",
      stroke: asset.stroke ?? "#000000",
      strokeWidth: asset.strokeWidth ?? 1,
    };
  }

  if (asset.assetKind === "bezierCurve3d") {
    return {
      ...baseAsset,
      assetKind: "bezierCurve3d",
      stroke: asset.stroke ?? "#000000",
      strokeWidth: asset.strokeWidth ?? 1,
      bezierPath3d: asset.bezierPath3d
        ? cloneStructuredBezierPath3D(asset.bezierPath3d)
        : {
            version: 1,
            closed: false,
            segments: [],
          },
    };
  }

  if (asset.assetKind === "viewMorphProfile") {
    return {
      ...baseAsset,
      assetKind: "viewMorphProfile",
      fill: asset.fill,
      fillRule: asset.fillRule,
      viewMorphProfile: asset.viewMorphProfile
        ? cloneViewMorphProfile(asset.viewMorphProfile)
        : createDefaultViewMorphProfile(),
    };
  }

  return {
    ...baseAsset,
    assetKind: "filledPath",
    fill: asset.fill,
    fillRule: asset.fillRule,
  };
}
