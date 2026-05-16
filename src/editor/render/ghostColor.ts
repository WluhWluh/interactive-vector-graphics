import type { PrimitiveSvgAsset } from "../../core/assets/primitiveAssetTypes";
import { primitiveAssetUsesStrokeStyle } from "../../core/assets/primitiveAssetCapabilities";

type RgbColor = {
  r: number;
  g: number;
  b: number;
};

const ghostColorCache = new Map<string, string>();
const GHOST_COLOR_CANDIDATES: RgbColor[] = [
  { r: 255, g: 207, b: 74 },
  { r: 91, g: 196, b: 191 },
  { r: 244, g: 114, b: 182 },
  { r: 163, g: 230, b: 53 },
  { r: 56, g: 189, b: 248 },
  { r: 249, g: 115, b: 22 },
  { r: 248, g: 250, b: 252 },
];

export function getPrimitiveGhostColor(asset: PrimitiveSvgAsset): string {
  return getContrastGhostColor(
    primitiveAssetUsesStrokeStyle(asset) ? asset.stroke : asset.fill,
  );
}

export function getContrastGhostColor(sourceColor: string): string {
  const cachedColor = ghostColorCache.get(sourceColor);

  if (cachedColor) {
    return cachedColor;
  }

  const sourceRgb = parseCssColorToRgb(sourceColor);
  const selectedColor = sourceRgb
    ? GHOST_COLOR_CANDIDATES.reduce((best, candidate) =>
        getRgbContrastScore(candidate, sourceRgb) >
        getRgbContrastScore(best, sourceRgb)
          ? candidate
          : best,
      )
    : GHOST_COLOR_CANDIDATES[0];
  const color = rgbToHex(selectedColor);
  ghostColorCache.set(sourceColor, color);
  return color;
}

function parseCssColorToRgb(color: string): RgbColor | null {
  const canonicalColor = getCanonicalCanvasColor(color);
  const hexMatch = /^#([0-9a-f]{6})$/i.exec(canonicalColor);

  if (hexMatch?.[1]) {
    return {
      r: Number.parseInt(hexMatch[1].slice(0, 2), 16),
      g: Number.parseInt(hexMatch[1].slice(2, 4), 16),
      b: Number.parseInt(hexMatch[1].slice(4, 6), 16),
    };
  }

  const rgbMatch =
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i.exec(
      canonicalColor,
    );

  if (!rgbMatch?.[1] || !rgbMatch[2] || !rgbMatch[3]) {
    return null;
  }

  return {
    r: clampColorChannel(Number(rgbMatch[1])),
    g: clampColorChannel(Number(rgbMatch[2])),
    b: clampColorChannel(Number(rgbMatch[3])),
  };
}

function getCanonicalCanvasColor(color: string): string {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return color;
  }

  context.fillStyle = "#000000";
  context.fillStyle = color;
  return context.fillStyle;
}

function getRgbContrastScore(left: RgbColor, right: RgbColor): number {
  const channelDistance =
    Math.abs(left.r - right.r) +
    Math.abs(left.g - right.g) +
    Math.abs(left.b - right.b);
  const luminanceDistance = Math.abs(getRelativeLuminance(left) - getRelativeLuminance(right));

  return channelDistance + luminanceDistance * 255;
}

function getRelativeLuminance(color: RgbColor): number {
  return (
    0.2126 * normalizeColorChannel(color.r) +
    0.7152 * normalizeColorChannel(color.g) +
    0.0722 * normalizeColorChannel(color.b)
  );
}

function normalizeColorChannel(channel: number): number {
  const value = channel / 255;

  return value <= 0.03928
    ? value / 12.92
    : ((value + 0.055) / 1.055) ** 2.4;
}

function clampColorChannel(channel: number): number {
  return Math.max(0, Math.min(255, Math.round(channel)));
}

function rgbToHex(color: RgbColor): string {
  return `#${[color.r, color.g, color.b]
    .map((channel) => clampColorChannel(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}
