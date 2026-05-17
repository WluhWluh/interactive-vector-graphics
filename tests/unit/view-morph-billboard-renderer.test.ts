import { strict as assert } from "node:assert";
import { Euler, Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three";
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
  assertRotatedScaleAwareProjection();
  assertNestedMatrixScaleAwareProjection();
  assertRotatedEvaluationDoesNotFlattenDefaultProfile(profile);
  assertRotationPreservesProjectedPath(profile);
  assertRotationIsEquivalentToCameraReorientation(profile);
  assertXRotatedPrefabRollsAsRigidScreenShape();
}

function assertRotatedEvaluationDoesNotFlattenDefaultProfile(
  profile: ReturnType<typeof createDefaultViewMorphProfile>,
): void {
  for (const rotationY of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
    const matrix = composeMatrix({
      rotation: [0, rotationY, 0],
      scale: [2, 3, 4],
    });

    for (const direction of getRegressionViewDirections()) {
      const camera = createCameraLookingFrom(direction);
      const evaluated = evaluateViewMorphProfileForCamera(profile, camera, matrix);
      const extents = getPathExtents(evaluated);

      assert.ok(
        extents.width > 94,
        `rotated default view morph should not flatten horizontally at rotation ${rotationY}, direction ${direction.join(",")}`,
      );
      assert.ok(
        extents.height > 94,
        `rotated default view morph should not flatten vertically at rotation ${rotationY}, direction ${direction.join(",")}`,
      );
    }
  }
}

function assertRotationPreservesProjectedPath(
  profile: ReturnType<typeof createDefaultViewMorphProfile>,
): void {
  const baseCamera = createCameraLookingFrom([0.35, 0.22, 1]);
  const rotation = composeMatrix({ rotation: [0, Math.PI / 2, 0] });
  const rotatedCamera = createRotatedCameraAroundOrigin(baseCamera, rotation);
  const baseMatrix = composeMatrix({});
  const rotatedMatrix = rotation.clone();

  const baseEvaluation = evaluateViewMorphProfileForCamera(
    profile,
    baseCamera,
    baseMatrix,
  );
  const rotatedEvaluation = evaluateViewMorphProfileForCamera(
    profile,
    rotatedCamera,
    rotatedMatrix,
  );

  assert.ok(
    getApproximatePathDistance(baseEvaluation, rotatedEvaluation) < 0.05,
    "rotating the asset and camera together should preserve the evaluated view morph path",
  );

  const baseProjected = sampleProjectedPath(
    baseEvaluation,
    createViewMorphBillboardProjector({
      camera: baseCamera,
      origin: [0, 0, 0],
      projectWorldPosition: createPerspectiveScreenProjector(baseCamera),
      localToWorldMatrix: baseMatrix,
    }),
  );
  const rotatedProjected = sampleProjectedPath(
    rotatedEvaluation,
    createViewMorphBillboardProjector({
      camera: rotatedCamera,
      origin: [0, 0, 0],
      projectWorldPosition: createPerspectiveScreenProjector(rotatedCamera),
      localToWorldMatrix: rotatedMatrix,
    }),
  );

  assert.ok(
    getAveragePointDistance(baseProjected, rotatedProjected) < 0.05,
    "rotating the asset and camera together should preserve the projected view morph path",
  );
}

function assertRotationIsEquivalentToCameraReorientation(
  profile: ReturnType<typeof createDefaultViewMorphProfile>,
): void {
  const camera = createCameraLookingFrom([0.35, 0.22, 1]);
  const rotation = composeMatrix({ rotation: [0, Math.PI / 2, 0] });
  const inverseRotation = rotation.clone().invert();
  const rotatedAssetProjected = sampleProjectedViewMorphPath(
    profile,
    camera,
    rotation,
  );
  const reorientedCamera = createRotatedCameraAroundOrigin(
    camera,
    inverseRotation,
  );
  const baseAssetProjected = sampleProjectedViewMorphPath(
    profile,
    reorientedCamera,
    composeMatrix({}),
  );

  assert.ok(
    getAveragePointDistance(rotatedAssetProjected, baseAssetProjected) < 0.05,
    "rotating the asset should be equivalent to reorienting the camera for the projected path",
  );
}

function assertXRotatedPrefabRollsAsRigidScreenShape(): void {
  const profile = createIrregularViewMorphProfile();
  const localToWorldMatrix = composeMatrix({
    rotation: [Math.PI / 2, 0, 0],
  });
  const baseCamera = createCameraLookingFrom([0, 1, 0]);
  const baseProjected = sampleProjectedViewMorphPath(
    profile,
    baseCamera,
    localToWorldMatrix,
  );

  for (const rollDegrees of [15, 30, 45, 60, 75, 90, 120, 150, 180]) {
    const rollRadians = (rollDegrees * Math.PI) / 180;
    const rolledCamera = createCameraLookingFrom([0, 1, 0], rollRadians);
    const rolledProjected = sampleProjectedViewMorphPath(
      profile,
      rolledCamera,
      localToWorldMatrix,
    );
    const expected = rotateCanvasPoints(baseProjected, rollRadians);
    const distance = getApproximatePointSetDistance(expected, rolledProjected);

    assert.ok(
      distance < 0.01,
      `X-rotated view morph should only roll rigidly in screen space at ${rollDegrees} degrees, got ${distance}`,
    );
  }
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

function assertRotatedScaleAwareProjection(): void {
  const camera = createCameraLookingFrom([1, 0, 0]);
  const matrix = composeMatrix({
    rotation: [0, Math.PI / 2, 0],
    scale: [2, 3, 4],
  });
  const projector = createViewMorphBillboardProjector({
    camera,
    origin: [0, 0, 0],
    projectWorldPosition: createCameraScreenSpaceProjector(camera),
    localToWorldMatrix: matrix,
  });
  const baseProjector = createViewMorphBillboardProjector({
    camera,
    origin: [0, 0, 0],
    projectWorldPosition: createCameraScreenSpaceProjector(camera),
    localToWorldMatrix: composeMatrix({ rotation: [0, Math.PI / 2, 0] }),
  });
  const baseHorizontal = baseProjector.pathToScreen([50, 0]);
  const scaledHorizontal = projector.pathToScreen([50, 0]);
  const baseVertical = baseProjector.pathToScreen([0, -50]);
  const scaledVertical = projector.pathToScreen([0, -50]);

  assert.ok(baseHorizontal && scaledHorizontal && baseVertical && scaledVertical);
  assert.equal(
    getDominantScaleRatio(scaledHorizontal, baseHorizontal),
    2,
    "rotated view morph should apply local X scale along the rotated screen horizontal axis",
  );
  assert.equal(
    getDominantScaleRatio(scaledVertical, baseVertical),
    3,
    "rotated view morph should keep local Y scale along the vertical axis",
  );
}

function assertNestedMatrixScaleAwareProjection(): void {
  const camera = createCameraLookingFrom([0, 0, 1]);
  const parent = composeMatrix({ rotation: [0, Math.PI / 2, 0], scale: [1, 2, 1] });
  const child = composeMatrix({ rotation: [0, -Math.PI / 2, 0], scale: [2, 3, 4] });
  const nested = parent.clone().multiply(child);
  const base = composeMatrix({});
  const baseProjector = createViewMorphBillboardProjector({
    camera,
    origin: [0, 0, 0],
    projectWorldPosition: createCameraScreenSpaceProjector(camera),
    localToWorldMatrix: base,
  });
  const nestedProjector = createViewMorphBillboardProjector({
    camera,
    origin: [0, 0, 0],
    projectWorldPosition: createCameraScreenSpaceProjector(camera),
    localToWorldMatrix: nested,
  });
  const baseVertical = baseProjector.pathToScreen([0, -50]);
  const nestedVertical = nestedProjector.pathToScreen([0, -50]);

  assert.ok(baseVertical && nestedVertical);
  assert.equal(
    getDominantScaleRatio(nestedVertical, baseVertical),
    6,
    "nested group and node scale should preserve the full world matrix scale for view morph projection",
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

function createCameraLookingFrom(
  direction: Vector3Tuple,
  rollRadians = 0,
): PerspectiveCamera {
  const viewDirection = new Vector3(...direction).normalize();
  const camera = new PerspectiveCamera(45, 1, 0.05, 120);

  camera.position.copy(viewDirection.multiplyScalar(6));
  camera.lookAt(0, 0, 0);

  if (rollRadians !== 0) {
    camera.quaternion.premultiply(
      new Quaternion().setFromAxisAngle(
        new Vector3(...direction).normalize(),
        rollRadians,
      ),
    );
  }

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

function composeMatrix(input: {
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  scale?: Vector3Tuple;
}): Matrix4 {
  const position = new Vector3(...(input.position ?? [0, 0, 0]));
  const rotation = new Quaternion().setFromEuler(
    new Euler(...(input.rotation ?? [0, 0, 0]), "XYZ"),
  );
  const scale = new Vector3(...(input.scale ?? [1, 1, 1]));

  return new Matrix4().compose(position, rotation, scale);
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

function getPathExtents(path: ReturnType<typeof evaluateViewMorphProfileForCamera>): {
  width: number;
  height: number;
} {
  const xs = path.segments.map((segment) => segment.anchor[0]);
  const ys = path.segments.map((segment) => segment.anchor[1]);

  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function createPerspectiveScreenProjector(
  camera: PerspectiveCamera,
): (position: Vector3Tuple) => { x: number; y: number } {
  return (position) => {
    const projected = new Vector3(...position).project(camera);

    return {
      x: Number(projected.x.toFixed(6)),
      y: Number(projected.y.toFixed(6)),
    };
  };
}

function getApproximatePathDistance(
  left: ReturnType<typeof evaluateViewMorphProfileForCamera>,
  right: ReturnType<typeof evaluateViewMorphProfileForCamera>,
): number {
  const leftPoints = samplePath(left);
  const rightPoints = samplePath(right);

  return Math.max(
    Math.max(...leftPoints.map((point) => getNearestPointDistance(point, rightPoints))),
    Math.max(...rightPoints.map((point) => getNearestPointDistance(point, leftPoints))),
  );
}

function sampleProjectedPath(
  path: ReturnType<typeof evaluateViewMorphProfileForCamera>,
  projector: ReturnType<typeof createViewMorphBillboardProjector>,
  totalSamples = 1024,
): Array<[number, number]> {
  return Array.from({ length: totalSamples }, (_, sampleIndex): [number, number] => {
    const scaledIndex = (sampleIndex / totalSamples) * path.segments.length;
    const segmentIndex = Math.floor(scaledIndex) % path.segments.length;
    const segment = path.segments[segmentIndex]!;
    const nextSegment = path.segments[(segmentIndex + 1) % path.segments.length]!;
    const p0 = projector.pathToScreen(segment.anchor);
    const p1 = projector.pathToScreen([
      segment.anchor[0] + segment.handleOut[0],
      segment.anchor[1] + segment.handleOut[1],
    ]);
    const p2 = projector.pathToScreen([
      nextSegment.anchor[0] + nextSegment.handleIn[0],
      nextSegment.anchor[1] + nextSegment.handleIn[1],
    ]);
    const p3 = projector.pathToScreen(nextSegment.anchor);
    const t = scaledIndex - segmentIndex;
    const inverseT = 1 - t;

    if (!p0 || !p1 || !p2 || !p3) {
      return [NaN, NaN];
    }

    return [
      inverseT ** 3 * p0[0] +
        3 * inverseT ** 2 * t * p1[0] +
        3 * inverseT * t ** 2 * p2[0] +
        t ** 3 * p3[0],
      inverseT ** 3 * p0[1] +
        3 * inverseT ** 2 * t * p1[1] +
        3 * inverseT * t ** 2 * p2[1] +
        t ** 3 * p3[1],
    ];
  });
}

function sampleProjectedViewMorphPath(
  profile: ReturnType<typeof createDefaultViewMorphProfile>,
  camera: PerspectiveCamera,
  localToWorldMatrix: Matrix4,
): Array<[number, number]> {
  const projector = createViewMorphBillboardProjector({
    camera,
    origin: [0, 0, 0],
    projectWorldPosition: createPerspectiveScreenProjector(camera),
    localToWorldMatrix,
  });
  const evaluated = evaluateViewMorphProfileForCamera(
    profile,
    camera,
    localToWorldMatrix,
  );

  return sampleProjectedPath(evaluated, projector);
}

function samplePath(
  path: ReturnType<typeof evaluateViewMorphProfileForCamera>,
  totalSamples = 1024,
): Array<[number, number]> {
  return Array.from({ length: totalSamples }, (_, sampleIndex): [number, number] => {
    const scaledIndex = (sampleIndex / totalSamples) * path.segments.length;
    const segmentIndex = Math.floor(scaledIndex) % path.segments.length;
    const segment = path.segments[segmentIndex]!;
    const nextSegment = path.segments[(segmentIndex + 1) % path.segments.length]!;
    const p0 = segment.anchor;
    const p1: [number, number] = [
      segment.anchor[0] + segment.handleOut[0],
      segment.anchor[1] + segment.handleOut[1],
    ];
    const p2: [number, number] = [
      nextSegment.anchor[0] + nextSegment.handleIn[0],
      nextSegment.anchor[1] + nextSegment.handleIn[1],
    ];
    const p3 = nextSegment.anchor;
    const t = scaledIndex - segmentIndex;
    const inverseT = 1 - t;

    return [
      inverseT ** 3 * p0[0] +
        3 * inverseT ** 2 * t * p1[0] +
        3 * inverseT * t ** 2 * p2[0] +
        t ** 3 * p3[0],
      inverseT ** 3 * p0[1] +
        3 * inverseT ** 2 * t * p1[1] +
        3 * inverseT * t ** 2 * p2[1] +
        t ** 3 * p3[1],
    ];
  });
}

function getNearestPointDistance(
  point: [number, number],
  candidates: Array<[number, number]>,
): number {
  return Math.min(
    ...candidates.map((candidate) =>
      Math.hypot(point[0] - candidate[0], point[1] - candidate[1]),
    ),
  );
}

function getAveragePointDistance(
  left: Array<[number, number]>,
  right: Array<[number, number]>,
): number {
  const count = Math.min(left.length, right.length);
  let total = 0;

  for (let index = 0; index < count; index += 1) {
    total += Math.hypot(
      left[index]![0] - right[index]![0],
      left[index]![1] - right[index]![1],
    );
  }

  return count > 0 ? total / count : Number.POSITIVE_INFINITY;
}

function getApproximatePointSetDistance(
  left: Array<[number, number]>,
  right: Array<[number, number]>,
): number {
  return Math.max(
    Math.max(...left.map((point) => getNearestPointDistance(point, right))),
    Math.max(...right.map((point) => getNearestPointDistance(point, left))),
  );
}

function rotateCanvasPoints(
  points: Array<[number, number]>,
  angleRadians: number,
): Array<[number, number]> {
  const cosine = Math.cos(angleRadians);
  const sine = Math.sin(angleRadians);

  return points.map(([x, y]) => {
    const canvasY = -y;
    const rotatedX = x * cosine - canvasY * sine;
    const rotatedCanvasY = x * sine + canvasY * cosine;

    return [rotatedX, -rotatedCanvasY];
  });
}

function createRotatedCameraAroundOrigin(
  camera: PerspectiveCamera,
  rotationMatrix: Matrix4,
): PerspectiveCamera {
  const rotatedCamera = new PerspectiveCamera(
    camera.fov,
    camera.aspect,
    camera.near,
    camera.far,
  );
  const position = new Vector3().copy(camera.position).applyMatrix4(rotationMatrix);
  const target = new Vector3(0, 0, 0).applyMatrix4(rotationMatrix);

  rotatedCamera.position.copy(position);
  rotatedCamera.lookAt(target);
  rotatedCamera.updateMatrixWorld(true);

  return rotatedCamera;
}

function createIrregularViewMorphProfile(): ReturnType<
  typeof createDefaultViewMorphProfile
> {
  const profile = createDefaultViewMorphProfile();

  profile.verticalPlanes[0]!.path.points = [
    { id: "point-top", point: [0, -66] },
    { id: "point-upper-right", point: [44, -42] },
    { id: "point-right", point: [58, 2] },
    { id: "point-lower-right", point: [31, 47] },
    { id: "point-bottom", point: [0, 69] },
    { id: "point-lower-left", point: [-52, 37] },
    { id: "point-left", point: [-64, -7] },
    { id: "point-upper-left", point: [-37, -53] },
  ];
  profile.verticalPlanes[1]!.path.points = [
    { id: "point-top", point: [0, -52] },
    { id: "point-upper-right", point: [59, -35] },
    { id: "point-right", point: [75, 8] },
    { id: "point-lower-right", point: [47, 38] },
    { id: "point-bottom", point: [0, 58] },
    { id: "point-lower-left", point: [-38, 45] },
    { id: "point-left", point: [-51, 0] },
    { id: "point-upper-left", point: [-28, -41] },
  ];
  profile.horizontalPlane.path.points = [
    { id: "point-east", point: [72, -5] },
    { id: "point-north-east", point: [32, -38] },
    { id: "point-north", point: [0, -48] },
    { id: "point-north-west", point: [-44, -26] },
    { id: "point-west", point: [-66, 7] },
    { id: "point-south-west", point: [-31, 46] },
    { id: "point-south", point: [7, 58] },
    { id: "point-south-east", point: [53, 34] },
  ];

  return profile;
}
