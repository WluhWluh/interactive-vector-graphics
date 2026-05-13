import { DOMParser } from "@xmldom/xmldom";
import type { Element as XmlElement } from "@xmldom/xmldom";
import {
  parsePathDToStructuredBezier,
  type StructuredBezierPath,
} from "../src/core/assets/structuredBezierPath";

type SvgImportContext = {
  id: string;
  name: string;
  sourceUrl: string;
};

export type PrimitiveSvgImportResult = {
  assetKind: "filledPath" | "strokePath";
  viewBox: [number, number, number, number];
  pathD: string;
  fill: string;
  fillRule: "nonzero" | "evenodd";
  stroke: string | null;
  strokeWidth: number | null;
  bezierPath: StructuredBezierPath;
};

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

export class ServerPrimitiveSvgImportError extends Error {
  readonly assetId: string;
  readonly sourceUrl: string;
  readonly context: string;

  constructor(context: SvgImportContext, reason: string) {
    super(`Could not import primitive SVG "${context.id}": ${reason}`);
    this.name = "ServerPrimitiveSvgImportError";
    this.assetId = context.id;
    this.sourceUrl = context.sourceUrl;
    this.context = reason;
  }
}

export function importPrimitiveSvgOnServer(
  svgText: string,
  context: SvgImportContext,
): PrimitiveSvgImportResult {
  const parseErrors: string[] = [];
  const document = new DOMParser({
    onError: (level, message) => {
      if (level !== "warning") {
        parseErrors.push(message);
      }
    },
  }).parseFromString(svgText, "image/svg+xml");

  if (parseErrors.length > 0) {
    throw new ServerPrimitiveSvgImportError(
      context,
      "the SVG XML could not be parsed",
    );
  }

  const svg = document.documentElement;

  if (!svg || svg.localName !== "svg") {
    throw new ServerPrimitiveSvgImportError(
      context,
      "the root element must be <svg>",
    );
  }

  rejectRootAttributes(svg, context);
  rejectUnsupportedElements(svg, context);

  const viewBox = parseViewBox(svg.getAttribute("viewBox"), context);
  const pathElement = selectSinglePathElement(svg, context);
  rejectPathAttributes(pathElement, context);
  const pathD = readRequiredPathData(pathElement, context);
  const styles = readPathStyles(pathElement, pathD, context);
  const bezierPath = parsePathDToStructuredBezier(pathD, {
    expectedClosed: styles.assetKind === "filledPath",
  });

  return styles.assetKind === "strokePath"
    ? {
        assetKind: "strokePath",
        viewBox,
        pathD,
        fill: "none",
        fillRule: "nonzero",
        stroke: styles.stroke,
        strokeWidth: styles.strokeWidth,
        bezierPath,
      }
    : {
        assetKind: "filledPath",
        viewBox,
        pathD,
        fill: styles.fill,
        fillRule: styles.fillRule,
        stroke: null,
        strokeWidth: null,
        bezierPath,
      };
}

function rejectRootAttributes(
  svg: XmlElement,
  context: SvgImportContext,
): void {
  for (const attribute of ["class", "style", "transform"]) {
    if (svg.hasAttribute(attribute)) {
      throw new ServerPrimitiveSvgImportError(
        context,
        `the root <svg> cannot use ${attribute}`,
      );
    }
  }
}

function rejectUnsupportedElements(
  svg: XmlElement,
  context: SvgImportContext,
): void {
  for (const element of getDescendantElements(svg)) {
    const name = element.localName;

    if (name && UNSUPPORTED_ELEMENT_NAMES.has(name)) {
      throw new ServerPrimitiveSvgImportError(
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
    throw new ServerPrimitiveSvgImportError(context, "viewBox is required");
  }

  const values = value
    .trim()
    .split(/[\s,]+/)
    .map((part) => Number(part));

  if (values.length !== 4 || values.some((part) => !Number.isFinite(part))) {
    throw new ServerPrimitiveSvgImportError(
      context,
      "viewBox must contain four numbers",
    );
  }

  const [x, y, width, height] = values;

  if (width <= 0 || height <= 0) {
    throw new ServerPrimitiveSvgImportError(
      context,
      "viewBox width and height must be positive",
    );
  }

  return [x, y, width, height];
}

function selectSinglePathElement(
  svg: XmlElement,
  context: SvgImportContext,
): XmlElement {
  const directChildren = getChildElements(svg);
  let pathHost: XmlElement = svg;

  if (directChildren.length !== 1) {
    throw new ServerPrimitiveSvgImportError(
      context,
      "primitive SVG assets must contain exactly one path or one wrapping group",
    );
  }

  const onlyChild = directChildren[0];

  if (onlyChild.localName === "g") {
    validateWrappingGroup(onlyChild, context);
    pathHost = onlyChild;
  } else if (onlyChild.localName !== "path") {
    throw new ServerPrimitiveSvgImportError(
      context,
      "primitive SVG assets must contain one <path>",
    );
  }

  if (pathHost.localName === "path") {
    return pathHost;
  }

  const groupChildren = getChildElements(pathHost);

  if (groupChildren.length !== 1 || groupChildren[0]?.localName !== "path") {
    throw new ServerPrimitiveSvgImportError(
      context,
      "wrapping groups must contain exactly one <path>",
    );
  }

  return groupChildren[0];
}

function validateWrappingGroup(
  group: XmlElement,
  context: SvgImportContext,
): void {
  for (const attribute of ["transform", "class", "style"]) {
    if (group.hasAttribute(attribute)) {
      throw new ServerPrimitiveSvgImportError(
        context,
        `wrapping groups cannot use ${attribute}`,
      );
    }
  }
}

function readRequiredPathData(
  pathElement: XmlElement,
  context: SvgImportContext,
): string {
  const pathD = pathElement.getAttribute("d")?.trim();

  if (!pathD) {
    throw new ServerPrimitiveSvgImportError(
      context,
      "the path d attribute is required",
    );
  }

  return pathD;
}

function rejectPathAttributes(
  pathElement: XmlElement,
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
      throw new ServerPrimitiveSvgImportError(
        context,
        `path attribute "${attribute}" is not supported`,
      );
    }
  }
}

function readPathStyles(
  pathElement: XmlElement,
  pathD: string,
  context: SvgImportContext,
):
  | {
      assetKind: "filledPath";
      fill: string;
      fillRule: "nonzero" | "evenodd";
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
    throw new ServerPrimitiveSvgImportError(
      context,
      "a primitive path cannot mix solid fill and stroke",
    );
  }

  if (hasSolidStroke) {
    if (!hasNoFill) {
      throw new ServerPrimitiveSvgImportError(
        context,
        "strokePath assets must explicitly use fill=\"none\"",
      );
    }

    if (/[zZ]/.test(pathD)) {
      throw new ServerPrimitiveSvgImportError(
        context,
        "strokePath assets must use an open path without Z commands",
      );
    }

    if (stroke.startsWith("url(")) {
      throw new ServerPrimitiveSvgImportError(
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
    throw new ServerPrimitiveSvgImportError(
      context,
      "strokePath assets must define stroke",
    );
  }

  if (!hasSolidFill) {
    throw new ServerPrimitiveSvgImportError(context, "fill is required");
  }

  if (fill.startsWith("url(")) {
    throw new ServerPrimitiveSvgImportError(
      context,
      "fill must be a solid color, not none or a paint server",
    );
  }

  if (!/[zZ]\s*$/.test(pathD)) {
    throw new ServerPrimitiveSvgImportError(
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
      throw new ServerPrimitiveSvgImportError(
        context,
        `style declaration "${declaration}" is invalid`,
      );
    }

    const property = declaration.slice(0, separatorIndex).trim();
    const value = declaration.slice(separatorIndex + 1).trim();

    if (!ALLOWED_STYLE_PROPERTIES.has(property)) {
      throw new ServerPrimitiveSvgImportError(
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
    throw new ServerPrimitiveSvgImportError(
      context,
      "strokePath assets must define stroke-width",
    );
  }

  const match = /^(\d+(?:\.\d+)?|\.\d+)(px)?$/.exec(value.trim());
  const strokeWidth = match ? Number(match[1]) : Number.NaN;

  if (!Number.isFinite(strokeWidth) || strokeWidth <= 0) {
    throw new ServerPrimitiveSvgImportError(
      context,
      "stroke-width must be a positive number or px value",
    );
  }

  return strokeWidth;
}

function normalizeFillRule(
  value: string,
  context: SvgImportContext,
): "nonzero" | "evenodd" {
  if (value === "nonzero" || value === "evenodd") {
    return value;
  }

  throw new ServerPrimitiveSvgImportError(
    context,
    `fill-rule "${value}" is not supported`,
  );
}

function getChildElements(element: XmlElement): XmlElement[] {
  const output: XmlElement[] = [];

  for (let index = 0; index < element.childNodes.length; index += 1) {
    const child = element.childNodes.item(index);

    if (child?.nodeType === 1) {
      output.push(child as XmlElement);
    }
  }

  return output;
}

function getDescendantElements(element: XmlElement): XmlElement[] {
  const output: XmlElement[] = [];
  const visit = (current: XmlElement): void => {
    for (const child of getChildElements(current)) {
      output.push(child);
      visit(child);
    }
  };

  visit(element);
  return output;
}
