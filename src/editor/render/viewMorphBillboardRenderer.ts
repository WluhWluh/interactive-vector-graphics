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
  const viewDirectionLocal = viewDirection
    .negate()
    .normalize()
    .applyMatrix4(inverseRotation);
  const frame = getViewMorphLocalBillboardFrame(viewDirectionLocal);

  return {
    viewDirectionLocal: vectorToPoint3D(viewDirectionLocal),
    horizontalRotationReferenceLocal: vectorToPoint3D(frame.rightLocal),
    screenUpReferenceLocal: vectorToPoint3D(frame.upLocal),
  };
}

export function createViewMorphBillboardProjector(
  input: ViewMorphBillboardProjectorInput,
): ViewMorphBillboardProjector {
  const localToWorldMatrix = input.localToWorldMatrix ?? new Matrix4();
  const origin = new Vector3(...(input.origin ?? getMatrixOrigin(localToWorldMatrix)));
  const evaluationInput = getViewMorphCameraEvaluationInput(
    input.camera,
    localToWorldMatrix,
  );
  const frame = getViewMorphLocalBillboardFrame(
    new Vector3(...evaluationInput.viewDirectionLocal),
  );
  const unitsPerPathUnit =
    input.unitsPerPathUnit ?? VIEW_MORPH_PROFILE_UNITS_PER_PATH_UNIT;
  const originProjected = input.projectWorldPosition(vectorToTuple(origin));
  const rightProjected = input.projectWorldPosition(
    vectorToTuple(
      origin
        .clone()
        .add(
          transformLocalDirection(localToWorldMatrix, frame.rightLocal)
            .multiplyScalar(unitsPerPathUnit),
        ),
    ),
  );
  const upProjected = input.projectWorldPosition(
    vectorToTuple(
      origin
        .clone()
        .add(
          transformLocalDirection(localToWorldMatrix, frame.upLocal)
            .multiplyScalar(unitsPerPathUnit),
        ),
    ),
  );

  return {
    pathToScreen: (point) => {
      if (!originProjected || !rightProjected || !upProjected) {
        return null;
      }

      const rightScreen = {
        x: rightProjected.x - originProjected.x,
        y: rightProjected.y - originProjected.y,
      };
      const upScreen = {
        x: upProjected.x - originProjected.x,
        y: upProjected.y - originProjected.y,
      };

      return [
        originProjected.x + rightScreen.x * point[0] - upScreen.x * point[1],
        originProjected.y + rightScreen.y * point[0] - upScreen.y * point[1],
      ];
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

function getViewMorphLocalBillboardFrame(viewDirectionLocal: Vector3): {
  rightLocal: Vector3;
  upLocal: Vector3;
} {
  const view = viewDirectionLocal.clone().normalize();
  const preferredUp = new Vector3(0, 1, 0);
  let upLocal = projectOntoViewPlane(preferredUp, view);

  if (upLocal.lengthSq() < 0.000001) {
    const fallbackUp = view.y >= 0 ? new Vector3(0, 0, -1) : new Vector3(0, 0, 1);
    upLocal = projectOntoViewPlane(fallbackUp, view);
  }

  if (upLocal.lengthSq() < 0.000001) {
    upLocal.set(0, 0, -1);
  }

  upLocal.normalize();

  const rightLocal = new Vector3().crossVectors(upLocal, view).normalize();

  return {
    rightLocal,
    upLocal,
  };
}

function projectOntoViewPlane(vector: Vector3, viewDirection: Vector3): Vector3 {
  return vector
    .clone()
    .sub(viewDirection.clone().multiplyScalar(vector.dot(viewDirection)));
}

function transformLocalDirection(matrix: Matrix4, direction: Vector3): Vector3 {
  const origin = new Vector3(0, 0, 0).applyMatrix4(matrix);

  return direction.clone().applyMatrix4(matrix).sub(origin);
}
