import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type {
  PrefabRecord,
  ProjectRecord,
  SceneRecord,
  StoredPrimitiveAsset,
} from "./records";
import type { PrefabDocument } from "../documents/prefabDocument";
import type { SceneDocument } from "../documents/sceneDocument";
import type {
  PrefabId,
  PrimitiveAssetId,
  ProjectId,
  SceneId,
} from "./ids";

const PACKAGE_MANIFEST_PATH = "manifest.json";

export type ProjectPackageKind = "project" | "primitive" | "prefab" | "scene";

export type ProjectPackageManifest = {
  version: 1;
  kind: ProjectPackageKind;
  exportedAt: string;
  root: {
    projectId: ProjectId;
    primitiveAssetId?: PrimitiveAssetId;
    prefabId?: PrefabId;
    sceneId?: SceneId;
  };
  projects: ProjectRecord[];
  assets: StoredPrimitiveAsset[];
  prefabs: Array<{
    record: PrefabRecord;
    document: PrefabDocument;
  }>;
  scenes: Array<{
    record: SceneRecord;
    document: SceneDocument;
  }>;
};

export type ProjectPackageImportIdMap = {
  projects: Record<string, ProjectId>;
  assets: Record<string, PrimitiveAssetId>;
  prefabs: Record<string, PrefabId>;
  scenes: Record<string, SceneId>;
};

export type ImportPackageResponse = {
  package: ProjectPackageManifest;
  idMap: ProjectPackageImportIdMap;
};

export function encodeProjectPackageManifest(
  manifest: ProjectPackageManifest,
): Uint8Array {
  validateProjectPackageManifest(manifest);
  return strToU8(`${JSON.stringify(manifest, null, 2)}\n`);
}

export function decodeProjectPackageManifest(
  bytes: Uint8Array,
): ProjectPackageManifest {
  const manifest = JSON.parse(strFromU8(bytes)) as unknown;
  validateProjectPackageManifest(manifest);
  return manifest;
}

export function encodeProjectPackageZip(
  manifest: ProjectPackageManifest,
): Uint8Array {
  return zipSync({
    [PACKAGE_MANIFEST_PATH]: encodeProjectPackageManifest(manifest),
  });
}

export function decodeProjectPackageZip(bytes: Uint8Array): ProjectPackageManifest {
  const files = unzipSync(bytes);
  const manifestBytes = files[PACKAGE_MANIFEST_PATH];

  if (!manifestBytes) {
    throw new Error("Package zip is missing manifest.json.");
  }

  return decodeProjectPackageManifest(manifestBytes);
}

export function validateProjectPackageManifest(
  value: unknown,
): asserts value is ProjectPackageManifest {
  if (!isRecord(value) || value.version !== 1) {
    throw new Error("Project package manifest must use version 1.");
  }

  if (
    value.kind !== "project" &&
    value.kind !== "primitive" &&
    value.kind !== "prefab" &&
    value.kind !== "scene"
  ) {
    throw new Error("Project package kind is invalid.");
  }

  const root = value.root;

  if (!isRecord(root) || typeof root.projectId !== "string") {
    throw new Error("Project package root is invalid.");
  }

  for (const field of ["projects", "assets", "prefabs", "scenes"] as const) {
    if (!Array.isArray(value[field])) {
      throw new Error(`Project package ${field} must be an array.`);
    }
  }

  const manifest = value as unknown as ProjectPackageManifest;

  if (manifest.projects.length !== 1) {
    throw new Error("Project package must contain one project record.");
  }

  const [project] = manifest.projects;
  if (!project || project.id !== manifest.root.projectId) {
    throw new Error("Project package root project must match the project record.");
  }

  validateRecordCollection(manifest.projects, "project");
  validateRecordCollection(manifest.assets, "asset");
  validateRecordCollection(manifest.prefabs.map((entry) => entry.record), "prefab");
  validateRecordCollection(manifest.scenes.map((entry) => entry.record), "scene");

  validatePrimitiveAssetReferences(manifest);
  validatePrefabReferences(manifest);
  validateSceneReferences(manifest);
  validatePackageRoot(manifest);
}

function validatePackageRoot(manifest: ProjectPackageManifest): void {
  const {
    kind,
    root: { primitiveAssetId, prefabId, sceneId },
  } = manifest;

  if (kind === "primitive" && typeof primitiveAssetId !== "string") {
    throw new Error("Project package root must reference a primitive asset.");
  }

  if (kind === "prefab" && typeof prefabId !== "string") {
    throw new Error("Project package root must reference a prefab.");
  }

  if (kind === "scene" && typeof sceneId !== "string") {
    throw new Error("Project package root must reference a scene.");
  }
}

function validatePrimitiveAssetReferences(manifest: ProjectPackageManifest): void {
  const assetIds = new Set(manifest.assets.map((asset) => asset.id));

  if (assetIds.size !== manifest.assets.length) {
    throw new Error("Project package repeats an asset id.");
  }

  if (
    manifest.kind === "primitive" &&
    manifest.root.primitiveAssetId &&
    !assetIds.has(manifest.root.primitiveAssetId)
  ) {
    throw new Error("Project package root primitive asset is missing.");
  }

  for (const entry of manifest.prefabs) {
    for (const node of entry.document.nodes) {
      if (node.kind === "primitive" && node.assetId && !assetIds.has(node.assetId)) {
        throw new Error(
          `Prefab "${entry.record.id}" references missing asset "${node.assetId}".`,
        );
      }
    }
  }
}

function validatePrefabReferences(manifest: ProjectPackageManifest): void {
  const prefabIds = new Set(manifest.prefabs.map((entry) => entry.record.id));

  if (prefabIds.size !== manifest.prefabs.length) {
    throw new Error("Project package repeats a prefab id.");
  }

  if (
    manifest.kind === "prefab" &&
    manifest.root.prefabId &&
    !prefabIds.has(manifest.root.prefabId)
  ) {
    throw new Error("Project package root prefab is missing.");
  }

  for (const entry of manifest.scenes) {
    for (const node of entry.document.nodes) {
      if (node.kind === "prefabInstance" && !prefabIds.has(node.prefabId)) {
        throw new Error(
          `Scene "${entry.record.id}" references missing prefab "${node.prefabId}".`,
        );
      }
    }
  }
}

function validateSceneReferences(manifest: ProjectPackageManifest): void {
  const sceneIds = new Set(manifest.scenes.map((entry) => entry.record.id));

  if (sceneIds.size !== manifest.scenes.length) {
    throw new Error("Project package repeats a scene id.");
  }

  if (
    manifest.kind === "scene" &&
    manifest.root.sceneId &&
    !sceneIds.has(manifest.root.sceneId)
  ) {
    throw new Error("Project package root scene is missing.");
  }
}

function validateRecordCollection(
  records: Array<{ id: string; name: string; createdAt: string; updatedAt: string }>,
  label: string,
): void {
  const ids = new Set<string>();

  for (const record of records) {
    if (
      typeof record.id !== "string" ||
      !record.id.trim() ||
      typeof record.name !== "string" ||
      !record.name.trim() ||
      typeof record.createdAt !== "string" ||
      typeof record.updatedAt !== "string"
    ) {
      throw new Error(`Project package contains an invalid ${label} record.`);
    }

    if (ids.has(record.id)) {
      throw new Error(`Project package repeats a ${label} id.`);
    }

    ids.add(record.id);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
