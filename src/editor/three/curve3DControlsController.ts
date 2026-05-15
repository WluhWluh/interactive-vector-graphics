import {
  BufferGeometry,
  LineBasicMaterial,
  LineSegments,
  type Scene,
} from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import {
  tupleToVector,
} from "./viewportMath";
import {
  createCurve3DControlProxy,
  disposeObject,
  updateCurve3DControlMaterial,
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
  let curve3DHandleLines: LineSegments | null = null;

  function setControls(
    controls: Curve3DControlDescriptor[],
    handleLines: Curve3DHandleLineDescriptor[],
  ): void {
    const nextIds = new Set(controls.map((control) => control.id));

    for (const [controlId, proxy] of [...input.curve3DControls]) {
      if (nextIds.has(controlId)) {
        continue;
      }

      input.overlayScene.remove(proxy.mesh);
      disposeObject(proxy.mesh);
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
      proxy.mesh.position.fromArray(control.position);
      proxy.mesh.userData.curveControlId = control.id;
      proxy.mesh.userData.segmentId = control.segmentId;
      proxy.mesh.userData.component = control.component;
      updateCurve3DControlMaterial(proxy, control.selected);

      if (!existing) {
        input.curve3DControls.set(control.id, proxy);
        input.overlayScene.add(proxy.mesh);
      }
    }

    setHandleLines(handleLines);

    const selectedCurveControlId = input.getSelectedCurve3DControlId();
    if (selectedCurveControlId && !input.curve3DControls.has(selectedCurveControlId)) {
      input.setSelectedCurve3DControlId(null);
    } else if (selectedCurveControlId && input.getTransformControlsVisible()) {
      const proxy = input.curve3DControls.get(selectedCurveControlId);

      if (proxy) {
        input.transformControls.attach(proxy.mesh);
      }
    }
  }

  function clear(): void {
    input.setSelectedCurve3DControlId(null);

    for (const proxy of input.curve3DControls.values()) {
      input.overlayScene.remove(proxy.mesh);
      disposeObject(proxy.mesh);
    }

    input.curve3DControls.clear();
    setHandleLines([]);
    input.attachCurrentTransformTarget();
  }

  function setHandleLines(lines: Curve3DHandleLineDescriptor[]): void {
    if (curve3DHandleLines) {
      input.overlayScene.remove(curve3DHandleLines);
      disposeObject(curve3DHandleLines);
      curve3DHandleLines = null;
    }

    if (lines.length === 0) {
      return;
    }

    const points = lines.flatMap((line) => [
      tupleToVector(line.start),
      tupleToVector(line.end),
    ]);
    const geometry = new BufferGeometry().setFromPoints(points);
    const material = new LineBasicMaterial({
      color: 0xeef4ff,
      transparent: true,
      opacity: 0.58,
      depthTest: false,
    });

    curve3DHandleLines = new LineSegments(geometry, material);
    curve3DHandleLines.renderOrder = 14;
    input.overlayScene.add(curve3DHandleLines);
  }

  return {
    setControls,
    clear,
    setHandleLines,
  };
}
