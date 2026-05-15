import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export async function writeTextFileAtomic(
  path: string,
  text: string,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });

  const tempPath = join(
    dirname(path),
    `.${randomUUID()}.${path.split(/[\\/]/).at(-1) ?? "file"}.tmp`,
  );

  try {
    await writeFile(tempPath, text, "utf8");
    await rename(tempPath, path);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}
