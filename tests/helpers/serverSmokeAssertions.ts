import { strict as assert } from "node:assert";
import { validatePrefabDocument } from "../../server/prefabDocument";
import { validateSceneDocument } from "../../server/sceneDocument";
import type { PrefabDocument, SceneDocument } from "../../server/types";
import {
  validateStructuredBezierPath,
  type StructuredBezierPath,
} from "../../src/core/assets/structuredBezierPath";
import {
  validateStructuredBezierPath3D,
  type StructuredBezierPath3D,
} from "../../src/core/assets/structuredBezierPath3d";

export function assertInvalidSceneDocument(
  document: unknown,
  expectedMessage: RegExp,
  projectId: string,
): void {
  assert.throws(
    () => validateSceneDocument(document, { projectId }),
    expectedMessage,
  );
}

export function assertInvalidPrefabDocument(
  document: unknown,
  expectedMessage: RegExp,
  projectId: string,
): void {
  assert.throws(
    () => validatePrefabDocument(document, { projectId }),
    expectedMessage,
  );
}

export function assertInvalidStructuredBezierPath(
  path: StructuredBezierPath,
  options: { expectedClosed: boolean },
  expectedMessage: RegExp,
): void {
  assert.throws(
    () => validateStructuredBezierPath(path, options),
    expectedMessage,
  );
}

export function assertInvalidStructuredBezierPath3D(
  path: StructuredBezierPath3D,
  expectedMessage: RegExp,
): void {
  assert.throws(
    () => validateStructuredBezierPath3D(path),
    expectedMessage,
  );
}

export function createBezierSegment(
  id: string,
  anchor: [number, number],
): StructuredBezierPath["segments"][number] {
  return {
    id,
    anchor,
    handleIn: [0, 0],
    handleOut: [0, 0],
  };
}

export function cloneStructuredBezierPathForTest(
  path: StructuredBezierPath,
): StructuredBezierPath {
  return {
    version: 1,
    closed: path.closed,
    segments: path.segments.map((segment) => ({
      id: segment.id,
      anchor: [...segment.anchor],
      handleIn: [...segment.handleIn],
      handleOut: [...segment.handleOut],
    })),
  };
}

export function cloneStructuredBezierPath3DForTest(
  path: StructuredBezierPath3D,
): StructuredBezierPath3D {
  return {
    version: 1,
    closed: false,
    segments: path.segments.map((segment) => ({
      id: segment.id,
      anchor: [...segment.anchor],
      handleIn: [...segment.handleIn],
      handleOut: [...segment.handleOut],
    })),
  };
}

export type ServerSmokePrefabDocument = PrefabDocument;
export type ServerSmokeSceneDocument = SceneDocument;
