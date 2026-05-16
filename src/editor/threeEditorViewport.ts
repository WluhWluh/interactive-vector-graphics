import {
  AmbientLight,
  LineBasicMaterial,
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
import type { PrimitiveSvgAsset } from "../core/assets/primitiveAssetTypes";
import type { StageSize } from "../core/stage/canvasStage";
import {
  eulerToTuple,
  tupleToVector,
  vectorToTuple,
  type Vector3Tuple,
} from "./three/viewportMath";
import {
  applyNodeTransform,
  createAxesHelper,
  createGridHelper,
  createNodeProxy,
  createTransparentRenderer,
  disposeObject,
  type Curve3DControlDescriptor,
  type Curve3DControlProxy,
  type Curve3DHandleLineDescriptor,
  type NodeProxy,
} from "./three/viewportObjects";
import {
  bindOrbitTransformInteraction,
  configureOrbitCameraControls,
} from "./three/orbitCameraController";
import {
  createTransformControlsController,
  didPointerMoveBeyondClickThreshold,
  type TransformControlsController,
} from "./three/transformControlsController";
import {
  createCurve3DControlsController,
  type Curve3DControlsController,
} from "./three/curve3DControlsController";

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
  private readonly transformControlsController: TransformControlsController;
  private readonly curve3DControlsController: Curve3DControlsController;
  private transformControlsVisible = true;
  private orbitDisabledForTransformPointer = false;
  private orbitInteractionActive = false;
  private projection: CameraProjection = "perspective";
  private transformMode: TransformMode = "translate";
  private selectedNodeId: string | null = null;
  private selectedCurve3DControlId: string | null = null;
  private onSelectionChange: ((nodeId: string | null) => void) | null = null;
  private onObjectTransform: ((nodeId: string) => void) | null = null;
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

    this.transformControlsController = createTransformControlsController({
      overlayCanvas: this.overlayCanvas,
      orbitControls: this.orbitControls,
      transformControls: this.transformControls,
      proxies: this.proxies,
      curve3DControls: this.curve3DControls,
      getTransformMode: () => this.transformMode,
      getSelectedNodeId: () => this.selectedNodeId,
      setSelectedNodeId: (nodeId) => {
        this.selectedNodeId = nodeId;
      },
      getSelectedCurve3DControlId: () => this.selectedCurve3DControlId,
      getTransformControlsVisible: () => this.transformControlsVisible,
      setTransformControlsVisibleFlag: (visible) => {
        this.transformControlsVisible = visible;
      },
      setOrbitInteractionActive: (active) => {
        this.orbitInteractionActive = active;
      },
      getOrbitDisabledForTransformPointer: () =>
        this.orbitDisabledForTransformPointer,
      setOrbitDisabledForTransformPointer: (disabled) => {
        this.orbitDisabledForTransformPointer = disabled;
      },
      onObjectTransform: (nodeId) => {
        this.onObjectTransform?.(nodeId);
      },
      onCurve3DControlTransform: (controlId, position) => {
        this.onCurve3DControlTransform?.(controlId, position);
      },
    });
    this.transformControlsController.bindKeyboardModifiers();
    this.transformControlsController.bindTransformEvents();
    this.transformControlsController.bindPointerGuards();
    bindOrbitTransformInteraction({
      orbitControls: this.orbitControls,
      transformControls: this.transformControls,
      getTransformControlsVisible: () => this.transformControlsVisible,
      setOrbitInteractionActive: (active) => {
        this.orbitInteractionActive = active;
      },
    });

    this.curve3DControlsController = createCurve3DControlsController({
      overlayScene: this.overlayScene,
      transformControls: this.transformControls,
      curve3DControls: this.curve3DControls,
      getSelectedCurve3DControlId: () => this.selectedCurve3DControlId,
      setSelectedCurve3DControlId: (controlId) => {
        this.selectedCurve3DControlId = controlId;
      },
      getTransformControlsVisible: () => this.transformControlsVisible,
      attachCurrentTransformTarget: () => this.attachCurrentTransformTarget(),
    });

    this.overlayCanvas.addEventListener(
      "pointerdown",
      (event) => {
        this.pointerDownPosition.set(event.clientX, event.clientY);
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
    onCurve3DControlTransform?: (controlId: string, position: Vector3Tuple) => void;
    onCameraChange?: () => void;
  }): void {
    this.onSelectionChange = callbacks.onSelectionChange;
    this.onObjectTransform = callbacks.onObjectTransform;
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
    this.curve3DControlsController.setControls(controls, handleLines);
  }

  clearCurve3DControls(): void {
    this.curve3DControlsController.clear();
  }

  setSelectedCurve3DControl(controlId: string | null): void {
    this.selectedCurve3DControlId = controlId;

    if (controlId) {
      this.selectedNodeId = null;
    }

    this.curve3DControlsController.refreshControlStyles();
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
    if (this.selectedCurve3DControlId && mode !== "translate") {
      mode = "translate";
    }

    this.transformMode = mode;
    this.transformControls.setMode(mode);
  }

  setTransformControlsVisible(visible: boolean): void {
    this.transformControlsController.setVisible(visible);
  }

  setOrbitControlsEnabled(enabled: boolean): void {
    this.orbitControls.enabled = enabled;
    this.orbitDisabledForTransformPointer = false;
    this.orbitInteractionActive = false;
  }

  isTransformDraggingOrOrbiting(): boolean {
    return this.transformControls.dragging || this.orbitInteractionActive;
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

    if (
      didPointerMoveBeyondClickThreshold({
        pointerDownPosition: this.pointerDownPosition,
        event,
      })
    ) {
      return;
    }

    const rect = this.overlayCanvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.activeCamera);

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
    configureOrbitCameraControls({
      orbitControls: this.orbitControls,
      camera: this.activeCamera,
      target,
    });
  }

  private attachCurrentTransformTarget(): void {
    this.transformControlsController.attachCurrentTarget();
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

}

function getRequiredCanvas(id: string): HTMLCanvasElement {
  const canvas = document.getElementById(id);

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error(`Expected #${id} to be a canvas element.`);
  }

  return canvas;
}
