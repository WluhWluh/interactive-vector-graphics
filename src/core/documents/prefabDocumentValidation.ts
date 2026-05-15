import type {
  PrefabDocument,
  PrefabPathAnimationKeyframe,
  PrefabTrackEasing,
  PrefabTrackProperty,
  PrefabVectorAnimationKeyframe,
  Vector3Tuple,
} from "./prefabDocument";
import { PREFAB_DOCUMENT_VERSION } from "./prefabDocument";
import {
  validateStructuredBezierPath,
  type StructuredBezierPath,
} from "../assets/structuredBezierPath";

type PrefabDocumentContext = {
  projectId: string;
  prefabId?: string;
};

export class PrefabDocumentValidationError extends Error {
  readonly projectId: string;
  readonly prefabId: string | undefined;

  constructor(context: PrefabDocumentContext, reason: string) {
    super(`Invalid prefab document: ${reason}`);
    this.name = "PrefabDocumentValidationError";
    this.projectId = context.projectId;
    this.prefabId = context.prefabId;
  }
}

export function validatePrefabDocument(
  value: unknown,
  context: PrefabDocumentContext,
): PrefabDocument {
  if (!isRecord(value)) {
    throw new PrefabDocumentValidationError(context, "document must be an object");
  }

  if (value.version !== PREFAB_DOCUMENT_VERSION) {
    throw new PrefabDocumentValidationError(
      context,
      `version must be ${PREFAB_DOCUMENT_VERSION}`,
    );
  }

  if (!Array.isArray(value.nodes)) {
    throw new PrefabDocumentValidationError(context, "nodes must be an array");
  }

  const nodes = value.nodes.map((node, index) =>
    validatePrefabNode(node, `nodes[${index}]`, context),
  );
  const animation = validatePrefabAnimation(value.animation, context);
  validatePrefabHierarchy(nodes, context);

  return {
    version: PREFAB_DOCUMENT_VERSION,
    nodes,
    animation,
  };
}

function validatePrefabNode(
  value: unknown,
  path: string,
  context: PrefabDocumentContext,
): PrefabDocument["nodes"][number] {
  if (!isRecord(value)) {
    throw new PrefabDocumentValidationError(context, `${path} must be an object`);
  }

  if (value.kind !== "group" && value.kind !== "primitive") {
    throw new PrefabDocumentValidationError(
      context,
      `${path}.kind must be group or primitive`,
    );
  }

  if (value.parentId !== null && typeof value.parentId !== "string") {
    throw new PrefabDocumentValidationError(
      context,
      `${path}.parentId must be null or a string`,
    );
  }

  const baseNode = {
    id: readRequiredString(value.id, `${path}.id`, context),
    kind: value.kind,
    parentId: value.parentId,
    name: readRequiredString(value.name, `${path}.name`, context),
    position: readVector3(value.position, `${path}.position`, context),
    rotation: readVector3(value.rotation, `${path}.rotation`, context),
    scale: readVector3(value.scale, `${path}.scale`, context),
    billboardMode: "spherical" as const,
  };

  if (value.billboardMode !== "spherical") {
    throw new PrefabDocumentValidationError(
      context,
      `${path}.billboardMode must be spherical`,
    );
  }

  if (value.kind === "group") {
    if (value.assetId !== undefined) {
      throw new PrefabDocumentValidationError(
        context,
        `${path}.assetId must not be set for group nodes`,
      );
    }

    return {
      ...baseNode,
      kind: "group",
    };
  }

  return {
    ...baseNode,
    kind: "primitive",
    assetId: readRequiredString(value.assetId, `${path}.assetId`, context),
  };
}

function validatePrefabHierarchy(
  nodes: PrefabDocument["nodes"],
  context: PrefabDocumentContext,
): void {
  const ids = new Set<string>();

  for (const node of nodes) {
    if (ids.has(node.id)) {
      throw new PrefabDocumentValidationError(
        context,
        `duplicate node id "${node.id}"`,
      );
    }

    ids.add(node.id);
  }

  for (const node of nodes) {
    if (node.parentId && !ids.has(node.parentId)) {
      throw new PrefabDocumentValidationError(
        context,
        `parentId "${node.parentId}" does not exist`,
      );
    }
  }

  for (const node of nodes) {
    const seen = new Set<string>();
    let parentId = node.parentId;

    while (parentId) {
      if (seen.has(parentId) || parentId === node.id) {
        throw new PrefabDocumentValidationError(context, "parent cycle detected");
      }

      seen.add(parentId);
      parentId = nodes.find((candidate) => candidate.id === parentId)?.parentId ?? null;
    }
  }
}

function validatePrefabAnimation(
  value: unknown,
  context: PrefabDocumentContext,
): PrefabDocument["animation"] {
  if (!isRecord(value)) {
    throw new PrefabDocumentValidationError(context, "animation must be an object");
  }

  const snapFps = readFiniteNumber(value.snapFps, "animation.snapFps", context);

  if (snapFps < 1 || snapFps > 240) {
    throw new PrefabDocumentValidationError(
      context,
      "animation.snapFps must be between 1 and 240",
    );
  }

  if (value.activeClipId !== null && typeof value.activeClipId !== "string") {
    throw new PrefabDocumentValidationError(
      context,
      "animation.activeClipId must be null or a string",
    );
  }

  if (!Array.isArray(value.clips)) {
    throw new PrefabDocumentValidationError(
      context,
      "animation.clips must be an array",
    );
  }

  const clips = value.clips.map((clip, index) =>
    validatePrefabAnimationClip(clip, `animation.clips[${index}]`, context),
  );

  if (
    typeof value.activeClipId === "string" &&
    !clips.some((clip) => clip.id === value.activeClipId)
  ) {
    throw new PrefabDocumentValidationError(
      context,
      "animation.activeClipId must match an existing clip id",
    );
  }

  return {
    snapFps,
    activeClipId: value.activeClipId,
    clips,
  };
}

function validatePrefabAnimationClip(
  value: unknown,
  path: string,
  context: PrefabDocumentContext,
): PrefabDocument["animation"]["clips"][number] {
  if (!isRecord(value)) {
    throw new PrefabDocumentValidationError(context, `${path} must be an object`);
  }

  const id = readRequiredString(value.id, `${path}.id`, context);
  const name = readRequiredString(value.name, `${path}.name`, context);
  const durationMs = readInteger(value.durationMs, `${path}.durationMs`, context);

  if (durationMs < 0) {
    throw new PrefabDocumentValidationError(
      context,
      `${path}.durationMs must be greater than or equal to 0`,
    );
  }

  if (typeof value.loop !== "boolean") {
    throw new PrefabDocumentValidationError(
      context,
      `${path}.loop must be a boolean`,
    );
  }

  if (!Array.isArray(value.tracks)) {
    throw new PrefabDocumentValidationError(
      context,
      `${path}.tracks must be an array`,
    );
  }

  return {
    id,
    name,
    durationMs,
    loop: value.loop,
    tracks: value.tracks.map((track, index) =>
      validatePrefabAnimationTrack(
        track,
        `${path}.tracks[${index}]`,
        durationMs,
        context,
      ),
    ),
  };
}

function validatePrefabAnimationTrack(
  value: unknown,
  path: string,
  clipDurationMs: number,
  context: PrefabDocumentContext,
): PrefabDocument["animation"]["clips"][number]["tracks"][number] {
  if (!isRecord(value)) {
    throw new PrefabDocumentValidationError(context, `${path} must be an object`);
  }

  const id = readRequiredString(value.id, `${path}.id`, context);
  const target = validatePrefabTrackTarget(value.target, `${path}.target`, context);

  if (!Array.isArray(value.keyframes)) {
    throw new PrefabDocumentValidationError(
      context,
      `${path}.keyframes must be an array`,
    );
  }

  if (target.property === "path") {
    const pathTarget = {
      nodeId: target.nodeId,
      property: "path" as const,
    };
    const keyframes = value.keyframes.map((keyframe, index) =>
      validatePrefabPathKeyframe(
        keyframe,
        `${path}.keyframes[${index}]`,
        clipDurationMs,
        context,
      ),
    );
    validatePathKeyframeShapeConsistency(keyframes, path, context);
    return {
      id,
      target: pathTarget,
      keyframes: validateUniqueKeyframes(keyframes, path, context),
    };
  }

  const vectorTarget = {
    nodeId: target.nodeId,
    property: target.property,
  };

  return {
    id,
    target: vectorTarget,
    keyframes: validateUniqueKeyframes(
      value.keyframes.map((keyframe, index) =>
        validatePrefabVectorKeyframe(
          keyframe,
          `${path}.keyframes[${index}]`,
          clipDurationMs,
          context,
        ),
      ),
      path,
      context,
    ),
  };
}

function validatePrefabTrackTarget(
  value: unknown,
  path: string,
  context: PrefabDocumentContext,
): PrefabDocument["animation"]["clips"][number]["tracks"][number]["target"] {
  if (!isRecord(value)) {
    throw new PrefabDocumentValidationError(context, `${path} must be an object`);
  }

  return {
    nodeId: readRequiredString(value.nodeId, `${path}.nodeId`, context),
    property: validatePrefabTrackProperty(value.property, `${path}.property`, context),
  };
}

function validatePrefabTrackProperty(
  value: unknown,
  path: string,
  context: PrefabDocumentContext,
): PrefabTrackProperty {
  const validProperties: PrefabTrackProperty[] = [
    "position",
    "rotation",
    "scale",
    "path",
  ];

  if (
    typeof value !== "string" ||
    !validProperties.includes(value as PrefabTrackProperty)
  ) {
    throw new PrefabDocumentValidationError(context, `${path} is invalid`);
  }

  return value as PrefabTrackProperty;
}

function validatePrefabVectorKeyframe(
  value: unknown,
  path: string,
  clipDurationMs: number,
  context: PrefabDocumentContext,
): PrefabVectorAnimationKeyframe {
  if (!isRecord(value)) {
    throw new PrefabDocumentValidationError(context, `${path} must be an object`);
  }

  const id = readRequiredString(value.id, `${path}.id`, context);
  const timeMs = readInteger(value.timeMs, `${path}.timeMs`, context);

  if (timeMs < 0 || timeMs > clipDurationMs) {
    throw new PrefabDocumentValidationError(
      context,
      `${path}.timeMs must be within the clip duration`,
    );
  }

  return {
    id,
    timeMs,
    value: readVector3(value.value, `${path}.value`, context),
    easing: validatePrefabTrackEasing(value.easing, `${path}.easing`, context),
  };
}

function validatePrefabPathKeyframe(
  value: unknown,
  path: string,
  clipDurationMs: number,
  context: PrefabDocumentContext,
): PrefabPathAnimationKeyframe {
  if (!isRecord(value)) {
    throw new PrefabDocumentValidationError(context, `${path} must be an object`);
  }

  const id = readRequiredString(value.id, `${path}.id`, context);
  const timeMs = readInteger(value.timeMs, `${path}.timeMs`, context);

  if (timeMs < 0 || timeMs > clipDurationMs) {
    throw new PrefabDocumentValidationError(
      context,
      `${path}.timeMs must be within the clip duration`,
    );
  }

  return {
    id,
    timeMs,
    value: readStructuredBezierPath(value.value, `${path}.value`, context),
    easing: validatePrefabTrackEasing(value.easing, `${path}.easing`, context),
  };
}

function validateUniqueKeyframes<
  T extends PrefabVectorAnimationKeyframe | PrefabPathAnimationKeyframe,
>(
  keyframes: T[],
  path: string,
  context: PrefabDocumentContext,
): T[] {
  const ids = new Set<string>();

  for (const keyframe of keyframes) {
    if (ids.has(keyframe.id)) {
      throw new PrefabDocumentValidationError(
        context,
        `${path}.keyframes contains duplicate keyframe id "${keyframe.id}"`,
      );
    }

    ids.add(keyframe.id);
  }

  return keyframes;
}

function validatePathKeyframeShapeConsistency(
  keyframes: PrefabPathAnimationKeyframe[],
  path: string,
  context: PrefabDocumentContext,
): void {
  const firstPath = keyframes[0]?.value;

  if (!firstPath || !isStructuredBezierPath(firstPath)) {
    return;
  }

  const firstSegmentIds = firstPath.segments.map((segment) => segment.id);

  for (const keyframe of keyframes) {
    if (keyframe.value.closed !== firstPath.closed) {
      throw new PrefabDocumentValidationError(
        context,
        `${path}.keyframes must keep the same path closed state`,
      );
    }

    const segmentIds = keyframe.value.segments.map((segment) => segment.id);

    if (
      segmentIds.length !== firstSegmentIds.length ||
      segmentIds.some((segmentId, index) => segmentId !== firstSegmentIds[index])
    ) {
      throw new PrefabDocumentValidationError(
        context,
        `${path}.keyframes must keep the same Bezier segment ids`,
      );
    }
  }
}

function validatePrefabTrackEasing(
  value: unknown,
  path: string,
  context: PrefabDocumentContext,
): PrefabTrackEasing {
  if (value !== "linear" && value !== "step" && value !== "easeInOut") {
    throw new PrefabDocumentValidationError(
      context,
      `${path} must be linear, step, or easeInOut`,
    );
  }

  return value;
}

function readVector3(
  value: unknown,
  path: string,
  context: PrefabDocumentContext,
): Vector3Tuple {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new PrefabDocumentValidationError(
      context,
      `${path} must contain three numbers`,
    );
  }

  return [
    readFiniteNumber(value[0], `${path}[0]`, context),
    readFiniteNumber(value[1], `${path}[1]`, context),
    readFiniteNumber(value[2], `${path}[2]`, context),
  ];
}

function readStructuredBezierPath(
  value: unknown,
  path: string,
  context: PrefabDocumentContext,
): StructuredBezierPath {
  try {
    return validateStructuredBezierPath(value, {
      expectedClosed: isRecord(value) && value.closed === true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid structured path";
    throw new PrefabDocumentValidationError(context, `${path} ${message}`);
  }
}

function isStructuredBezierPath(value: unknown): value is StructuredBezierPath {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.closed === "boolean" &&
    Array.isArray(value.segments)
  );
}

function readRequiredString(
  value: unknown,
  path: string,
  context: PrefabDocumentContext,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new PrefabDocumentValidationError(context, `${path} is required`);
  }

  return value;
}

function readFiniteNumber(
  value: unknown,
  path: string,
  context: PrefabDocumentContext,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PrefabDocumentValidationError(context, `${path} must be a number`);
  }

  return value;
}

function readInteger(
  value: unknown,
  path: string,
  context: PrefabDocumentContext,
): number {
  const number = readFiniteNumber(value, path, context);

  if (!Number.isInteger(number)) {
    throw new PrefabDocumentValidationError(context, `${path} must be an integer`);
  }

  return number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
