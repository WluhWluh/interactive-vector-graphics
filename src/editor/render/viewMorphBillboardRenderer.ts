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

export type ViewMorphScreenBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type ViewMorphBillboardTransformAdapter = {
  origin: Vector3Tuple;
  localToWorldMatrix: Matrix4;
  getCameraEvaluationInput: (camera: Camera) => ViewMorphCameraEvaluationInput;
  createProjector: (
    input: ViewMorphBillboardProjectorInput,
  ) => ViewMorphBillboardProjector;
};

export type ViewMorphBillboardProjectorInput = {
  camera: Camera;
  origin?: Vector3Tuple;
  projectWorldPosition: (
    position: Vector3Tuple,
  ) => { x: number; y: number } | null;
  unitsPerPathUnit?: number;
  localToWorldMatrix?: Matrix4;
};

export type DrawViewMorphBillboardPathInput = ViewMorphBillboardProjectorInput & {
  profile: ViewMorphProfile;
  fillStyle: string;
  fillRule: PrimitiveFillRule;
  localToWorldMatrix?: Matrix4;
};

export type ViewMorphBillboardTransformAdapterInput = {
  origin?: Vector3Tuple;
  localToWorldMatrix?: Matrix4;
  unitsPerPathUnit?: number;
};

export function createViewMorphBillboardTransformAdapter(
  input: ViewMorphBillboardTransformAdapterInput = {},
): ViewMorphBillboardTransformAdapter {
  const localToWorldMatrix = input.localToWorldMatrix?.clone() ?? new Matrix4();
  const origin = input.origin ?? getMatrixOrigin(localToWorldMatrix);

  return {
    origin,
    localToWorldMatrix,
    getCameraEvaluationInput: (camera) =>
      getViewMorphCameraEvaluationInput(camera, localToWorldMatrix),
    createProjector: (projectorInput) =>
      createViewMorphBillboardProjector({
        ...projectorInput,
        origin,
        unitsPerPathUnit: input.unitsPerPathUnit ?? projectorInput.unitsPerPathUnit,
        localToWorldMatrix,
      }),
  };
}

export function evaluateViewMorphProfileForCamera(
  profile: ViewMorphProfile,
  camera: Camera,
  localToWorldMatrix = new Matrix4(),
): StructuredBezierPath {
  const input = createViewMorphBillboardTransformAdapter({
    localToWorldMatrix,
  }).getCameraEvaluationInput(camera);

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
  const localToWorldMatrix = input.localToWorldMatrix ?? new Matrix4();
  const origin = new Vector3(...(input.origin ?? getMatrixOrigin(localToWorldMatrix)));
  const right = getCameraScreenRightWorldVector(input.camera);
  const up = getCameraScreenUpWorldVector(input.camera);
  const transformBasis = getViewMorphTransformBasis(localToWorldMatrix);
  const cameraInput = getViewMorphCameraEvaluationInput(
    input.camera,
    localToWorldMatrix,
  );
  const localBillboardBasis = getViewMorphLocalBillboardBasis(cameraInput);
  const unitsPerPathUnit =
    input.unitsPerPathUnit ?? VIEW_MORPH_PROFILE_UNITS_PER_PATH_UNIT;

  return {
    pathToScreen: (point) => {
      const localDisplacement = getLocalBillboardDisplacement(
        point,
        localBillboardBasis.right,
        localBillboardBasis.up,
      );
      const worldDisplacement = localDisplacement.applyMatrix4(
        transformBasis.linearMatrix,
      );
      const screenX = worldDisplacement.dot(right);
      const screenY = worldDisplacement.dot(up);
      const worldPoint = origin
        .clone()
        .add(right.clone().multiplyScalar(screenX * unitsPerPathUnit))
        .add(up.clone().multiplyScalar(screenY * unitsPerPathUnit));
      const projected = input.projectWorldPosition(vectorToTuple(worldPoint));

      return projected ? [projected.x, projected.y] : null;
    },
  };
}

export function drawViewMorphBillboardPath(
  context: CanvasRenderingContext2D,
  input: DrawViewMorphBillboardPathInput,
): StructuredBezierPath {
  const adapter = createViewMorphBillboardTransformAdapter({
    origin: input.origin,
    localToWorldMatrix: input.localToWorldMatrix,
    unitsPerPathUnit: input.unitsPerPathUnit,
  });
  const evaluationInput = adapter.getCameraEvaluationInput(input.camera);
  const evaluatedPath = evaluateViewMorphProfileToBezierPath(
    input.profile,
    evaluationInput.viewDirectionLocal,
    {
      horizontalRotationReferenceLocal:
        evaluationInput.horizontalRotationReferenceLocal,
      screenUpReferenceLocal: evaluationInput.screenUpReferenceLocal,
    },
  );
  const projector = adapter.createProjector({
    camera: input.camera,
    projectWorldPosition: input.projectWorldPosition,
  });

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

export function getViewMorphBillboardScreenBounds(
  viewBox: [number, number, number, number],
  projector: ViewMorphBillboardProjector,
): ViewMorphScreenBounds | null {
  const [x, y, width, height] = viewBox;
  const points = [
    projector.pathToScreen([x, y]),
    projector.pathToScreen([x + width, y]),
    projector.pathToScreen([x + width, y + height]),
    projector.pathToScreen([x, y + height]),
  ].filter((point): point is [number, number] => Boolean(point));

  if (points.length === 0) {
    return null;
  }

  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point[0]),
      minY: Math.min(bounds.minY, point[1]),
      maxX: Math.max(bounds.maxX, point[0]),
      maxY: Math.max(bounds.maxY, point[1]),
    }),
    {
      minX: points[0]?.[0] ?? 0,
      minY: points[0]?.[1] ?? 0,
      maxX: points[0]?.[0] ?? 0,
      maxY: points[0]?.[1] ?? 0,
    },
  );
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

function getMatrixOrigin(matrix: Matrix4): Vector3Tuple {
  return vectorToTuple(new Vector3().setFromMatrixPosition(matrix));
}

function getViewMorphTransformBasis(matrix: Matrix4): {
  inverseRotationMatrix: Matrix4;
  linearMatrix: Matrix4;
} {
  const rotationMatrix = new Matrix4().extractRotation(matrix);
  const linearMatrix = matrix.clone();
  const elements = linearMatrix.elements;

  elements[12] = 0;
  elements[13] = 0;
  elements[14] = 0;

  return {
    inverseRotationMatrix: rotationMatrix.clone().invert(),
    linearMatrix,
  };
}

function getLocalBillboardDisplacement(
  point: ViewMorphPoint2D,
  rightLocal: Vector3,
  upLocal: Vector3,
): Vector3 {
  return rightLocal
    .clone()
    .multiplyScalar(point[0])
    .add(upLocal.clone().multiplyScalar(-point[1]));
}

function getViewMorphLocalBillboardBasis(
  input: ViewMorphCameraEvaluationInput,
): { right: Vector3; up: Vector3 } {
  const view = new Vector3(...input.viewDirectionLocal).normalize();
  const localUp = new Vector3(0, 1, 0);
  const right = new Vector3().crossVectors(localUp, view);

  if (right.lengthSq() > 0.000001) {
    return {
      right: right.normalize(),
      up: localUp,
    };
  }

  const fallbackRight = projectToHorizontalPlane(
    new Vector3(...input.horizontalRotationReferenceLocal),
  ) ?? new Vector3(1, 0, 0);
  const fallbackUp = projectToHorizontalPlane(
    new Vector3(...input.screenUpReferenceLocal),
  ) ?? new Vector3(-fallbackRight.z, 0, fallbackRight.x).normalize();

  return {
    right: fallbackRight,
    up: fallbackUp,
  };
}

function projectToHorizontalPlane(vector: Vector3): Vector3 | null {
  const projected = new Vector3(vector.x, 0, vector.z);

  return projected.lengthSq() > 0.000001 ? projected.normalize() : null;
}
