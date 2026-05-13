import type {
  PrimitiveAssetKind,
  PrimitiveFillRule,
  PrimitiveSvgAsset,
} from "../core/assets/primitiveSvg";
import {
  cloneStructuredBezierPath,
  type StructuredBezierPath,
} from "../core/assets/structuredBezierPath";
import type {
  EditorSceneNode,
  EditorViewportCameraSnapshot,
  Vector3Tuple,
} from "./threeEditorViewport";

export type ProjectRecord = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredPrimitiveAssetDto = {
  id: string;
  projectId: string;
  assetKind: PrimitiveAssetKind;
  name: string;
  sourceFilename: string;
  sourcePath: string;
  viewBox: [number, number, number, number];
  pathD: string;
  fill: string;
  fillRule: PrimitiveFillRule;
  stroke: string | null;
  strokeWidth: number | null;
  bezierPath: StructuredBezierPath;
  createdAt: string;
  updatedAt: string;
};

export type PrefabNode = {
  id: string;
  kind: "group" | "primitive";
  parentId: string | null;
  assetId?: string;
  name: string;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
  billboardMode: "spherical";
};

export type PrefabTrackEasing = "linear" | "step" | "easeInOut";
export type PrefabTrackProperty = "position" | "rotation" | "scale";

export type PrefabAnimation = {
  snapFps: number;
  activeClipId: string | null;
  clips: PrefabAnimationClip[];
};

export type PrefabAnimationClip = {
  id: string;
  name: string;
  durationMs: number;
  loop: boolean;
  tracks: PrefabAnimationTrack[];
};

export type PrefabAnimationTrack = {
  id: string;
  target: {
    nodeId: string;
    property: PrefabTrackProperty;
  };
  keyframes: PrefabAnimationKeyframe[];
};

export type PrefabAnimationKeyframe = {
  id: string;
  timeMs: number;
  value: Vector3Tuple;
  easing: PrefabTrackEasing;
};

export type PrefabDocument = {
  version: 3;
  nodes: PrefabNode[];
  animation: PrefabAnimation;
};

export type PrefabRecord = {
  id: string;
  projectId: string;
  name: string;
  dataPath: string;
  createdAt: string;
  updatedAt: string;
};

export type ScenePrimitiveNode = EditorSceneNode & {
  kind: "primitive";
};

export type ScenePrefabInstanceNode = {
  id: string;
  kind: "prefabInstance";
  prefabId: string;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
};

export type SceneNode = ScenePrimitiveNode | ScenePrefabInstanceNode;

export type SceneDocument = {
  version: 2;
  camera: EditorViewportCameraSnapshot;
  nodes: SceneNode[];
  animation: {
    fps: 24;
    activeClipId: string | null;
    clips: Array<{
      id: string;
      name: string;
      duration: number;
      tracks: Array<{
        id: string;
        target:
          | {
              kind: "node";
              nodeId: string;
              property:
                | "position"
                | "rotation"
                | "scale"
                | "target"
                | "fov"
                | "zoom";
            }
          | {
              kind: "camera";
              property:
                | "position"
                | "rotation"
                | "scale"
                | "target"
                | "fov"
                | "zoom";
            };
        keyframes: Array<{
          time: number;
          value: number | [number, number, number];
          easing: "linear" | "step" | "easeInOut";
        }>;
      }>;
    }>;
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

export async function listPrefabs(projectId: string): Promise<PrefabRecord[]> {
  const response = await fetch(
    `/api/projects/${encodeURIComponent(projectId)}/prefabs`,
  );
  const body = (await response.json()) as {
    prefabs?: PrefabRecord[];
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
  const body = (await response.json()) as {
    prefab?: PrefabRecord;
    document?: PrefabDocument;
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
  const body = (await response.json()) as {
    prefab?: PrefabRecord;
    document?: PrefabDocument;
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
  const body = (await response.json()) as {
    prefab?: PrefabRecord;
    document?: PrefabDocument;
    error?: string;
  };
  assertOk(response, body.error);

  if (!body.prefab || !body.document) {
    throw new Error("Prefab API did not return an updated prefab.");
  }

  return { prefab: body.prefab, document: body.document };
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
  const baseAsset = {
    id: asset.id,
    name: asset.name,
    sourceUrl: asset.sourcePath,
    viewBox: asset.viewBox,
    pathD: asset.pathD,
    path: new Path2D(asset.pathD),
    bezierPath: cloneStructuredBezierPath(asset.bezierPath),
  };

  return asset.assetKind === "strokePath"
    ? {
        ...baseAsset,
        assetKind: "strokePath",
        stroke: asset.stroke ?? "#000000",
        strokeWidth: asset.strokeWidth ?? 1,
      }
    : {
        ...baseAsset,
        assetKind: "filledPath",
        fill: asset.fill,
        fillRule: asset.fillRule,
      };
}

function assertOk(response: Response, error?: string): void {
  if (!response.ok) {
    throw new Error(error ?? `API request failed with status ${response.status}`);
  }
}
