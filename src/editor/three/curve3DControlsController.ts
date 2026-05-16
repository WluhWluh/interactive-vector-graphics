import {
  BufferGeometry,
  LineBasicMaterial,
  LineSegments,
  type Scene,
} from "three";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { getPathControlBaseScreenSizePx } from "../tools/pathControlStyle";
import { tupleToVector } from "./viewportMath";
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
  setHoveredControlId: (controlId: string | null) => void;
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
  let curve3DHandleLines: LineSegments | null = null;
  let hoveredCurveControlId: string | null = null;

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
      proxy.baseScreenSizePx = getPathControlBaseScreenSizePx(control.component);
      proxy.root.position.fromArray(control.position);
      proxy.root.userData.curveControlId = control.id;
      proxy.root.userData.segmentId = control.segmentId;
      proxy.root.userData.component = control.component;
      proxy.fillMesh.userData.curveControlId = control.id;
      proxy.fillMesh.userData.segmentId = control.segmentId;
      proxy.fillMesh.userData.component = control.component;
      proxy.outlineMesh.userData.curveControlId = control.id;
      proxy.outlineMesh.userData.segmentId = control.segmentId;
      proxy.outlineMesh.userData.component = control.component;
      updateCurve3DControlMaterial(proxy, {
        selected: control.selected,
        hovered: hoveredCurveControlId === control.id,
      });

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
    hoveredCurveControlId = null;

    for (const proxy of input.curve3DControls.values()) {
      input.overlayScene.remove(proxy.root);
      disposeObject(proxy.root);
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

  function setHoveredControlId(controlId: string | null): void {
    if (hoveredCurveControlId === controlId) {
      return;
    }

    const previousHoveredId = hoveredCurveControlId;
    hoveredCurveControlId = controlId;

    for (const id of [previousHoveredId, hoveredCurveControlId]) {
      if (!id) {
        continue;
      }

      const proxy = input.curve3DControls.get(id);

      if (!proxy) {
        continue;
      }

      updateCurve3DControlMaterial(proxy, {
        selected: input.getSelectedCurve3DControlId() === id,
        hovered: hoveredCurveControlId === id,
      });
    }
  }

  function refreshControlStyles(): void {
    for (const [id, proxy] of input.curve3DControls) {
      updateCurve3DControlMaterial(proxy, {
        selected: input.getSelectedCurve3DControlId() === id,
        hovered: hoveredCurveControlId === id,
      });
    }
  }

  return {
    setControls,
    clear,
    setHandleLines,
    setHoveredControlId,
    refreshControlStyles,
  };
}
