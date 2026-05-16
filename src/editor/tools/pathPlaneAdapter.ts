import type { BezierPoint } from "../../core/assets/structuredBezierPath";
import type { TransformSnapshot } from "./prefabTransform";
import { roundBezierValue, type PathEditViewportAdapter } from "./pathEditCore";
import type { Vector3Tuple } from "../three/viewportMath";

export type BillboardScreenTransform = {
  projected: { x: number; y: number };
  assetScale: number;
  rotation: number;
  nodeScale: [number, number];
  viewBoxCenter: BezierPoint;
};

export type BillboardScreenTransformInput = {
  viewBox: [number, number, number, number];
  transform: TransformSnapshot;
  projectWorldPosition: (
    position: [number, number, number],
  ) => { x: number; y: number } | null;
  getDistanceScale: (position: [number, number, number], worldSize: number) => number;
};

export type WorldRay = {
  origin: Vector3Tuple;
  direction: Vector3Tuple;
};

export type PlanePathViewportAdapterInput = {
  origin: Vector3Tuple;
  uAxis: Vector3Tuple;
  vAxis: Vector3Tuple;
  unitsPerPathUnit: number;
  projectWorldPosition: (position: Vector3Tuple) => { x: number; y: number } | null;
  getWorldRayFromScreenPoint: (point: BezierPoint) => WorldRay | null;
};

export function createBillboardScreenTransform(
  input: BillboardScreenTransformInput,
): BillboardScreenTransform | null {
  const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] = input.viewBox;
  const projected = input.projectWorldPosition(input.transform.position);

  if (!projected) {
    return null;
  }

  const largestDimension = Math.max(viewBoxWidth, viewBoxHeight);
  const screenScale = input.getDistanceScale(input.transform.position, 1);
  const assetScale = screenScale / largestDimension;

  return {
    projected,
    assetScale,
    rotation: input.transform.rotation[2],
    nodeScale: [input.transform.scale[0], input.transform.scale[1]],
    viewBoxCenter: [viewBoxX + viewBoxWidth / 2, viewBoxY + viewBoxHeight / 2],
  };
}

export function pathPointToBillboardScreen(
  point: BezierPoint,
  transform: BillboardScreenTransform,
): BezierPoint {
  const localX =
    (point[0] - transform.viewBoxCenter[0]) *
    transform.assetScale *
    transform.nodeScale[0];
  const localY =
    (point[1] - transform.viewBoxCenter[1]) *
    transform.assetScale *
    transform.nodeScale[1];
  const cos = Math.cos(transform.rotation);
  const sin = Math.sin(transform.rotation);

  return [
    roundBezierValue(transform.projected.x + localX * cos - localY * sin),
    roundBezierValue(transform.projected.y + localX * sin + localY * cos),
  ];
}

export function billboardScreenPointToPath(
  point: BezierPoint,
  transform: BillboardScreenTransform,
): BezierPoint {
  const dx = point[0] - transform.projected.x;
  const dy = point[1] - transform.projected.y;
  const cos = Math.cos(-transform.rotation);
  const sin = Math.sin(-transform.rotation);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  return [
    roundBezierValue(
      localX / safeBillboardScale(transform.assetScale * transform.nodeScale[0]) +
        transform.viewBoxCenter[0],
    ),
    roundBezierValue(
      localY / safeBillboardScale(transform.assetScale * transform.nodeScale[1]) +
        transform.viewBoxCenter[1],
    ),
  ];
}

export function createPlanePathViewportAdapter(
  input: PlanePathViewportAdapterInput,
): PathEditViewportAdapter | null {
  const origin = input.origin;
  const uAxis = normalize3D(input.uAxis);
  const vAxis = normalize3D(input.vAxis);

  if (!uAxis || !vAxis || Math.abs(input.unitsPerPathUnit) < 0.000001) {
    return null;
  }

  const normal = normalize3D(cross3D(uAxis, vAxis));

  if (!normal) {
    return null;
  }

  return {
    pathToScreen: (point) => {
      const worldPoint = add3D(
        origin,
        add3D(
          scale3D(uAxis, point[0] * input.unitsPerPathUnit),
          scale3D(vAxis, point[1] * input.unitsPerPathUnit),
        ),
      );
      const projected = input.projectWorldPosition(worldPoint);

      return projected
        ? [roundBezierValue(projected.x), roundBezierValue(projected.y)]
        : null;
    },
    screenToPath: (point) => {
      const ray = input.getWorldRayFromScreenPoint(point);

      if (!ray) {
        return null;
      }

      const denominator = dot3D(normal, ray.direction);

      if (Math.abs(denominator) < 0.000001) {
        return null;
      }

      const t = dot3D(normal, subtract3D(origin, ray.origin)) / denominator;
      const intersection = add3D(ray.origin, scale3D(ray.direction, t));
      const local = subtract3D(intersection, origin);

      return [
        roundBezierValue(dot3D(local, uAxis) / input.unitsPerPathUnit),
        roundBezierValue(dot3D(local, vAxis) / input.unitsPerPathUnit),
      ];
    },
  };
}

function safeBillboardScale(value: number): number {
  if (Math.abs(value) < 0.0001) {
    return value < 0 ? -0.0001 : 0.0001;
  }

  return value;
}

function add3D(left: Vector3Tuple, right: Vector3Tuple): Vector3Tuple {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function subtract3D(left: Vector3Tuple, right: Vector3Tuple): Vector3Tuple {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function scale3D(value: Vector3Tuple, scale: number): Vector3Tuple {
  return [value[0] * scale, value[1] * scale, value[2] * scale];
}

function dot3D(left: Vector3Tuple, right: Vector3Tuple): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function cross3D(left: Vector3Tuple, right: Vector3Tuple): Vector3Tuple {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function normalize3D(value: Vector3Tuple | null): Vector3Tuple | null {
  if (!value) {
    return null;
  }

  const length = Math.hypot(value[0], value[1], value[2]);

  if (length < 0.000001) {
    return null;
  }

  return [value[0] / length, value[1] / length, value[2] / length];
}
