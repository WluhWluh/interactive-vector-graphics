import { structuredBezierToPathD } from "./structuredBezierPath";
import type { StructuredBezierPath } from "./structuredBezierPath";

export type SerializedPrimitiveAssetSvgInput = {
  assetKind: "filledPath" | "strokePath";
  viewBox: [number, number, number, number];
  bezierPath: StructuredBezierPath;
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
    input.assetKind === "strokePath"
      ? createStrokePathMarkup(input, pathD)
      : createFilledPathMarkup(input, pathD);

  return {
    pathD,
    svgText: [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">`,
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

function formatSvgNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
}
