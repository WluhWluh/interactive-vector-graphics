import type { PrefabTrackProperty } from "../api";
import type { TransformMode } from "../threeEditorViewport";

export type TransformProperty = "position" | "rotation" | "scale";
export type EditorTool = TransformMode | "path";

export const EDITOR_TOOL_TO_PREFAB_PROPERTY: Record<
  EditorTool,
  PrefabTrackProperty
> = {
  translate: "position",
  rotate: "rotation",
  scale: "scale",
  path: "path",
};

export const PREFAB_PROPERTY_TO_EDITOR_TOOL: Record<
  PrefabTrackProperty,
  EditorTool
> = {
  position: "translate",
  rotation: "rotate",
  scale: "scale",
  path: "path",
};

export function getTimelinePropertyForEditorTool(
  tool: EditorTool,
): PrefabTrackProperty {
  return EDITOR_TOOL_TO_PREFAB_PROPERTY[tool];
}

export function getEditorToolForTimelineProperty(
  property: PrefabTrackProperty,
): EditorTool {
  return PREFAB_PROPERTY_TO_EDITOR_TOOL[property];
}

export function canUsePathToolForSelection(input: {
  editorMode: "asset" | "path" | "scene";
  hasActiveClip: boolean;
  hasPrimitiveSelection: boolean;
  assetKind?: string | null;
}): boolean {
  return Boolean(
    input.editorMode === "asset" &&
      input.hasActiveClip &&
      input.hasPrimitiveSelection &&
      input.assetKind !== "bezierCurve3d",
  );
}

export function getFallbackTransformTool(currentTransformMode: TransformMode): TransformMode {
  return currentTransformMode;
}
