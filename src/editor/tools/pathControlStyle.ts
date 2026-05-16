import type { PathEditComponent } from "./pathEditCore";

export type PathControlVisualState = {
  selected: boolean;
  hovered: boolean;
};

export type PathControl2DStyle = {
  fill: string;
  stroke: string;
  lineWidth: number;
  radius: number;
  size: number;
};

export type PathControl3DStyle = {
  fill: number;
  outline: number;
  scale: number;
  outlineScale: number;
};

export const PATH_CONTROL_COLORS = {
  anchorFill: "#5bc4bf",
  handleFill: "#5bc4bf",
  selectedFill: "#ffcf4a",
  outline: "rgba(17, 24, 39, 0.86)",
  hoverOutline: "#ffffff",
  handleLine: "rgba(238, 244, 255, 0.44)",
  anchorFill3D: 0x5bc4bf,
  handleFill3D: 0x5bc4bf,
  selectedFill3D: 0xffcf4a,
  outline3D: 0x111827,
  hoverOutline3D: 0xffffff,
  handleLine3D: 0xeef4ff,
} as const;

export function getPathControl2DStyle(
  component: PathEditComponent,
  state: PathControlVisualState,
): PathControl2DStyle {
  const emphasized = state.selected || state.hovered;

  return {
    fill: state.selected
      ? PATH_CONTROL_COLORS.selectedFill
      : component === "anchor"
        ? PATH_CONTROL_COLORS.anchorFill
        : PATH_CONTROL_COLORS.handleFill,
    stroke: state.hovered
      ? PATH_CONTROL_COLORS.hoverOutline
      : PATH_CONTROL_COLORS.outline,
    lineWidth: state.hovered ? 3 : 2,
    radius: emphasized ? 6 : 5,
    size: emphasized ? 10 : 8,
  };
}

export function getPolylineControl2DStyle(
  state: PathControlVisualState,
): PathControl2DStyle {
  return getPathControl2DStyle("anchor", state);
}

export function getPathControl3DStyle(
  component: PathEditComponent,
  state: PathControlVisualState,
): PathControl3DStyle {
  const emphasized = state.selected || state.hovered;

  return {
    fill: state.selected
      ? PATH_CONTROL_COLORS.selectedFill3D
      : component === "anchor"
        ? PATH_CONTROL_COLORS.anchorFill3D
        : PATH_CONTROL_COLORS.handleFill3D,
    outline: state.hovered
      ? PATH_CONTROL_COLORS.hoverOutline3D
      : PATH_CONTROL_COLORS.outline3D,
    scale: emphasized ? 1.16 : 1,
    outlineScale: state.hovered ? 1.48 : 1.32,
  };
}
