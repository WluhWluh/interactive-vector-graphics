import {
  cloneEditorV2Layout,
  createLayoutFingerprint,
  type EditorV2LayoutDocument,
} from "./layout";

export type EditorV2StoredLayout = {
  id: string;
  name: string;
  layout: EditorV2LayoutDocument;
};

let projectLayoutIdCounter = 0;

export function createStoredProjectLayout(
  name: string,
  layout: EditorV2LayoutDocument,
): EditorV2StoredLayout {
  projectLayoutIdCounter += 1;
  return {
    id: `project-layout-${Date.now().toString(36)}-${projectLayoutIdCounter.toString(36)}`,
    name,
    layout: cloneEditorV2Layout(layout),
  };
}

export function renameStoredProjectLayout(
  layouts: EditorV2StoredLayout[],
  layoutId: string,
  name: string,
): EditorV2StoredLayout[] {
  const trimmed = name.trim();

  if (!trimmed) {
    return layouts;
  }

  return layouts.map((layout) =>
    layout.id === layoutId
      ? {
          ...layout,
          name: trimmed,
        }
      : layout,
  );
}

export function deleteStoredProjectLayout(
  layouts: EditorV2StoredLayout[],
  layoutId: string,
): EditorV2StoredLayout[] {
  return layouts.filter((layout) => layout.id !== layoutId);
}

export function moveStoredProjectLayout(
  layouts: EditorV2StoredLayout[],
  sourceId: string,
  targetId: string,
): EditorV2StoredLayout[] {
  if (sourceId === targetId) {
    return layouts;
  }

  const sourceIndex = layouts.findIndex((layout) => layout.id === sourceId);
  const targetIndex = layouts.findIndex((layout) => layout.id === targetId);

  if (sourceIndex < 0 || targetIndex < 0) {
    return layouts;
  }

  const next = [...layouts];
  const [source] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, source!);
  return next;
}

export function getMatchingProjectLayoutIds(
  layouts: EditorV2StoredLayout[],
  fingerprint: string,
): Set<string> {
  return new Set(
    layouts
      .filter(
        (layout) => createLayoutFingerprint(layout.layout) === fingerprint,
      )
      .map((layout) => layout.id),
  );
}
