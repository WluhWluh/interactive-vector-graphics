import type { PrimitiveSvgAsset } from "../../core/assets/primitiveAssetTypes";
import {
  addBezierPoints,
  getPathEditControls,
  type PathEditComponent,
  type PathEditDragState,
  type PathEditSession,
  type PathEditViewportAdapter,
} from "../tools/pathEditCore";
import { drawPrimitiveAssetPath } from "./primitiveAssetDrawing";

export type SourcePathEditViewTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export function drawPathEditControls(
  context: CanvasRenderingContext2D,
  session: PathEditSession,
  adapter: PathEditViewportAdapter,
  hoveredControl: PathEditDragState | null = null,
): void {
  const controls = getPathEditControls(session.draft);

  context.save();
  context.font = "600 12px system-ui, sans-serif";

  for (const segment of session.draft.segments) {
    const anchor = adapter.pathToScreen(segment.anchor);
    const handleIn = adapter.pathToScreen(
      addBezierPoints(segment.anchor, segment.handleIn),
    );
    const handleOut = adapter.pathToScreen(
      addBezierPoints(segment.anchor, segment.handleOut),
    );

    if (!anchor || !handleIn || !handleOut) {
      continue;
    }

    drawPathEditHandleLine(context, anchor, handleIn);
    drawPathEditHandleLine(context, anchor, handleOut);
  }

  for (const control of controls) {
    const screenPoint = adapter.pathToScreen(control.point);

    if (!screenPoint) {
      continue;
    }

    const selected =
      session.selected?.segmentId === control.segmentId &&
      session.selected.component === control.component;
    const hovered =
      hoveredControl?.segmentId === control.segmentId &&
      hoveredControl.component === control.component;

    drawPathEditControlPoint(
      context,
      screenPoint,
      control.component,
      selected,
      hovered,
    );
  }

  context.restore();
}

export function drawPathEditPreview(
  context: CanvasRenderingContext2D,
  asset: PrimitiveSvgAsset,
  transform: SourcePathEditViewTransform,
): void {
  context.save();
  context.translate(transform.offsetX, transform.offsetY);
  context.scale(transform.scale, transform.scale);
  drawPrimitiveAssetPath(context, asset);
  context.restore();
}

function drawPathEditHandleLine(
  context: CanvasRenderingContext2D,
  anchor: [number, number],
  handle: [number, number],
): void {
  context.save();
  context.strokeStyle = "rgba(238, 244, 255, 0.44)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(anchor[0], anchor[1]);
  context.lineTo(handle[0], handle[1]);
  context.stroke();
  context.restore();
}

function drawPathEditControlPoint(
  context: CanvasRenderingContext2D,
  point: [number, number],
  component: PathEditComponent,
  selected: boolean,
  hovered: boolean,
): void {
  context.save();
  context.fillStyle = selected ? "#ffcf4a" : "#5bc4bf";
  context.strokeStyle = hovered ? "#ffffff" : "rgba(17, 24, 39, 0.86)";
  context.lineWidth = hovered ? 3 : 2;

  if (component === "anchor") {
    context.beginPath();
    context.arc(point[0], point[1], selected || hovered ? 6 : 5, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  } else {
    const size = selected || hovered ? 10 : 8;
    context.fillRect(point[0] - size / 2, point[1] - size / 2, size, size);
    context.strokeRect(point[0] - size / 2, point[1] - size / 2, size, size);
  }

  context.restore();
}
