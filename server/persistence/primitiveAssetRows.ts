import type { StoredPrimitiveAsset } from "../types";
import {
  parsePathDToStructuredBezier,
  validateStructuredBezierPath,
  type StructuredBezierPath,
} from "../../src/core/assets/structuredBezierPath";
import {
  validateStructuredBezierPath3D,
  type StructuredBezierPath3D,
} from "../../src/core/assets/structuredBezierPath3d";

export type StoredPrimitiveAssetRow = Omit<
  StoredPrimitiveAsset,
  "viewBox" | "bezierPath" | "bezierPath3d"
> & {
  viewBox: string;
  bezierPath: string | null;
  bezierPath3d: string | null;
};

export function hydratePrimitiveAssetRow(
  row: StoredPrimitiveAssetRow,
): StoredPrimitiveAsset {
  const assetKind =
    row.assetKind === "bezierCurve3d"
      ? "bezierCurve3d"
      : row.assetKind === "strokePath"
        ? "strokePath"
        : "filledPath";
  const expectedClosed = assetKind === "filledPath";
  const bezierPath3d =
    assetKind === "bezierCurve3d"
      ? readStoredBezierPath3D(row.bezierPath3d)
      : null;

  return {
    ...row,
    assetKind,
    viewBox: JSON.parse(row.viewBox) as [number, number, number, number],
    fillRule: row.fillRule === "evenodd" ? "evenodd" : "nonzero",
    stroke:
      assetKind === "strokePath" || assetKind === "bezierCurve3d"
        ? row.stroke
        : null,
    strokeWidth:
      (assetKind === "strokePath" || assetKind === "bezierCurve3d") &&
      typeof row.strokeWidth === "number"
        ? row.strokeWidth
        : null,
    bezierPath: readStoredBezierPath(row.bezierPath, row.pathD, expectedClosed),
    bezierPath3d,
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
