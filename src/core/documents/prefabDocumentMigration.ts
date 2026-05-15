import {
  clonePrefabDocument,
  PREFAB_DOCUMENT_VERSION,
  type PrefabDocument,
} from "./prefabDocument";
import {
  createLatestDocumentMigrationResult,
  createUnsupportedDocumentMigrationResult,
  readDocumentVersion,
  type DocumentMigrationResult,
} from "./documentMigration";

export function migratePrefabDocument(
  value: unknown,
): DocumentMigrationResult<PrefabDocument> {
  const version = readDocumentVersion(value);

  if (version === PREFAB_DOCUMENT_VERSION) {
    return createLatestDocumentMigrationResult({
      document: clonePrefabDocument(value as PrefabDocument),
      version,
    });
  }

  return createUnsupportedDocumentMigrationResult({
    value,
    latestVersion: PREFAB_DOCUMENT_VERSION,
    documentLabel: "Prefab",
  });
}
