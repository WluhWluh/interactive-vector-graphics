import { strict as assert } from "node:assert";
import { Matrix4, PerspectiveCamera, Vector3 } from "three";
import { createDefaultViewMorphProfile } from "../../src/core/assets/viewMorphProfile";
import {
  createViewMorphBillboardProjector,
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

  assertScaleAwareProjection("front", [0, 0, 1], {
    horizontalSourceAxis: "x",
    verticalSourceAxis: "y",
  });
  assertScaleAwareProjection("side", [1, 0, 0], {
    horizontalSourceAxis: "z",
    verticalSourceAxis: "y",
  });
  assertScaleAwareProjection("top", [0, 1, 0], {
    horizontalSourceAxis: "x",
    verticalSourceAxis: "z",
  });
}

function assertScaleAwareProjection(
  label: string,
  direction: Vector3Tuple,
  axes: { horizontalSourceAxis: "x" | "y" | "z"; verticalSourceAxis: "x" | "y" | "z" },
): void {
  const camera = createCameraLookingFrom(direction);
  const baseProjector = createViewMorphBillboardProjector({
    camera,
    origin: [0, 0, 0],
    projectWorldPosition: createCameraScreenSpaceProjector(camera),
    localToWorldMatrix: transformToMatrix({
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    }),
  });
  const scaledProjector = createViewMorphBillboardProjector({
    camera,
    origin: [0, 0, 0],
    projectWorldPosition: createCameraScreenSpaceProjector(camera),
    localToWorldMatrix: transformToMatrix({
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [2, 3, 4],
    }),
  });
  const baseHorizontal = baseProjector.pathToScreen([50, 0]);
  const scaledHorizontal = scaledProjector.pathToScreen([50, 0]);
  const baseVertical = baseProjector.pathToScreen([0, -50]);
  const scaledVertical = scaledProjector.pathToScreen([0, -50]);

  assert.ok(baseHorizontal && scaledHorizontal && baseVertical && scaledVertical);
  assert.equal(
    getDominantScaleRatio(scaledHorizontal, baseHorizontal),
    getAxisScale(axes.horizontalSourceAxis),
    `${label} horizontal billboard extent should follow local ${axes.horizontalSourceAxis.toUpperCase()} scale`,
  );
  assert.equal(
    getDominantScaleRatio(scaledVertical, baseVertical),
    getAxisScale(axes.verticalSourceAxis),
    `${label} vertical billboard extent should follow local ${axes.verticalSourceAxis.toUpperCase()} scale`,
  );
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

function createCameraScreenSpaceProjector(
  camera: PerspectiveCamera,
): (position: Vector3Tuple) => { x: number; y: number } {
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();

  return (position) => {
    const point = new Vector3(...position);

    return {
      x: Number(point.dot(right).toFixed(6)),
      y: Number(point.dot(up).toFixed(6)),
    };
  };
}

function getDominantScaleRatio(
  scaled: [number, number],
  base: [number, number],
): number {
  const xRatio = Math.abs(base[0]) > 0.000001 ? scaled[0] / base[0] : 0;
  const yRatio = Math.abs(base[1]) > 0.000001 ? scaled[1] / base[1] : 0;
  const ratio = Math.abs(xRatio) > Math.abs(yRatio) ? xRatio : yRatio;

  return Number(Math.abs(ratio).toFixed(6));
}

function getAxisScale(axis: "x" | "y" | "z"): number {
  return { x: 2, y: 3, z: 4 }[axis];
}
