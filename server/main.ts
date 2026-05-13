import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { createDataStore, getDefaultDataDir, getServerPort } from "./dataStore";
import { validatePrefabDocument } from "./prefabDocument";
import { importPrimitiveSvgOnServer } from "./primitiveSvgImport";
import { validateSceneDocument } from "./sceneDocument";
import type {
  AssetsResponse,
  CreateAssetResponse,
  CreatePrefabResponse,
  CreateProjectResponse,
  CreateSceneResponse,
  HealthResponse,
  PrefabDetailResponse,
  PrefabsResponse,
  ProjectsResponse,
  SceneDetailResponse,
  ScenesResponse,
} from "./types";

const dataStore = createDataStore(getDefaultDataDir());
const server = Fastify({
  logger: true,
});

/**
 * SVG imports are handled by the backend now, so the editor and any future
 * deployed build can use the same API path and the same validation rules. The
 * first storage contract is intentionally small: one uploaded file per request,
 * validated as a primitive SVG before anything is written to disk or SQLite.
 */
await server.register(multipart, {
  limits: {
    fileSize: 1024 * 1024,
    files: 1,
  },
});

server.get<{ Reply: HealthResponse }>("/api/health", async () => {
  await dataStore.ensureReady();

  return {
    ok: true,
    dataDir: dataStore.dataDir,
    projectCount: dataStore.countProjects(),
  };
});

server.get<{ Reply: ProjectsResponse }>("/api/projects", async () => {
  await dataStore.ensureReady();

  return {
    projects: dataStore.listProjects(),
  };
});

server.post<{
  Body: { name?: unknown };
  Reply: CreateProjectResponse | { error: string };
}>("/api/projects", async (request, reply) => {
  await dataStore.ensureReady();

  if (typeof request.body?.name !== "string" || !request.body.name.trim()) {
    reply.code(400);
    return { error: "Project name is required." };
  }

  return {
    project: await dataStore.createProject(request.body.name),
  };
});

server.delete<{
  Params: { projectId: string };
  Reply: { ok: true } | { error: string };
}>("/api/projects/:projectId", async (request, reply) => {
  await dataStore.ensureReady();

  try {
    await dataStore.deleteProject(request.params.projectId);
    return { ok: true };
  } catch (error) {
    reply.code(404);
    return { error: error instanceof Error ? error.message : "Project not found." };
  }
});

server.get<{
  Params: { projectId: string };
  Reply: AssetsResponse | { error: string };
}>("/api/projects/:projectId/assets", async (request, reply) => {
  await dataStore.ensureReady();

  try {
    return {
      assets: dataStore.listPrimitiveAssets(request.params.projectId),
    };
  } catch (error) {
    reply.code(404);
    return { error: error instanceof Error ? error.message : "Project not found." };
  }
});

server.post<{
  Params: { projectId: string };
  Reply: CreateAssetResponse | { error: string };
}>("/api/projects/:projectId/assets", async (request, reply) => {
  await dataStore.ensureReady();

  const upload = await request.file();

  if (!upload) {
    reply.code(400);
    return { error: "SVG file is required." };
  }

  try {
    const svgText = (await upload.toBuffer()).toString("utf8");
    const name = stripSvgExtension(upload.filename);
    /**
     * The server repeats primitive validation even though the browser can also
     * preview SVG paths. This keeps imported project data trustworthy when the
     * editor is eventually deployed or accessed by multiple tools.
     */
    const imported = importPrimitiveSvgOnServer(svgText, {
      id: name,
      name,
      sourceUrl: `upload:${upload.filename}`,
    });
    const asset = await dataStore.createPrimitiveAsset({
      projectId: request.params.projectId,
      name,
      sourceFilename: upload.filename,
      svgText,
      ...imported,
    });

    return { asset };
  } catch (error) {
    reply.code(400);
    return { error: error instanceof Error ? error.message : "Import failed." };
  }
});

server.delete<{
  Params: { projectId: string; assetId: string };
  Reply: { ok: true } | { error: string };
}>("/api/projects/:projectId/assets/:assetId", async (request, reply) => {
  await dataStore.ensureReady();

  try {
    await dataStore.deletePrimitiveAsset(
      request.params.projectId,
      request.params.assetId,
    );
    return { ok: true };
  } catch (error) {
    reply.code(404);
    return { error: error instanceof Error ? error.message : "Asset not found." };
  }
});

server.get<{
  Params: { projectId: string };
  Reply: PrefabsResponse | { error: string };
}>("/api/projects/:projectId/prefabs", async (request, reply) => {
  await dataStore.ensureReady();

  try {
    return {
      prefabs: dataStore.listPrefabs(request.params.projectId),
    };
  } catch (error) {
    reply.code(404);
    return { error: error instanceof Error ? error.message : "Project not found." };
  }
});

server.post<{
  Params: { projectId: string };
  Body: { name?: unknown; document?: unknown };
  Reply: CreatePrefabResponse | { error: string };
}>("/api/projects/:projectId/prefabs", async (request, reply) => {
  await dataStore.ensureReady();

  if (typeof request.body?.name !== "string" || !request.body.name.trim()) {
    reply.code(400);
    return { error: "Prefab name is required." };
  }

  try {
    const document = validatePrefabDocument(request.body.document, {
      projectId: request.params.projectId,
    });
    const prefab = await dataStore.createPrefab({
      projectId: request.params.projectId,
      name: request.body.name,
      document,
    });

    return { prefab, document };
  } catch (error) {
    reply.code(400);
    return { error: error instanceof Error ? error.message : "Prefab create failed." };
  }
});

server.get<{
  Params: { projectId: string; prefabId: string };
  Reply: PrefabDetailResponse | { error: string };
}>("/api/projects/:projectId/prefabs/:prefabId", async (request, reply) => {
  await dataStore.ensureReady();

  try {
    return await dataStore.getPrefab(
      request.params.projectId,
      request.params.prefabId,
    );
  } catch (error) {
    reply.code(404);
    return { error: error instanceof Error ? error.message : "Prefab not found." };
  }
});

server.put<{
  Params: { projectId: string; prefabId: string };
  Body: { document?: unknown };
  Reply: PrefabDetailResponse | { error: string };
}>("/api/projects/:projectId/prefabs/:prefabId", async (request, reply) => {
  await dataStore.ensureReady();

  try {
    const document = validatePrefabDocument(request.body.document, {
      projectId: request.params.projectId,
      prefabId: request.params.prefabId,
    });
    const prefab = await dataStore.updatePrefab(
      request.params.projectId,
      request.params.prefabId,
      document,
    );

    return { prefab, document };
  } catch (error) {
    reply.code(400);
    return { error: error instanceof Error ? error.message : "Prefab update failed." };
  }
});

server.delete<{
  Params: { projectId: string; prefabId: string };
  Reply: { ok: true } | { error: string };
}>("/api/projects/:projectId/prefabs/:prefabId", async (request, reply) => {
  await dataStore.ensureReady();

  try {
    await dataStore.deletePrefab(
      request.params.projectId,
      request.params.prefabId,
    );
    return { ok: true };
  } catch (error) {
    reply.code(404);
    return { error: error instanceof Error ? error.message : "Prefab not found." };
  }
});

server.get<{
  Params: { projectId: string };
  Reply: ScenesResponse | { error: string };
}>("/api/projects/:projectId/scenes", async (request, reply) => {
  await dataStore.ensureReady();

  try {
    return {
      scenes: dataStore.listScenes(request.params.projectId),
    };
  } catch (error) {
    reply.code(404);
    return { error: error instanceof Error ? error.message : "Project not found." };
  }
});

server.post<{
  Params: { projectId: string };
  Body: { name?: unknown; document?: unknown };
  Reply: CreateSceneResponse | { error: string };
}>("/api/projects/:projectId/scenes", async (request, reply) => {
  await dataStore.ensureReady();

  if (typeof request.body?.name !== "string" || !request.body.name.trim()) {
    reply.code(400);
    return { error: "Scene name is required." };
  }

  try {
    const document = validateSceneDocument(request.body.document, {
      projectId: request.params.projectId,
    });
    const scene = await dataStore.createScene({
      projectId: request.params.projectId,
      name: request.body.name,
      document,
    });

    return { scene, document };
  } catch (error) {
    reply.code(400);
    return { error: error instanceof Error ? error.message : "Scene create failed." };
  }
});

server.get<{
  Params: { projectId: string; sceneId: string };
  Reply: SceneDetailResponse | { error: string };
}>("/api/projects/:projectId/scenes/:sceneId", async (request, reply) => {
  await dataStore.ensureReady();

  try {
    return await dataStore.getScene(
      request.params.projectId,
      request.params.sceneId,
    );
  } catch (error) {
    reply.code(404);
    return { error: error instanceof Error ? error.message : "Scene not found." };
  }
});

server.put<{
  Params: { projectId: string; sceneId: string };
  Body: { document?: unknown };
  Reply: SceneDetailResponse | { error: string };
}>("/api/projects/:projectId/scenes/:sceneId", async (request, reply) => {
  await dataStore.ensureReady();

  try {
    const document = validateSceneDocument(request.body.document, {
      projectId: request.params.projectId,
      sceneId: request.params.sceneId,
    });
    const scene = await dataStore.updateScene(
      request.params.projectId,
      request.params.sceneId,
      document,
    );

    return { scene, document };
  } catch (error) {
    reply.code(400);
    return { error: error instanceof Error ? error.message : "Scene update failed." };
  }
});

server.delete<{
  Params: { projectId: string; sceneId: string };
  Reply: { ok: true } | { error: string };
}>("/api/projects/:projectId/scenes/:sceneId", async (request, reply) => {
  await dataStore.ensureReady();

  try {
    await dataStore.deleteScene(request.params.projectId, request.params.sceneId);
    return { ok: true };
  } catch (error) {
    reply.code(404);
    return { error: error instanceof Error ? error.message : "Scene not found." };
  }
});

async function start(): Promise<void> {
  await dataStore.ensureReady();
  await server.listen({
    host: "127.0.0.1",
    port: getServerPort(),
  });
}

function stripSvgExtension(filename: string): string {
  return filename.replace(/\.svg$/i, "") || "primitive-asset";
}

start().catch((error: unknown) => {
  server.log.error(error);
  dataStore.close();
  process.exit(1);
});
