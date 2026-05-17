import type { PrimitiveSvgAsset } from "../core/assets/primitiveAssetTypes";
import { hydratePrimitiveSvgAsset } from "../core/assets/primitiveAssetHydration";
import type { StructuredBezierPath } from "../core/assets/structuredBezierPath";
import type { StructuredBezierPath3D } from "../core/assets/structuredBezierPath3d";
import type { ViewMorphProfile } from "../core/assets/viewMorphProfile";
import type {
  AssetsResponse,
  CreateAssetResponse,
  CreatePrefabResponse,
  CreateProjectResponse,
  CreateSceneResponse,
  ImportPackageResponse,
  PrefabDetailResponse,
  PrefabRecord,
  PrefabsResponse,
  ProjectRecord,
  ProjectsResponse,
  RenameAssetResponse,
  RenamePrefabResponse,
  RenameProjectResponse,
  RenameSceneResponse,
  SceneDetailResponse,
  SceneDocument,
  SceneRecord,
  ScenesResponse,
  StoredPrimitiveAsset as StoredPrimitiveAssetDto,
  UpdateAssetCurve3DResponse,
  UpdateAssetPathResponse,
  UpdateViewMorphProfileResponse,
} from "../core/contracts/api";
import type { ProjectPackageManifest } from "../core/contracts/package";
import {
  decodeProjectPackageZip,
  encodeProjectPackageZip,
} from "../core/contracts/package";
import type { PrefabDocument } from "../core/documents/prefabDocument";

export type {
  PrefabAnimation,
  PrefabAnimationClip,
  PrefabAnimationKeyframe,
  PrefabAnimationTrack,
  PrefabDocument,
  PrefabNode,
  PrefabPathAnimationKeyframe,
  PrefabPathAnimationTrack,
  PrefabPathTrackProperty,
  PrefabTrackEasing,
  PrefabTrackProperty,
  PrefabVectorAnimationKeyframe,
  PrefabVectorAnimationTrack,
  PrefabVectorTrackProperty,
} from "../core/documents/prefabDocument";

export type {
  PrefabRecord,
  ProjectPackageManifest,
  ProjectRecord,
  SceneDocument,
  SceneNode,
  ScenePrefabInstanceNode,
  ScenePrimitiveNode,
  SceneRecord,
} from "../core/contracts/api";

export async function listProjects(): Promise<ProjectRecord[]> {
  const response = await fetch("/api/projects");
  const body = (await response.json()) as Partial<ProjectsResponse> & {
    error?: string;
  };
  assertOk(response, body.error);
  return body.projects ?? [];
}

export async function createProject(name: string): Promise<ProjectRecord> {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });
  const body = (await response.json()) as Partial<CreateProjectResponse> & {
    error?: string;
  };
  assertOk(response, body.error);

  if (!body.project) {
    throw new Error("Project API did not return a project.");
  }

  return body.project;
}

export async function renameProject(
  projectId: string,
  name: string,
): Promise<ProjectRecord> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });
  const body = (await response.json()) as Partial<RenameProjectResponse> & {
    error?: string;
  };
  assertOk(response, body.error);

  if (!body.project) {
    throw new Error("Project API did not return a renamed project.");
  }

  return body.project;
}

export async function deleteProject(projectId: string): Promise<void> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
  });
  const body = (await response.json()) as { error?: string };
  assertOk(response, body.error);
}

export async function listAssets(projectId: string): Promise<PrimitiveSvgAsset[]> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/assets`,
  );
  const body = (await response.json()) as Partial<AssetsResponse> & {
    error?: string;
  };
  assertOk(response, body.error);
  return (body.assets ?? []).map(hydratePrimitiveAsset);
}

export async function uploadAsset(
  projectId: string,
  file: File,
): Promise<PrimitiveSvgAsset> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/assets`,
    {
      method: "POST",
      body: formData,
    },
  );
  const body = (await response.json()) as Partial<UpdateAssetPathResponse> & {
    error?: string;
  };
  assertOk(response, body.error);

  if (!body.asset) {
    throw new Error("Asset API did not return an asset.");
  }

  return hydratePrimitiveAsset(body.asset);
}

export async function createViewMorphProfileAsset(
  projectId: string,
): Promise<PrimitiveSvgAsset> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/assets/view-morph-profile`,
    {
      method: "POST",
    },
  );
  const body = (await response.json()) as Partial<CreateAssetResponse> & {
    error?: string;
  };
  assertOk(response, body.error);

  if (!body.asset) {
    throw new Error("Asset API did not return a view morph profile asset.");
  }

  return hydratePrimitiveAsset(body.asset);
}

export async function deleteAsset(
  projectId: string,
  assetId: string,
): Promise<void> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`,
    {
      method: "DELETE",
    },
  );
  const body = (await response.json()) as { error?: string };
  assertOk(response, body.error);
}

export async function updateAssetPath(
  projectId: string,
  assetId: string,
  bezierPath: StructuredBezierPath,
): Promise<PrimitiveSvgAsset> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/path`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bezierPath }),
    },
  );
  const body = (await response.json()) as
    Partial<UpdateAssetPathResponse> & { error?: string };
  assertOk(response, body.error);

  if (!body.asset) {
    throw new Error("Asset API did not return an updated asset.");
  }

  return hydratePrimitiveAsset(body.asset);
}

export async function convertAssetTo3DCurve(
  projectId: string,
  assetId: string,
): Promise<PrimitiveSvgAsset> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/convert-to-3d-curve`,
    {
      method: "POST",
    },
  );
  const body = (await response.json()) as Partial<UpdateAssetCurve3DResponse> & {
    error?: string;
  };
  assertOk(response, body.error);

  if (!body.asset) {
    throw new Error("Asset API did not return a converted 3D curve asset.");
  }

  return hydratePrimitiveAsset(body.asset);
}

export async function updateAssetCurve3D(
  projectId: string,
  assetId: string,
  bezierPath3d: StructuredBezierPath3D,
): Promise<PrimitiveSvgAsset> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/curve3d`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bezierPath3d }),
    },
  );
  const body = (await response.json()) as
    Partial<UpdateViewMorphProfileResponse> & { error?: string };
  assertOk(response, body.error);

  if (!body.asset) {
    throw new Error("Asset API did not return an updated 3D curve asset.");
  }

  return hydratePrimitiveAsset(body.asset);
}

export async function updateViewMorphProfile(
  projectId: string,
  assetId: string,
  viewMorphProfile: ViewMorphProfile,
): Promise<PrimitiveSvgAsset> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}/view-morph-profile`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ viewMorphProfile }),
    },
  );
  const body = (await response.json()) as
    Partial<UpdateViewMorphProfileResponse> & { error?: string };
  assertOk(response, body.error);

  if (!body.asset) {
    throw new Error("Asset API did not return an updated view morph profile.");
  }

  return hydratePrimitiveAsset(body.asset);
}

export async function renameAsset(
  projectId: string,
  assetId: string,
  name: string,
): Promise<PrimitiveSvgAsset> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(assetId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    },
  );
  const body = (await response.json()) as Partial<RenameAssetResponse> & {
    error?: string;
  };
  assertOk(response, body.error);

  if (!body.asset) {
    throw new Error("Asset API did not return a renamed asset.");
  }

  return hydratePrimitiveAsset(body.asset);
}

export async function listPrefabs(projectId: string): Promise<PrefabRecord[]> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/prefabs`,
  );
  const body = (await response.json()) as Partial<PrefabsResponse> & {
    error?: string;
  };
  assertOk(response, body.error);
  return body.prefabs ?? [];
}

export async function createPrefab(
  projectId: string,
  name: string,
  document: PrefabDocument,
): Promise<{ prefab: PrefabRecord; document: PrefabDocument }> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/prefabs`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, document }),
    },
  );
  const body = (await response.json()) as Partial<CreatePrefabResponse> & {
    error?: string;
  };
  assertOk(response, body.error);

  if (!body.prefab || !body.document) {
    throw new Error("Prefab API did not return a created prefab.");
  }

  return { prefab: body.prefab, document: body.document };
}

export async function getPrefab(
  projectId: string,
  prefabId: string,
): Promise<{ prefab: PrefabRecord; document: PrefabDocument }> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/prefabs/${encodeURIComponent(prefabId)}`,
  );
  const body = (await response.json()) as Partial<PrefabDetailResponse> & {
    error?: string;
  };
  assertOk(response, body.error);

  if (!body.prefab || !body.document) {
    throw new Error("Prefab API did not return a prefab document.");
  }

  return { prefab: body.prefab, document: body.document };
}

export async function savePrefab(
  projectId: string,
  prefabId: string,
  document: PrefabDocument,
): Promise<{ prefab: PrefabRecord; document: PrefabDocument }> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/prefabs/${encodeURIComponent(prefabId)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ document }),
    },
  );
  const body = (await response.json()) as Partial<PrefabDetailResponse> & {
    error?: string;
  };
  assertOk(response, body.error);

  if (!body.prefab || !body.document) {
    throw new Error("Prefab API did not return an updated prefab.");
  }

  return { prefab: body.prefab, document: body.document };
}

export async function renamePrefab(
  projectId: string,
  prefabId: string,
  name: string,
): Promise<PrefabRecord> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/prefabs/${encodeURIComponent(prefabId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    },
  );
  const body = (await response.json()) as Partial<RenamePrefabResponse> & {
    error?: string;
  };
  assertOk(response, body.error);

  if (!body.prefab) {
    throw new Error("Prefab API did not return a renamed prefab.");
  }

  return body.prefab;
}

export async function deletePrefab(
  projectId: string,
  prefabId: string,
): Promise<void> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/prefabs/${encodeURIComponent(prefabId)}`,
    {
      method: "DELETE",
    },
  );
  const body = (await response.json()) as { error?: string };
  assertOk(response, body.error);
}

export async function listScenes(projectId: string): Promise<SceneRecord[]> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/scenes`,
  );
  const body = (await response.json()) as Partial<ScenesResponse> & {
    error?: string;
  };
  assertOk(response, body.error);
  return body.scenes ?? [];
}

export async function createScene(
  projectId: string,
  name: string,
  document: SceneDocument,
): Promise<{ scene: SceneRecord; document: SceneDocument }> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/scenes`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, document }),
    },
  );
  const body = (await response.json()) as Partial<CreateSceneResponse> & {
    error?: string;
  };
  assertOk(response, body.error);

  if (!body.scene || !body.document) {
    throw new Error("Scene API did not return a created scene.");
  }

  return { scene: body.scene, document: body.document };
}

export async function getScene(
  projectId: string,
  sceneId: string,
): Promise<{ scene: SceneRecord; document: SceneDocument }> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/scenes/${encodeURIComponent(sceneId)}`,
  );
  const body = (await response.json()) as Partial<SceneDetailResponse> & {
    error?: string;
  };
  assertOk(response, body.error);

  if (!body.scene || !body.document) {
    throw new Error("Scene API did not return a scene document.");
  }

  return { scene: body.scene, document: body.document };
}

export async function saveScene(
  projectId: string,
  sceneId: string,
  document: SceneDocument,
): Promise<{ scene: SceneRecord; document: SceneDocument }> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/scenes/${encodeURIComponent(sceneId)}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ document }),
    },
  );
  const body = (await response.json()) as Partial<SceneDetailResponse> & {
    error?: string;
  };
  assertOk(response, body.error);

  if (!body.scene || !body.document) {
    throw new Error("Scene API did not return an updated scene.");
  }

  return { scene: body.scene, document: body.document };
}

export async function renameScene(
  projectId: string,
  sceneId: string,
  name: string,
): Promise<SceneRecord> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/scenes/${encodeURIComponent(sceneId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    },
  );
  const body = (await response.json()) as Partial<RenameSceneResponse> & {
    error?: string;
  };
  assertOk(response, body.error);

  if (!body.scene) {
    throw new Error("Scene API did not return a renamed scene.");
  }

  return body.scene;
}

export async function deleteScene(
  projectId: string,
  sceneId: string,
): Promise<void> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/scenes/${encodeURIComponent(sceneId)}`,
    {
      method: "DELETE",
    },
  );
  const body = (await response.json()) as { error?: string };
  assertOk(response, body.error);
}

export async function exportPackage(
  projectId: string,
  kind: "project" | "primitive" | "prefab" | "scene",
  itemId?: string,
): Promise<ProjectPackageManifest> {
  const search = new URLSearchParams({ kind });

  if (itemId) {
    search.set("id", itemId);
  }

  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/package?${search.toString()}`,
  );
  assertOk(response);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return decodeProjectPackageZip(bytes);
}

export async function importPackage(
  projectId: string | null,
  manifest: ProjectPackageManifest,
): Promise<ImportPackageResponse> {
  const path = projectId
    ? `/api/projects/${encodeURIComponent(projectId)}/package/import`
    : "/api/package/import";
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/zip",
    },
    body: new Blob([toArrayBuffer(encodeProjectPackageZip(manifest))], {
      type: "application/zip",
    }),
  });
  const body = (await response.json()) as Partial<ImportPackageResponse> & {
    error?: string;
  };
  assertOk(response, body.error);

  if (!body.package || !body.idMap) {
    throw new Error("Package API did not return an imported package.");
  }

  return { package: body.package, idMap: body.idMap };
}

function hydratePrimitiveAsset(asset: StoredPrimitiveAssetDto): PrimitiveSvgAsset {
  return hydratePrimitiveSvgAsset(asset);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const output = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(output).set(bytes);
  return output;
}

function assertOk(response: Response, error?: string): void {
  if (!response.ok) {
    throw new Error(error ?? `API request failed with status ${response.status}`);
  }
}
