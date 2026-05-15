export type DocumentMigrationResult<TDocument> =
  | {
      ok: true;
      document: TDocument;
      fromVersion: number;
      toVersion: number;
      migrated: boolean;
    }
  | {
      ok: false;
      fromVersion: number | null;
      reason: string;
    };

export function readDocumentVersion(value: unknown): number | null {
  if (!isRecord(value)) {
    return null;
  }

  const { version } = value;

  return Number.isInteger(version) ? (version as number) : null;
}

export function createLatestDocumentMigrationResult<TDocument>(input: {
  document: TDocument;
  version: number;
}): DocumentMigrationResult<TDocument> {
  return {
    ok: true,
    document: input.document,
    fromVersion: input.version,
    toVersion: input.version,
    migrated: false,
  };
}

export function createUnsupportedDocumentMigrationResult<TDocument>(input: {
  value: unknown;
  latestVersion: number;
  documentLabel: string;
}): DocumentMigrationResult<TDocument> {
  const fromVersion = readDocumentVersion(input.value);

  return {
    ok: false,
    fromVersion,
    reason:
      fromVersion === null
        ? `${input.documentLabel} document version is missing`
        : `${input.documentLabel} document version ${fromVersion} cannot be migrated to ${input.latestVersion}`,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
