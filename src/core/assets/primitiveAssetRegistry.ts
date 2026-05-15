import type {
  PrimitiveAssetManifest,
  PrimitiveSvgAsset,
} from "./primitiveAssetTypes";
import { loadPrimitiveSvgAsset } from "./primitiveSvgImport";

export class PrimitiveAssetRegistry {
  private readonly assets = new Map<string, PrimitiveSvgAsset>();

  async loadManifest(manifestUrl: string): Promise<void> {
    const response = await fetch(manifestUrl);

    if (!response.ok) {
      throw new Error(
        `Could not load primitive asset manifest "${manifestUrl}": ${response.status}`,
      );
    }

    const manifest = (await response.json()) as PrimitiveAssetManifest;
    assertValidManifest(manifest, manifestUrl);

    await Promise.all(
      manifest.assets.map(async (entry) => {
        const asset = await loadPrimitiveSvgAsset(entry);
        this.register(asset);
      }),
    );
  }

  register(asset: PrimitiveSvgAsset): void {
    if (this.assets.has(asset.id)) {
      throw new Error(`Primitive asset "${asset.id}" is already registered.`);
    }

    this.assets.set(asset.id, asset);
  }

  has(id: string): boolean {
    return this.assets.has(id);
  }

  createUniqueId(baseId: string): string {
    const safeBaseId = toSafeAssetId(baseId);

    if (!this.has(safeBaseId)) {
      return safeBaseId;
    }

    let suffix = 2;
    let candidate = `${safeBaseId}-${suffix}`;

    while (this.has(candidate)) {
      suffix += 1;
      candidate = `${safeBaseId}-${suffix}`;
    }

    return candidate;
  }

  get(id: string): PrimitiveSvgAsset {
    const asset = this.assets.get(id);

    if (!asset) {
      throw new Error(`Primitive asset "${id}" is not registered.`);
    }

    return asset;
  }

  snapshot(): PrimitiveSvgAsset[] {
    return [...this.assets.values()];
  }
}

export function toSafeAssetId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "primitive-asset";
}

function assertValidManifest(
  manifest: PrimitiveAssetManifest,
  manifestUrl: string,
): void {
  if (manifest.version !== 1 || !Array.isArray(manifest.assets)) {
    throw new Error(`Primitive asset manifest "${manifestUrl}" must use version 1.`);
  }

  const seenIds = new Set<string>();

  for (const asset of manifest.assets) {
    if (!asset.id || !asset.name || !asset.url) {
      throw new Error(
        `Primitive asset manifest "${manifestUrl}" contains an invalid entry.`,
      );
    }

    if (seenIds.has(asset.id)) {
      throw new Error(
        `Primitive asset manifest "${manifestUrl}" repeats asset id "${asset.id}".`,
      );
    }

    seenIds.add(asset.id);
  }
}
