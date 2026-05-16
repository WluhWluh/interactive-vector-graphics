import { strict as assert } from "node:assert";
import {
  createDefaultViewMorphProfile,
  evaluateViewMorphProfile,
  evaluateViewMorphProfileToBezierPath,
} from "../../src/core/assets/viewMorphProfile";

type PathExtents = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
};

type Vector3 = [number, number, number];

export function runViewMorphProfileUnitTests(): void {
  const profile = createDefaultViewMorphProfile();

  assert.equal(profile.version, 1);
  assert.equal(profile.verticalPlanes.length, 2);
  assert.equal(profile.horizontalPlane.path.points.length, 8);

  for (const plane of profile.verticalPlanes) {
    assert.equal(plane.normal[1], 0);
    assert.equal(plane.tangentU[1], 0);
    assert.equal(plane.path.points.length, 8);
    assert.deepEqual(
      plane.path.points.map((point) => point.id),
      [
        "point-top",
        "point-upper-right",
        "point-right",
        "point-lower-right",
        "point-bottom",
        "point-lower-left",
        "point-left",
        "point-upper-left",
      ],
    );
    assert.equal(plane.path.points[0]?.point[0], 0);
    assert.equal(plane.path.points[4]?.point[0], 0);
  }

  const frontEvaluation = evaluateViewMorphProfile(profile, [0, 0, 1]);
  assert.equal(frontEvaluation.debug.verticalBlend.leftPlaneId, "vertical-front");
  assert.equal(frontEvaluation.debug.horizontalWeight, 0);

  const topEvaluation = evaluateViewMorphProfile(profile, [0, 1, 0]);
  assert.equal(topEvaluation.debug.horizontalWeight, 1);
  assert.equal(topEvaluation.debug.verticalWeight, 0);

  const asymmetricTopProfile = createDefaultViewMorphProfile();
  asymmetricTopProfile.horizontalPlane.path.points =
    asymmetricTopProfile.horizontalPlane.path.points.map((point) => ({
      id: point.id,
      point: [point.point[0] * 1.6, point.point[1] * 0.6],
    }));
  const topWithRightwardReference = evaluateViewMorphProfile(
    asymmetricTopProfile,
    [0, 1, 0],
    {
      horizontalRotationReferenceLocal: [1, 0, 0],
      screenUpReferenceLocal: [0, 0, 1],
    },
  );
  const topWithForwardReference = evaluateViewMorphProfile(
    asymmetricTopProfile,
    [0, 1, 0],
    {
      horizontalRotationReferenceLocal: [0, 0, 1],
      screenUpReferenceLocal: [-1, 0, 0],
    },
  );
  const topRightwardExtents = getPathExtents(topWithRightwardReference.path);
  const topForwardExtents = getPathExtents(topWithForwardReference.path);

  assert.ok(
    topRightwardExtents.width > topRightwardExtents.height + 80,
    "top view should align the long horizontal profile axis with a rightward reference",
  );
  assert.ok(
    topForwardExtents.height > topForwardExtents.width + 80,
    "top view should rotate the horizontal profile from a forward reference",
  );

  const asymmetricBottomWithRightwardReference = evaluateViewMorphProfile(
    asymmetricTopProfile,
    [0, -1, 0],
    {
      horizontalRotationReferenceLocal: [1, 0, 0],
      screenUpReferenceLocal: [0, 0, 1],
    },
  );
  const asymmetricBottomWithForwardReference = evaluateViewMorphProfile(
    asymmetricTopProfile,
    [0, -1, 0],
    {
      horizontalRotationReferenceLocal: [0, 0, 1],
      screenUpReferenceLocal: [-1, 0, 0],
    },
  );

  assert.deepEqual(
    getPathExtents(asymmetricBottomWithRightwardReference.path),
    getPathExtents(topWithRightwardReference.path),
    "top and bottom vertical views with a zero rotation reference should match",
  );
  assert.deepEqual(
    getPathExtents(asymmetricBottomWithForwardReference.path),
    getPathExtents(topWithForwardReference.path),
    "top and bottom vertical views with a symmetric profile should preserve extents",
  );

  for (let index = 0; index < 8; index += 1) {
    const angle = (index * Math.PI) / 4;
    const evaluated = evaluateViewMorphProfileToBezierPath(profile, [
      Math.sin(angle),
      0,
      Math.cos(angle),
    ]);
    const anchors = evaluated.segments.map((segment) => segment.anchor);
    const xs = anchors.map((anchor) => anchor[0]);
    const ys = anchors.map((anchor) => anchor[1]);
    const radii = anchors.map((anchor) => Math.hypot(anchor[0], anchor[1]));

    assert.ok(
      Math.min(...radii) > 49.9,
      `horizontal direction ${index} should not flatten inward`,
    );
    assert.ok(
      Math.max(...radii) < 50.1,
      `horizontal direction ${index} should stay near the template radius`,
    );
    assert.ok(Math.min(...xs) < -49.9, `horizontal direction ${index} needs left extent`);
    assert.ok(Math.max(...xs) > 49.9, `horizontal direction ${index} needs right extent`);
    assert.ok(Math.min(...ys) < -49.9, `horizontal direction ${index} needs top extent`);
    assert.ok(Math.max(...ys) > 49.9, `horizontal direction ${index} needs bottom extent`);
  }

  for (const direction of [
    [1, 1, 1],
    [-1, 1, 0.35],
    [0.25, -0.75, 1],
  ] as Array<[number, number, number]>) {
    const evaluated = evaluateViewMorphProfileToBezierPath(profile, direction);
    assert.equal(evaluated.closed, true);
    assert.equal(
      evaluated.segments.length,
      profile.verticalPlanes[0]!.path.points.length +
        profile.horizontalPlane.path.points.length,
    );
    assert.ok(evaluated.segments.every((segment) => segment.anchor.every(Number.isFinite)));
  }

  const mixedPointCountProfile = createDefaultViewMorphProfile();
  mixedPointCountProfile.horizontalPlane.path.points = [
    { id: "point-east", point: [60, 0] },
    { id: "point-north", point: [0, 35] },
    { id: "point-west", point: [-45, 0] },
    { id: "point-south", point: [0, -55] },
  ];
  const mixedPointCountEvaluation = evaluateViewMorphProfileToBezierPath(
    mixedPointCountProfile,
    [0.35, 0.8, 1],
  );

  assert.equal(mixedPointCountEvaluation.closed, true);
  assert.equal(
    mixedPointCountEvaluation.segments.length,
    mixedPointCountProfile.verticalPlanes[0]!.path.points.length +
      mixedPointCountProfile.horizontalPlane.path.points.length,
  );
  assert.ok(
    mixedPointCountEvaluation.segments.every((segment) =>
      [...segment.anchor, ...segment.handleIn, ...segment.handleOut].every(Number.isFinite),
    ),
  );

  for (const pitchDegrees of [-75, -45, -20, 20, 45, 75]) {
    for (let yawIndex = 0; yawIndex < 8; yawIndex += 1) {
      const yaw = (yawIndex * Math.PI) / 4;
      const pitch = (pitchDegrees * Math.PI) / 180;
      const direction: [number, number, number] = [
        Math.cos(pitch) * Math.sin(yaw),
        Math.sin(pitch),
        Math.cos(pitch) * Math.cos(yaw),
      ];
      const evaluated = evaluateViewMorphProfileToBezierPath(profile, direction, {
        ...getOrbitLikeScreenBasis(direction),
      });
      const extents = getPathExtents(evaluated);

      assert.ok(
        extents.width > 94,
        `default template should not flatten horizontally at pitch ${pitchDegrees}, yaw ${yawIndex}`,
      );
      assert.ok(
        extents.height > 94,
        `default template should not flatten vertically at pitch ${pitchDegrees}, yaw ${yawIndex}`,
      );
      assert.ok(
        Math.abs(extents.width - extents.height) < 8,
        `default template should stay near circular at pitch ${pitchDegrees}, yaw ${yawIndex}`,
      );
    }
  }
}

function getPathExtents(path: ViewMorphProfileEvaluationPath): PathExtents {
  const anchors = path.segments.map((segment) => segment.anchor);
  const xs = anchors.map((anchor) => anchor[0]);
  const ys = anchors.map((anchor) => anchor[1]);
  const minX = Number(Math.min(...xs).toFixed(4));
  const maxX = Number(Math.max(...xs).toFixed(4));
  const minY = Number(Math.min(...ys).toFixed(4));
  const maxY = Number(Math.max(...ys).toFixed(4));

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: Number((maxX - minX).toFixed(4)),
    height: Number((maxY - minY).toFixed(4)),
  };
}

type ViewMorphProfileEvaluationPath = ReturnType<
  typeof evaluateViewMorphProfileToBezierPath
>;

function getOrbitLikeScreenBasis(viewDirection: Vector3): {
  horizontalRotationReferenceLocal: Vector3;
  screenUpReferenceLocal: Vector3;
} {
  const view = normalize3D(viewDirection);
  let right = cross3D([0, 1, 0], view);

  if (length3D(right) <= 0.000001) {
    right = [1, 0, 0];
  } else {
    right = normalize3D(right);
  }

  return {
    horizontalRotationReferenceLocal: right,
    screenUpReferenceLocal: normalize3D(cross3D(view, right)),
  };
}

function cross3D(left: Vector3, right: Vector3): Vector3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function length3D(vector: Vector3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalize3D(vector: Vector3): Vector3 {
  const length = length3D(vector) || 1;

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}
