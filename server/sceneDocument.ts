import type {
  SceneDocument,
  SceneKeyframeValue,
  SceneTrackProperty,
  Vector3Tuple,
} from "./types";

type SceneDocumentContext = {
  projectId: string;
  sceneId?: string;
};

export class SceneDocumentValidationError extends Error {
  readonly projectId: string;
  readonly sceneId: string | undefined;

  constructor(context: SceneDocumentContext, reason: string) {
    super(`Invalid scene document: ${reason}`);
    this.name = "SceneDocumentValidationError";
    this.projectId = context.projectId;
    this.sceneId = context.sceneId;
  }
}

export function validateSceneDocument(
  value: unknown,
  context: SceneDocumentContext,
): SceneDocument {
  if (!isRecord(value)) {
    throw new SceneDocumentValidationError(context, "document must be an object");
  }

  if (value.version !== 2) {
    throw new SceneDocumentValidationError(context, "version must be 2");
  }

  const camera = validateCamera(value.camera, context);
  const nodes = validateNodes(value.nodes, context);
  const animation = validateAnimation(value.animation, context);

  return {
    version: 2,
    camera,
    nodes,
    animation,
  };
}

function validateCamera(
  value: unknown,
  context: SceneDocumentContext,
): SceneDocument["camera"] {
  if (!isRecord(value)) {
    throw new SceneDocumentValidationError(context, "camera must be an object");
  }

  const projection = value.projection;

  if (projection !== "perspective" && projection !== "orthographic") {
    throw new SceneDocumentValidationError(
      context,
      "camera.projection must be perspective or orthographic",
    );
  }

  const fov = readFiniteNumber(value.fov, "camera.fov", context);
  const zoom = readFiniteNumber(value.zoom, "camera.zoom", context);
  const near = readFiniteNumber(value.near, "camera.near", context);
  const far = readFiniteNumber(value.far, "camera.far", context);

  if (fov <= 0 || fov >= 180) {
    throw new SceneDocumentValidationError(
      context,
      "camera.fov must be greater than 0 and less than 180",
    );
  }

  if (zoom <= 0) {
    throw new SceneDocumentValidationError(
      context,
      "camera.zoom must be positive",
    );
  }

  if (near <= 0 || far <= near) {
    throw new SceneDocumentValidationError(
      context,
      "camera near/far values are invalid",
    );
  }

  return {
    projection,
    position: readVector3(value.position, "camera.position", context),
    target: readVector3(value.target, "camera.target", context),
    fov,
    zoom,
    near,
    far,
  };
}

function validateNodes(
  value: unknown,
  context: SceneDocumentContext,
): SceneDocument["nodes"] {
  if (!Array.isArray(value)) {
    throw new SceneDocumentValidationError(context, "nodes must be an array");
  }

  return value.map((node, index) => {
    if (!isRecord(node)) {
      throw new SceneDocumentValidationError(
        context,
        `nodes[${index}] must be an object`,
      );
    }

    if (typeof node.id !== "string" || !node.id.trim()) {
      throw new SceneDocumentValidationError(
        context,
        `nodes[${index}].id is required`,
      );
    }

    if (typeof node.assetId !== "string" || !node.assetId.trim()) {
      throw new SceneDocumentValidationError(
        context,
        `nodes[${index}].assetId is required`,
      );
    }

    if (node.billboardMode !== "spherical") {
      throw new SceneDocumentValidationError(
        context,
        `nodes[${index}].billboardMode must be spherical`,
      );
    }

    return {
      id: node.id,
      assetId: node.assetId,
      position: readVector3(node.position, `nodes[${index}].position`, context),
      rotation: readVector3(node.rotation, `nodes[${index}].rotation`, context),
      scale: readVector3(node.scale, `nodes[${index}].scale`, context),
      billboardMode: "spherical" as const,
    };
  });
}

function validateAnimation(
  value: unknown,
  context: SceneDocumentContext,
): SceneDocument["animation"] {
  if (!isRecord(value)) {
    throw new SceneDocumentValidationError(context, "animation must be an object");
  }

  if (value.fps !== 24) {
    throw new SceneDocumentValidationError(
      context,
      "animation.fps must be 24",
    );
  }

  if (value.activeClipId !== null && typeof value.activeClipId !== "string") {
    throw new SceneDocumentValidationError(
      context,
      "animation.activeClipId must be null or a string",
    );
  }

  if (!Array.isArray(value.clips)) {
    throw new SceneDocumentValidationError(context, "animation.clips must be an array");
  }

  const clips = value.clips.map((clip, index) =>
    validateAnimationClip(clip, `animation.clips[${index}]`, context),
  );

  if (
    typeof value.activeClipId === "string" &&
    !clips.some((clip) => clip.id === value.activeClipId)
  ) {
    throw new SceneDocumentValidationError(
      context,
      "animation.activeClipId must match an existing clip id",
    );
  }

  return {
    fps: 24,
    activeClipId: value.activeClipId,
    clips,
  };
}

function validateAnimationClip(
  value: unknown,
  path: string,
  context: SceneDocumentContext,
): SceneDocument["animation"]["clips"][number] {
  if (!isRecord(value)) {
    throw new SceneDocumentValidationError(context, `${path} must be an object`);
  }

  const id = readRequiredString(value.id, `${path}.id`, context);
  const name = readRequiredString(value.name, `${path}.name`, context);
  const duration = readFiniteNumber(value.duration, `${path}.duration`, context);

  if (duration < 0) {
    throw new SceneDocumentValidationError(
      context,
      `${path}.duration must be greater than or equal to 0`,
    );
  }

  if (!Array.isArray(value.tracks)) {
    throw new SceneDocumentValidationError(context, `${path}.tracks must be an array`);
  }

  return {
    id,
    name,
    duration,
    tracks: value.tracks.map((track, index) =>
      validateAnimationTrack(
        track,
        `${path}.tracks[${index}]`,
        duration,
        context,
      ),
    ),
  };
}

function validateAnimationTrack(
  value: unknown,
  path: string,
  clipDuration: number,
  context: SceneDocumentContext,
): SceneDocument["animation"]["clips"][number]["tracks"][number] {
  if (!isRecord(value)) {
    throw new SceneDocumentValidationError(context, `${path} must be an object`);
  }

  const id = readRequiredString(value.id, `${path}.id`, context);
  const target = validateTrackTarget(value.target, `${path}.target`, context);

  if (!Array.isArray(value.keyframes)) {
    throw new SceneDocumentValidationError(
      context,
      `${path}.keyframes must be an array`,
    );
  }

  return {
    id,
    target,
    keyframes: value.keyframes.map((keyframe, index) =>
      validateKeyframe(
        keyframe,
        `${path}.keyframes[${index}]`,
        clipDuration,
        target.property,
        context,
      ),
    ),
  };
}

function validateTrackTarget(
  value: unknown,
  path: string,
  context: SceneDocumentContext,
): SceneDocument["animation"]["clips"][number]["tracks"][number]["target"] {
  if (!isRecord(value)) {
    throw new SceneDocumentValidationError(context, `${path} must be an object`);
  }

  if (value.kind !== "node" && value.kind !== "camera") {
    throw new SceneDocumentValidationError(
      context,
      `${path}.kind must be node or camera`,
    );
  }

  const property = validateTrackProperty(value.property, `${path}.property`, context);

  if (value.kind === "node") {
    return {
      kind: "node",
      nodeId: readRequiredString(value.nodeId, `${path}.nodeId`, context),
      property,
    };
  }

  if (value.nodeId !== undefined) {
    throw new SceneDocumentValidationError(
      context,
      `${path}.nodeId must not be set for camera tracks`,
    );
  }

  return {
    kind: "camera",
    property,
  };
}

function validateTrackProperty(
  value: unknown,
  path: string,
  context: SceneDocumentContext,
): SceneTrackProperty {
  const validProperties: SceneTrackProperty[] = [
    "position",
    "rotation",
    "scale",
    "target",
    "fov",
    "zoom",
  ];

  if (
    typeof value !== "string" ||
    !validProperties.includes(value as SceneTrackProperty)
  ) {
    throw new SceneDocumentValidationError(context, `${path} is invalid`);
  }

  return value as SceneTrackProperty;
}

function validateKeyframe(
  value: unknown,
  path: string,
  clipDuration: number,
  property: SceneTrackProperty,
  context: SceneDocumentContext,
): SceneDocument["animation"]["clips"][number]["tracks"][number]["keyframes"][number] {
  if (!isRecord(value)) {
    throw new SceneDocumentValidationError(context, `${path} must be an object`);
  }

  const time = readFiniteNumber(value.time, `${path}.time`, context);

  if (time < 0 || time > clipDuration) {
    throw new SceneDocumentValidationError(
      context,
      `${path}.time must be within the clip duration`,
    );
  }

  if (
    value.easing !== "linear" &&
    value.easing !== "step" &&
    value.easing !== "easeInOut"
  ) {
    throw new SceneDocumentValidationError(
      context,
      `${path}.easing must be linear, step, or easeInOut`,
    );
  }

  return {
    time,
    value: validateKeyframeValue(value.value, `${path}.value`, property, context),
    easing: value.easing,
  };
}

function validateKeyframeValue(
  value: unknown,
  path: string,
  property: SceneTrackProperty,
  context: SceneDocumentContext,
): SceneKeyframeValue {
  if (isVectorTrackProperty(property)) {
    return readVector3(value, path, context);
  }

  return readFiniteNumber(value, path, context);
}

function readVector3(
  value: unknown,
  path: string,
  context: SceneDocumentContext,
): Vector3Tuple {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new SceneDocumentValidationError(
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

function readRequiredString(
  value: unknown,
  path: string,
  context: SceneDocumentContext,
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new SceneDocumentValidationError(context, `${path} is required`);
  }

  return value;
}

function readFiniteNumber(
  value: unknown,
  path: string,
  context: SceneDocumentContext,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new SceneDocumentValidationError(context, `${path} must be a number`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isVectorTrackProperty(property: SceneTrackProperty): boolean {
  return (
    property === "position" ||
    property === "rotation" ||
    property === "scale" ||
    property === "target"
  );
}
