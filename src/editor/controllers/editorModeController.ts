import type { EditorMode } from "../state/editorAppState";

export type EditorModeChangePlan = {
  nextMode: EditorMode;
  shouldExitPathTool: boolean;
  shouldClearSourcePathEdit: boolean;
  shouldClearCurve3DControls: boolean;
};

export function planEditorModeChange(
  currentMode: EditorMode,
  nextMode: EditorMode,
): EditorModeChangePlan {
  return {
    nextMode,
    shouldExitPathTool: nextMode !== "asset" || currentMode !== "asset",
    shouldClearSourcePathEdit: nextMode !== "path",
    shouldClearCurve3DControls: nextMode !== "path",
  };
}
