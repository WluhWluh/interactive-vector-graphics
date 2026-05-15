import type { StructuredBezierPath } from "./structuredBezierPath";
import type { StructuredBezierPath3D } from "./structuredBezierPath3d";
import type { ViewMorphProfile } from "./viewMorphProfile";

export type PrimitiveFillRule = "nonzero" | "evenodd";
export type PrimitiveAssetKind =
  | "filledPath"
  | "strokePath"
  | "bezierCurve3d"
  | "viewMorphProfile";

export type PrimitiveAssetManifestEntry = {
  id: string;
  name: string;
  url: string;
};

export type PrimitiveAssetManifest = {
  version: 1;
  assets: PrimitiveAssetManifestEntry[];
};

export type PrimitiveSvgAssetBase = {
  id: string;
  name: string;
  sourceUrl: string;
  viewBox: [number, number, number, number];
  pathD: string;
  path: Path2D;
  bezierPath: StructuredBezierPath;
};

export type FilledPrimitiveSvgAsset = PrimitiveSvgAssetBase & {
  assetKind: "filledPath";
  fill: string;
  fillRule: PrimitiveFillRule;
};

export type StrokePrimitiveSvgAsset = PrimitiveSvgAssetBase & {
  assetKind: "strokePath";
  stroke: string;
  strokeWidth: number;
};

export type BezierCurve3DPrimitiveSvgAsset = PrimitiveSvgAssetBase & {
  assetKind: "bezierCurve3d";
  stroke: string;
  strokeWidth: number;
  bezierPath3d: StructuredBezierPath3D;
};

export type ViewMorphProfilePrimitiveSvgAsset = PrimitiveSvgAssetBase & {
  assetKind: "viewMorphProfile";
  fill: string;
  fillRule: PrimitiveFillRule;
  viewMorphProfile: ViewMorphProfile;
};

export type PrimitiveSvgAsset =
  | FilledPrimitiveSvgAsset
  | StrokePrimitiveSvgAsset
  | BezierCurve3DPrimitiveSvgAsset
  | ViewMorphProfilePrimitiveSvgAsset;

export type SvgImportContext = {
  id: string;
  name: string;
  sourceUrl: string;
};

export type StoredPrimitiveAssetLike = {
  id: string;
  assetKind: PrimitiveAssetKind;
  name: string;
  sourcePath: string;
  viewBox: [number, number, number, number];
  pathD: string;
  fill: string;
  fillRule: PrimitiveFillRule;
  stroke: string | null;
  strokeWidth: number | null;
  bezierPath: StructuredBezierPath;
  bezierPath3d: StructuredBezierPath3D | null;
  viewMorphProfile: ViewMorphProfile | null;
};
