import { strict as assert } from "node:assert";
import { Matrix4, PerspectiveCamera, Vector3 } from "three";
import { createDefaultViewMorphProfile } from "../../src/core/assets/viewMorphProfile";
import {
  evaluateViewMorphProfileForCamera,
  getViewMorphCameraEvaluationInput,
} from "../../src/editor/render/viewMorphBillboardRenderer";
import { transformToMatrix } from "../../src/editor/tools/prefabTransform";

type Vector3Tuple = [number, number, number];

export function runViewMorphBillboardRendererUnitTests(): void {
  const profile = createDefaultViewMorphProfile();

  for (const direction of getRegressionViewDirections()) {
    const camera = createCameraLookingFrom(direction);
    const previewInput = getViewMorphCameraEvaluationInput(camera, new Matrix4());
    const prefabInput = getViewMorphCameraEvaluationInput(
      camera,
      transformToMatrix({
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      }),
    );

    assert.deepEqual(
      roundCameraInput(prefabInput),
      roundCameraInput(previewInput),
      `untransformed prefab should use the same view morph camera input as Source Path Edit for direction ${direction.join(",")}`,
    );
    assert.deepEqual(
      evaluateViewMorphProfileForCamera(profile, camera, new Matrix4()),
      evaluateViewMorphProfileForCamera(
        profile,
        camera,
        transformToMatrix({
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        }),
      ),
      `untransformed prefab should evaluate the same final path as Source Path Edit for direction ${direction.join(",")}`,
    );
  }
}

function getRegressionViewDirections(): Vector3Tuple[] {
  const directions: Vector3Tuple[] = [
    [0, 0, 1],
    [1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
  ];

  for (const pitchDegrees of [-60, -45, -20, 20, 45, 60]) {
    for (let yawDegrees = 0; yawDegrees < 360; yawDegrees += 45) {
      directions.push(getYawPitchDirection(yawDegrees, pitchDegrees));
    }
  }

  return directions;
}

function createCameraLookingFrom(direction: Vector3Tuple): PerspectiveCamera {
  const viewDirection = new Vector3(...direction).normalize();
  const camera = new PerspectiveCamera(45, 1, 0.05, 120);

  camera.position.copy(viewDirection.multiplyScalar(6));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);

  return camera;
}

function getYawPitchDirection(
  yawDegrees: number,
  pitchDegrees: number,
): Vector3Tuple {
  const yaw = (yawDegrees * Math.PI) / 180;
  const pitch = (pitchDegrees * Math.PI) / 180;

  return [
    Math.cos(pitch) * Math.sin(yaw),
    Math.sin(pitch),
    Math.cos(pitch) * Math.cos(yaw),
  ];
}

function roundCameraInput(
  input: ReturnType<typeof getViewMorphCameraEvaluationInput>,
): ReturnType<typeof getViewMorphCameraEvaluationInput> {
  return {
    viewDirectionLocal: roundTuple(input.viewDirectionLocal),
    horizontalRotationReferenceLocal: roundTuple(
      input.horizontalRotationReferenceLocal,
    ),
    screenUpReferenceLocal: roundTuple(input.screenUpReferenceLocal),
  };
}

function roundTuple(tuple: Vector3Tuple): Vector3Tuple {
  return tuple.map((value) => Number(value.toFixed(6))) as Vector3Tuple;
}
