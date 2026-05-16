import { strict as assert } from "node:assert";
import {
  createDefaultViewMorphProfile,
  evaluateViewMorphProfile,
  evaluateViewMorphProfileToBezierPath,
} from "../../src/core/assets/viewMorphProfile";

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
  const topWithRightwardScreenUp = evaluateViewMorphProfile(
    asymmetricTopProfile,
    [0, 1, 0],
    { horizontalRotationReferenceLocal: [1, 0, 0] },
  );
  const topWithForwardScreenUp = evaluateViewMorphProfile(
    asymmetricTopProfile,
    [0, 1, 0],
    { horizontalRotationReferenceLocal: [0, 0, 1] },
  );
  const rightAnchorWithRightwardScreenUp =
    topWithRightwardScreenUp.path.segments[2]?.anchor;
  const rightAnchorWithForwardScreenUp =
    topWithForwardScreenUp.path.segments[2]?.anchor;

  assert.ok(rightAnchorWithRightwardScreenUp, "expected a right-side anchor");
  assert.ok(rightAnchorWithForwardScreenUp, "expected a right-side anchor");
  assert.ok(
    Math.abs(rightAnchorWithRightwardScreenUp[0]) >
      Math.abs(rightAnchorWithForwardScreenUp[0]) + 20,
    "top view should rotate the horizontal profile from the screen orientation reference",
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
    assert.equal(evaluated.segments.length, 8);
    assert.deepEqual(
      evaluated.segments.map((segment) => segment.id),
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
    assert.ok(evaluated.segments.every((segment) => segment.anchor.every(Number.isFinite)));
  }
}
