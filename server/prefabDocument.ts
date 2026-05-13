import type { PrefabDocument, Vector3Tuple } from "./types";

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

  if (value.version !== 1) {
    throw new PrefabDocumentValidationError(context, "version must be 1");
  }

  if (!Array.isArray(value.nodes)) {
    throw new PrefabDocumentValidationError(context, "nodes must be an array");
  }

  const nodes = value.nodes.map((node, index) =>
    validatePrefabNode(node, `nodes[${index}]`, context),
  );
  validatePrefabHierarchy(nodes, context);

  return {
    version: 1,
    nodes,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
