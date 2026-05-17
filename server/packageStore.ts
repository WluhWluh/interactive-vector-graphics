import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { DataStore } from "./dataStore";
import { validatePrefabDocument } from "./prefabDocument";
import { validateSceneDocument } from "./sceneDocument";
import type {
  ImportPackageResponse,
  PrefabDocument,
  ProjectPackageImportIdMap,
  ProjectPackageKind,
  ProjectPackageManifest,
  SceneDocument,
} from "./types";

const PACKAGE_MANIFEST_PATH = "manifest.json";

export type ExportPackageInput = {
  store: DataStore;
  projectId: string;
  kind: ProjectPackageKind;
  itemId?: string;
};

export type ImportPackageInput = {
  store: DataStore;
  manifest: ProjectPackageManifest;
  targetProjectId?: string;
};

export async function exportProjectPackage(
  input: ExportPackageInput,
): Promise<ProjectPackageManifest> {
  await input.store.ensureReady();

  const projects = input.store.listProjects();
  const project = projects.find((candidate) => candidate.id === input.projectId);

  if (!project) {
    throw new Error(`Project "${input.projectId}" does not exist.`);
  }

  const assets = input.store.listPrimitiveAssets(input.projectId);
  const prefabs = await Promise.all(
    input.store.listPrefabs(input.projectId).map(async (prefab) => {
      const detail = await input.store.getPrefab(input.projectId, prefab.id);
      return {
        prefab: detail.prefab,
        document: detail.document,
      };
    }),
  );
  const scenes = await Promise.all(
    input.store.listScenes(input.projectId).map(async (scene) => {
      const detail = await input.store.getScene(input.projectId, scene.id);
      return {
        scene: detail.scene,
        document: detail.document,
      };
    }),
  );
  const includedAssetIds = new Set<string>();
  const includedPrefabIds = new Set<string>();
  const includedSceneIds = new Set<string>();
  const root: ProjectPackageManifest["root"] = {
    projectId: input.projectId,
  };

  if (input.kind === "project") {
    assets.forEach((asset) => includedAssetIds.add(asset.id));
    prefabs.forEach(({ prefab }) => includedPrefabIds.add(prefab.id));
    scenes.forEach(({ scene }) => includedSceneIds.add(scene.id));
  } else if (input.kind === "primitive") {
    const asset = requireItem(assets, input.itemId, "Primitive asset");
    includedAssetIds.add(asset.id);
    Object.assign(root, { primitiveAssetId: asset.id });
  } else if (input.kind === "prefab") {
    const prefabEntry = requireItem(
      prefabs.map((entry) => entry.prefab),
      input.itemId,
      "Prefab",
    );
    includedPrefabIds.add(prefabEntry.id);
    Object.assign(root, { prefabId: prefabEntry.id });
  } else {
    const sceneEntry = requireItem(
      scenes.map((entry) => entry.scene),
      input.itemId,
      "Scene",
    );
    includedSceneIds.add(sceneEntry.id);
    Object.assign(root, { sceneId: sceneEntry.id });
  }

  let changed = true;
  while (changed) {
    changed = false;

    for (const entry of prefabs) {
      if (!includedPrefabIds.has(entry.prefab.id)) {
        continue;
      }

      for (const node of entry.document.nodes) {
        if (node.kind === "primitive" && typeof node.assetId === "string") {
          changed = addToSet(includedAssetIds, node.assetId) || changed;
        }
      }
    }

    for (const entry of scenes) {
      if (!includedSceneIds.has(entry.scene.id)) {
        continue;
      }

      for (const node of entry.document.nodes) {
        if (node.kind === "primitive") {
          changed = addToSet(includedAssetIds, node.assetId) || changed;
        } else {
          changed = addToSet(includedPrefabIds, node.prefabId) || changed;
        }
      }
    }
  }

  const includedAssets = assets.filter((asset) => includedAssetIds.has(asset.id));
  const includedPrefabs = prefabs.filter(({ prefab }) =>
    includedPrefabIds.has(prefab.id),
  );
  const includedScenes = scenes.filter(({ scene }) => includedSceneIds.has(scene.id));

  return {
    version: 1,
    kind: input.kind,
    exportedAt: new Date().toISOString(),
    root,
    projects: [project],
    assets: includedAssets,
    prefabs: includedPrefabs.map(({ prefab, document }) => ({
      record: prefab,
      document,
    })),
    scenes: includedScenes.map(({ scene, document }) => ({
      record: scene,
      document,
    })),
  };
}

export function encodeProjectPackageManifest(
  manifest: ProjectPackageManifest,
): Uint8Array {
  return strToU8(`${JSON.stringify(manifest, null, 2)}\n`);
}

export async function importProjectPackage(
  input: ImportPackageInput,
): Promise<ImportPackageResponse> {
  validateProjectPackageManifest(input.manifest);

  const sourceProject = input.manifest.projects[0];
  const project = input.targetProjectId
    ? input.store
        .listProjects()
        .find((candidate) => candidate.id === input.targetProjectId)
    : await input.store.createProject(sourceProject.name);

  if (!project) {
    throw new Error(`Target project "${input.targetProjectId}" does not exist.`);
  }

  const idMap: ProjectPackageImportIdMap = {
    projects: {
      [sourceProject.id]: project.id,
    },
    assets: {},
    prefabs: {},
    scenes: {},
  };
  const importedAssets: ProjectPackageManifest["assets"] = [];
  const importedPrefabs: ProjectPackageManifest["prefabs"] = [];
  const importedScenes: ProjectPackageManifest["scenes"] = [];

  for (const asset of input.manifest.assets) {
    const importedAsset = await input.store.importPrimitiveAssetFromPackage(
      project.id,
      asset,
    );
    idMap.assets[asset.id] = importedAsset.id;
    importedAssets.push(importedAsset);
  }

  for (const entry of input.manifest.prefabs) {
    const document = remapPrefabDocument(entry.document, idMap);
    const importedPrefab = await input.store.importPrefabFromPackage({
      projectId: project.id,
      name: entry.record.name,
      document: validatePrefabDocument(document, { projectId: project.id }),
    });
    idMap.prefabs[entry.record.id] = importedPrefab.id;
    importedPrefabs.push({
      record: importedPrefab,
      document,
    });
  }

  for (const entry of input.manifest.scenes) {
    const document = remapSceneDocument(entry.document, idMap);
    const importedScene = await input.store.importSceneFromPackage({
      projectId: project.id,
      name: entry.record.name,
      document: validateSceneDocument(document, { projectId: project.id }),
    });
    idMap.scenes[entry.record.id] = importedScene.id;
    importedScenes.push({
      record: importedScene,
      document,
    });
  }

  return {
    package: {
      version: 1,
      kind: input.manifest.kind,
      exportedAt: new Date().toISOString(),
      root: remapPackageRoot(input.manifest.root, idMap),
      projects: [project],
      assets: importedAssets,
      prefabs: importedPrefabs,
      scenes: importedScenes,
    },
    idMap,
  };
}

export function encodeProjectPackageZip(
  manifest: ProjectPackageManifest,
): Uint8Array {
  return zipSync({
    [PACKAGE_MANIFEST_PATH]: strToU8(`${JSON.stringify(manifest, null, 2)}\n`),
  });
}

export function decodeProjectPackageZip(bytes: Uint8Array): ProjectPackageManifest {
  const files = unzipSync(bytes);
  const manifestBytes = files[PACKAGE_MANIFEST_PATH];

  if (!manifestBytes) {
    throw new Error("Package zip is missing manifest.json.");
  }

  const manifest = JSON.parse(strFromU8(manifestBytes)) as unknown;
  validateProjectPackageManifest(manifest);

  return manifest;
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

  if (!isRecord(value.root) || typeof value.root.projectId !== "string") {
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

  if (manifest.assets.some((asset) => asset.projectId !== manifest.root.projectId)) {
    throw new Error("Project package asset project ids must match the root project.");
  }
}

function remapPrefabDocument(
  document: PrefabDocument,
  idMap: ProjectPackageImportIdMap,
): PrefabDocument {
  const cloned = structuredClone(document) as PrefabDocument;
  cloned.nodes = cloned.nodes.map((node) =>
    node.kind === "primitive"
      ? {
          ...node,
          assetId:
            typeof node.assetId === "string"
              ? idMap.assets[node.assetId] ?? node.assetId
              : node.assetId,
        }
      : node,
  );
  return cloned;
}

function remapSceneDocument(
  document: SceneDocument,
  idMap: ProjectPackageImportIdMap,
): SceneDocument {
  const cloned = structuredClone(document) as SceneDocument;
  cloned.nodes = cloned.nodes.map((node) => {
    if (node.kind === "primitive") {
      return {
        ...node,
        assetId: idMap.assets[node.assetId] ?? node.assetId,
      };
    }

    return {
      ...node,
      prefabId: idMap.prefabs[node.prefabId] ?? node.prefabId,
    };
  });
  return cloned;
}

function remapPackageRoot(
  root: ProjectPackageManifest["root"],
  idMap: ProjectPackageImportIdMap,
): ProjectPackageManifest["root"] {
  return {
    projectId: idMap.projects[root.projectId] ?? root.projectId,
    primitiveAssetId: root.primitiveAssetId
      ? idMap.assets[root.primitiveAssetId]
      : undefined,
    prefabId: root.prefabId ? idMap.prefabs[root.prefabId] : undefined,
    sceneId: root.sceneId ? idMap.scenes[root.sceneId] : undefined,
  };
}

function requireItem<T extends { id: string }>(
  items: T[],
  itemId: string | undefined,
  label: string,
): T {
  if (!itemId) {
    throw new Error(`${label} id is required for package export.`);
  }

  const item = items.find((candidate) => candidate.id === itemId);

  if (!item) {
    throw new Error(`${label} "${itemId}" does not exist.`);
  }

  return item;
}

function addToSet(set: Set<string>, value: string): boolean {
  const previousSize = set.size;
  set.add(value);
  return set.size !== previousSize;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
