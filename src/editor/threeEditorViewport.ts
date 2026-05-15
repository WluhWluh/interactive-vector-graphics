import {
  AmbientLight,
  BufferGeometry,
  LineBasicMaterial,
  LineSegments,
  OrthographicCamera,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Camera,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { PrimitiveSvgAsset } from "../core/assets/primitiveSvg";
import type { StageSize } from "../core/stage/canvasStage";
import {
  eulerToTuple,
  largestAbsoluteScaleRatio,
  tupleToVector,
  vectorToTuple,
  type Vector3Tuple,
} from "./three/viewportMath";
import {
  applyNodeTransform,
  createAxesHelper,
  createCurve3DControlProxy,
  createGridHelper,
  createNodeProxy,
  createTransparentRenderer,
  disposeObject,
  updateCurve3DControlMaterial,
  type Curve3DControlDescriptor,
  type Curve3DControlProxy,
  type Curve3DHandleLineDescriptor,
  type NodeProxy,
} from "./three/viewportObjects";

export { eulerToTuple, tupleToVector, vectorToTuple } from "./three/viewportMath";
export type { Vector3Tuple } from "./three/viewportMath";
export type {
  Curve3DControlComponent,
  Curve3DControlDescriptor,
  Curve3DHandleLineDescriptor,
} from "./three/viewportObjects";

export type CameraProjection = "perspective" | "orthographic";
export type TransformMode = "translate" | "rotate" | "scale";
export type BillboardMode = "spherical";

export type EditorSceneNode = {
  id: string;
  assetId: string;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
  billboardMode: BillboardMode;
};

export type EditorTransformNode = {
  id: string;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
};

export type EditorViewportCameraSnapshot = {
  projection: CameraProjection;
  position: Vector3Tuple;
  target: Vector3Tuple;
  fov: number;
  zoom: number;
  near: number;
  far: number;
};

const DEFAULT_CAMERA_POSITION = new Vector3(4.5, 3.2, 5.2);
const DEFAULT_CAMERA_TARGET = new Vector3(0, 0.8, 0);
const PERSPECTIVE_FOV = 45;
const CAMERA_NEAR = 0.05;
const CAMERA_FAR = 120;
const ORTHOGRAPHIC_HALF_HEIGHT = 3.5;

export class ThreeEditorViewport {
  private readonly backgroundCanvas: HTMLCanvasElement;
  private readonly overlayCanvas: HTMLCanvasElement;
  private readonly backgroundRenderer: WebGLRenderer;
  private readonly overlayRenderer: WebGLRenderer;
  private readonly backgroundScene = new Scene();
  private readonly overlayScene = new Scene();
  private readonly perspectiveCamera = new PerspectiveCamera(
    PERSPECTIVE_FOV,
    1,
    CAMERA_NEAR,
    CAMERA_FAR,
  );
  private readonly orthographicCamera = new OrthographicCamera(
    -ORTHOGRAPHIC_HALF_HEIGHT,
    ORTHOGRAPHIC_HALF_HEIGHT,
    ORTHOGRAPHIC_HALF_HEIGHT,
    -ORTHOGRAPHIC_HALF_HEIGHT,
    CAMERA_NEAR,
    CAMERA_FAR,
  );
  private readonly orbitControls: OrbitControls;
  private readonly transformControls: TransformControls;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly proxies = new Map<string, NodeProxy>();
  private readonly curve3DControls = new Map<string, Curve3DControlProxy>();
  private readonly pointerDownPosition = new Vector2();
  private readonly scaleDragStart = new Vector3(1, 1, 1);
  private curve3DHandleLines: LineSegments | null = null;
  private shiftKeyPressed = false;
  private transformControlsVisible = true;
  private orbitDisabledForTransformPointer = false;
  private orbitInteractionActive = false;
  private projection: CameraProjection = "perspective";
  private transformMode: TransformMode = "translate";
  private selectedNodeId: string | null = null;
  private selectedCurve3DControlId: string | null = null;
  private onSelectionChange: ((nodeId: string | null) => void) | null = null;
  private onObjectTransform: ((nodeId: string) => void) | null = null;
  private onCurve3DControlSelection:
    | ((controlId: string | null) => void)
    | null = null;
  private onCurve3DControlTransform:
    | ((controlId: string, position: Vector3Tuple) => void)
    | null = null;
  private onCameraChange: (() => void) | null = null;

  constructor() {
    this.backgroundCanvas = getRequiredCanvas("three-background-canvas");
    this.overlayCanvas = getRequiredCanvas("three-overlay-canvas");
    this.backgroundRenderer = createTransparentRenderer(this.backgroundCanvas);
    this.overlayRenderer = createTransparentRenderer(this.overlayCanvas);

    /**
     * The editor keeps two Three scenes so grid/axes can sit behind the vector
     * artwork while selection proxies and TransformControls stay above it. Both
     * scenes share the same active camera, keeping helper geometry aligned with
     * the Canvas Path2D projection.
     */
    this.backgroundScene.add(new AmbientLight(0xffffff, 1));
    this.backgroundScene.add(createGridHelper());
    this.backgroundScene.add(createAxesHelper());

    this.perspectiveCamera.position.copy(DEFAULT_CAMERA_POSITION);
    this.orthographicCamera.position.copy(DEFAULT_CAMERA_POSITION);
    this.lookAtDefaultTarget();

    this.orbitControls = new OrbitControls(this.activeCamera, this.overlayCanvas);
    this.configureOrbitControls(DEFAULT_CAMERA_TARGET);

    this.transformControls = new TransformControls(
      this.activeCamera,
      this.overlayCanvas,
    );
    this.transformControls.setMode(this.transformMode);
    this.transformControls.detach();
    this.overlayScene.add(this.transformControls.getHelper());
    window.addEventListener("keydown", (event) => {
      if (event.key === "Shift") {
        this.shiftKeyPressed = true;
      }
    });
    window.addEventListener("keyup", (event) => {
      if (event.key === "Shift") {
        this.shiftKeyPressed = false;
      }
    });
    this.transformControls.addEventListener("dragging-changed", (event) => {
      const isTransformDragging = Boolean(event.value);
      this.orbitInteractionActive = false;
      this.orbitControls.enabled = !isTransformDragging;
    });
    this.transformControls.addEventListener("mouseDown", () => {
      const proxy = this.selectedNodeId ? this.proxies.get(this.selectedNodeId) : null;

      if (proxy) {
        this.scaleDragStart.copy(proxy.root.scale);
      }
    });
    this.transformControls.addEventListener("objectChange", () => {
      if (this.selectedCurve3DControlId) {
        const proxy = this.curve3DControls.get(this.selectedCurve3DControlId);

        if (proxy) {
          proxy.mesh.updateMatrixWorld();
          this.onCurve3DControlTransform?.(
            this.selectedCurve3DControlId,
            vectorToTuple(proxy.mesh.position),
          );
        }
        return;
      }

      if (this.selectedNodeId) {
        this.applyShiftUniformScale();
        this.onObjectTransform?.(this.selectedNodeId);
      }
    });
    this.orbitControls.addEventListener("start", () => {
      this.orbitInteractionActive = true;
      this.transformControls.enabled = false;
      this.transformControls.axis = null;
    });
    this.orbitControls.addEventListener("end", () => {
      this.orbitInteractionActive = false;
      this.transformControls.enabled = this.transformControlsVisible;
      this.transformControls.axis = null;
    });

    this.overlayCanvas.addEventListener(
      "pointerdown",
      (event) => {
        this.pointerDownPosition.set(event.clientX, event.clientY);

        if (!this.transformControlsVisible || event.button !== 0) {
          return;
        }

        this.transformControls.pointerHover(this.getTransformControlsPointer(event));

        if (this.transformControls.axis !== null) {
          this.orbitDisabledForTransformPointer = true;
          this.orbitControls.enabled = false;
        }
      },
      { capture: true },
    );
    this.overlayCanvas.addEventListener("pointerdown", (event) => {
      this.pointerDownPosition.set(event.clientX, event.clientY);
    });
    this.overlayCanvas.addEventListener("pointerup", (event) => {
      if (this.orbitDisabledForTransformPointer && !this.transformControls.dragging) {
        this.orbitControls.enabled = true;
      }

      this.orbitDisabledForTransformPointer = false;
      this.handlePointerUp(event);
    });
    this.overlayCanvas.addEventListener("pointercancel", () => {
      if (this.orbitDisabledForTransformPointer && !this.transformControls.dragging) {
        this.orbitControls.enabled = true;
      }

      this.orbitDisabledForTransformPointer = false;
    });
  }

  get activeCamera(): Camera {
    return this.projection === "perspective"
      ? this.perspectiveCamera
      : this.orthographicCamera;
  }

  get currentProjection(): CameraProjection {
    return this.projection;
  }

  get currentTransformMode(): TransformMode {
    return this.transformMode;
  }

  setCallbacks(callbacks: {
    onSelectionChange: (nodeId: string | null) => void;
    onObjectTransform: (nodeId: string) => void;
    onCurve3DControlSelection?: (controlId: string | null) => void;
    onCurve3DControlTransform?: (controlId: string, position: Vector3Tuple) => void;
    onCameraChange?: () => void;
  }): void {
    this.onSelectionChange = callbacks.onSelectionChange;
    this.onObjectTransform = callbacks.onObjectTransform;
    this.onCurve3DControlSelection =
      callbacks.onCurve3DControlSelection ?? null;
    this.onCurve3DControlTransform =
      callbacks.onCurve3DControlTransform ?? null;
    this.onCameraChange = callbacks.onCameraChange ?? null;
  }

  resize(size: StageSize): void {
    const aspect = size.cssWidth / size.cssHeight;
    this.backgroundRenderer.setPixelRatio(size.dpr);
    this.overlayRenderer.setPixelRatio(size.dpr);
    this.backgroundRenderer.setSize(size.cssWidth, size.cssHeight, false);
    this.overlayRenderer.setSize(size.cssWidth, size.cssHeight, false);

    this.perspectiveCamera.aspect = aspect;
    this.perspectiveCamera.updateProjectionMatrix();

    this.orthographicCamera.left = -ORTHOGRAPHIC_HALF_HEIGHT * aspect;
    this.orthographicCamera.right = ORTHOGRAPHIC_HALF_HEIGHT * aspect;
    this.orthographicCamera.top = ORTHOGRAPHIC_HALF_HEIGHT;
    this.orthographicCamera.bottom = -ORTHOGRAPHIC_HALF_HEIGHT;
    this.orthographicCamera.updateProjectionMatrix();
  }

  render(size: StageSize): void {
    this.resize(size);
    const cameraChanged = this.orbitControls.update();
    if (cameraChanged) {
      this.onCameraChange?.();
    }
    if (this.orbitInteractionActive && !this.transformControls.dragging) {
      this.transformControls.axis = null;
    }
    this.backgroundRenderer.render(this.backgroundScene, this.activeCamera);
    this.overlayRenderer.render(this.overlayScene, this.activeCamera);
  }

  addOrUpdateNode(node: EditorTransformNode, asset?: PrimitiveSvgAsset): void {
    const existing = this.proxies.get(node.id);

    if (existing) {
      applyNodeTransform(existing.root, node);
      this.updateProxySelection(existing);
      return;
    }

    const proxy = createNodeProxy(node, asset);
    this.proxies.set(node.id, proxy);
    this.overlayScene.add(proxy.root);
    this.updateProxySelection(proxy);
  }

  removeNode(nodeId: string): void {
    const proxy = this.proxies.get(nodeId);

    if (!proxy) {
      return;
    }

    this.overlayScene.remove(proxy.root);
    disposeObject(proxy.root);
    this.proxies.delete(nodeId);

    if (this.selectedNodeId === nodeId) {
      this.setSelectedNode(null);
    }
  }

  clearNodes(): void {
    for (const nodeId of [...this.proxies.keys()]) {
      this.removeNode(nodeId);
    }

    this.setSelectedNode(null);
  }

  setCurve3DControls(
    controls: Curve3DControlDescriptor[],
    handleLines: Curve3DHandleLineDescriptor[],
  ): void {
    const nextIds = new Set(controls.map((control) => control.id));

    for (const [controlId, proxy] of [...this.curve3DControls]) {
      if (nextIds.has(controlId)) {
        continue;
      }

      this.overlayScene.remove(proxy.mesh);
      disposeObject(proxy.mesh);
      this.curve3DControls.delete(controlId);

      if (this.selectedCurve3DControlId === controlId) {
        this.selectedCurve3DControlId = null;
        this.transformControls.detach();
      }
    }

    for (const control of controls) {
      const existing = this.curve3DControls.get(control.id);
      const proxy = existing ?? createCurve3DControlProxy(control);

      proxy.segmentId = control.segmentId;
      proxy.component = control.component;
      proxy.mesh.position.fromArray(control.position);
      proxy.mesh.userData.curveControlId = control.id;
      proxy.mesh.userData.segmentId = control.segmentId;
      proxy.mesh.userData.component = control.component;
      updateCurve3DControlMaterial(proxy, control.selected);

      if (!existing) {
        this.curve3DControls.set(control.id, proxy);
        this.overlayScene.add(proxy.mesh);
      }
    }

    this.setCurve3DHandleLines(handleLines);

    if (
      this.selectedCurve3DControlId &&
      !this.curve3DControls.has(this.selectedCurve3DControlId)
    ) {
      this.setSelectedCurve3DControl(null);
    } else if (this.selectedCurve3DControlId && this.transformControlsVisible) {
      const proxy = this.curve3DControls.get(this.selectedCurve3DControlId);

      if (proxy) {
        this.transformControls.attach(proxy.mesh);
      }
    }
  }

  clearCurve3DControls(): void {
    this.setSelectedCurve3DControl(null);

    for (const proxy of this.curve3DControls.values()) {
      this.overlayScene.remove(proxy.mesh);
      disposeObject(proxy.mesh);
    }

    this.curve3DControls.clear();
    this.setCurve3DHandleLines([]);
    this.attachCurrentTransformTarget();
  }

  setSelectedCurve3DControl(controlId: string | null): void {
    this.selectedCurve3DControlId = controlId;

    if (controlId) {
      this.selectedNodeId = null;
    }

    this.attachCurrentTransformTarget();
  }

  syncNodeFromProxy(node: EditorTransformNode): void {
    const proxy = this.proxies.get(node.id);

    if (!proxy) {
      return;
    }

    proxy.root.updateMatrixWorld();
    node.position = vectorToTuple(proxy.root.position);
    node.rotation = eulerToTuple(proxy.root.rotation);
    node.scale = vectorToTuple(proxy.root.scale);
  }

  syncProxyFromNode(node: EditorTransformNode): void {
    const proxy = this.proxies.get(node.id);

    if (!proxy) {
      return;
    }

    applyNodeTransform(proxy.root, node);
  }

  setSelectedNode(nodeId: string | null): void {
    this.selectedNodeId = nodeId;
    if (nodeId) {
      this.selectedCurve3DControlId = null;
    }
    this.attachCurrentTransformTarget();

    for (const candidate of this.proxies.values()) {
      this.updateProxySelection(candidate);
    }
  }

  setProjection(projection: CameraProjection): void {
    if (projection === this.projection) {
      return;
    }

    const previousCamera = this.activeCamera;
    const previousTarget = this.orbitControls.target.clone();
    this.projection = projection;
    this.activeCamera.position.copy(previousCamera.position);
    this.activeCamera.quaternion.copy(previousCamera.quaternion);
    this.updateActiveProjectionMatrix();
    this.orbitControls.object = this.activeCamera;
    this.transformControls.camera = this.activeCamera;
    this.configureOrbitControls(previousTarget);
  }

  toggleProjection(): CameraProjection {
    this.setProjection(
      this.projection === "perspective" ? "orthographic" : "perspective",
    );
    return this.projection;
  }

  setTransformMode(mode: TransformMode): void {
    this.transformMode = mode;
    this.transformControls.setMode(mode);
  }

  setTransformControlsVisible(visible: boolean): void {
    if (visible === this.transformControlsVisible) {
      return;
    }

    this.transformControlsVisible = visible;
    this.transformControls.enabled = visible;

    if (visible) {
      this.attachCurrentTransformTarget();
    } else {
      this.transformControls.detach();
    }
  }

  setOrbitControlsEnabled(enabled: boolean): void {
    this.orbitControls.enabled = enabled;
    this.orbitDisabledForTransformPointer = false;
    this.orbitInteractionActive = false;
  }

  resetView(): void {
    this.perspectiveCamera.position.copy(DEFAULT_CAMERA_POSITION);
    this.orthographicCamera.position.copy(DEFAULT_CAMERA_POSITION);
    this.lookAtDefaultTarget();
    this.configureOrbitControls(DEFAULT_CAMERA_TARGET);
  }

  getCameraSnapshot(): EditorViewportCameraSnapshot {
    const camera = this.activeCamera;
    const target = this.orbitControls.target;

    return {
      projection: this.projection,
      position: vectorToTuple(camera.position),
      target: vectorToTuple(target),
      fov: this.perspectiveCamera.fov,
      zoom:
        this.projection === "perspective"
          ? this.perspectiveCamera.zoom
          : this.orthographicCamera.zoom,
      near: CAMERA_NEAR,
      far: CAMERA_FAR,
    };
  }

  getDefaultCameraSnapshot(): EditorViewportCameraSnapshot {
    return {
      projection: "perspective",
      position: vectorToTuple(DEFAULT_CAMERA_POSITION),
      target: vectorToTuple(DEFAULT_CAMERA_TARGET),
      fov: PERSPECTIVE_FOV,
      zoom: 1,
      near: CAMERA_NEAR,
      far: CAMERA_FAR,
    };
  }

  applyCameraSnapshot(snapshot: EditorViewportCameraSnapshot): void {
    const target = tupleToVector(snapshot.target);
    const position = tupleToVector(snapshot.position);

    /**
     * Scene documents store the editor camera independently from the current
     * helper state. Rehydrating both camera objects keeps projection switching
     * predictable after a load: the user can toggle modes without jumping back
     * to an old position.
     */
    this.projection = snapshot.projection;
    this.perspectiveCamera.position.copy(position);
    this.orthographicCamera.position.copy(position);
    this.perspectiveCamera.fov = snapshot.fov;
    this.perspectiveCamera.zoom =
      snapshot.projection === "perspective" ? snapshot.zoom : 1;
    this.orthographicCamera.zoom =
      snapshot.projection === "orthographic" ? snapshot.zoom : 1;
    this.perspectiveCamera.near = snapshot.near;
    this.perspectiveCamera.far = snapshot.far;
    this.orthographicCamera.near = snapshot.near;
    this.orthographicCamera.far = snapshot.far;
    this.perspectiveCamera.lookAt(target);
    this.orthographicCamera.lookAt(target);
    this.perspectiveCamera.updateProjectionMatrix();
    this.orthographicCamera.updateProjectionMatrix();
    this.orbitControls.object = this.activeCamera;
    this.transformControls.camera = this.activeCamera;
    this.configureOrbitControls(target);
  }

  projectWorldPosition(
    worldPosition: Vector3,
    size: StageSize,
  ): { x: number; y: number; depth: number } | null {
    const projected = worldPosition.clone().project(this.activeCamera);

    if (
      !Number.isFinite(projected.x) ||
      !Number.isFinite(projected.y) ||
      !Number.isFinite(projected.z) ||
      projected.z < -1 ||
      projected.z > 1
    ) {
      return null;
    }

    return {
      x: (projected.x * 0.5 + 0.5) * size.cssWidth,
      y: (-projected.y * 0.5 + 0.5) * size.cssHeight,
      depth: projected.z,
    };
  }

  getDistanceScale(worldPosition: Vector3, baseWorldSize: number): number {
    if (this.projection === "orthographic") {
      return this.orthographicCamera.zoom * 72 * baseWorldSize;
    }

    const distance = this.activeCamera.position.distanceTo(worldPosition);
    const fovRadians = (this.perspectiveCamera.fov * Math.PI) / 180;
    const screenScale = 1 / Math.max(distance * Math.tan(fovRadians / 2), 0.001);

    return screenScale * 180 * baseWorldSize;
  }

  getProxySnapshot(): Array<{
    nodeId: string;
    position: Vector3Tuple;
    rotation: Vector3Tuple;
    scale: Vector3Tuple;
    selected: boolean;
  }> {
    return [...this.proxies.values()].map((proxy) => ({
      nodeId: proxy.nodeId,
      position: vectorToTuple(proxy.root.position),
      rotation: eulerToTuple(proxy.root.rotation),
      scale: vectorToTuple(proxy.root.scale),
      selected: proxy.nodeId === this.selectedNodeId,
    }));
  }

  dispose(): void {
    this.orbitControls.dispose();
    this.transformControls.dispose();
    this.backgroundRenderer.dispose();
    this.overlayRenderer.dispose();
  }

  private handlePointerUp(event: PointerEvent): void {
    if (this.transformControls.dragging) {
      return;
    }

    const moved = this.pointerDownPosition.distanceTo(
      new Vector2(event.clientX, event.clientY),
    );

    if (moved > 4) {
      return;
    }

    const rect = this.overlayCanvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.activeCamera);

    const curveIntersection = this.raycaster.intersectObjects(
      [...this.curve3DControls.values()].map((proxy) => proxy.mesh),
      false,
    )[0];
    const curveControlId = curveIntersection?.object.userData.curveControlId as
      | string
      | undefined;

    if (curveControlId) {
      this.setSelectedCurve3DControl(curveControlId);
      this.onCurve3DControlSelection?.(curveControlId);
      return;
    }

    if (this.curve3DControls.size > 0) {
      this.setSelectedCurve3DControl(null);
      this.onCurve3DControlSelection?.(null);
      return;
    }

    const hitMeshes = [...this.proxies.values()].map((proxy) => proxy.hitMesh);
    const intersection = this.raycaster.intersectObjects(hitMeshes, false)[0];
    const nodeId = intersection?.object.userData.nodeId as string | undefined;

    if (nodeId) {
      this.setSelectedNode(nodeId);
      this.onSelectionChange?.(nodeId);
    }
  }

  private lookAtDefaultTarget(): void {
    this.perspectiveCamera.lookAt(DEFAULT_CAMERA_TARGET);
    this.orthographicCamera.lookAt(DEFAULT_CAMERA_TARGET);
  }

  private configureOrbitControls(target: Vector3): void {
    this.orbitControls.object = this.activeCamera;
    this.orbitControls.target.copy(target);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.08;
    this.orbitControls.update();
  }

  private applyShiftUniformScale(): void {
    if (
      this.transformMode !== "scale" ||
      !this.shiftKeyPressed ||
      !this.selectedNodeId
    ) {
      return;
    }

    const proxy = this.proxies.get(this.selectedNodeId);

    if (!proxy) {
      return;
    }

    const scaleRatio = largestAbsoluteScaleRatio(
      proxy.root.scale,
      this.scaleDragStart,
    );

    proxy.root.scale.set(
      this.scaleDragStart.x * scaleRatio,
      this.scaleDragStart.y * scaleRatio,
      this.scaleDragStart.z * scaleRatio,
    );
    proxy.root.updateMatrixWorld();
  }

  private attachCurrentTransformTarget(): void {
    if (!this.transformControlsVisible) {
      this.transformControls.detach();
      return;
    }

    const curveProxy = this.selectedCurve3DControlId
      ? this.curve3DControls.get(this.selectedCurve3DControlId)
      : null;

    if (curveProxy) {
      this.transformControls.attach(curveProxy.mesh);
      return;
    }

    const nodeProxy = this.selectedNodeId ? this.proxies.get(this.selectedNodeId) : null;

    if (nodeProxy) {
      this.transformControls.attach(nodeProxy.root);
      return;
    }

    this.transformControls.detach();
  }

  private updateActiveProjectionMatrix(): void {
    if (this.projection === "perspective") {
      this.perspectiveCamera.updateProjectionMatrix();
    } else {
      this.orthographicCamera.updateProjectionMatrix();
    }
  }

  private updateProxySelection(proxy: NodeProxy): void {
    const selected = proxy.nodeId === this.selectedNodeId;
    proxy.edgeLines.visible = selected;
    const material = proxy.edgeLines.material as LineBasicMaterial;
    material.color.set(selected ? "#ffcf4a" : "#5bc4bf");
  }

  private getTransformControlsPointer(event: PointerEvent): PointerEvent {
    const rect = this.overlayCanvas.getBoundingClientRect();

    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
      button: event.button,
    } as unknown as PointerEvent;
  }

  private setCurve3DHandleLines(lines: Curve3DHandleLineDescriptor[]): void {
    if (this.curve3DHandleLines) {
      this.overlayScene.remove(this.curve3DHandleLines);
      disposeObject(this.curve3DHandleLines);
      this.curve3DHandleLines = null;
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

    this.curve3DHandleLines = new LineSegments(geometry, material);
    this.curve3DHandleLines.renderOrder = 14;
    this.overlayScene.add(this.curve3DHandleLines);
  }
}

function getRequiredCanvas(id: string): HTMLCanvasElement {
  const canvas = document.getElementById(id);

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error(`Expected #${id} to be a canvas element.`);
  }

  return canvas;
}
