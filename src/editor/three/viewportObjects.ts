import {
  AxesHelper,
  BoxGeometry,
  BufferGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  GridHelper,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SphereGeometry,
  WebGLRenderer,
  type Object3D,
} from "three";
import type { PrimitiveSvgAsset } from "../../core/assets/primitiveAssetTypes";
import type { Vector3Tuple } from "./viewportMath";

export type TransformProxyNode = {
  id: string;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
};

export type NodeProxy = {
  nodeId: string;
  root: Object3D;
  hitMesh: Mesh;
  edgeLines: LineSegments;
};

export type Curve3DControlComponent = "anchor" | "handleIn" | "handleOut";

export type Curve3DControlDescriptor = {
  id: string;
  segmentId: string;
  component: Curve3DControlComponent;
  position: Vector3Tuple;
  selected: boolean;
};

export type Curve3DHandleLineDescriptor = {
  start: Vector3Tuple;
  end: Vector3Tuple;
};

export type Curve3DControlProxy = {
  id: string;
  segmentId: string;
  component: Curve3DControlComponent;
  mesh: Mesh;
};

const CURVE_3D_ANCHOR_GEOMETRY = new SphereGeometry(0.035, 16, 10);
const CURVE_3D_HANDLE_GEOMETRY = new BoxGeometry(0.07, 0.07, 0.07);

export function createTransparentRenderer(
  canvas: HTMLCanvasElement,
): WebGLRenderer {
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas,
  });

  renderer.setClearColor(new Color(0x000000), 0);
  renderer.autoClear = true;
  return renderer;
}

export function createGridHelper(): GridHelper {
  const grid = new GridHelper(12, 12, 0x5bc4bf, 0x334155);
  grid.material.opacity = 0.44;
  grid.material.transparent = true;
  return grid;
}

export function createAxesHelper(): AxesHelper {
  const axes = new AxesHelper(2.4);
  axes.position.y = 0.01;
  return axes;
}

export function createNodeProxy(
  node: TransformProxyNode,
  asset?: PrimitiveSvgAsset,
): NodeProxy {
  const [, , viewBoxWidth, viewBoxHeight] = asset?.viewBox ?? [0, 0, 100, 100];
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
  if (asset) {
    root.userData.assetId = asset.id;
  }
  root.userData.proxyKind = "primitive-billboard";
  applyNodeTransform(root, node);

  return {
    nodeId: node.id,
    root,
    hitMesh: root,
    edgeLines,
  };
}

export function createCurve3DControlProxy(
  control: Curve3DControlDescriptor,
): Curve3DControlProxy {
  const mesh = new Mesh(
    control.component === "anchor"
      ? CURVE_3D_ANCHOR_GEOMETRY.clone()
      : CURVE_3D_HANDLE_GEOMETRY.clone(),
    new MeshBasicMaterial({
      color: control.selected ? 0xffcf4a : 0x5bc4bf,
      depthTest: false,
      depthWrite: false,
    }),
  );

  mesh.renderOrder = 15;
  mesh.userData.curveControlId = control.id;
  mesh.userData.segmentId = control.segmentId;
  mesh.userData.component = control.component;

  return {
    id: control.id,
    segmentId: control.segmentId,
    component: control.component,
    mesh,
  };
}

export function updateCurve3DControlMaterial(
  proxy: Curve3DControlProxy,
  selected: boolean,
): void {
  const material = proxy.mesh.material as MeshBasicMaterial;
  material.color.set(selected ? 0xffcf4a : 0x5bc4bf);
}

export function applyNodeTransform(
  root: Object3D,
  node: TransformProxyNode,
): void {
  root.position.fromArray(node.position);
  root.rotation.fromArray([...node.rotation, "XYZ"]);
  root.scale.fromArray(node.scale);
  root.updateMatrixWorld();
}

export function disposeObject(object: Object3D): void {
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
