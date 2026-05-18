import type { EditorV2ContentType } from "./layout";

export type EditorV2ContentDefinition = {
  type: EditorV2ContentType;
  label: string;
  shortLabel: string;
  description: string;
};

export const EDITOR_V2_CONTENT_DEFINITIONS: EditorV2ContentDefinition[] = [
  {
    type: "viewport",
    label: "3D Viewport",
    shortLabel: "Viewport",
    description: "Camera preview and editing handles",
  },
  {
    type: "assetBrowser",
    label: "Asset Browser",
    shortLabel: "Assets",
    description: "Projects, primitives, prefabs, scenes",
  },
  {
    type: "outliner",
    label: "Outliner",
    shortLabel: "Outliner",
    description: "Scene and prefab hierarchy",
  },
  {
    type: "inspector",
    label: "Inspector",
    shortLabel: "Inspector",
    description: "Selected item properties",
  },
  {
    type: "timeline",
    label: "Timeline",
    shortLabel: "Timeline",
    description: "Animation clips and keyframes",
  },
  {
    type: "console",
    label: "Console",
    shortLabel: "Console",
    description: "Status, warnings, and command feedback",
  },
  {
    type: "properties",
    label: "Properties",
    shortLabel: "Props",
    description: "Tool and document settings",
  },
  {
    type: "toolbar",
    label: "Tool Shelf",
    shortLabel: "Tools",
    description: "Tool categories and quick actions",
  },
];

export function getEditorV2ContentDefinition(
  type: EditorV2ContentType,
): EditorV2ContentDefinition {
  return (
    EDITOR_V2_CONTENT_DEFINITIONS.find((definition) => definition.type === type) ??
    EDITOR_V2_CONTENT_DEFINITIONS[0]!
  );
}
