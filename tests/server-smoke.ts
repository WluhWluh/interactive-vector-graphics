import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDataStore } from "../server/dataStore";

const tempDataDir = await mkdtemp(join(tmpdir(), "ivg-server-smoke-"));

try {
  const store = createDataStore(tempDataDir);
  await store.ensureReady();

  assert.equal(await store.countProjects(), 0);
  assert.deepEqual(await store.listProjects(), []);

  const firstProject = await store.createProject("My Test Project");
  const secondProject = await store.createProject("My Test Project");

  assert.equal(firstProject.id, "my-test-project");
  assert.equal(firstProject.name, "My Test Project");
  assert.equal(secondProject.id, "my-test-project-2");
  assert.equal((await store.listProjects()).length, 2);

  const projectIndex = JSON.parse(
    await readFile(join(tempDataDir, "projects.json"), "utf8"),
  ) as { projects: Array<{ id: string }> };

  assert.deepEqual(
    projectIndex.projects.map((project) => project.id),
    ["my-test-project", "my-test-project-2"],
  );
} finally {
  await rm(tempDataDir, { recursive: true, force: true });
}
