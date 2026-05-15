import type { DatabaseSync } from "node:sqlite";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { StoredPrimitiveAsset } from "../types";
import {
  canUpdatePrimitiveAsset2DSourcePath,
  getPrimitiveAssetCapabilities,
  primitiveAssetHas3DSourcePath,
} from "../../src/core/assets/primitiveAssetCapabilities";
import { createNormalizedPrimitiveSvg } from "../../src/core/assets/primitiveAssetSvg";
import {
  validateStructuredBezierPath,
  type StructuredBezierPath,
} from "../../src/core/assets/structuredBezierPath";
import {
  convertStructuredBezierPathTo3D,
  projectStructuredBezierPath3DTo2D,
  validateStructuredBezierPath3D,
  type StructuredBezierPath3D,
} from "../../src/core/assets/structuredBezierPath3d";
import { writeTextFileAtomic } from "../persistence/atomicFile";
import {
  hydratePrimitiveAssetRow,
  type StoredPrimitiveAssetRow,
} from "../persistence/primitiveAssetRows";

export type CreatePrimitiveAssetInput = {
  projectId: string;
  name: string;
  sourceFilename: string;
  svgText: string;
  assetKind: "filledPath" | "strokePath";
  viewBox: [number, number, number, number];
  pathD: string;
  fill: string;
  fillRule: "nonzero" | "evenodd";
  stroke: string | null;
  strokeWidth: number | null;
  bezierPath: StructuredBezierPath;
};

export type PrimitiveAssetStore = {
  listPrimitiveAssets: (projectId: string) => StoredPrimitiveAsset[];
  createPrimitiveAsset: (
    input: CreatePrimitiveAssetInput,
  ) => Promise<StoredPrimitiveAsset>;
  updatePrimitiveAssetPath: (
    projectId: string,
    assetId: string,
    bezierPath: StructuredBezierPath,
  ) => Promise<StoredPrimitiveAsset>;
  convertPrimitiveAssetTo3DCurve: (
    projectId: string,
    assetId: string,
  ) => Promise<StoredPrimitiveAsset>;
  updatePrimitiveAssetCurve3D: (
    projectId: string,
    assetId: string,
    bezierPath3d: StructuredBezierPath3D,
  ) => Promise<StoredPrimitiveAsset>;
  deletePrimitiveAsset: (projectId: string, assetId: string) => Promise<void>;
};

export type PrimitiveAssetStoreDependencies = {
  database: DatabaseSync;
  resolvedDataDir: string;
  assertProjectExists: (projectId: string) => void;
  getProjectDir: (projectId: string) => string;
  toDataRelativePath: (path: string) => string;
  runDatabaseTransaction: <T>(operation: () => T) => T;
  createUniqueId: (baseId: string, existingIds: Set<string>) => string;
  slugifyName: (name: string) => string;
};

export function createPrimitiveAssetStore(
  dependencies: PrimitiveAssetStoreDependencies,
): PrimitiveAssetStore {
  const {
    database,
    resolvedDataDir,
    assertProjectExists,
    getProjectDir,
    toDataRelativePath,
    runDatabaseTransaction,
    createUniqueId,
    slugifyName,
  } = dependencies;

  function listPrimitiveAssets(projectId: string): StoredPrimitiveAsset[] {
    assertProjectExists(projectId);

    const rows = database
      .prepare(
        `
        SELECT id, projectId, name, sourceFilename, sourcePath, assetKind,
          viewBox, pathD, fill, fillRule, stroke, strokeWidth, bezierPath, bezierPath3d,
          createdAt, updatedAt
        FROM primitive_assets
        WHERE projectId = ?
        ORDER BY createdAt
      `,
      )
      .all(projectId) as StoredPrimitiveAssetRow[];

    return rows.map(hydratePrimitiveAssetRow);
  }

  async function createPrimitiveAsset(
    input: CreatePrimitiveAssetInput,
  ): Promise<StoredPrimitiveAsset> {
    assertProjectExists(input.projectId);

    const assetId = createUniqueAssetId(input.projectId, input.name);
    const timestamp = new Date().toISOString();
    const sourcePath = join(
      getProjectDir(input.projectId),
      "primitives",
      `${assetId}.svg`,
    );
    const relativeSourcePath = toDataRelativePath(sourcePath);
    const normalized = createNormalizedPrimitiveSvg({
      assetKind: input.assetKind,
      viewBox: input.viewBox,
      bezierPath: input.bezierPath,
      bezierPath3d: null,
      fill: input.fill,
      fillRule: input.fillRule,
      stroke: input.stroke,
      strokeWidth: input.strokeWidth,
    });
    const asset: StoredPrimitiveAsset = {
      id: assetId,
      projectId: input.projectId,
      name: input.name.trim(),
      sourceFilename: input.sourceFilename,
      sourcePath: relativeSourcePath,
      assetKind: input.assetKind,
      viewBox: input.viewBox,
      pathD: normalized.pathD,
      fill: input.fill,
      fillRule: input.fillRule,
      stroke: input.stroke,
      strokeWidth: input.strokeWidth,
      bezierPath: input.bezierPath,
      bezierPath3d: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await mkdir(dirname(sourcePath), { recursive: true });
    await writeTextFileAtomic(sourcePath, normalized.svgText);
    runDatabaseTransaction(() => {
      database
        .prepare(
          `
        INSERT INTO primitive_assets (
          id, projectId, name, sourceFilename, sourcePath, assetKind, viewBox,
          pathD, fill, fillRule, stroke, strokeWidth, bezierPath, bezierPath3d, createdAt,
          updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          asset.id,
          asset.projectId,
          asset.name,
          asset.sourceFilename,
          asset.sourcePath,
          asset.assetKind,
          JSON.stringify(asset.viewBox),
          asset.pathD,
          asset.fill,
          asset.fillRule,
          asset.stroke,
          asset.strokeWidth,
          JSON.stringify(asset.bezierPath),
          null,
          asset.createdAt,
          asset.updatedAt,
        );
    });

    return asset;
  }

  async function updatePrimitiveAssetPath(
    projectId: string,
    assetId: string,
    bezierPath: StructuredBezierPath,
  ): Promise<StoredPrimitiveAsset> {
    const existingAsset = getPrimitiveAssetRecord(projectId, assetId);
    if (!canUpdatePrimitiveAsset2DSourcePath(existingAsset.assetKind)) {
      throw new Error("3D curve assets must be updated through the curve3d API.");
    }
    const { expectedStructuredPathClosed } = getPrimitiveAssetCapabilities(
      existingAsset.assetKind,
    );
    const validatedBezierPath = validateStructuredBezierPath(bezierPath, {
      expectedClosed: expectedStructuredPathClosed,
    });
    const normalized = createNormalizedPrimitiveSvg({
      assetKind: existingAsset.assetKind,
      viewBox: existingAsset.viewBox,
      bezierPath: validatedBezierPath,
      bezierPath3d: null,
      fill: existingAsset.fill,
      fillRule: existingAsset.fillRule,
      stroke: existingAsset.stroke,
      strokeWidth: existingAsset.strokeWidth,
    });
    const timestamp = new Date().toISOString();
    const updatedAsset: StoredPrimitiveAsset = {
      ...existingAsset,
      pathD: normalized.pathD,
      bezierPath: validatedBezierPath,
      updatedAt: timestamp,
    };

    await writeTextFileAtomic(
      join(resolvedDataDir, existingAsset.sourcePath),
      normalized.svgText,
    );
    runDatabaseTransaction(() => {
      database
        .prepare(
          `
        UPDATE primitive_assets
        SET pathD = ?, bezierPath = ?, updatedAt = ?
        WHERE projectId = ? AND id = ?
      `,
        )
        .run(
          updatedAsset.pathD,
          JSON.stringify(updatedAsset.bezierPath),
          updatedAsset.updatedAt,
          projectId,
          assetId,
        );
    });

    return updatedAsset;
  }

  async function convertPrimitiveAssetTo3DCurve(
    projectId: string,
    assetId: string,
  ): Promise<StoredPrimitiveAsset> {
    const sourceAsset = getPrimitiveAssetRecord(projectId, assetId);

    if (!getPrimitiveAssetCapabilities(sourceAsset.assetKind).canConvertTo3DCurve) {
      throw new Error("Only strokePath assets can be converted to 3D curves.");
    }

    const bezierPath3d = convertStructuredBezierPathTo3D(sourceAsset.bezierPath);
    const projectedBezierPath = projectStructuredBezierPath3DTo2D(bezierPath3d);
    const name = `${sourceAsset.name} 3D Curve`;
    const newAssetId = createUniqueAssetId(projectId, name);
    const timestamp = new Date().toISOString();
    const sourcePath = join(getProjectDir(projectId), "primitives", `${newAssetId}.svg`);
    const relativeSourcePath = toDataRelativePath(sourcePath);
    const normalized = createNormalizedPrimitiveSvg({
      assetKind: "bezierCurve3d",
      viewBox: sourceAsset.viewBox,
      bezierPath: projectedBezierPath,
      bezierPath3d,
      fill: "none",
      fillRule: "nonzero",
      stroke: sourceAsset.stroke,
      strokeWidth: sourceAsset.strokeWidth,
    });
    const asset: StoredPrimitiveAsset = {
      ...sourceAsset,
      id: newAssetId,
      name,
      sourceFilename: `${newAssetId}.svg`,
      sourcePath: relativeSourcePath,
      assetKind: "bezierCurve3d",
      pathD: normalized.pathD,
      fill: "none",
      fillRule: "nonzero",
      bezierPath: projectedBezierPath,
      bezierPath3d,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await mkdir(dirname(sourcePath), { recursive: true });
    await writeTextFileAtomic(sourcePath, normalized.svgText);
    runDatabaseTransaction(() => {
      database
        .prepare(
          `
        INSERT INTO primitive_assets (
          id, projectId, name, sourceFilename, sourcePath, assetKind, viewBox,
          pathD, fill, fillRule, stroke, strokeWidth, bezierPath, bezierPath3d, createdAt,
          updatedAt
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          asset.id,
          asset.projectId,
          asset.name,
          asset.sourceFilename,
          asset.sourcePath,
          asset.assetKind,
          JSON.stringify(asset.viewBox),
          asset.pathD,
          asset.fill,
          asset.fillRule,
          asset.stroke,
          asset.strokeWidth,
          JSON.stringify(asset.bezierPath),
          JSON.stringify(asset.bezierPath3d),
          asset.createdAt,
          asset.updatedAt,
        );
    });

    return asset;
  }

  async function updatePrimitiveAssetCurve3D(
    projectId: string,
    assetId: string,
    bezierPath3d: StructuredBezierPath3D,
  ): Promise<StoredPrimitiveAsset> {
    const existingAsset = getPrimitiveAssetRecord(projectId, assetId);

    if (!primitiveAssetHas3DSourcePath(existingAsset.assetKind)) {
      throw new Error("Only 3D curve assets can be updated through the curve3d API.");
    }

    const validatedBezierPath3d = validateStructuredBezierPath3D(bezierPath3d);
    const projectedBezierPath = projectStructuredBezierPath3DTo2D(validatedBezierPath3d);
    const normalized = createNormalizedPrimitiveSvg({
      assetKind: "bezierCurve3d",
      viewBox: existingAsset.viewBox,
      bezierPath: projectedBezierPath,
      bezierPath3d: validatedBezierPath3d,
      fill: "none",
      fillRule: "nonzero",
      stroke: existingAsset.stroke,
      strokeWidth: existingAsset.strokeWidth,
    });
    const timestamp = new Date().toISOString();
    const updatedAsset: StoredPrimitiveAsset = {
      ...existingAsset,
      pathD: normalized.pathD,
      bezierPath: projectedBezierPath,
      bezierPath3d: validatedBezierPath3d,
      updatedAt: timestamp,
    };

    await writeTextFileAtomic(
      join(resolvedDataDir, existingAsset.sourcePath),
      normalized.svgText,
    );
    runDatabaseTransaction(() => {
      database
        .prepare(
          `
        UPDATE primitive_assets
        SET pathD = ?, bezierPath = ?, bezierPath3d = ?, updatedAt = ?
        WHERE projectId = ? AND id = ?
      `,
        )
        .run(
          updatedAsset.pathD,
          JSON.stringify(updatedAsset.bezierPath),
          JSON.stringify(updatedAsset.bezierPath3d),
          updatedAsset.updatedAt,
          projectId,
          assetId,
        );
    });

    return updatedAsset;
  }

  async function deletePrimitiveAsset(
    projectId: string,
    assetId: string,
  ): Promise<void> {
    assertProjectExists(projectId);

    const row = database
      .prepare(
        "SELECT sourcePath FROM primitive_assets WHERE projectId = ? AND id = ?",
      )
      .get(projectId, assetId) as { sourcePath: string } | undefined;

    runDatabaseTransaction(() => {
      database
        .prepare("DELETE FROM primitive_assets WHERE projectId = ? AND id = ?")
        .run(projectId, assetId);
    });

    if (row) {
      await rm(join(resolvedDataDir, row.sourcePath), { force: true });
    }
  }

  function getPrimitiveAssetRecord(
    projectId: string,
    assetId: string,
  ): StoredPrimitiveAsset {
    assertProjectExists(projectId);

    const row = database
      .prepare(
        `
        SELECT id, projectId, name, sourceFilename, sourcePath, assetKind,
          viewBox, pathD, fill, fillRule, stroke, strokeWidth, bezierPath, bezierPath3d,
          createdAt, updatedAt
        FROM primitive_assets
        WHERE projectId = ? AND id = ?
      `,
      )
      .get(projectId, assetId) as StoredPrimitiveAssetRow | undefined;

    if (!row) {
      throw new Error(`Primitive asset "${assetId}" does not exist.`);
    }

    return hydratePrimitiveAssetRow(row);
  }

  function createUniqueAssetId(projectId: string, name: string): string {
    const baseId = slugifyName(name);
    const existingIds = new Set(
      listPrimitiveAssets(projectId).map((asset) => asset.id),
    );

    return createUniqueId(baseId, existingIds);
  }

  return {
    listPrimitiveAssets,
    createPrimitiveAsset,
    updatePrimitiveAssetPath,
    convertPrimitiveAssetTo3DCurve,
    updatePrimitiveAssetCurve3D,
    deletePrimitiveAsset,
  };
}
