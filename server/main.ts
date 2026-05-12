import Fastify from "fastify";
import { createDataStore, getDefaultDataDir, getServerPort } from "./dataStore";
import type {
  CreateProjectResponse,
  HealthResponse,
  ProjectsResponse,
} from "./types";

const dataStore = createDataStore(getDefaultDataDir());
const server = Fastify({
  logger: true,
});

server.get<{ Reply: HealthResponse }>("/api/health", async () => {
  await dataStore.ensureReady();

  return {
    ok: true,
    dataDir: dataStore.dataDir,
    projectCount: await dataStore.countProjects(),
  };
});

server.get<{ Reply: ProjectsResponse }>("/api/projects", async () => {
  await dataStore.ensureReady();

  return {
    projects: await dataStore.listProjects(),
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

async function start(): Promise<void> {
  await dataStore.ensureReady();
  await server.listen({
    host: "127.0.0.1",
    port: getServerPort(),
  });
}

start().catch((error: unknown) => {
  server.log.error(error);
  process.exit(1);
});
