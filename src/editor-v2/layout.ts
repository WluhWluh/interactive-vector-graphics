export type EditorV2MenuBarPlacement = "top" | "bottom";
export type EditorV2SplitDirection = "horizontal" | "vertical";
export type EditorV2ContentType =
  | "viewport"
  | "assetBrowser"
  | "outliner"
  | "inspector"
  | "timeline"
  | "console"
  | "properties"
  | "toolbar";

export type EditorV2AreaNode = {
  kind: "area";
  id: string;
  contentType: EditorV2ContentType;
  minWidth?: number;
  minHeight?: number;
};

export type EditorV2SplitNode = {
  kind: "split";
  id: string;
  direction: EditorV2SplitDirection;
  ratio: number;
  first: EditorV2LayoutNode;
  second: EditorV2LayoutNode;
};

export type EditorV2LayoutNode = EditorV2AreaNode | EditorV2SplitNode;

export type EditorV2LayoutDocument = {
  version: 1;
  menuBarPlacement: EditorV2MenuBarPlacement;
  root: EditorV2LayoutNode;
};

type AreaPathStep = "first" | "second";
type AreaPath = AreaPathStep[];

const MIN_SPLIT_RATIO = 0.12;
const MAX_SPLIT_RATIO = 0.88;

let layoutIdCounter = 0;

export function createDefaultEditorV2Layout(): EditorV2LayoutDocument {
  return {
    version: 1,
    menuBarPlacement: "top",
    root: createSplit(
      "horizontal",
      0.2,
      createArea("outliner"),
      createSplit(
        "vertical",
        0.72,
        createSplit(
          "horizontal",
          0.68,
          createArea("viewport"),
          createArea("inspector"),
        ),
        createSplit(
          "horizontal",
          0.28,
          createArea("assetBrowser"),
          createArea("timeline"),
        ),
      ),
    ),
  };
}

export function createArea(
  contentType: EditorV2ContentType,
  input: Partial<Pick<EditorV2AreaNode, "id" | "minWidth" | "minHeight">> = {},
): EditorV2AreaNode {
  return {
    kind: "area",
    id: input.id ?? createLayoutId("area"),
    contentType,
    minWidth: input.minWidth,
    minHeight: input.minHeight,
  };
}

export function createSplit(
  direction: EditorV2SplitDirection,
  ratio: number,
  first: EditorV2LayoutNode,
  second: EditorV2LayoutNode,
  id = createLayoutId("split"),
): EditorV2SplitNode {
  return {
    kind: "split",
    id,
    direction,
    ratio: clampSplitRatio(ratio),
    first,
    second,
  };
}

export function cloneEditorV2Layout(
  layout: EditorV2LayoutDocument,
): EditorV2LayoutDocument {
  return structuredClone(layout) as EditorV2LayoutDocument;
}

export function createLayoutFingerprint(layout: EditorV2LayoutDocument): string {
  return JSON.stringify(normalizeEditorV2Layout(layout));
}

export function normalizeEditorV2Layout(layout: EditorV2LayoutDocument): unknown {
  return {
    version: 1,
    menuBarPlacement: layout.menuBarPlacement === "bottom" ? "bottom" : "top",
    root: normalizeLayoutNode(layout.root),
  };
}

export function parseEditorV2LayoutDocument(
  value: unknown,
): EditorV2LayoutDocument | null {
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }

  const menuBarPlacement =
    value.menuBarPlacement === "bottom" ? "bottom" : "top";
  const root = parseLayoutNode(value.root);

  return root
    ? {
        version: 1,
        menuBarPlacement,
        root,
      }
    : null;
}

export function updateAreaContent(
  layout: EditorV2LayoutDocument,
  areaId: string,
  contentType: EditorV2ContentType,
): EditorV2LayoutDocument {
  return updateLayoutNode(layout, areaId, (area) => ({
    ...area,
    contentType,
  }));
}

export function splitArea(
  layout: EditorV2LayoutDocument,
  areaId: string,
  direction: EditorV2SplitDirection,
  placement: "before" | "after" = "after",
): EditorV2LayoutDocument {
  return updateLayoutNode(layout, areaId, (area) => {
    const duplicate = createArea(area.contentType, {
      minWidth: area.minWidth,
      minHeight: area.minHeight,
    });
    return placement === "before"
      ? createSplit(direction, 0.5, duplicate, area)
      : createSplit(direction, 0.5, area, duplicate);
  });
}

export function resizeSplit(
  layout: EditorV2LayoutDocument,
  splitId: string,
  ratio: number,
): EditorV2LayoutDocument {
  const next = cloneEditorV2Layout(layout);
  next.root = resizeSplitNode(next.root, splitId, clampSplitRatio(ratio));
  return next;
}

export function closeArea(
  layout: EditorV2LayoutDocument,
  areaId: string,
): EditorV2LayoutDocument {
  const path = findAreaPath(layout.root, areaId);

  if (!path || path.length === 0) {
    return layout;
  }

  const next = cloneEditorV2Layout(layout);
  const parentPath = path.slice(0, -1);
  const side = path[path.length - 1]!;
  const parent = getNodeAtPath(next.root, parentPath);

  if (!parent || parent.kind !== "split") {
    return layout;
  }

  const sibling = side === "first" ? parent.second : parent.first;
  next.root = replaceNodeAtPath(next.root, parentPath, sibling);
  return next;
}

export function moveAreaToArea(
  layout: EditorV2LayoutDocument,
  sourceAreaId: string,
  targetAreaId: string,
  edge: "left" | "right" | "top" | "bottom" | "center",
): EditorV2LayoutDocument {
  if (sourceAreaId === targetAreaId) {
    return layout;
  }

  const sourceArea = findArea(layout.root, sourceAreaId);
  const targetArea = findArea(layout.root, targetAreaId);

  if (!sourceArea || !targetArea) {
    return layout;
  }

  const movedArea = {
    ...sourceArea,
    id: createLayoutId("area"),
  };
  let next = closeArea(layout, sourceAreaId);

  if (!findArea(next.root, targetAreaId)) {
    return layout;
  }

  if (edge === "center") {
    return updateLayoutNode(next, targetAreaId, () => movedArea);
  }

  next = updateLayoutNode(next, targetAreaId, (area) => {
    const direction = edge === "left" || edge === "right" ? "horizontal" : "vertical";
    return edge === "left" || edge === "top"
      ? createSplit(direction, 0.5, movedArea, area)
      : createSplit(direction, 0.5, area, movedArea);
  });
  return next;
}

export function insertAreaAtSplitBoundary(
  layout: EditorV2LayoutDocument,
  sourceAreaId: string,
  splitId: string,
  side: "first" | "second",
): EditorV2LayoutDocument {
  const sourceArea = findArea(layout.root, sourceAreaId);

  if (!sourceArea) {
    return layout;
  }

  const movedArea = {
    ...sourceArea,
    id: createLayoutId("area"),
  };
  const next = closeArea(layout, sourceAreaId);

  if (!findSplit(next.root, splitId)) {
    return layout;
  }

  return {
    ...next,
    root: insertAreaAtSplitBoundaryNode(next.root, splitId, side, movedArea),
  };
}

export function setMenuBarPlacement(
  layout: EditorV2LayoutDocument,
  placement: EditorV2MenuBarPlacement,
): EditorV2LayoutDocument {
  return {
    ...cloneEditorV2Layout(layout),
    menuBarPlacement: placement,
  };
}

export function getAreaCount(node: EditorV2LayoutNode): number {
  return node.kind === "area"
    ? 1
    : getAreaCount(node.first) + getAreaCount(node.second);
}

export function getAreaIds(node: EditorV2LayoutNode): string[] {
  return node.kind === "area"
    ? [node.id]
    : [...getAreaIds(node.first), ...getAreaIds(node.second)];
}

export function clampSplitRatio(value: number): number {
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, value));
}

function updateLayoutNode(
  layout: EditorV2LayoutDocument,
  areaId: string,
  update: (area: EditorV2AreaNode) => EditorV2LayoutNode,
): EditorV2LayoutDocument {
  const next = cloneEditorV2Layout(layout);
  next.root = updateAreaNode(next.root, areaId, update);
  return next;
}

function updateAreaNode(
  node: EditorV2LayoutNode,
  areaId: string,
  update: (area: EditorV2AreaNode) => EditorV2LayoutNode,
): EditorV2LayoutNode {
  if (node.kind === "area") {
    return node.id === areaId ? update(node) : node;
  }

  return {
    ...node,
    first: updateAreaNode(node.first, areaId, update),
    second: updateAreaNode(node.second, areaId, update),
  };
}

function resizeSplitNode(
  node: EditorV2LayoutNode,
  splitId: string,
  ratio: number,
): EditorV2LayoutNode {
  if (node.kind === "area") {
    return node;
  }

  return {
    ...node,
    ratio: node.id === splitId ? ratio : node.ratio,
    first: resizeSplitNode(node.first, splitId, ratio),
    second: resizeSplitNode(node.second, splitId, ratio),
  };
}

function normalizeLayoutNode(node: EditorV2LayoutNode): unknown {
  if (node.kind === "area") {
    return {
      kind: "area",
      contentType: node.contentType,
    };
  }

  return {
    kind: "split",
    direction: node.direction,
    ratio: Number(clampSplitRatio(node.ratio).toFixed(4)),
    first: normalizeLayoutNode(node.first),
    second: normalizeLayoutNode(node.second),
  };
}

function parseLayoutNode(value: unknown): EditorV2LayoutNode | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.kind === "area") {
    return isContentType(value.contentType)
      ? createArea(value.contentType, {
          id: typeof value.id === "string" ? value.id : undefined,
          minWidth:
            typeof value.minWidth === "number" && Number.isFinite(value.minWidth)
              ? value.minWidth
              : undefined,
          minHeight:
            typeof value.minHeight === "number" && Number.isFinite(value.minHeight)
              ? value.minHeight
              : undefined,
        })
      : null;
  }

  if (value.kind === "split") {
    const first = parseLayoutNode(value.first);
    const second = parseLayoutNode(value.second);

    if (
      !first ||
      !second ||
      (value.direction !== "horizontal" && value.direction !== "vertical")
    ) {
      return null;
    }

    return createSplit(
      value.direction,
      typeof value.ratio === "number" ? value.ratio : 0.5,
      first,
      second,
      typeof value.id === "string" ? value.id : undefined,
    );
  }

  return null;
}

function findAreaPath(
  node: EditorV2LayoutNode,
  areaId: string,
  path: AreaPath = [],
): AreaPath | null {
  if (node.kind === "area") {
    return node.id === areaId ? path : null;
  }

  return (
    findAreaPath(node.first, areaId, [...path, "first"]) ??
    findAreaPath(node.second, areaId, [...path, "second"])
  );
}

function findArea(
  node: EditorV2LayoutNode,
  areaId: string,
): EditorV2AreaNode | null {
  if (node.kind === "area") {
    return node.id === areaId ? node : null;
  }

  return findArea(node.first, areaId) ?? findArea(node.second, areaId);
}

function findSplit(
  node: EditorV2LayoutNode,
  splitId: string,
): EditorV2SplitNode | null {
  if (node.kind === "area") {
    return null;
  }

  if (node.id === splitId) {
    return node;
  }

  return findSplit(node.first, splitId) ?? findSplit(node.second, splitId);
}

function insertAreaAtSplitBoundaryNode(
  node: EditorV2LayoutNode,
  splitId: string,
  side: "first" | "second",
  movedArea: EditorV2AreaNode,
): EditorV2LayoutNode {
  if (node.kind === "area") {
    return node;
  }

  if (node.id === splitId) {
    return side === "first"
      ? {
          ...node,
          first: createSplit(node.direction, 0.74, node.first, movedArea),
        }
      : {
          ...node,
          second: createSplit(node.direction, 0.26, movedArea, node.second),
        };
  }

  return {
    ...node,
    first: insertAreaAtSplitBoundaryNode(node.first, splitId, side, movedArea),
    second: insertAreaAtSplitBoundaryNode(node.second, splitId, side, movedArea),
  };
}

function getNodeAtPath(
  node: EditorV2LayoutNode,
  path: AreaPath,
): EditorV2LayoutNode | null {
  let current: EditorV2LayoutNode = node;

  for (const step of path) {
    if (current.kind !== "split") {
      return null;
    }

    current = current[step];
  }

  return current;
}

function replaceNodeAtPath(
  node: EditorV2LayoutNode,
  path: AreaPath,
  replacement: EditorV2LayoutNode,
): EditorV2LayoutNode {
  if (path.length === 0) {
    return replacement;
  }

  if (node.kind !== "split") {
    return node;
  }

  const [head, ...tail] = path;
  return head === "first"
    ? {
        ...node,
        first: replaceNodeAtPath(node.first, tail, replacement),
      }
    : {
        ...node,
        second: replaceNodeAtPath(node.second, tail, replacement),
      };
}

function isContentType(value: unknown): value is EditorV2ContentType {
  return (
    value === "viewport" ||
    value === "assetBrowser" ||
    value === "outliner" ||
    value === "inspector" ||
    value === "timeline" ||
    value === "console" ||
    value === "properties" ||
    value === "toolbar"
  );
}

function createLayoutId(prefix: "area" | "split"): string {
  layoutIdCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${layoutIdCounter.toString(36)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
