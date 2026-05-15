import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { PrefabDocument, SceneDocument } from "../types";
import { writeTextFileAtomic } from "./atomicFile";

export async function writeJsonDocumentFile(
  path: string,
  document: PrefabDocument | SceneDocument,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeTextFileAtomic(path, `${JSON.stringify(document, null, 2)}\n`);
}
