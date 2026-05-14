import type { EditorViewportCameraSnapshot } from "../threeEditorViewport";
import type { SceneDocument, SceneNode } from "../api";
import { getNextNodeNumber } from "../tools/editorUtils";
import { cloneSceneNode } from "./documentNodes";

export type AppliedSceneDocumentState = {
  nodes: SceneNode[];
  selectedNodeId: string | null;
  nextNodeNumber: number;
};

export function createSceneDocument(
  camera: EditorViewportCameraSnapshot,
  nodes: SceneNode[],
): SceneDocument {
  return {
    version: 2,
    camera,
    nodes: nodes.map(cloneSceneNode),
    animation: createEmptySceneAnimation(),
  };
}

export function createEmptySceneDocument(
  camera: EditorViewportCameraSnapshot,
): SceneDocument {
  return {
    version: 2,
    camera,
    nodes: [],
    animation: createEmptySceneAnimation(),
  };
}

export function applySceneDocumentState(
  document: SceneDocument,
): AppliedSceneDocumentState {
  const nodes = document.nodes.map(cloneSceneNode);

  return {
    nodes,
    selectedNodeId: nodes[0]?.id ?? null,
    nextNodeNumber: getNextNodeNumber(
      nodes.map((node) => node.id),
      "node",
    ),
  };
}

function createEmptySceneAnimation(): SceneDocument["animation"] {
  return {
    fps: 24,
    activeClipId: null,
    clips: [],
  };
}
