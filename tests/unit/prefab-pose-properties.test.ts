import { strict as assert } from "node:assert";
import { createBezierSegment } from "../helpers/serverSmokeAssertions";
import {
  getPrefabPosePropertyAdapter,
  isPathPosePropertyAdapter,
  isVectorPosePropertyAdapter,
} from "../../src/editor/pose/prefabPoseProperties";
import type { TimelineStagingPose } from "../../src/editor/timeline/stagingPose";

export function runPrefabPosePropertyUnitTests(): void {
  const pose: TimelineStagingPose = {
    nodeId: "node-1",
    clipId: "clip-1",
    position: [1, 2, 3],
    rotation: [0.1, 0.2, 0.3],
    scale: [1, 1, 1],
    pathDraft: {
      version: 1,
      closed: true,
      segments: [
        createBezierSegment("seg-1", [0, 0]),
        createBezierSegment("seg-2", [10, 0]),
        createBezierSegment("seg-3", [0, 10]),
      ],
    },
  };

  const positionAdapter = getPrefabPosePropertyAdapter("position");
  assert.equal(isVectorPosePropertyAdapter(positionAdapter), true);

  if (!isVectorPosePropertyAdapter(positionAdapter)) {
    throw new Error("Expected position adapter to be vector.");
  }

  const sampledPosition = positionAdapter.readStagingValue(pose);
  sampledPosition[0] = 99;
  assert.deepEqual(pose.position, [1, 2, 3]);

  positionAdapter.writeStagingValue(pose, [4, 5, 6]);
  assert.deepEqual(pose.position, [4, 5, 6]);

  const pathAdapter = getPrefabPosePropertyAdapter("path");
  assert.equal(isPathPosePropertyAdapter(pathAdapter), true);

  if (!isPathPosePropertyAdapter(pathAdapter)) {
    throw new Error("Expected path adapter to be path.");
  }

  const sampledPath = pathAdapter.readStagingValue(pose);
  assert.deepEqual(sampledPath?.segments[0]?.anchor, [0, 0]);
  sampledPath!.segments[0]!.anchor = [99, 99];
  assert.deepEqual(pose.pathDraft?.segments[0]?.anchor, [0, 0]);

  pathAdapter.writeStagingValue(pose, sampledPath!);
  assert.deepEqual(pose.pathDraft?.segments[0]?.anchor, [99, 99]);
}
