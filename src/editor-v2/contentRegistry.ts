import type { EditorV2ContentType } from "./layout";

export type EditorV2ContentDefinition = {
  type: EditorV2ContentType;
  label: string;
  shortLabel: string;
  description: string;
  minWidth: number;
  minHeight: number;
};

export const EDITOR_V2_CONTENT_DEFINITIONS: EditorV2ContentDefinition[] = [
  {
    type: "viewport",
    label: "3D Viewport",
    shortLabel: "Viewport",
    description: "Camera preview and editing handles",
    minWidth: 300,
    minHeight: 220,
  },
  {
    type: "assetBrowser",
    label: "Asset Browser",
    shortLabel: "Assets",
    description: "Projects, primitives, prefabs, scenes",
    minWidth: 220,
    minHeight: 160,
  },
  {
    type: "outliner",
    label: "Outliner",
    shortLabel: "Outliner",
    description: "Scene and prefab hierarchy",
    minWidth: 180,
    minHeight: 160,
  },
  {
    type: "inspector",
    label: "Inspector",
    shortLabel: "Inspector",
    description: "Selected item properties",
    minWidth: 240,
    minHeight: 180,
  },
  {
    type: "timeline",
    label: "Timeline",
    shortLabel: "Timeline",
    description: "Animation clips and keyframes",
    minWidth: 360,
    minHeight: 150,
  },
  {
    type: "console",
    label: "Console",
    shortLabel: "Console",
    description: "Status, warnings, and command feedback",
    minWidth: 260,
    minHeight: 140,
  },
  {
    type: "properties",
    label: "Properties",
    shortLabel: "Props",
    description: "Tool and document settings",
    minWidth: 220,
    minHeight: 180,
  },
  {
    type: "toolbar",
    label: "Tool Shelf",
    shortLabel: "Tools",
    description: "Tool categories and quick actions",
    minWidth: 180,
    minHeight: 160,
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
