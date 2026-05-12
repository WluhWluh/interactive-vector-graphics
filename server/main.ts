import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { createDataStore, getDefaultDataDir, getServerPort } from "./dataStore";
import { importPrimitiveSvgOnServer } from "./primitiveSvgImport";
import type {
  AssetsResponse,
  CreateAssetResponse,
  CreateProjectResponse,
  HealthResponse,
  ProjectsResponse,
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
