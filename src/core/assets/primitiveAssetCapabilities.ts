import type { PrimitiveAssetKind, PrimitiveSvgAsset } from "./primitiveAssetTypes";

export type StrokeStyledPrimitiveSvgAsset = Extract<
  PrimitiveSvgAsset,
  { assetKind: "strokePath" | "bezierCurve3d" }
>;
export type FillStyledPrimitiveSvgAsset = Extract<
  PrimitiveSvgAsset,
  { assetKind: "filledPath" }
>;
export type PrimitiveAssetWith3DSourcePath = Extract<
  PrimitiveSvgAsset,
  { assetKind: "bezierCurve3d" }
>;

export type PrimitiveAssetRenderStyle = "fill" | "stroke" | "projectedStroke3d";

export type PrimitiveAssetCapabilityDefinition = {
  readonly kind: PrimitiveAssetKind;
  readonly listLabel: string;
  readonly renderStyle: PrimitiveAssetRenderStyle;
  readonly expectedStructuredPathClosed: boolean;
  readonly usesFillStyle: boolean;
  readonly usesStrokeStyle: boolean;
  readonly has3DSourcePath: boolean;
  readonly canUpdate2DSourcePath: boolean;
  readonly canSourcePathEdit: boolean;
  readonly canInPlacePathEdit: boolean;
  readonly canPathKeyframe: boolean;
  readonly canConvertTo3DCurve: boolean;
};

export type PrimitiveAssetCapabilities = Omit<
  PrimitiveAssetCapabilityDefinition,
  "kind"
>;

const PRIMITIVE_ASSET_CAPABILITY_DEFINITIONS: readonly PrimitiveAssetCapabilityDefinition[] =
  [
    {
      kind: "filledPath",
      listLabel: "Fill",
      renderStyle: "fill",
      expectedStructuredPathClosed: true,
      usesFillStyle: true,
      usesStrokeStyle: false,
      has3DSourcePath: false,
      canUpdate2DSourcePath: true,
      canSourcePathEdit: true,
      canInPlacePathEdit: true,
      canPathKeyframe: true,
      canConvertTo3DCurve: false,
    },
    {
      kind: "strokePath",
      listLabel: "Stroke",
      renderStyle: "stroke",
      expectedStructuredPathClosed: false,
      usesFillStyle: false,
      usesStrokeStyle: true,
      has3DSourcePath: false,
      canUpdate2DSourcePath: true,
      canSourcePathEdit: true,
      canInPlacePathEdit: true,
      canPathKeyframe: true,
      canConvertTo3DCurve: true,
    },
    {
      kind: "bezierCurve3d",
      listLabel: "3D Curve",
      renderStyle: "projectedStroke3d",
      expectedStructuredPathClosed: false,
      usesFillStyle: false,
      usesStrokeStyle: true,
      has3DSourcePath: true,
      canUpdate2DSourcePath: false,
      canSourcePathEdit: true,
      canInPlacePathEdit: false,
      canPathKeyframe: false,
      canConvertTo3DCurve: false,
    },
  ];

export const PRIMITIVE_ASSET_CAPABILITY_REGISTRY: ReadonlyMap<
  PrimitiveAssetKind,
  PrimitiveAssetCapabilityDefinition
> = new Map(
  PRIMITIVE_ASSET_CAPABILITY_DEFINITIONS.map((definition) => [
    definition.kind,
    definition,
  ]),
);

const PRIMITIVE_ASSET_CAPABILITIES: Record<PrimitiveAssetKind, PrimitiveAssetCapabilities> = {
  filledPath: {
    ...getPrimitiveAssetCapabilityDefinition("filledPath"),
  },
  strokePath: {
    ...getPrimitiveAssetCapabilityDefinition("strokePath"),
  },
  bezierCurve3d: {
    ...getPrimitiveAssetCapabilityDefinition("bezierCurve3d"),
  },
};

export function getPrimitiveAssetCapabilities(
  assetOrKind: PrimitiveSvgAsset | PrimitiveAssetKind,
): PrimitiveAssetCapabilities {
  return PRIMITIVE_ASSET_CAPABILITIES[getPrimitiveAssetKind(assetOrKind)];
}

export function getPrimitiveAssetCapabilityDefinition(
  assetOrKind: PrimitiveSvgAsset | PrimitiveAssetKind,
): PrimitiveAssetCapabilityDefinition {
  const kind = getPrimitiveAssetKind(assetOrKind);
  const definition = PRIMITIVE_ASSET_CAPABILITY_REGISTRY.get(kind);

  if (!definition) {
    throw new Error(`Unknown primitive asset kind "${kind}".`);
  }

  return definition;
}

export function getPrimitiveAssetCapabilityDefinitions(): PrimitiveAssetCapabilityDefinition[] {
  return [...PRIMITIVE_ASSET_CAPABILITY_REGISTRY.values()];
}

export function primitiveAssetUsesFillStyle(
  asset: PrimitiveSvgAsset,
): asset is FillStyledPrimitiveSvgAsset;
export function primitiveAssetUsesFillStyle(kind: PrimitiveAssetKind): boolean;
export function primitiveAssetUsesFillStyle(
  assetOrKind: PrimitiveSvgAsset | PrimitiveAssetKind,
): boolean {
  return getPrimitiveAssetCapabilities(assetOrKind).usesFillStyle;
}

export function primitiveAssetUsesStrokeStyle(
  asset: PrimitiveSvgAsset,
): asset is StrokeStyledPrimitiveSvgAsset;
export function primitiveAssetUsesStrokeStyle(kind: PrimitiveAssetKind): boolean;
export function primitiveAssetUsesStrokeStyle(
  assetOrKind: PrimitiveSvgAsset | PrimitiveAssetKind,
): boolean {
  return getPrimitiveAssetCapabilities(assetOrKind).usesStrokeStyle;
}

export function primitiveAssetHas3DSourcePath(
  asset: PrimitiveSvgAsset,
): asset is PrimitiveAssetWith3DSourcePath;
export function primitiveAssetHas3DSourcePath(kind: PrimitiveAssetKind): boolean;
export function primitiveAssetHas3DSourcePath(
  assetOrKind: PrimitiveSvgAsset | PrimitiveAssetKind,
): boolean {
  return getPrimitiveAssetCapabilities(assetOrKind).has3DSourcePath;
}

export function canUpdatePrimitiveAsset2DSourcePath(
  assetOrKind: PrimitiveSvgAsset | PrimitiveAssetKind,
): boolean {
  return getPrimitiveAssetCapabilities(assetOrKind).canUpdate2DSourcePath;
}

export function canInPlaceEditPrimitiveAssetPath(
  asset: PrimitiveSvgAsset | null,
): boolean {
  return Boolean(asset && getPrimitiveAssetCapabilities(asset).canInPlacePathEdit);
}

export function canKeyframePrimitiveAssetPath(
  asset: PrimitiveSvgAsset | null,
): boolean {
  return Boolean(asset && getPrimitiveAssetCapabilities(asset).canPathKeyframe);
}

export function canConvertPrimitiveAssetTo3DCurve(
  asset: PrimitiveSvgAsset | null,
): boolean {
  return Boolean(asset && getPrimitiveAssetCapabilities(asset).canConvertTo3DCurve);
}

export function getPrimitiveAssetListLabel(asset: PrimitiveSvgAsset): string {
  return getPrimitiveAssetCapabilities(asset).listLabel;
}

function getPrimitiveAssetKind(
  assetOrKind: PrimitiveSvgAsset | PrimitiveAssetKind,
): PrimitiveAssetKind {
  return typeof assetOrKind === "string" ? assetOrKind : assetOrKind.assetKind;
}
