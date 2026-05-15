import type { CollapsibleModuleId } from "../ui/collapsibleModules";
import type { EditorAppState } from "./editorAppState";

export type EditorCommand =
  | {
      type: "setLastImportError";
      message: string;
    }
  | {
      type: "clearLastImportError";
    }
  | {
      type: "toggleCollapsedModule";
      moduleId: CollapsibleModuleId;
      collapsedModuleIds: Set<CollapsibleModuleId>;
    };

export type EditorCommandInvalidation = {
  renderShell?: boolean;
  exposeDebugHooks?: boolean;
  persistCollapsedModules?: boolean;
};

export type EditorCommandResult = {
  collapsedModuleIds?: Set<CollapsibleModuleId>;
  invalidation: EditorCommandInvalidation;
};

export function dispatchEditorCommand(
  state: EditorAppState,
  command: EditorCommand,
): EditorCommandResult {
  switch (command.type) {
    case "setLastImportError":
      state.lastImportError = command.message;

      return {
        invalidation: {
          renderShell: true,
          exposeDebugHooks: true,
        },
      };

    case "clearLastImportError":
      state.lastImportError = null;

      return {
        invalidation: {
          exposeDebugHooks: true,
        },
      };

    case "toggleCollapsedModule": {
      const collapsedModuleIds = new Set(command.collapsedModuleIds);

      if (collapsedModuleIds.has(command.moduleId)) {
        collapsedModuleIds.delete(command.moduleId);
      } else {
        collapsedModuleIds.add(command.moduleId);
      }

      return {
        collapsedModuleIds,
        invalidation: {
          exposeDebugHooks: true,
          persistCollapsedModules: true,
        },
      };
    }
  }
}
