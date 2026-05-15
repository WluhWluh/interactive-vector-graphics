import { strict as assert } from "node:assert";
import {
  calculateViewMorphPlaneWeights,
  createDefaultViewMorphProfile,
  evaluateViewMorphProfileToBezierPath,
} from "../../src/core/assets/viewMorphProfile";

export function runViewMorphProfileUnitTests(): void {
  const profile = createDefaultViewMorphProfile();

  assert.equal(profile.version, 1);
  assert.equal(profile.planes.length, 3);

  for (const plane of profile.planes) {
    assert.equal(plane.path.closed, true);
    assert.equal(plane.path.segments.length, 4);
    assert.deepEqual(
      plane.path.segments.map((segment) => segment.id),
      ["seg-1", "seg-2", "seg-3", "seg-4"],
    );
  }

  const frontPath = evaluateViewMorphProfileToBezierPath(profile, [0, 0, 1]);
  assert.deepEqual(frontPath, profile.planes[0]?.path);

  const sidePath = evaluateViewMorphProfileToBezierPath(profile, [1, 0, 0]);
  assert.deepEqual(sidePath, profile.planes[1]?.path);

  const topPath = evaluateViewMorphProfileToBezierPath(profile, [0, 1, 0]);
  assert.deepEqual(topPath, profile.planes[2]?.path);

  const weights = calculateViewMorphPlaneWeights(profile, [1, 0, 0]);
  assert.equal(weights.find((weight) => weight.planeId === "plane-front")?.weight, 0);
  assert.equal(weights.find((weight) => weight.planeId === "plane-top")?.weight, 0);
  assert.equal(weights.find((weight) => weight.planeId === "plane-side")?.weight, 1);

  for (const direction of [
    [1, 1, 1],
    [-1, 1, 0.35],
    [0.25, -0.75, 1],
  ] as Array<[number, number, number]>) {
    const evaluated = evaluateViewMorphProfileToBezierPath(profile, direction);
    assert.equal(evaluated.closed, true);
    assert.equal(evaluated.segments.length, 4);
    assert.deepEqual(
      evaluated.segments.map((segment) => segment.id),
      ["seg-1", "seg-2", "seg-3", "seg-4"],
    );
    assert.deepEqual(evaluated.segments[0]?.anchor, [0, -50]);
    assert.deepEqual(evaluated.segments[1]?.anchor, [50, 0]);
    assert.deepEqual(evaluated.segments[2]?.anchor, [0, 50]);
    assert.deepEqual(evaluated.segments[3]?.anchor, [-50, 0]);
  }
}
