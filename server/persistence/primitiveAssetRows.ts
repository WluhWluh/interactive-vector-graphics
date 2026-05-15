import type { StoredPrimitiveAsset } from "../types";
import {
  getPrimitiveAssetCapabilities,
  primitiveAssetUsesStrokeStyle,
} from "../../src/core/assets/primitiveAssetCapabilities";
import {
  parsePathDToStructuredBezier,
  validateStructuredBezierPath,
  type StructuredBezierPath,
} from "../../src/core/assets/structuredBezierPath";
import {
  validateStructuredBezierPath3D,
  type StructuredBezierPath3D,
} from "../../src/core/assets/structuredBezierPath3d";
import {
  validateViewMorphProfile,
  type ViewMorphProfile,
} from "../../src/core/assets/viewMorphProfile";

export type StoredPrimitiveAssetRow = Omit<
  StoredPrimitiveAsset,
  "viewBox" | "bezierPath" | "bezierPath3d" | "viewMorphProfile"
> & {
  viewBox: string;
  bezierPath: string | null;
  bezierPath3d: string | null;
  viewMorphProfile: string | null;
};

export function hydratePrimitiveAssetRow(
  row: StoredPrimitiveAssetRow,
): StoredPrimitiveAsset {
  const assetKind =
    row.assetKind === "bezierCurve3d"
      ? "bezierCurve3d"
      : row.assetKind === "viewMorphProfile"
        ? "viewMorphProfile"
      : row.assetKind === "strokePath"
        ? "strokePath"
        : "filledPath";
  const capabilities = getPrimitiveAssetCapabilities(assetKind);
  const bezierPath3d = capabilities.has3DSourcePath
    ? readStoredBezierPath3D(row.bezierPath3d)
    : null;
  const viewMorphProfile =
    assetKind === "viewMorphProfile"
      ? readStoredViewMorphProfile(row.viewMorphProfile)
      : null;

  return {
    ...row,
    assetKind,
    viewBox: JSON.parse(row.viewBox) as [number, number, number, number],
    fillRule: row.fillRule === "evenodd" ? "evenodd" : "nonzero",
    stroke: primitiveAssetUsesStrokeStyle(assetKind) ? row.stroke : null,
    strokeWidth:
      primitiveAssetUsesStrokeStyle(assetKind) && typeof row.strokeWidth === "number"
        ? row.strokeWidth
        : null,
    bezierPath: readStoredBezierPath(
      row.bezierPath,
      row.pathD,
      capabilities.expectedStructuredPathClosed,
    ),
    bezierPath3d,
    viewMorphProfile,
  };
}

function readStoredBezierPath(
  value: string | null,
  pathD: string,
  expectedClosed: boolean,
): StructuredBezierPath {
  if (value) {
    return validateStructuredBezierPath(JSON.parse(value) as StructuredBezierPath, {
      expectedClosed,
    });
  }

  return parsePathDToStructuredBezier(pathD, { expectedClosed });
}

function readStoredBezierPath3D(value: string | null): StructuredBezierPath3D {
  if (!value) {
    throw new Error("3D curve asset is missing structured 3D Bezier data.");
  }

  return validateStructuredBezierPath3D(JSON.parse(value) as StructuredBezierPath3D);
}

function readStoredViewMorphProfile(value: string | null): ViewMorphProfile {
  if (!value) {
    throw new Error("View morph asset is missing profile data.");
  }

  return validateViewMorphProfile(JSON.parse(value) as ViewMorphProfile);
}
