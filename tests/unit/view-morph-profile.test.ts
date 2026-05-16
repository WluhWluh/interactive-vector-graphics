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
