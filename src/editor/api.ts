import type { PrimitiveFillRule, PrimitiveSvgAsset } from "../core/assets/primitiveSvg";
import type { EditorSceneNode, EditorViewportCameraSnapshot } from "./threeEditorViewport";

export type ProjectRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredPrimitiveAssetDto = {
  id: string;
  projectId: string;
  name: string;
  sourceFilename: string;
  sourcePath: string;
  viewBox: [number, number, number, number];
  pathD: string;
  fill: string;
  fillRule: PrimitiveFillRule;
  createdAt: string;
  updatedAt: string;
};

export type SceneDocument = {
  version: 1;
  camera: EditorViewportCameraSnapshot;
  nodes: EditorSceneNode[];
  animation: {
    fps: 24;
    duration: 0;
    tracks: [];
  };
};

export type SceneRecord = {
  id: string;
  projectId: string;
  name: string;
  dataPath: string;
  createdAt: string;
  updatedAt: string;
};

export async function listProjects(): Promise<ProjectRecord[]> {
  const response = await fetch("/api/projects");
  const body = (await response.json()) as { projects?: ProjectRecord[]; error?: string };
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
  const body = (await response.json()) as { project?: ProjectRecord; error?: string };
  assertOk(response, body.error);

  if (!body.project) {
    throw new Error("Project API did not return a project.");
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
  const body = (await response.json()) as {
    assets?: StoredPrimitiveAssetDto[];
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
  const body = (await response.json()) as {
    asset?: StoredPrimitiveAssetDto;
    error?: string;
  };
  assertOk(response, body.error);

  if (!body.asset) {
    throw new Error("Asset API did not return an asset.");
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

export async function listScenes(projectId: string): Promise<SceneRecord[]> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/scenes`,
  );
  const body = (await response.json()) as {
    scenes?: SceneRecord[];
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
  const body = (await response.json()) as {
    scene?: SceneRecord;
    document?: SceneDocument;
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
  const body = (await response.json()) as {
    scene?: SceneRecord;
    document?: SceneDocument;
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
  const body = (await response.json()) as {
    scene?: SceneRecord;
    document?: SceneDocument;
    error?: string;
  };
  assertOk(response, body.error);

  if (!body.scene || !body.document) {
    throw new Error("Scene API did not return an updated scene.");
  }

  return { scene: body.scene, document: body.document };
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

function hydratePrimitiveAsset(asset: StoredPrimitiveAssetDto): PrimitiveSvgAsset {
  /**
   * The backend stores portable primitive data, not browser-only objects. The
   * editor recreates Path2D at the API boundary so rendering code can stay the
   * same whether an asset came from a built-in manifest or persisted storage.
   */
  return {
    id: asset.id,
    name: asset.name,
    sourceUrl: asset.sourcePath,
    viewBox: asset.viewBox,
    pathD: asset.pathD,
    path: new Path2D(asset.pathD),
    fill: asset.fill,
    fillRule: asset.fillRule,
  };
}

function assertOk(response: Response, error?: string): void {
  if (!response.ok) {
    throw new Error(error ?? `API request failed with status ${response.status}`);
  }
}
