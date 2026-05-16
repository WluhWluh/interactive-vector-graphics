import { Vector2, Vector3 } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import {
  eulerToTuple,
  largestAbsoluteScaleRatio,
  vectorToTuple,
  type Vector3Tuple,
} from "./viewportMath";
import type { Curve3DControlProxy, NodeProxy } from "./viewportObjects";
import type { TransformMode } from "../threeEditorViewport";

export type TransformControlsController = {
  readonly scaleDragStart: Vector3;
  bindKeyboardModifiers: () => void;
  bindTransformEvents: () => void;
  bindPointerGuards: () => void;
  setVisible: (visible: boolean) => void;
  attachCurrentTarget: () => void;
  getPointer: (event: PointerEvent) => PointerEvent;
  applyShiftUniformScale: () => void;
};

export function createTransformControlsController(input: {
  overlayCanvas: HTMLCanvasElement;
  orbitControls: OrbitControls;
  transformControls: TransformControls;
  proxies: Map<string, NodeProxy>;
  curve3DControls: Map<string, Curve3DControlProxy>;
  getTransformMode: () => TransformMode;
  getSelectedNodeId: () => string | null;
  setSelectedNodeId: (nodeId: string | null) => void;
  getSelectedCurve3DControlId: () => string | null;
  setSelectedCurve3DControlId: (controlId: string | null) => void;
  getTransformControlsVisible: () => boolean;
  setTransformControlsVisibleFlag: (visible: boolean) => void;
  setOrbitInteractionActive: (active: boolean) => void;
  getOrbitDisabledForTransformPointer: () => boolean;
  setOrbitDisabledForTransformPointer: (disabled: boolean) => void;
  onObjectTransform: (nodeId: string) => void;
  onCurve3DControlTransform: (controlId: string, position: Vector3Tuple) => void;
}): TransformControlsController {
  const scaleDragStart = new Vector3(1, 1, 1);
  let shiftKeyPressed = false;

  function bindKeyboardModifiers(): void {
    window.addEventListener("keydown", (event) => {
      if (event.key === "Shift") {
        shiftKeyPressed = true;
      }
    });
    window.addEventListener("keyup", (event) => {
      if (event.key === "Shift") {
        shiftKeyPressed = false;
      }
    });
  }

  function bindTransformEvents(): void {
    input.transformControls.addEventListener("dragging-changed", (event) => {
      const isTransformDragging = Boolean(event.value);
      input.setOrbitInteractionActive(false);
      input.orbitControls.enabled = !isTransformDragging;
    });
    input.transformControls.addEventListener("mouseDown", () => {
      const selectedNodeId = input.getSelectedNodeId();
      const proxy = selectedNodeId ? input.proxies.get(selectedNodeId) : null;

      if (proxy) {
        scaleDragStart.copy(proxy.root.scale);
      }
    });
    input.transformControls.addEventListener("objectChange", () => {
      const selectedCurveControlId = input.getSelectedCurve3DControlId();
      if (selectedCurveControlId) {
        const proxy = input.curve3DControls.get(selectedCurveControlId);

        if (proxy) {
          proxy.root.updateMatrixWorld();
          input.onCurve3DControlTransform(
            selectedCurveControlId,
            vectorToTuple(proxy.root.position),
          );
        }
        return;
      }

      const selectedNodeId = input.getSelectedNodeId();
      if (selectedNodeId) {
        applyShiftUniformScale();
        input.onObjectTransform(selectedNodeId);
      }
    });
  }

  function bindPointerGuards(): void {
    input.overlayCanvas.addEventListener(
      "pointerdown",
      (event) => {
        if (!input.getTransformControlsVisible() || event.button !== 0) {
          return;
        }

        input.transformControls.pointerHover(getPointer(event));

        if (input.transformControls.axis !== null) {
          input.setOrbitDisabledForTransformPointer(true);
          input.orbitControls.enabled = false;
        }
      },
      { capture: true },
    );
    input.overlayCanvas.addEventListener("pointerup", () => {
      if (
        input.getOrbitDisabledForTransformPointer() &&
        !input.transformControls.dragging
      ) {
        input.orbitControls.enabled = true;
      }

      input.setOrbitDisabledForTransformPointer(false);
    });
    input.overlayCanvas.addEventListener("pointercancel", () => {
      if (
        input.getOrbitDisabledForTransformPointer() &&
        !input.transformControls.dragging
      ) {
        input.orbitControls.enabled = true;
      }

      input.setOrbitDisabledForTransformPointer(false);
    });
  }

  function setVisible(visible: boolean): void {
    if (visible === input.getTransformControlsVisible()) {
      return;
    }

    input.setTransformControlsVisibleFlag(visible);
    input.transformControls.enabled = visible;

    if (visible) {
      attachCurrentTarget();
    } else {
      input.transformControls.detach();
    }
  }

  function attachCurrentTarget(): void {
    if (!input.getTransformControlsVisible()) {
      input.transformControls.detach();
      return;
    }

    const curveControlId = input.getSelectedCurve3DControlId();
    const curveProxy = curveControlId
      ? input.curve3DControls.get(curveControlId)
      : null;

    if (curveProxy) {
      input.transformControls.attach(curveProxy.root);
      return;
    }

    const selectedNodeId = input.getSelectedNodeId();
    const nodeProxy = selectedNodeId ? input.proxies.get(selectedNodeId) : null;

    if (nodeProxy) {
      input.transformControls.attach(nodeProxy.root);
      return;
    }

    input.transformControls.detach();
  }

  function applyShiftUniformScale(): void {
    const selectedNodeId = input.getSelectedNodeId();
    if (
      input.getTransformMode() !== "scale" ||
      !shiftKeyPressed ||
      !selectedNodeId
    ) {
      return;
    }

    const proxy = input.proxies.get(selectedNodeId);

    if (!proxy) {
      return;
    }

    const scaleRatio = largestAbsoluteScaleRatio(proxy.root.scale, scaleDragStart);

    proxy.root.scale.set(
      scaleDragStart.x * scaleRatio,
      scaleDragStart.y * scaleRatio,
      scaleDragStart.z * scaleRatio,
    );
    proxy.root.updateMatrixWorld();
  }

  function getPointer(event: PointerEvent): PointerEvent {
    const rect = input.overlayCanvas.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
      button: event.button,
    } as unknown as PointerEvent;
  }

  return {
    scaleDragStart,
    bindKeyboardModifiers,
    bindTransformEvents,
    bindPointerGuards,
    setVisible,
    attachCurrentTarget,
    getPointer,
    applyShiftUniformScale,
  };
}

export function readNodeProxyTransform(proxy: NodeProxy): {
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
} {
  return {
    position: vectorToTuple(proxy.root.position),
    rotation: eulerToTuple(proxy.root.rotation),
    scale: vectorToTuple(proxy.root.scale),
  };
}

export function didPointerMoveBeyondClickThreshold(input: {
  pointerDownPosition: Vector2;
  event: PointerEvent;
  thresholdPx?: number;
}): boolean {
  const moved = input.pointerDownPosition.distanceTo(
    new Vector2(input.event.clientX, input.event.clientY),
  );

  return moved > (input.thresholdPx ?? 4);
}
