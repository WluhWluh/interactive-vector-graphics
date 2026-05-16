import type { PrimitiveSvgAsset } from "../../core/assets/primitiveAssetTypes";
import {
  getPrimitiveAssetListLabel,
  primitiveAssetUsesStrokeStyle,
} from "../../core/assets/primitiveAssetCapabilities";
import {
  structuredBezierToPathD,
  type StructuredBezierPath,
} from "../../core/assets/structuredBezierPath";
export { getPrimitiveGhostColor } from "./ghostColor";

export function createPrimitiveAssetPathPreview(
  asset: PrimitiveSvgAsset,
  bezierPath: StructuredBezierPath,
): PrimitiveSvgAsset {
  const pathD = buildPathEditPathD(bezierPath);

  return {
    ...asset,
    bezierPath,
    pathD,
    path: new Path2D(pathD),
  };
}

export function buildPathEditPathD(path: StructuredBezierPath): string {
  return path.segments.length > 0 ? structuredBezierToPathD(path) : "";
}

export function drawPrimitiveAssetPath(
  context: CanvasRenderingContext2D,
  asset: PrimitiveSvgAsset,
  colorOverride?: string,
): void {
  if (primitiveAssetUsesStrokeStyle(asset)) {
    context.strokeStyle = colorOverride ?? asset.stroke;
    context.lineWidth = asset.strokeWidth;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.setLineDash([]);
    context.stroke(asset.path);
    return;
  }

  context.fillStyle = colorOverride ?? asset.fill;
  context.fill(asset.path, asset.fillRule);
}

export function getAssetKindListLabel(asset: PrimitiveSvgAsset): string {
  return getPrimitiveAssetListLabel(asset);
}
