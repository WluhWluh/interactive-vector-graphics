import type { SceneDocument, Vector3Tuple } from "./types";

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

  if (value.version !== 1) {
    throw new SceneDocumentValidationError(context, "version must be 1");
  }

  const camera = validateCamera(value.camera, context);
  const nodes = validateNodes(value.nodes, context);
  const animation = validateAnimation(value.animation, context);

  return {
    version: 1,
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

  if (value.fps !== 24 || value.duration !== 0) {
    throw new SceneDocumentValidationError(
      context,
      "animation must use fps 24 and duration 0 in this phase",
    );
  }

  if (!Array.isArray(value.tracks) || value.tracks.length !== 0) {
    throw new SceneDocumentValidationError(
      context,
      "animation.tracks must be an empty array in this phase",
    );
  }

  return {
    fps: 24,
    duration: 0,
    tracks: [],
  };
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
