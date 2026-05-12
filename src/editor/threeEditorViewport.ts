import {
  AmbientLight,
  AxesHelper,
  BufferGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  Euler,
  GridHelper,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Camera,
  type Object3D,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import type { PrimitiveSvgAsset } from "../core/assets/primitiveSvg";
import type { StageSize } from "../core/stage/canvasStage";

export type CameraProjection = "perspective" | "orthographic";
export type TransformMode = "translate" | "rotate" | "scale";
export type BillboardMode = "spherical";
export type Vector3Tuple = [number, number, number];

export type EditorSceneNode = {
  id: string;
  assetId: string;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
  billboardMode: BillboardMode;
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

type NodeProxy = {
  nodeId: string;
  root: Object3D;
  hitMesh: Mesh;
  edgeLines: LineSegments;
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
  private readonly pointerDownPosition = new Vector2();
  private projection: CameraProjection = "perspective";
  private transformMode: TransformMode = "translate";
  private selectedNodeId: string | null = null;
  private onSelectionChange: ((nodeId: string | null) => void) | null = null;
  private onObjectTransform: ((nodeId: string) => void) | null = null;

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
    this.configureOrbitControls();

    this.transformControls = new TransformControls(
      this.activeCamera,
      this.overlayCanvas,
    );
    this.transformControls.setMode(this.transformMode);
    this.transformControls.detach();
    this.overlayScene.add(this.transformControls.getHelper());
    this.transformControls.addEventListener("dragging-changed", (event) => {
      this.orbitControls.enabled = !Boolean(event.value);
    });
    this.transformControls.addEventListener("objectChange", () => {
      if (this.selectedNodeId) {
        this.onObjectTransform?.(this.selectedNodeId);
      }
    });

    this.overlayCanvas.addEventListener("pointerdown", (event) => {
      this.pointerDownPosition.set(event.clientX, event.clientY);
    });
    this.overlayCanvas.addEventListener("pointerup", (event) => {
      this.handlePointerUp(event);
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
  }): void {
    this.onSelectionChange = callbacks.onSelectionChange;
    this.onObjectTransform = callbacks.onObjectTransform;
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
    this.orbitControls.update();
    this.backgroundRenderer.render(this.backgroundScene, this.activeCamera);
    this.overlayRenderer.render(this.overlayScene, this.activeCamera);
  }

  addOrUpdateNode(node: EditorSceneNode, asset: PrimitiveSvgAsset): void {
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

  syncNodeFromProxy(node: EditorSceneNode): void {
    const proxy = this.proxies.get(node.id);

    if (!proxy) {
      return;
    }

    proxy.root.updateMatrixWorld();
    node.position = vectorToTuple(proxy.root.position);
    node.rotation = eulerToTuple(proxy.root.rotation);
    node.scale = vectorToTuple(proxy.root.scale);
  }

  setSelectedNode(nodeId: string | null): void {
    this.selectedNodeId = nodeId;
    const proxy = nodeId ? this.proxies.get(nodeId) : null;

    if (proxy) {
      this.transformControls.attach(proxy.root);
    } else {
      this.transformControls.detach();
    }

    for (const candidate of this.proxies.values()) {
      this.updateProxySelection(candidate);
    }
  }

  setProjection(projection: CameraProjection): void {
    if (projection === this.projection) {
      return;
    }

    const previousCamera = this.activeCamera;
    this.projection = projection;
    this.activeCamera.position.copy(previousCamera.position);
    this.activeCamera.quaternion.copy(previousCamera.quaternion);
    this.updateActiveProjectionMatrix();
    this.orbitControls.object = this.activeCamera;
    this.transformControls.camera = this.activeCamera;
    this.configureOrbitControls();
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

  resetView(): void {
    this.perspectiveCamera.position.copy(DEFAULT_CAMERA_POSITION);
    this.orthographicCamera.position.copy(DEFAULT_CAMERA_POSITION);
    this.lookAtDefaultTarget();
    this.configureOrbitControls();
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

  private configureOrbitControls(): void {
    this.orbitControls.object = this.activeCamera;
    this.orbitControls.target.copy(DEFAULT_CAMERA_TARGET);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.08;
    this.orbitControls.update();
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

export function tupleToVector(value: Vector3Tuple): Vector3 {
  return new Vector3(value[0], value[1], value[2]);
}

export function vectorToTuple(value: Vector3): Vector3Tuple {
  return [roundNumber(value.x), roundNumber(value.y), roundNumber(value.z)];
}

export function eulerToTuple(value: Euler): Vector3Tuple {
  return [roundNumber(value.x), roundNumber(value.y), roundNumber(value.z)];
}

function createTransparentRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas,
  });

  renderer.setClearColor(new Color(0x000000), 0);
  renderer.autoClear = true;
  return renderer;
}

function createGridHelper(): GridHelper {
  const grid = new GridHelper(12, 12, 0x5bc4bf, 0x334155);
  grid.material.opacity = 0.44;
  grid.material.transparent = true;
  return grid;
}

function createAxesHelper(): AxesHelper {
  const axes = new AxesHelper(2.4);
  axes.position.y = 0.01;
  return axes;
}

function createNodeProxy(
  node: EditorSceneNode,
  asset: PrimitiveSvgAsset,
): NodeProxy {
  const [, , viewBoxWidth, viewBoxHeight] = asset.viewBox;
  const largestDimension = Math.max(viewBoxWidth, viewBoxHeight);
  const width = viewBoxWidth / largestDimension;
  const height = viewBoxHeight / largestDimension;
  const root = new Mesh(
    new PlaneGeometry(width, height),
    new MeshBasicMaterial({
      color: 0x5bc4bf,
      opacity: 0.06,
      transparent: true,
      side: DoubleSide,
      depthWrite: false,
    }),
  );
  const edgeGeometry = new EdgesGeometry(root.geometry);
  const edgeLines = new LineSegments(
    edgeGeometry,
    new LineBasicMaterial({
      color: 0x5bc4bf,
      transparent: true,
      opacity: 0.95,
    }),
  );

  edgeLines.renderOrder = 10;
  root.add(edgeLines);
  root.userData.nodeId = node.id;
  root.userData.assetId = node.assetId;
  root.userData.proxyKind = "primitive-billboard";
  applyNodeTransform(root, node);

  return {
    nodeId: node.id,
    root,
    hitMesh: root,
    edgeLines,
  };
}

function applyNodeTransform(root: Object3D, node: EditorSceneNode): void {
  root.position.fromArray(node.position);
  root.rotation.fromArray([...node.rotation, "XYZ"]);
  root.scale.fromArray(node.scale);
  root.updateMatrixWorld();
}

function disposeObject(object: Object3D): void {
  object.traverse((child) => {
    const maybeGeometry = child as Object3D & { geometry?: BufferGeometry };
    const maybeMaterial = child as Object3D & {
      material?: { dispose?: () => void } | Array<{ dispose?: () => void }>;
    };

    maybeGeometry.geometry?.dispose();

    if (Array.isArray(maybeMaterial.material)) {
      for (const material of maybeMaterial.material) {
        material.dispose?.();
      }
    } else {
      maybeMaterial.material?.dispose?.();
    }
  });
}

function getRequiredCanvas(id: string): HTMLCanvasElement {
  const canvas = document.getElementById(id);

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error(`Expected #${id} to be a canvas element.`);
  }

  return canvas;
}

function roundNumber(value: number): number {
  return Number(value.toFixed(4));
}
