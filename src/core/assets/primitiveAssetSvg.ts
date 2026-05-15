import { getPrimitiveAssetCapabilities } from "./primitiveAssetCapabilities";
import { structuredBezierToPathD } from "./structuredBezierPath";
import type { StructuredBezierPath } from "./structuredBezierPath";
import type { StructuredBezierPath3D } from "./structuredBezierPath3d";
import type { ViewMorphProfile } from "./viewMorphProfile";

export type SerializedPrimitiveAssetSvgInput = {
  assetKind: "filledPath" | "strokePath" | "bezierCurve3d" | "viewMorphProfile";
  viewBox: [number, number, number, number];
  bezierPath: StructuredBezierPath;
  bezierPath3d?: StructuredBezierPath3D | null;
  viewMorphProfile?: ViewMorphProfile | null;
  fill: string;
  fillRule: "nonzero" | "evenodd";
  stroke: string | null;
  strokeWidth: number | null;
};

/**
 * Persisted primitive SVG files are project-native assets, not raw Illustrator
 * exports. Rebuilding the file from structured data keeps SQLite metadata,
 * Path2D runtime data, and the on-disk SVG source in lockstep after imports or
 * Path Edit Mode saves.
 */
export function createNormalizedPrimitiveSvg(
  input: SerializedPrimitiveAssetSvgInput,
): { svgText: string; pathD: string } {
  const pathD = structuredBezierToPathD(input.bezierPath);
  const viewBox = input.viewBox.map(formatSvgNumber).join(" ");
  const pathMarkup =
    getPrimitiveAssetCapabilities(input.assetKind).usesStrokeStyle
      ? createStrokePathMarkup(input, pathD)
      : createFilledPathMarkup(input, pathD);
  const metadata =
    getPrimitiveAssetCapabilities(input.assetKind).has3DSourcePath &&
    input.bezierPath3d
      ? `  <metadata data-ivg-asset-kind="bezierCurve3d">${escapeXmlText(
          JSON.stringify(input.bezierPath3d),
        )}</metadata>`
      : input.assetKind === "viewMorphProfile" && input.viewMorphProfile
        ? `  <metadata data-ivg-asset-kind="viewMorphProfile">${escapeXmlText(
            JSON.stringify(input.viewMorphProfile),
          )}</metadata>`
      : null;

  return {
    pathD,
    svgText: [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">`,
      ...(metadata ? [metadata] : []),
      `  ${pathMarkup}`,
      "</svg>",
      "",
    ].join("\n"),
  };
}

function createFilledPathMarkup(
  input: SerializedPrimitiveAssetSvgInput,
  pathD: string,
): string {
  return [
    "<path",
    `fill="${escapeXmlAttribute(input.fill)}"`,
    `fill-rule="${input.fillRule}"`,
    `d="${escapeXmlAttribute(pathD)}"`,
    "/>",
  ].join(" ");
}

function createStrokePathMarkup(
  input: SerializedPrimitiveAssetSvgInput,
  pathD: string,
): string {
  return [
    "<path",
    'fill="none"',
    `stroke="${escapeXmlAttribute(input.stroke ?? "#000000")}"`,
    `stroke-width="${formatSvgNumber(input.strokeWidth ?? 1)}"`,
    'stroke-linecap="round"',
    'stroke-linejoin="round"',
    `d="${escapeXmlAttribute(pathD)}"`,
    "/>",
  ].join(" ");
}

function escapeXmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeXmlText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function formatSvgNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
}
