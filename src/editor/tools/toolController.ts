import type { PrefabTrackProperty } from "../api";
import type { TransformMode } from "../threeEditorViewport";
import type { PrimitiveAssetKind } from "../../core/assets/primitiveSvg";
import { getPrimitiveAssetCapabilities } from "../../core/assets/primitiveAssetCapabilities";

export type TransformProperty = "position" | "rotation" | "scale";
export type EditorTool = TransformMode | "path";
export type EditorModeForTools = "asset" | "path" | "scene";

export type ToolContext = {
  editorMode: EditorModeForTools;
  hasActiveClip: boolean;
  hasPrimitiveSelection: boolean;
  assetKind?: PrimitiveAssetKind | null;
};

export type ToolDefinition = {
  id: EditorTool;
  label: string;
  timelineProperty: PrefabTrackProperty;
  usesTransformControls: boolean;
  usesPathOverlay: boolean;
  requiresActiveClip: boolean;
  canUse: (context: ToolContext) => boolean;
};

export const TOOL_DEFINITIONS: readonly ToolDefinition[] = [
  {
    id: "translate",
    label: "Move",
    timelineProperty: "position",
    usesTransformControls: true,
    usesPathOverlay: false,
    requiresActiveClip: false,
    canUse: () => true,
  },
  {
    id: "rotate",
    label: "Rotate",
    timelineProperty: "rotation",
    usesTransformControls: true,
    usesPathOverlay: false,
    requiresActiveClip: false,
    canUse: () => true,
  },
  {
    id: "scale",
    label: "Scale",
    timelineProperty: "scale",
    usesTransformControls: true,
    usesPathOverlay: false,
    requiresActiveClip: false,
    canUse: () => true,
  },
  {
    id: "path",
    label: "Path",
    timelineProperty: "path",
    usesTransformControls: false,
    usesPathOverlay: true,
    requiresActiveClip: true,
    canUse: (context) =>
      Boolean(
        context.editorMode === "asset" &&
          context.hasActiveClip &&
          context.hasPrimitiveSelection &&
          context.assetKind &&
          getPrimitiveAssetCapabilities(context.assetKind).canInPlacePathEdit,
      ),
  },
];

export const TRANSFORM_TOOL_DEFINITIONS = TOOL_DEFINITIONS.filter(
  (tool): tool is ToolDefinition & { id: TransformMode } =>
    tool.id === "translate" || tool.id === "rotate" || tool.id === "scale",
);

export const TIMELINE_TOOL_DEFINITIONS = TOOL_DEFINITIONS;
export const TIMELINE_LANE_PROPERTIES = TIMELINE_TOOL_DEFINITIONS.map(
  (tool) => tool.timelineProperty,
);

export const EDITOR_TOOL_TO_PREFAB_PROPERTY = Object.fromEntries(
  TOOL_DEFINITIONS.map((tool) => [tool.id, tool.timelineProperty]),
) as Record<EditorTool, PrefabTrackProperty>;

export const PREFAB_PROPERTY_TO_EDITOR_TOOL = Object.fromEntries(
  TOOL_DEFINITIONS.map((tool) => [tool.timelineProperty, tool.id]),
) as Record<PrefabTrackProperty, EditorTool>;

export function getTimelinePropertyForEditorTool(
  tool: EditorTool,
): PrefabTrackProperty {
  return getToolDefinition(tool).timelineProperty;
}

export function getEditorToolForTimelineProperty(
  property: PrefabTrackProperty,
): EditorTool {
  return (
    TOOL_DEFINITIONS.find((tool) => tool.timelineProperty === property)?.id ??
    PREFAB_PROPERTY_TO_EDITOR_TOOL[property]
  );
}

export function getToolDefinition(tool: EditorTool): ToolDefinition {
  const definition = TOOL_DEFINITIONS.find((candidate) => candidate.id === tool);

  if (!definition) {
    throw new Error(`Unknown editor tool "${tool}".`);
  }

  return definition;
}

export function canUseEditorTool(tool: EditorTool, context: ToolContext): boolean {
  return getToolDefinition(tool).canUse(context);
}

export function canUsePathToolForSelection(input: ToolContext): boolean {
  return canUseEditorTool("path", input);
}

export function getFallbackTransformTool(currentTransformMode: TransformMode): TransformMode {
  return currentTransformMode;
}
