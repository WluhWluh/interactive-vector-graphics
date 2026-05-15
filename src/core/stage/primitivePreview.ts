import type { PrimitiveSvgAsset } from "../assets/primitiveAssetTypes";
import { primitiveAssetUsesStrokeStyle } from "../assets/primitiveAssetCapabilities";
import {
  evaluateViewMorphProfileToBezierPath,
} from "../assets/viewMorphProfile";
import { structuredBezierToPathD } from "../assets/structuredBezierPath";
import type { StageLayer, StageSize } from "./canvasStage";

export function drawStageGrid(layer: StageLayer, size: StageSize): void {
  const { context } = layer;
  const gridSize = 64;

  context.save();
  context.globalAlpha = 0.16;
  context.strokeStyle = "#eef4ff";
  context.lineWidth = 1;

  for (let x = 0; x <= size.cssWidth; x += gridSize) {
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, size.cssHeight);
    context.stroke();
  }

  for (let y = 0; y <= size.cssHeight; y += gridSize) {
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(size.cssWidth, y + 0.5);
    context.stroke();
  }

  context.restore();
}

export function drawCenteredStatus(
  context: CanvasRenderingContext2D,
  size: StageSize,
  message: string,
): void {
  context.save();
  context.fillStyle = "rgba(238, 244, 255, 0.82)";
  context.font = "600 16px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(message, size.cssWidth / 2, size.cssHeight / 2);
  context.restore();
}

export function drawPrimitivePreview(
  context: CanvasRenderingContext2D,
  size: StageSize,
  asset: PrimitiveSvgAsset,
): void {
  const drawAsset =
    asset.assetKind === "viewMorphProfile" ? createViewMorphPreviewAsset(asset) : asset;
  const centerX = size.cssWidth / 2;
  const centerY = size.cssHeight / 2;
  const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] = drawAsset.viewBox;
  const targetSize = Math.max(84, Math.min(size.cssWidth, size.cssHeight) * 0.16);
  const assetScale = targetSize / Math.max(viewBoxWidth, viewBoxHeight);

  context.save();
  context.translate(centerX, centerY);
  context.scale(assetScale, assetScale);
  context.translate(
    -(viewBoxX + viewBoxWidth / 2),
    -(viewBoxY + viewBoxHeight / 2),
  );
  if (primitiveAssetUsesStrokeStyle(drawAsset)) {
    context.strokeStyle = drawAsset.stroke;
    context.lineWidth = drawAsset.strokeWidth;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke(drawAsset.path);
  } else {
    context.fillStyle = drawAsset.fill;
    context.fill(drawAsset.path, drawAsset.fillRule);
  }
  context.restore();
}

function createViewMorphPreviewAsset(
  asset: Extract<PrimitiveSvgAsset, { assetKind: "viewMorphProfile" }>,
): PrimitiveSvgAsset {
  const bezierPath = evaluateViewMorphProfileToBezierPath(
    asset.viewMorphProfile,
    [0, 0, 1],
  );
  const pathD = structuredBezierToPathD(bezierPath);

  return {
    ...asset,
    bezierPath,
    pathD,
    path: new Path2D(pathD),
  };
}
