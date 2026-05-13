import {
  parsePathDToStructuredBezier,
  type StructuredBezierPath,
} from "./structuredBezierPath";

export type PrimitiveFillRule = "nonzero" | "evenodd";
export type PrimitiveAssetKind = "filledPath" | "strokePath";

export type PrimitiveAssetManifestEntry = {
  id: string;
  name: string;
  url: string;
};

export type PrimitiveAssetManifest = {
  version: 1;
  assets: PrimitiveAssetManifestEntry[];
};

export type PrimitiveSvgAssetBase = {
  id: string;
  name: string;
  sourceUrl: string;
  viewBox: [number, number, number, number];
  pathD: string;
  path: Path2D;
  bezierPath: StructuredBezierPath;
};

export type FilledPrimitiveSvgAsset = PrimitiveSvgAssetBase & {
  assetKind: "filledPath";
  fill: string;
  fillRule: PrimitiveFillRule;
};

export type StrokePrimitiveSvgAsset = PrimitiveSvgAssetBase & {
  assetKind: "strokePath";
  stroke: string;
  strokeWidth: number;
};

export type PrimitiveSvgAsset =
  | FilledPrimitiveSvgAsset
  | StrokePrimitiveSvgAsset;

export type SvgImportContext = {
  id: string;
  name: string;
  sourceUrl: string;
};

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const ALLOWED_STYLE_PROPERTIES = new Set([
  "fill",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
]);
const UNSUPPORTED_ELEMENT_NAMES = new Set([
  "defs",
  "clipPath",
  "mask",
  "filter",
  "linearGradient",
  "radialGradient",
  "pattern",
  "text",
  "image",
  "symbol",
  "use",
  "foreignObject",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
]);

export class PrimitiveSvgImportError extends Error {
  readonly assetId: string;
  readonly sourceUrl: string;
  readonly context: string;

  constructor(context: SvgImportContext, reason: string) {
    super(`Could not import primitive SVG "${context.id}": ${reason}`);
    this.name = "PrimitiveSvgImportError";
    this.assetId = context.id;
    this.sourceUrl = context.sourceUrl;
    this.context = reason;
  }
}

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

export async function loadPrimitiveSvgAsset(
  entry: PrimitiveAssetManifestEntry,
): Promise<PrimitiveSvgAsset> {
  const response = await fetch(entry.url);

  if (!response.ok) {
    throw new PrimitiveSvgImportError(
      {
        id: entry.id,
        name: entry.name,
        sourceUrl: entry.url,
      },
      `fetch failed with status ${response.status}`,
    );
  }

  const svgText = await response.text();

  return importPrimitiveSvg(svgText, {
    id: entry.id,
    name: entry.name,
    sourceUrl: entry.url,
  });
}

export function importPrimitiveSvg(
  svgText: string,
  context: SvgImportContext,
): PrimitiveSvgAsset {
  const document = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const parserError = document.querySelector("parsererror");

  if (parserError) {
    throw new PrimitiveSvgImportError(context, "the SVG XML could not be parsed");
  }

  const svg = document.documentElement;

  if (svg.namespaceURI !== SVG_NAMESPACE || svg.localName !== "svg") {
    throw new PrimitiveSvgImportError(context, "the root element must be <svg>");
  }

  rejectRootAttributes(svg, context);
  rejectUnsupportedElements(svg, context);

  const viewBox = parseViewBox(svg.getAttribute("viewBox"), context);
  const pathElement = selectSinglePathElement(svg, context);
  rejectPathAttributes(pathElement, context);

  const pathD = readRequiredPathData(pathElement, context);
  const styles = readPathStyles(pathElement, pathD, context);
  const baseAsset = {
    id: context.id,
    name: context.name,
    sourceUrl: context.sourceUrl,
    viewBox,
    pathD,
    path: new Path2D(pathD),
    bezierPath: parsePathDToStructuredBezier(pathD, {
      expectedClosed: styles.assetKind === "filledPath",
    }),
  };

  if (styles.assetKind === "strokePath") {
    return {
      ...baseAsset,
      assetKind: "strokePath",
      stroke: styles.stroke,
      strokeWidth: styles.strokeWidth,
    };
  }

  return {
    ...baseAsset,
    assetKind: "filledPath",
    fill: styles.fill,
    fillRule: styles.fillRule,
  };
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

function rejectRootAttributes(
  svg: Element,
  context: SvgImportContext,
): void {
  if (svg.hasAttribute("class")) {
    throw new PrimitiveSvgImportError(context, "the root <svg> cannot use class");
  }

  if (svg.hasAttribute("style")) {
    throw new PrimitiveSvgImportError(context, "the root <svg> cannot use style");
  }

  if (svg.hasAttribute("transform")) {
    throw new PrimitiveSvgImportError(
      context,
      "the root <svg> cannot use transform",
    );
  }
}

function rejectUnsupportedElements(
  svg: Element,
  context: SvgImportContext,
): void {
  for (const element of [...svg.querySelectorAll("*")]) {
    const name = element.localName;

    if (UNSUPPORTED_ELEMENT_NAMES.has(name)) {
      throw new PrimitiveSvgImportError(
        context,
        `<${name}> is not supported in primitive SVG assets`,
      );
    }
  }
}

function parseViewBox(
  value: string | null,
  context: SvgImportContext,
): [number, number, number, number] {
  if (!value) {
    throw new PrimitiveSvgImportError(context, "viewBox is required");
  }

  const values = value
    .trim()
    .split(/[\s,]+/)
    .map((part) => Number(part));

  if (values.length !== 4 || values.some((part) => !Number.isFinite(part))) {
    throw new PrimitiveSvgImportError(context, "viewBox must contain four numbers");
  }

  const [x, y, width, height] = values;

  if (width <= 0 || height <= 0) {
    throw new PrimitiveSvgImportError(
      context,
      "viewBox width and height must be positive",
    );
  }

  return [x, y, width, height];
}

function selectSinglePathElement(
  svg: Element,
  context: SvgImportContext,
): SVGPathElement {
  const directChildren = [...svg.children].filter(isMeaningfulElement);
  let pathHost: Element = svg;

  if (directChildren.length !== 1) {
    throw new PrimitiveSvgImportError(
      context,
      "primitive SVG assets must contain exactly one path or one wrapping group",
    );
  }

  const onlyChild = directChildren[0];

  if (onlyChild.localName === "g") {
    validateWrappingGroup(onlyChild, context);
    pathHost = onlyChild;
  } else if (onlyChild.localName !== "path") {
    throw new PrimitiveSvgImportError(
      context,
      "primitive SVG assets must contain one <path>",
    );
  }

  const paths = [...pathHost.children].filter(
    (child) => isMeaningfulElement(child) && child.localName === "path",
  );

  if (pathHost.localName === "path") {
    return pathHost as SVGPathElement;
  }

  if (paths.length !== 1 || pathHost.children.length !== 1) {
    throw new PrimitiveSvgImportError(
      context,
      "wrapping groups must contain exactly one <path>",
    );
  }

  return paths[0] as SVGPathElement;
}

function validateWrappingGroup(group: Element, context: SvgImportContext): void {
  if (group.hasAttribute("transform")) {
    throw new PrimitiveSvgImportError(
      context,
      "wrapping groups cannot use transform",
    );
  }

  if (group.hasAttribute("class")) {
    throw new PrimitiveSvgImportError(context, "wrapping groups cannot use class");
  }

  if (group.hasAttribute("style")) {
    throw new PrimitiveSvgImportError(context, "wrapping groups cannot use style");
  }
}

function isMeaningfulElement(element: Element): boolean {
  return element.nodeType === Node.ELEMENT_NODE;
}

function readRequiredPathData(
  pathElement: SVGPathElement,
  context: SvgImportContext,
): string {
  const pathD = pathElement.getAttribute("d")?.trim();

  if (!pathD) {
    throw new PrimitiveSvgImportError(context, "the path d attribute is required");
  }

  return pathD;
}

function rejectPathAttributes(
  pathElement: SVGPathElement,
  context: SvgImportContext,
): void {
  const rejectedAttributes = [
    "stroke-dasharray",
    "transform",
    "class",
    "opacity",
    "fill-opacity",
    "stroke-opacity",
  ];

  for (const attribute of rejectedAttributes) {
    if (pathElement.hasAttribute(attribute)) {
      throw new PrimitiveSvgImportError(
        context,
        `path attribute "${attribute}" is not supported`,
      );
    }
  }
}

function readPathStyles(
  pathElement: SVGPathElement,
  pathD: string,
  context: SvgImportContext,
):
  | {
      assetKind: "filledPath";
      fill: string;
      fillRule: PrimitiveFillRule;
    }
  | {
      assetKind: "strokePath";
      stroke: string;
      strokeWidth: number;
    } {
  const inlineStyles = parseInlineStyle(pathElement.getAttribute("style"), context);
  const fill = pathElement.getAttribute("fill") ?? inlineStyles.fill ?? null;
  const stroke = pathElement.getAttribute("stroke") ?? inlineStyles.stroke ?? null;
  const strokeWidth =
    pathElement.getAttribute("stroke-width") ?? inlineStyles["stroke-width"] ?? null;
  const fillRule = normalizeFillRule(
    pathElement.getAttribute("fill-rule") ?? inlineStyles["fill-rule"] ?? "nonzero",
    context,
  );
  const hasSolidFill = fill !== null && fill !== "none";
  const hasNoFill = fill === "none";
  const hasSolidStroke = stroke !== null && stroke !== "none";

  if (hasSolidFill && hasSolidStroke) {
    throw new PrimitiveSvgImportError(
      context,
      "a primitive path cannot mix solid fill and stroke",
    );
  }

  if (hasSolidStroke) {
    if (!hasNoFill) {
      throw new PrimitiveSvgImportError(
        context,
        "strokePath assets must explicitly use fill=\"none\"",
      );
    }

    if (/[zZ]/.test(pathD)) {
      throw new PrimitiveSvgImportError(
        context,
        "strokePath assets must use an open path without Z commands",
      );
    }

    if (stroke.startsWith("url(")) {
      throw new PrimitiveSvgImportError(
        context,
        "stroke must be a solid color, not a paint server",
      );
    }

    return {
      assetKind: "strokePath",
      stroke,
      strokeWidth: normalizeStrokeWidth(strokeWidth, context),
    };
  }

  if (hasNoFill) {
    throw new PrimitiveSvgImportError(
      context,
      "strokePath assets must define stroke",
    );
  }

  if (!hasSolidFill) {
    throw new PrimitiveSvgImportError(context, "fill is required");
  }

  if (fill.startsWith("url(")) {
    throw new PrimitiveSvgImportError(
      context,
      "fill must be a solid color, not none or a paint server",
    );
  }

  if (!/[zZ]\s*$/.test(pathD)) {
    throw new PrimitiveSvgImportError(
      context,
      "filledPath assets must be closed with a final Z command",
    );
  }

  return { assetKind: "filledPath", fill, fillRule };
}

function parseInlineStyle(
  style: string | null,
  context: SvgImportContext,
): Record<string, string> {
  if (!style) {
    return {};
  }

  const output: Record<string, string> = {};
  const declarations = style
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean);

  for (const declaration of declarations) {
    const separatorIndex = declaration.indexOf(":");

    if (separatorIndex === -1) {
      throw new PrimitiveSvgImportError(
        context,
        `style declaration "${declaration}" is invalid`,
      );
    }

    const property = declaration.slice(0, separatorIndex).trim();
    const value = declaration.slice(separatorIndex + 1).trim();

    if (!ALLOWED_STYLE_PROPERTIES.has(property)) {
      throw new PrimitiveSvgImportError(
        context,
        `style property "${property}" is not supported`,
      );
    }

    output[property] = value;
  }

  return output;
}

function normalizeStrokeWidth(
  value: string | null,
  context: SvgImportContext,
): number {
  if (!value) {
    throw new PrimitiveSvgImportError(
      context,
      "strokePath assets must define stroke-width",
    );
  }

  const match = /^(\d+(?:\.\d+)?|\.\d+)(px)?$/.exec(value.trim());
  const strokeWidth = match ? Number(match[1]) : Number.NaN;

  if (!Number.isFinite(strokeWidth) || strokeWidth <= 0) {
    throw new PrimitiveSvgImportError(
      context,
      "stroke-width must be a positive number or px value",
    );
  }

  return strokeWidth;
}

function normalizeFillRule(
  value: string,
  context: SvgImportContext,
): PrimitiveFillRule {
  if (value === "nonzero" || value === "evenodd") {
    return value;
  }

  throw new PrimitiveSvgImportError(
    context,
    `fill-rule "${value}" is not supported`,
  );
}
