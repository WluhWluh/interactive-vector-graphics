import { Matrix4 } from "three";
import type { Camera } from "three";
import type { PrimitiveSvgAsset } from "../../core/assets/primitiveAssetTypes";
import { primitiveAssetHas3DSourcePath } from "../../core/assets/primitiveAssetCapabilities";
import {
  drawProjectedCurveCommands,
  projectBezierPath3DToCommands,
  type ProjectedCurveCommand,
} from "../../core/assets/projectedBezier3d";
import type { BezierPoint, StructuredBezierPath } from "../../core/assets/structuredBezierPath";
import type { StageSize } from "../../core/stage/canvasStage";
import {
  createPrimitiveAssetPathPreview,
  drawPrimitiveAssetPath,
  getPrimitiveGhostColor,
} from "./primitiveAssetDrawing";
import { drawViewMorphBillboardPath } from "./viewMorphBillboardRenderer";
import { transformToMatrix, type TransformSnapshot } from "../tools/prefabTransform";

export type DrawableBillboard = {
  id: string;
  asset: PrimitiveSvgAsset;
  transform: TransformSnapshot;
  selected: boolean;
  opacity?: number;
  ghost?: boolean;
  pathOverride?: StructuredBezierPath;
};

type ProjectedBillboard = DrawableBillboard & {
  projected: { x: number; y: number; depth: number };
  screenScale: number;
};

export type BillboardRendererContext = {
  camera: Camera;
  viewport: StageSize;
  projectWorldPosition: (
    position: [number, number, number],
  ) => { x: number; y: number; depth: number } | null;
  getDistanceScale: (position: [number, number, number], worldSize: number) => number;
  getAsset3DLocalToWorldUnitMatrix: (asset: PrimitiveSvgAsset) => Matrix4;
};

export function drawBillboards(
  context: CanvasRenderingContext2D,
  drawables: DrawableBillboard[],
  rendererContext: BillboardRendererContext,
): void {
  const sortedDrawables = drawables
    .map((drawable): ProjectedBillboard | null => {
      const worldPosition = drawable.transform.position;
      const projected = rendererContext.projectWorldPosition(worldPosition);

      if (!projected) {
        return null;
      }

      return {
        ...drawable,
        projected,
        screenScale: rendererContext.getDistanceScale(worldPosition, 1),
      };
    })
    .filter((entry): entry is ProjectedBillboard => entry !== null)
    .sort((a, b) => {
      const ghostOrder = Number(Boolean(a.ghost)) - Number(Boolean(b.ghost));

      return ghostOrder === 0 ? b.projected.depth - a.projected.depth : ghostOrder;
    });

  for (const drawable of sortedDrawables) {
    drawBillboardNode(context, drawable, rendererContext);
  }
}

function getBillboardWorldMatrix(
  drawable: DrawableBillboard,
  rendererContext: BillboardRendererContext,
): Matrix4 {
  return transformToMatrix(drawable.transform).multiply(
    rendererContext.getAsset3DLocalToWorldUnitMatrix(drawable.asset),
  );
}

function drawBillboardNode(
  context: CanvasRenderingContext2D,
  drawable: ProjectedBillboard,
  rendererContext: BillboardRendererContext,
): void {
  const { asset, ghost = false } = drawable;
  const drawAsset = drawable.pathOverride
    ? createPrimitiveAssetPathPreview(asset, drawable.pathOverride)
    : asset;
  const ghostColor = ghost ? getPrimitiveGhostColor(asset) : null;

  if (primitiveAssetHas3DSourcePath(asset)) {
    drawBezierCurve3DBillboard(
      context,
      drawable,
      asset,
      rendererContext,
      ghostColor ?? undefined,
    );
    return;
  }

  if (asset.assetKind === "viewMorphProfile") {
    context.save();
    context.globalAlpha *= drawable.opacity ?? 1;
    drawViewMorphBillboardPath(context, {
      profile: asset.viewMorphProfile,
      camera: rendererContext.camera,
      origin: drawable.transform.position,
      projectWorldPosition: rendererContext.projectWorldPosition,
      fillStyle: ghostColor ?? asset.fill,
      fillRule: asset.fillRule,
      rotationRad: drawable.transform.rotation[2],
      scale: [drawable.transform.scale[0], drawable.transform.scale[1]],
      localToWorldMatrix: transformToMatrix(drawable.transform),
    });
    context.restore();

    if (drawable.selected || drawable.ghost) {
      drawViewMorphBillboardSelectionBounds(
        context,
        drawable,
        ghostColor ?? undefined,
      );
    }
    return;
  }

  drawFlatBillboardPath(context, drawable, drawAsset, ghostColor ?? undefined);
}

function drawFlatBillboardPath(
  context: CanvasRenderingContext2D,
  drawable: ProjectedBillboard,
  drawAsset: PrimitiveSvgAsset,
  colorOverride?: string,
): void {
  const {
    asset,
    transform,
    projected,
    screenScale,
    selected,
    opacity = 1,
    ghost = false,
  } = drawable;
  const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] = asset.viewBox;
  const largestDimension = Math.max(viewBoxWidth, viewBoxHeight);
  const assetScale = screenScale / largestDimension;

  context.save();
  context.globalAlpha *= opacity;
  context.translate(projected.x, projected.y);
  context.rotate(transform.rotation[2]);
  context.scale(assetScale * transform.scale[0], assetScale * transform.scale[1]);
  context.translate(
    -(viewBoxX + viewBoxWidth / 2),
    -(viewBoxY + viewBoxHeight / 2),
  );
  drawPrimitiveAssetPath(context, drawAsset, colorOverride);

  if (selected || ghost) {
    context.lineWidth = 3 / Math.max(assetScale, 0.001);
    context.strokeStyle = colorOverride ?? "#ffcf4a";
    context.setLineDash(ghost ? [8 / Math.max(assetScale, 0.001)] : []);
    context.strokeRect(viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight);
  }

  context.restore();
}

function drawViewMorphBillboardSelectionBounds(
  context: CanvasRenderingContext2D,
  drawable: ProjectedBillboard,
  colorOverride?: string,
): void {
  const { selected, ghost = false } = drawable;
  const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] = drawable.asset.viewBox;
  const largestDimension = Math.max(viewBoxWidth, viewBoxHeight);
  const assetScale = drawable.screenScale / largestDimension;

  context.save();
  context.translate(drawable.projected.x, drawable.projected.y);
  context.rotate(drawable.transform.rotation[2]);
  context.scale(assetScale * drawable.transform.scale[0], assetScale * drawable.transform.scale[1]);
  context.translate(
    -(viewBoxX + viewBoxWidth / 2),
    -(viewBoxY + viewBoxHeight / 2),
  );
  context.lineWidth = 3 / Math.max(assetScale, 0.001);
  context.strokeStyle = colorOverride ?? "#ffcf4a";
  context.setLineDash(ghost ? [8 / Math.max(assetScale, 0.001)] : []);

  if (selected || ghost) {
    context.strokeRect(viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight);
  }

  context.restore();
}

function drawBezierCurve3DBillboard(
  context: CanvasRenderingContext2D,
  drawable: ProjectedBillboard,
  asset: Extract<PrimitiveSvgAsset, { assetKind: "bezierCurve3d" }>,
  rendererContext: BillboardRendererContext,
  colorOverride?: string,
): void {
  const commands = projectBezierPath3DToCommands(asset.bezierPath3d, {
    camera: rendererContext.camera,
    viewport: rendererContext.viewport,
    worldMatrix: getBillboardWorldMatrix(drawable, rendererContext),
  });

  if (commands.length === 0) {
    return;
  }

  context.save();
  context.globalAlpha *= drawable.opacity ?? 1;
  context.strokeStyle = colorOverride ?? asset.stroke;
  context.lineWidth = asset.strokeWidth;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.setLineDash([]);
  context.beginPath();
  drawProjectedCurveCommands(context, commands);
  context.stroke();
  context.restore();

  if (drawable.selected || drawable.ghost) {
    context.save();
    context.strokeStyle = colorOverride ?? "#ffcf4a";
    context.lineWidth = 2;
    context.setLineDash(drawable.ghost ? [8] : []);
    strokeProjectedCommandBounds(context, commands);
    context.restore();
  }
}

export function strokeProjectedCommandBounds(
  context: CanvasRenderingContext2D,
  commands: ProjectedCurveCommand[],
): void {
  const points = getProjectedCommandPoints(commands);

  if (points.length === 0) {
    return;
  }

  const bounds = points.reduce(
    (accumulator, point) => ({
      minX: Math.min(accumulator.minX, point[0]),
      minY: Math.min(accumulator.minY, point[1]),
      maxX: Math.max(accumulator.maxX, point[0]),
      maxY: Math.max(accumulator.maxY, point[1]),
    }),
    {
      minX: points[0]?.[0] ?? 0,
      minY: points[0]?.[1] ?? 0,
      maxX: points[0]?.[0] ?? 0,
      maxY: points[0]?.[1] ?? 0,
    },
  );

  context.strokeRect(
    bounds.minX - 8,
    bounds.minY - 8,
    bounds.maxX - bounds.minX + 16,
    bounds.maxY - bounds.minY + 16,
  );
}

function getProjectedCommandPoints(
  commands: ProjectedCurveCommand[],
): BezierPoint[] {
  return commands.flatMap((command) => {
    if (command.kind === "bezierCurveTo") {
      return [command.cp1, command.cp2, command.point];
    }

    return [command.point];
  });
}
