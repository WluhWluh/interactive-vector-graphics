import { Matrix4, Vector3 } from "three";
import type { Camera } from "three";
import type { StructuredBezierPath } from "../../core/assets/structuredBezierPath";
import {
  evaluateViewMorphProfileToBezierPath,
  type ViewMorphPoint2D,
  type ViewMorphPoint3D,
  type ViewMorphProfile,
} from "../../core/assets/viewMorphProfile";
import type { PrimitiveFillRule } from "../../core/assets/primitiveAssetTypes";
import type { Vector3Tuple } from "../three/viewportMath";

export const VIEW_MORPH_PROFILE_WORLD_SIZE = 1.6;
export const VIEW_MORPH_PROFILE_PATH_RADIUS = 50;
export const VIEW_MORPH_PROFILE_UNITS_PER_PATH_UNIT =
  VIEW_MORPH_PROFILE_WORLD_SIZE / (VIEW_MORPH_PROFILE_PATH_RADIUS * 2);

export type ViewMorphCameraEvaluationInput = {
  viewDirectionLocal: ViewMorphPoint3D;
  horizontalRotationReferenceLocal: ViewMorphPoint3D;
  screenUpReferenceLocal: ViewMorphPoint3D;
};

export type ViewMorphBillboardProjector = {
  pathToScreen: (point: ViewMorphPoint2D) => [number, number] | null;
};

export type ViewMorphBillboardProjectorInput = {
  camera: Camera;
  origin: Vector3Tuple;
  projectWorldPosition: (
    position: Vector3Tuple,
  ) => { x: number; y: number } | null;
  unitsPerPathUnit?: number;
  rotationRad?: number;
  scale?: [number, number];
};

export type DrawViewMorphBillboardPathInput = ViewMorphBillboardProjectorInput & {
  profile: ViewMorphProfile;
  fillStyle: string;
  fillRule: PrimitiveFillRule;
  localToWorldMatrix?: Matrix4;
};

export function evaluateViewMorphProfileForCamera(
  profile: ViewMorphProfile,
  camera: Camera,
  localToWorldMatrix = new Matrix4(),
): StructuredBezierPath {
  const input = getViewMorphCameraEvaluationInput(camera, localToWorldMatrix);

  return evaluateViewMorphProfileToBezierPath(profile, input.viewDirectionLocal, {
    horizontalRotationReferenceLocal: input.horizontalRotationReferenceLocal,
    screenUpReferenceLocal: input.screenUpReferenceLocal,
  });
}

export function getViewMorphCameraEvaluationInput(
  camera: Camera,
  localToWorldMatrix = new Matrix4(),
): ViewMorphCameraEvaluationInput {
  const inverseRotation = localToWorldMatrix.clone().extractRotation(
    localToWorldMatrix,
  ).invert();
  const viewDirection = new Vector3();
  camera.getWorldDirection(viewDirection);

  return {
    viewDirectionLocal: vectorToPoint3D(
      viewDirection.negate().normalize().applyMatrix4(inverseRotation),
    ),
    horizontalRotationReferenceLocal: vectorToPoint3D(
      getCameraScreenRightWorldVector(camera).applyMatrix4(inverseRotation),
    ),
    screenUpReferenceLocal: vectorToPoint3D(
      getCameraScreenUpWorldVector(camera).applyMatrix4(inverseRotation),
    ),
  };
}

export function createViewMorphBillboardProjector(
  input: ViewMorphBillboardProjectorInput,
): ViewMorphBillboardProjector {
  const origin = new Vector3(...input.origin);
  const right = getCameraScreenRightWorldVector(input.camera);
  const up = getCameraScreenUpWorldVector(input.camera);
  const unitsPerPathUnit =
    input.unitsPerPathUnit ?? VIEW_MORPH_PROFILE_UNITS_PER_PATH_UNIT;
  const [scaleX, scaleY] = input.scale ?? [1, 1];
  const rotation = input.rotationRad ?? 0;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  return {
    pathToScreen: (point) => {
      const localX = point[0] * scaleX;
      const localY = -point[1] * scaleY;
      const rotatedX = localX * cos - localY * sin;
      const rotatedY = localX * sin + localY * cos;
      const worldPoint = origin
        .clone()
        .add(right.clone().multiplyScalar(rotatedX * unitsPerPathUnit))
        .add(up.clone().multiplyScalar(rotatedY * unitsPerPathUnit));
      const projected = input.projectWorldPosition(vectorToTuple(worldPoint));

      return projected ? [projected.x, projected.y] : null;
    },
  };
}

export function drawViewMorphBillboardPath(
  context: CanvasRenderingContext2D,
  input: DrawViewMorphBillboardPathInput,
): StructuredBezierPath {
  const evaluatedPath = evaluateViewMorphProfileForCamera(
    input.profile,
    input.camera,
    input.localToWorldMatrix,
  );
  const projector = createViewMorphBillboardProjector(input);

  context.save();
  context.fillStyle = input.fillStyle;
  drawStructuredBezierPathWithProjector(
    context,
    evaluatedPath,
    projector,
    input.fillRule,
  );
  context.restore();

  return evaluatedPath;
}

export function drawStructuredBezierPathWithProjector(
  context: CanvasRenderingContext2D,
  path: StructuredBezierPath,
  projector: ViewMorphBillboardProjector,
  fillRule?: PrimitiveFillRule,
): void {
  context.beginPath();

  for (const [index, segment] of path.segments.entries()) {
    const point = projector.pathToScreen(segment.anchor);

    if (!point) {
      continue;
    }

    if (index === 0) {
      context.moveTo(point[0], point[1]);
      continue;
    }

    const previousSegment = path.segments[index - 1];

    if (!previousSegment) {
      context.lineTo(point[0], point[1]);
      continue;
    }

    const cp1 = projector.pathToScreen([
      previousSegment.anchor[0] + previousSegment.handleOut[0],
      previousSegment.anchor[1] + previousSegment.handleOut[1],
    ]);
    const cp2 = projector.pathToScreen([
      segment.anchor[0] + segment.handleIn[0],
      segment.anchor[1] + segment.handleIn[1],
    ]);

    if (cp1 && cp2) {
      context.bezierCurveTo(cp1[0], cp1[1], cp2[0], cp2[1], point[0], point[1]);
    } else {
      context.lineTo(point[0], point[1]);
    }
  }

  const firstSegment = path.segments[0];
  const lastSegment = path.segments.at(-1);

  if (firstSegment && lastSegment) {
    const firstPoint = projector.pathToScreen(firstSegment.anchor);
    const cp1 = projector.pathToScreen([
      lastSegment.anchor[0] + lastSegment.handleOut[0],
      lastSegment.anchor[1] + lastSegment.handleOut[1],
    ]);
    const cp2 = projector.pathToScreen([
      firstSegment.anchor[0] + firstSegment.handleIn[0],
      firstSegment.anchor[1] + firstSegment.handleIn[1],
    ]);

    if (firstPoint && cp1 && cp2) {
      context.bezierCurveTo(
        cp1[0],
        cp1[1],
        cp2[0],
        cp2[1],
        firstPoint[0],
        firstPoint[1],
      );
    }
  }

  context.closePath();

  if (fillRule) {
    context.fill(fillRule);
  }
}

export function getCameraScreenRightWorldVector(camera: Camera): Vector3 {
  return new Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
}

export function getCameraScreenUpWorldVector(camera: Camera): Vector3 {
  return new Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
}

function vectorToPoint3D(vector: Vector3): ViewMorphPoint3D {
  return [vector.x, vector.y, vector.z];
}

function vectorToTuple(vector: Vector3): Vector3Tuple {
  return [vector.x, vector.y, vector.z];
}
