import type { Scene } from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import {
  createCurve3DControlProxy,
  disposeObject,
  type Curve3DControlDescriptor,
  type Curve3DControlProxy,
  type Curve3DHandleLineDescriptor,
} from "./viewportObjects";

export type Curve3DControlsController = {
  setControls: (
    controls: Curve3DControlDescriptor[],
    handleLines: Curve3DHandleLineDescriptor[],
  ) => void;
  clear: () => void;
  setHandleLines: (lines: Curve3DHandleLineDescriptor[]) => void;
  refreshControlStyles: () => void;
};

export function createCurve3DControlsController(input: {
  overlayScene: Scene;
  transformControls: TransformControls;
  curve3DControls: Map<string, Curve3DControlProxy>;
  getSelectedCurve3DControlId: () => string | null;
  setSelectedCurve3DControlId: (controlId: string | null) => void;
  getTransformControlsVisible: () => boolean;
  attachCurrentTransformTarget: () => void;
}): Curve3DControlsController {

  function setControls(
    controls: Curve3DControlDescriptor[],
    handleLines: Curve3DHandleLineDescriptor[],
  ): void {
    const nextIds = new Set(controls.map((control) => control.id));

    for (const [controlId, proxy] of [...input.curve3DControls]) {
      if (nextIds.has(controlId)) {
        continue;
      }

      input.overlayScene.remove(proxy.root);
      disposeObject(proxy.root);
      input.curve3DControls.delete(controlId);

      if (input.getSelectedCurve3DControlId() === controlId) {
        input.setSelectedCurve3DControlId(null);
        input.transformControls.detach();
      }
    }

    for (const control of controls) {
      const existing = input.curve3DControls.get(control.id);
      const proxy = existing ?? createCurve3DControlProxy(control);

      proxy.segmentId = control.segmentId;
      proxy.component = control.component;
      proxy.root.position.fromArray(control.position);
      proxy.root.userData.curveControlId = control.id;
      proxy.root.userData.segmentId = control.segmentId;
      proxy.root.userData.component = control.component;

      if (!existing) {
        input.curve3DControls.set(control.id, proxy);
        input.overlayScene.add(proxy.root);
      }
    }

    setHandleLines(handleLines);

    const selectedCurveControlId = input.getSelectedCurve3DControlId();
    if (selectedCurveControlId && !input.curve3DControls.has(selectedCurveControlId)) {
      input.setSelectedCurve3DControlId(null);
    } else if (selectedCurveControlId && input.getTransformControlsVisible()) {
      const proxy = input.curve3DControls.get(selectedCurveControlId);

      if (proxy) {
        input.transformControls.attach(proxy.root);
      }
    }
  }

  function clear(): void {
    input.setSelectedCurve3DControlId(null);

    for (const proxy of input.curve3DControls.values()) {
      input.overlayScene.remove(proxy.root);
      disposeObject(proxy.root);
    }

    input.curve3DControls.clear();
    setHandleLines([]);
    input.attachCurrentTransformTarget();
  }

  function setHandleLines(lines: Curve3DHandleLineDescriptor[]): void {
    void lines;
  }

  function refreshControlStyles(): void {
    // Visual styles are drawn by the 2D paper overlay. The Three proxy roots
    // are intentionally invisible TransformControls targets.
  }

  return {
    setControls,
    clear,
    setHandleLines,
    refreshControlStyles,
  };
}
