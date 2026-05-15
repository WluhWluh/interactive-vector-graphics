import type { Vector3Tuple } from "../threeEditorViewport";

export type ViewportInteractionBindings = {
  paperCanvas: HTMLCanvasElement;
  threeOverlayCanvas: HTMLCanvasElement;
  setViewportCallbacks: (callbacks: {
    onSelectionChange: (nodeId: string | null) => void;
    onObjectTransform: (nodeId: string) => void;
    onCurve3DControlSelection: (controlId: string | null) => void;
    onCurve3DControlTransform: (controlId: string, position: Vector3Tuple) => void;
    onCameraChange: () => void;
  }) => void;
  selectPathEditControl: (event: PointerEvent | MouseEvent) => void;
  updatePathEditHover: (event: PointerEvent | MouseEvent) => void;
  clearPathEditHover: () => void;
  selectInPlacePathEditControl: (event: PointerEvent | MouseEvent) => boolean;
  onInPlacePathEditCanvasPointerDown: (capturedPathControl: boolean) => void;
  updateInPlacePathEditHover: (event: PointerEvent | MouseEvent) => void;
  clearInPlacePathEditHover: () => void;
  dragSelectedTimelineKeyframe: (event: PointerEvent) => void;
  dragPathEditControl: (event: PointerEvent | MouseEvent) => void;
  dragInPlacePathEditControl: (event: PointerEvent | MouseEvent) => void;
  clearPointerDragState: () => void;
  clearMouseDragState: () => void;
  onSelectionChange: (nodeId: string | null) => void;
  onObjectTransform: (nodeId: string) => void;
  onCurve3DControlSelection: (controlId: string | null) => void;
  onCurve3DControlTransform: (controlId: string, position: Vector3Tuple) => void;
  onCameraChange: () => void;
};

export function bindViewportInteractions(
  bindings: ViewportInteractionBindings,
): void {
  const { paperCanvas, threeOverlayCanvas } = bindings;

  paperCanvas.addEventListener("pointerdown", (event) => {
    bindings.selectPathEditControl(event);
  });
  paperCanvas.addEventListener("mousemove", (event) => {
    bindings.updatePathEditHover(event);
  });
  paperCanvas.addEventListener("mouseleave", () => {
    bindings.clearPathEditHover();
  });

  threeOverlayCanvas.addEventListener(
    "pointerdown",
    (event) => {
      const capturedPathControl = bindings.selectInPlacePathEditControl(event);
      bindings.onInPlacePathEditCanvasPointerDown(capturedPathControl);
    },
    { capture: true },
  );
  threeOverlayCanvas.addEventListener("mousemove", (event) => {
    bindings.updateInPlacePathEditHover(event);
  });
  threeOverlayCanvas.addEventListener("pointermove", (event) => {
    bindings.updateInPlacePathEditHover(event);
  });
  threeOverlayCanvas.addEventListener("mouseleave", () => {
    bindings.clearInPlacePathEditHover();
  });

  window.addEventListener("pointerdown", (event) => {
    if (event.target !== paperCanvas) {
      bindings.selectPathEditControl(event);
    }
  });
  window.addEventListener("mousedown", (event) => {
    if (event.target !== paperCanvas) {
      bindings.selectPathEditControl(event);
    }
  });
  window.addEventListener("pointermove", (event) => {
    bindings.dragSelectedTimelineKeyframe(event);
    bindings.dragPathEditControl(event);
    bindings.dragInPlacePathEditControl(event);
  });
  window.addEventListener("mousemove", (event) => {
    bindings.dragPathEditControl(event);
    bindings.dragInPlacePathEditControl(event);
  });
  window.addEventListener("pointerup", () => {
    bindings.clearPointerDragState();
  });
  window.addEventListener("mouseup", () => {
    bindings.clearMouseDragState();
  });

  bindings.setViewportCallbacks({
    onSelectionChange: bindings.onSelectionChange,
    onObjectTransform: bindings.onObjectTransform,
    onCurve3DControlSelection: bindings.onCurve3DControlSelection,
    onCurve3DControlTransform: bindings.onCurve3DControlTransform,
    onCameraChange: bindings.onCameraChange,
  });
}
