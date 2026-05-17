import { strict as assert } from "node:assert";
import {
  closeArea,
  createArea,
  createDefaultEditorV2Layout,
  createLayoutFingerprint,
  createSplit,
  getAreaCount,
  parseEditorV2LayoutDocument,
  splitArea,
  updateAreaContent,
  type EditorV2LayoutDocument,
} from "../../src/editor-v2/layout";

export function runEditorV2LayoutUnitTests(): void {
  const firstLayout: EditorV2LayoutDocument = {
    version: 1,
    menuBarPlacement: "top",
    root: createSplit(
      "horizontal",
      0.50004,
      createArea("viewport", { id: "area-a" }),
      createArea("inspector", { id: "area-b" }),
      "split-a",
    ),
  };
  const secondLayout: EditorV2LayoutDocument = {
    version: 1,
    menuBarPlacement: "top",
    root: createSplit(
      "horizontal",
      0.500041,
      createArea("viewport", { id: "different-a" }),
      createArea("inspector", { id: "different-b" }),
      "different-split",
    ),
  };

  assert.equal(
    createLayoutFingerprint(firstLayout),
    createLayoutFingerprint(secondLayout),
  );

  const duplicatedContentLayout = splitArea(
    createDefaultEditorV2Layout(),
    getFirstAreaId(createDefaultEditorV2Layout()),
    "horizontal",
  );
  assert.ok(getAreaCount(duplicatedContentLayout.root) > 1);
  assert.doesNotThrow(() => createLayoutFingerprint(duplicatedContentLayout));

  const switchedLayout = updateAreaContent(firstLayout, "area-b", "viewport");
  assert.notEqual(
    createLayoutFingerprint(firstLayout),
    createLayoutFingerprint(switchedLayout),
  );

  const closedLayout = closeArea(firstLayout, "area-a");
  assert.equal(getAreaCount(closedLayout.root), 1);

  assert.equal(parseEditorV2LayoutDocument({ version: 999 }), null);
  assert.equal(parseEditorV2LayoutDocument(firstLayout)?.version, 1);
}

function getFirstAreaId(layout: EditorV2LayoutDocument): string {
  return layout.root.kind === "area" ? layout.root.id : getFirstNestedAreaId(layout.root);
}

function getFirstNestedAreaId(node: Exclude<EditorV2LayoutDocument["root"], { kind: "area" }>): string {
  return node.first.kind === "area" ? node.first.id : getFirstNestedAreaId(node.first);
}
