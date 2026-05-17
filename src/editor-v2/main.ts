import "./styles.css";
import {
  EDITOR_V2_CONTENT_DEFINITIONS,
  getEditorV2ContentDefinition,
} from "./contentRegistry";
import {
  closeArea,
  cloneEditorV2Layout,
  createDefaultEditorV2Layout,
  createLayoutFingerprint,
  getAreaCount,
  insertAreaAtSplitBoundary,
  moveAreaToArea,
  resizeSplit,
  setMenuBarPlacement,
  splitArea,
  updateAreaContent,
  type EditorV2AreaNode,
  type EditorV2ContentType,
  type EditorV2LayoutDocument,
  type EditorV2LayoutNode,
  type EditorV2SplitDirection,
  type EditorV2SplitNode,
} from "./layout";
import {
  readEditorV2CookieLayout,
  writeEditorV2CookieLayout,
} from "./layoutStorage";
import {
  createStoredProjectLayout,
  deleteStoredProjectLayout,
  getMatchingProjectLayoutIds,
  moveStoredProjectLayout,
  renameStoredProjectLayout,
  type EditorV2StoredLayout,
} from "./projectLayouts";

type DropdownState = {
  id: string;
  anchor: HTMLElement;
  content: HTMLElement;
};

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
};

type ResizeDragState = {
  splitId: string;
  direction: EditorV2SplitDirection;
  rect: DOMRect;
};

type MoveDragState = {
  areaId: string;
  startX: number;
  startY: number;
  dragging: boolean;
};

type ProjectLayoutDragState = {
  layoutId: string;
};

type DropEdge = "left" | "right" | "top" | "bottom";

type DropTarget =
  | {
      kind: "area";
      areaId: string;
      edge: DropEdge;
      rect: DOMRect;
    }
  | {
      kind: "area-edge";
      areaId: string;
      edge: DropEdge;
      rect: DOMRect;
      cursorSide: "before" | "after";
    }
  | {
      kind: "boundary";
      splitId: string;
      side: "first" | "second";
      direction: EditorV2SplitDirection;
      rect: DOMRect;
      cursorSide: "before" | "after";
    };

type EditorV2DebugState = {
  getLayout: () => EditorV2LayoutDocument;
  getCookieLayout: () => EditorV2LayoutDocument;
  getProjectLayouts: () => EditorV2StoredLayout[];
  getFingerprint: () => string;
};

type AreaHeaderInteractionState = {
  areaId: string;
  startX: number;
  startY: number;
  dragging: boolean;
  clickCandidate: boolean;
};

const DOCK_LINE_THICKNESS = 4;
const DOCK_SPLIT_GAP = 2;
const DOCK_RESIZER_THICKNESS = 4;
const DOCK_LINE_GAP = DOCK_SPLIT_GAP * 2 + DOCK_RESIZER_THICKNESS;
const DOCK_AREA_LINE_OFFSET = (DOCK_LINE_GAP - DOCK_LINE_THICKNESS) / 2;
const DOCK_ARROW_SIZE = 20;
const DOCK_ARROW_GAP = 8;
const DOCK_ARROW_CORNER_RADIUS = 1.8;

declare global {
  interface Window {
    __editorV2Debug?: EditorV2DebugState;
  }
}

const app = document.querySelector<HTMLElement>("#editor-v2-app");

if (!app) {
  throw new Error("Editor v2 root element is missing.");
}

const rootElement = app;

let layout = readEditorV2CookieLayout();
let cookieLayout = cloneEditorV2Layout(layout);
let projectLayouts: EditorV2StoredLayout[] = [
  createStoredProjectLayout("Animation Workspace", createDefaultEditorV2Layout()),
];
let openDropdown: DropdownState | null = null;
let confirmState: ConfirmState | null = null;
let resizeDragState: ResizeDragState | null = null;
let moveDragState: MoveDragState | null = null;
let projectLayoutDragState: ProjectLayoutDragState | null = null;
let activeDropTarget: DropTarget | null = null;
let areaHeaderInteractionState: AreaHeaderInteractionState | null = null;
let pendingCookieWrite = 0;

render();
installGlobalPointerHandlers();
installDebugHook();

function render(): void {
  rootElement.dataset.menuPlacement = layout.menuBarPlacement;
  rootElement.replaceChildren(
    renderMenuBar(),
    renderWorkspace(),
    ...(openDropdown?.id.startsWith("area-select-") ? [renderFloatingDropdown(openDropdown)] : []),
    ...(confirmState ? [renderConfirmDialog(confirmState)] : []),
  );
}

function renderMenuBar(): HTMLElement {
  const menuBar = document.createElement("nav");
  menuBar.className = "editor-v2-menubar";
  menuBar.ariaLabel = "Editor v2 menu";

  const menus = [
    createMenu("File", renderFileMenu),
    createMenu("Edit", renderEditMenu),
    createMenu("Window", renderWindowMenu),
    createMenu("Layouts", renderLayoutsMenu),
  ];

  menuBar.append(...menus);
  return menuBar;
}

function createMenu(
  label: string,
  renderContent: () => HTMLElement,
): HTMLElement {
  const menu = document.createElement("div");
  const menuId = `menu-${label.toLowerCase()}`;
  menu.className = "editor-v2-menu";
  menu.dataset.open = String(openDropdown?.id === menuId);

  const button = document.createElement("button");
  button.className = "editor-v2-menu-button";
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    if (openDropdown?.id === menuId) {
      openDropdown = null;
    } else {
      openDropdown = {
        id: menuId,
        anchor: button,
        content: renderContent(),
      };
    }
    render();
  });

  const dropdown = document.createElement("div");
  dropdown.className = "editor-v2-dropdown";
  dropdown.hidden = openDropdown?.id !== menuId;
  dropdown.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  if (!dropdown.hidden && openDropdown) {
    openDropdown = {
      id: menuId,
      anchor: button,
      content: renderContent(),
    };
    dropdown.append(openDropdown.content);
  }

  menu.append(button, dropdown);
  return menu;
}

function renderFileMenu(): HTMLElement {
  return createMenuRows([
    {
      label: "New Default Layout",
      action: () => applyLayout(createDefaultEditorV2Layout()),
    },
    {
      label: "Reset Cookie Layout",
      action: () => {
        cookieLayout = createDefaultEditorV2Layout();
        applyLayout(cookieLayout);
      },
    },
    {
      label: "Menu Bar Top",
      action: () => applyLayout(setMenuBarPlacement(layout, "top")),
      active: layout.menuBarPlacement === "top",
    },
    {
      label: "Menu Bar Bottom",
      action: () => applyLayout(setMenuBarPlacement(layout, "bottom")),
      active: layout.menuBarPlacement === "bottom",
    },
  ]);
}

function renderEditMenu(): HTMLElement {
  return createMenuRows([
    {
      label: "Undo",
      detail: "Not wired",
      disabled: true,
    },
    {
      label: "Redo",
      detail: "Not wired",
      disabled: true,
    },
  ]);
}

function renderWindowMenu(): HTMLElement {
  return createMenuRows([
    {
      label: "Window contents are chosen from each area header",
      detail: "Blender-style",
      disabled: true,
    },
    {
      label: "Drag an area header onto a border to dock it",
      disabled: true,
    },
  ]);
}

function renderLayoutsMenu(): HTMLElement {
  const container = document.createElement("div");
  const currentFingerprint = createLayoutFingerprint(layout);
  const cookieFingerprint = createLayoutFingerprint(cookieLayout);
  const matchingProjectIds = getMatchingProjectLayoutIds(
    projectLayouts,
    currentFingerprint,
  );

  container.append(
    createLayoutMenuRow({
      name: "Cookie Layout",
      active: currentFingerprint === cookieFingerprint,
      onSelect: () => applyLayout(cookieLayout),
      actions: [
        {
          label: "Upload",
          title: "Upload cookie layout to project",
          onClick: () => {
            projectLayouts = [
              ...projectLayouts,
              createStoredProjectLayout(
                `Layout ${projectLayouts.length + 1}`,
                cookieLayout,
              ),
            ];
            render();
          },
        },
      ],
    }),
    createSeparator(),
  );

  for (const storedLayout of projectLayouts) {
    container.append(
      createLayoutMenuRow({
        name: storedLayout.name,
        active: matchingProjectIds.has(storedLayout.id),
        draggableId: storedLayout.id,
        onSelect: () => applyLayout(storedLayout.layout),
        actions: [
          {
            label: "Rename",
            title: "Rename layout",
            onClick: () => {
              const nextName = window.prompt(
                "Rename project layout",
                storedLayout.name,
              );
              if (nextName !== null) {
                projectLayouts = renameStoredProjectLayout(
                  projectLayouts,
                  storedLayout.id,
                  nextName,
                );
                render();
              }
            },
          },
          {
            label: "Delete",
            title: "Delete layout",
            danger: true,
            onClick: () => {
              confirmState = {
                title: "Delete Layout",
                message: `Delete "${storedLayout.name}" from the simulated project layout library?`,
                confirmLabel: "Delete",
                onConfirm: () => {
                  projectLayouts = deleteStoredProjectLayout(
                    projectLayouts,
                    storedLayout.id,
                  );
                  confirmState = null;
                  render();
                },
              };
              render();
            },
          },
        ],
      }),
    );
  }

  return container;
}

function createMenuRows(
  rows: Array<{
    label: string;
    detail?: string;
    disabled?: boolean;
    active?: boolean;
    action?: () => void;
  }>,
): HTMLElement {
  const container = document.createElement("div");

  for (const row of rows) {
    const button = document.createElement("button");
    button.className = "editor-v2-menu-row";
    button.type = "button";
    button.disabled = row.disabled ?? false;
    button.dataset.active = String(row.active ?? false);
    button.append(document.createTextNode(row.label));

    if (row.detail) {
      const detail = document.createElement("span");
      detail.textContent = row.detail;
      button.append(detail);
    }

    button.addEventListener("click", () => {
      row.action?.();
      openDropdown = null;
      render();
    });
    container.append(button);
  }

  return container;
}

function createLayoutMenuRow(input: {
  name: string;
  active: boolean;
  draggableId?: string;
  onSelect: () => void;
  actions: Array<{
    label: string;
    title: string;
    danger?: boolean;
    onClick: () => void;
  }>;
}): HTMLElement {
  const row = document.createElement("div");
  row.className = "editor-v2-layout-row";
  row.dataset.active = String(input.active);
  row.draggable = Boolean(input.draggableId);
  if (input.draggableId) {
    row.dataset.projectLayoutId = input.draggableId;
  }

  const selectButton = document.createElement("button");
  selectButton.className = "editor-v2-menu-row";
  selectButton.type = "button";
  selectButton.textContent = input.name;
  selectButton.addEventListener("click", () => {
    input.onSelect();
    openDropdown = null;
    render();
  });

  const actions = document.createElement("span");
  actions.className = "editor-v2-layout-actions";
  for (const action of input.actions) {
    const button = document.createElement("button");
    button.className = "editor-v2-icon-button";
    button.type = "button";
    button.title = action.title;
    button.textContent = action.label.slice(0, 1);
    button.dataset.danger = String(action.danger ?? false);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      action.onClick();
    });
    actions.append(button);
  }

  row.append(selectButton, actions);
  row.addEventListener("dragstart", () => {
    if (input.draggableId) {
      projectLayoutDragState = { layoutId: input.draggableId };
    }
  });
  row.addEventListener("dragover", (event) => {
    if (projectLayoutDragState) {
      event.preventDefault();
    }
  });
  row.addEventListener("drop", (event) => {
    event.preventDefault();
    if (projectLayoutDragState && input.draggableId) {
      projectLayouts = moveStoredProjectLayout(
        projectLayouts,
        projectLayoutDragState.layoutId,
        input.draggableId,
      );
      projectLayoutDragState = null;
      render();
    }
  });
  row.addEventListener("dragend", () => {
    projectLayoutDragState = null;
  });
  return row;
}

function createSeparator(): HTMLElement {
  const separator = document.createElement("div");
  separator.className = "editor-v2-menu-separator";
  return separator;
}

function renderWorkspace(): HTMLElement {
  const workspace = document.createElement("section");
  workspace.className = "editor-v2-workspace";
  workspace.ariaLabel = "Docking workspace";
  workspace.append(renderLayoutNode(layout.root));
  return workspace;
}

function renderLayoutNode(node: EditorV2LayoutNode): HTMLElement {
  if (node.kind === "area") {
    return renderArea(node);
  }

  return renderSplit(node);
}

function renderSplit(node: EditorV2SplitNode): HTMLElement {
  const split = document.createElement("div");
  split.className = "editor-v2-split";
  split.dataset.direction = node.direction;
  split.style.setProperty("--editor-v2-first-size", `${node.ratio * 100}%`);
  split.dataset.splitId = node.id;

  const firstPane = document.createElement("div");
  firstPane.className = "editor-v2-split-pane";
  firstPane.append(renderLayoutNode(node.first));

  const resizer = document.createElement("button");
  resizer.className = "editor-v2-split-resizer";
  resizer.type = "button";
  resizer.ariaLabel = "Resize split";
  resizer.dataset.splitId = node.id;
  resizer.dataset.direction = node.direction;
  resizer.dataset.dragging = String(resizeDragState?.splitId === node.id);
  resizer.addEventListener("pointerdown", (event) => {
    const rect = split.getBoundingClientRect();
    resizeDragState = {
      splitId: node.id,
      direction: node.direction,
      rect,
    };
    resizer.dataset.dragging = "true";
    updateResizePreview(node.id, node.direction, rect);
    resizer.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  const secondPane = document.createElement("div");
  secondPane.className = "editor-v2-split-pane";
  secondPane.append(renderLayoutNode(node.second));

  split.append(firstPane, resizer, secondPane);
  return split;
}

function renderArea(area: EditorV2AreaNode): HTMLElement {
  const definition = getEditorV2ContentDefinition(area.contentType);
  const element = document.createElement("section");
  element.className = "editor-v2-area";
  element.dataset.areaId = area.id;
  element.style.minWidth = `${area.minWidth ?? definition.minWidth}px`;
  element.style.minHeight = `${area.minHeight ?? definition.minHeight}px`;

  const header = document.createElement("header");
  header.className = "editor-v2-area-header";
  header.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    if (
      event.target instanceof HTMLElement &&
      event.target.closest(".editor-v2-area-action-button")
    ) {
      return;
    }

    areaHeaderInteractionState = {
      areaId: area.id,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
      clickCandidate:
        event.target instanceof HTMLElement &&
        event.target.closest(".editor-v2-content-select-button") !== null,
    };
    header.setPointerCapture(event.pointerId);
  });

  const title = document.createElement("span");
  title.className = "editor-v2-title-label";
  title.textContent = "　||　";

  const selectButton = document.createElement("button");
  selectButton.className = "editor-v2-content-select-button";
  selectButton.type = "button";
  selectButton.ariaLabel = "Area editor type";
  selectButton.ariaHasPopup = "menu";
  selectButton.textContent = definition.label;

  const splitHorizontalButton = createAreaButton("↔", "Split horizontally", () => {
    applyLayout(splitArea(layout, area.id, "horizontal"));
  });
  const splitVerticalButton = createAreaButton("↕", "Split vertically", () => {
    applyLayout(splitArea(layout, area.id, "vertical"));
  });
  const closeButton = createAreaButton("×", "Close area", () => {
    if (getAreaCount(layout.root) > 1) {
      applyLayout(closeArea(layout, area.id));
    }
  });

  header.append(title, selectButton, splitHorizontalButton, splitVerticalButton, closeButton);

  const body = document.createElement("div");
  body.className = "editor-v2-area-body";
  body.append(renderAreaContent(area));

  element.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  element.append(header, body);
  return element;
}

function renderFloatingDropdown(state: DropdownState): HTMLElement {
  const overlay = document.createElement("div");
  overlay.className = "editor-v2-dropdown editor-v2-floating-dropdown";
  overlay.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  const rect = state.anchor.getBoundingClientRect();
  overlay.style.left = `${Math.max(4, rect.left)}px`;
  overlay.style.top = `${Math.min(
    window.innerHeight - 12,
    rect.bottom + 4,
  )}px`;
  overlay.style.minWidth = `${Math.max(180, rect.width)}px`;
  overlay.append(state.content);
  return overlay;
}

function openAreaSelectDropdown(areaId: string): void {
  const area = document.querySelector<HTMLElement>(
    `.editor-v2-area[data-area-id="${areaId}"]`,
  );
  const selectButton = area?.querySelector<HTMLElement>(
    ".editor-v2-content-select-button",
  );
  const contentType = area?.querySelector<HTMLElement>(".editor-v2-content")
    ?.dataset.contentType as EditorV2ContentType | undefined;

  if (!area || !selectButton || !contentType) {
    return;
  }

  const dropdownId = `area-select-${areaId}`;
  openDropdown =
    openDropdown?.id === dropdownId
      ? null
      : {
          id: dropdownId,
          anchor: selectButton,
          content: createAreaSelectDropdown(areaId, contentType),
        };
  render();
}

function createAreaSelectDropdown(
  areaId: string,
  currentContentType: EditorV2ContentType,
): HTMLElement {
  return createMenuRows(
    EDITOR_V2_CONTENT_DEFINITIONS.map((candidate) => ({
      label: candidate.label,
      detail: candidate.shortLabel,
      active: candidate.type === currentContentType,
      action: () => {
        applyLayout(updateAreaContent(layout, areaId, candidate.type));
      },
    })),
  );
}

function renderAreaContent(area: EditorV2AreaNode): HTMLElement {
  const definition = getEditorV2ContentDefinition(area.contentType);
  const container = document.createElement("div");
  container.className = "editor-v2-content";
  container.dataset.contentType = area.contentType;

  if (area.contentType === "viewport") {
    const viewport = document.createElement("div");
    viewport.className = "editor-v2-viewport-mock";
    viewport.textContent = "Viewport Mock • layout experiment";
    container.append(viewport);
    return container;
  }

  const heading = document.createElement("h2");
  heading.textContent = definition.label;
  const copy = document.createElement("p");
  copy.textContent = definition.description;
  const list = document.createElement("ul");
  list.className = "editor-v2-list";

  for (const item of getMockItems(area.contentType, area.id)) {
    const row = document.createElement("li");
    row.textContent = item;
    list.append(row);
  }

  container.append(heading, copy, list);
  return container;
}

function createAreaButton(
  label: string,
  title: string,
  onClick: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "editor-v2-icon-button editor-v2-area-action-button";
  button.type = "button";
  button.title = title;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function renderConfirmDialog(state: ConfirmState): HTMLElement {
  const backdrop = document.createElement("div");
  backdrop.className = "editor-v2-confirm-backdrop";
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) {
      confirmState = null;
      openDropdown = null;
      render();
    }
  });

  const dialog = document.createElement("section");
  dialog.className = "editor-v2-confirm";
  dialog.role = "dialog";
  dialog.ariaModal = "true";

  const heading = document.createElement("h2");
  heading.textContent = state.title;
  const message = document.createElement("p");
  message.textContent = state.message;
  const actions = document.createElement("div");
  actions.className = "editor-v2-confirm-actions";

  const cancel = document.createElement("button");
  cancel.className = "editor-v2-command-button";
  cancel.type = "button";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => {
    confirmState = null;
    openDropdown = null;
    render();
  });

  const confirm = document.createElement("button");
  confirm.className = "editor-v2-command-button";
  confirm.type = "button";
  confirm.dataset.danger = "true";
  confirm.textContent = state.confirmLabel;
  confirm.addEventListener("click", state.onConfirm);

  actions.append(cancel, confirm);
  dialog.append(heading, message, actions);
  backdrop.append(dialog);
  return backdrop;
}

function installGlobalPointerHandlers(): void {
  window.addEventListener("pointermove", (event) => {
    if (resizeDragState) {
      const { splitId, direction, rect } = resizeDragState;
      const ratio =
        direction === "horizontal"
          ? (event.clientX - rect.left) / rect.width
          : (event.clientY - rect.top) / rect.height;
      layout = resizeSplit(layout, splitId, ratio);
      persistCurrentLayout();
      updateResizePreview(splitId, direction, rect);
      render();
      return;
    }

    if (areaHeaderInteractionState) {
      const moved = Math.hypot(
        event.clientX - areaHeaderInteractionState.startX,
        event.clientY - areaHeaderInteractionState.startY,
      );
      if (moved > 4) {
        areaHeaderInteractionState.dragging = true;
      }

      if (areaHeaderInteractionState.dragging) {
        moveDragState = {
          areaId: areaHeaderInteractionState.areaId,
          startX: areaHeaderInteractionState.startX,
          startY: areaHeaderInteractionState.startY,
          dragging: true,
        };
        activeDropTarget = findDropTargetAtPoint(
          event.clientX,
          event.clientY,
          areaHeaderInteractionState.areaId,
        );
        updateDockPreview(activeDropTarget);
        render();
      }
    } else if (moveDragState) {
      const moved = Math.hypot(
        event.clientX - moveDragState.startX,
        event.clientY - moveDragState.startY,
      );

      if (moved > 4) {
        moveDragState.dragging = true;
      }

      if (moveDragState.dragging) {
        activeDropTarget = findDropTargetAtPoint(
          event.clientX,
          event.clientY,
          moveDragState.areaId,
        );
        updateDockPreview(activeDropTarget);
      }
    }
  });

  window.addEventListener("pointerup", () => {
    if (resizeDragState) {
      resizeDragState = null;
      removeDockPreview();
      render();
    }

    if (areaHeaderInteractionState && !areaHeaderInteractionState.dragging) {
      if (areaHeaderInteractionState.clickCandidate) {
        openAreaSelectDropdown(areaHeaderInteractionState.areaId);
      }
      areaHeaderInteractionState = null;
    }

    if (moveDragState) {
      if (moveDragState.dragging && activeDropTarget) {
        if (activeDropTarget.kind === "boundary") {
          applyLayout(
            insertAreaAtSplitBoundary(
              layout,
              moveDragState.areaId,
              activeDropTarget.splitId,
              activeDropTarget.side,
            ),
          );
        } else {
          applyLayout(
            moveAreaToArea(
              layout,
              moveDragState.areaId,
              activeDropTarget.areaId,
              activeDropTarget.edge,
            ),
          );
        }
      }

      moveDragState = null;
      activeDropTarget = null;
      removeDockPreview();
    }

    areaHeaderInteractionState = null;
  });

  window.addEventListener("click", (event) => {
    if (
      openDropdown &&
      event.target instanceof Node &&
      !openDropdown.anchor.contains(event.target) &&
      !openDropdown.content.contains(event.target)
    ) {
      openDropdown = null;
      render();
    }
  });
}

function applyLayout(nextLayout: EditorV2LayoutDocument): void {
  layout = cloneEditorV2Layout(nextLayout);
  persistCurrentLayout();
  render();
}

function persistCurrentLayout(): void {
  cookieLayout = cloneEditorV2Layout(layout);
  window.clearTimeout(pendingCookieWrite);
  pendingCookieWrite = window.setTimeout(() => {
    writeEditorV2CookieLayout(cookieLayout);
  }, 80);
}

function updateResizePreview(
  splitId: string,
  direction: EditorV2SplitDirection,
  fallbackRect: DOMRect,
): void {
  const resizer =
    document.querySelector<HTMLElement>(
      `.editor-v2-split-resizer[data-split-id="${splitId}"]`,
    ) ?? null;
  const rect = resizer?.getBoundingClientRect() ?? fallbackRect;
  const preview = getOrCreateDockPreview();
  const line = preview.line;

  line.dataset.orientation = direction === "horizontal" ? "vertical" : "horizontal";
  line.style.left = `${rect.left}px`;
  line.style.top = `${rect.top}px`;
  line.style.width = `${rect.width}px`;
  line.style.height = `${rect.height}px`;
  preview.arrow.toggleAttribute("hidden", true);
}

function updateDockPreview(target: DropTarget | null): void {
  if (!target) {
    removeDockPreview();
    return;
  }

  const preview = getOrCreateDockPreview();
  const line = preview.line;
  const arrow = preview.arrow;
  const lineRect = getDropTargetLineRect(target);
  const arrowPlacement = getDropArrowPlacement(target, lineRect);

  line.dataset.orientation = isVerticalLineTarget(target) ? "vertical" : "horizontal";
  line.style.left = `${lineRect.left}px`;
  line.style.top = `${lineRect.top}px`;
  line.style.width = `${lineRect.width}px`;
  line.style.height = `${lineRect.height}px`;

  arrow.dataset.direction = arrowPlacement.direction;
  arrow.style.left = `${arrowPlacement.left}px`;
  arrow.style.top = `${arrowPlacement.top}px`;
  const arrowPath = arrow.querySelector("path");
  arrowPath?.setAttribute("d", buildRoundedDockArrowPath(arrowPlacement.direction));
}

function getOrCreateDockPreview(): {
  root: HTMLElement;
  line: HTMLElement;
  arrow: SVGSVGElement;
} {
  const existing = document.querySelector<HTMLElement>(".editor-v2-dock-preview");
  if (existing) {
    return {
      root: existing,
      line: existing.querySelector<HTMLElement>(".editor-v2-dock-line")!,
      arrow: existing.querySelector<SVGSVGElement>(".editor-v2-dock-arrow")!,
    };
  }

  const root = document.createElement("div");
  root.className = "editor-v2-dock-preview";
  const line = document.createElement("div");
  line.className = "editor-v2-dock-line";
  const arrow = createDockArrowSvg();
  root.append(line, arrow);
  document.body.append(root);
  return { root, line, arrow };
}

function removeDockPreview(): void {
  document.querySelector(".editor-v2-dock-preview")?.remove();
}

function getDropEdge(rect: DOMRect, x: number, y: number): DropEdge {
  const localX = (x - rect.left) / rect.width;
  const localY = (y - rect.top) / rect.height;
  const distances = [
    { edge: "left" as const, distance: localX },
    { edge: "right" as const, distance: 1 - localX },
    { edge: "top" as const, distance: localY },
    { edge: "bottom" as const, distance: 1 - localY },
  ];

  distances.sort((a, b) => a.distance - b.distance);
  return distances[0]!.edge;
}

function findDropTargetAtPoint(
  x: number,
  y: number,
  sourceAreaId: string,
): DropTarget | null {
  const boundaryTarget = findBoundaryDropTargetAtPoint(x, y);
  if (boundaryTarget) {
    return boundaryTarget;
  }

  const edgeTarget = findAreaEdgeDropTargetAtPoint(x, y, sourceAreaId);
  if (edgeTarget) {
    return edgeTarget;
  }

  const area = document
    .elementsFromPoint(x, y)
    .find(
      (element): element is HTMLElement =>
        element instanceof HTMLElement &&
        element.classList.contains("editor-v2-area") &&
        element.dataset.areaId !== sourceAreaId,
    );

  if (!area || !area.dataset.areaId) {
    return null;
  }

  const rect = area.getBoundingClientRect();
  return {
    kind: "area",
    areaId: area.dataset.areaId,
    edge: getDropEdge(rect, x, y),
    rect,
  };
}

function findBoundaryDropTargetAtPoint(x: number, y: number): DropTarget | null {
  const hitInset = 10;
  const candidates = [...document.querySelectorAll<HTMLElement>(".editor-v2-split-resizer")]
    .map((element) => {
      const rect = element.getBoundingClientRect();
      const direction: EditorV2SplitDirection =
        element.dataset.direction === "vertical" ? "vertical" : "horizontal";
      const splitElement = element.closest<HTMLElement>(".editor-v2-split");
      const splitRect = splitElement?.getBoundingClientRect();
      const expanded = expandRect(rect, direction === "horizontal" ? hitInset : 0, direction === "vertical" ? hitInset : 0);
      const inside =
        x >= expanded.left &&
        x <= expanded.right &&
        y >= expanded.top &&
        y <= expanded.bottom;

      if (!inside || !element.dataset.splitId || !splitRect) {
        return null;
      }

      const lineRect =
        direction === "horizontal"
          ? new DOMRect(
              rect.left + rect.width / 2 - 2,
              splitRect.top,
              4,
              splitRect.height,
            )
          : new DOMRect(
              splitRect.left,
              rect.top + rect.height / 2 - 2,
              splitRect.width,
              4,
            );

      const distance =
        direction === "horizontal"
          ? Math.abs(x - (rect.left + rect.width / 2))
          : Math.abs(y - (rect.top + rect.height / 2));

      return {
        element,
        rect: lineRect,
        direction,
        distance,
        span: direction === "horizontal" ? splitRect.height : splitRect.width,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((a, b) => a.distance - b.distance || b.span - a.span);

  const candidate = candidates[0];
  if (!candidate) {
    return null;
  }

  const cursorSide =
    candidate.direction === "horizontal"
      ? x < candidate.rect.left + candidate.rect.width / 2
        ? "before"
        : "after"
      : y < candidate.rect.top + candidate.rect.height / 2
        ? "before"
        : "after";

  return {
    kind: "boundary",
    splitId: candidate.element.dataset.splitId!,
    side: cursorSide === "before" ? "first" : "second",
    direction: candidate.direction,
    rect: candidate.rect,
    cursorSide,
  };
}

function findAreaEdgeDropTargetAtPoint(
  x: number,
  y: number,
  sourceAreaId: string,
): DropTarget | null {
  const hitInset = 12;
  const candidates = [...document.querySelectorAll<HTMLElement>(".editor-v2-area")]
    .filter((element) => element.dataset.areaId !== sourceAreaId)
    .map((element) => {
      const areaId = element.dataset.areaId;
      if (!areaId) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      const options = [
        { edge: "left" as const, distance: Math.abs(x - rect.left), span: rect.height },
        { edge: "right" as const, distance: Math.abs(x - rect.right), span: rect.height },
        { edge: "top" as const, distance: Math.abs(y - rect.top), span: rect.width },
        { edge: "bottom" as const, distance: Math.abs(y - rect.bottom), span: rect.width },
      ].sort((a, b) => a.distance - b.distance || b.span - a.span);
      const closest = options[0];
      if (!closest || closest.distance > hitInset) {
        return null;
      }

      return {
        areaId,
        rect,
        edge: closest.edge,
        cursorSide: (
          closest.edge === "left" || closest.edge === "right"
            ? x < rect.left + rect.width / 2
              ? "before"
              : "after"
            : y < rect.top + rect.height / 2
              ? "before"
              : "after"
        ) as "before" | "after",
        distance: closest.distance,
        span: closest.span,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((a, b) => {
      const aDistance =
        a.edge === "left" || a.edge === "right"
          ? Math.abs(x - (a.edge === "left" ? a.rect.left : a.rect.right))
          : Math.abs(y - (a.edge === "top" ? a.rect.top : a.rect.bottom));
      const bDistance =
        b.edge === "left" || b.edge === "right"
          ? Math.abs(x - (b.edge === "left" ? b.rect.left : b.rect.right))
          : Math.abs(y - (b.edge === "top" ? b.rect.top : b.rect.bottom));
      const aSpan = a.edge === "left" || a.edge === "right" ? a.rect.height : a.rect.width;
      const bSpan = b.edge === "left" || b.edge === "right" ? b.rect.height : b.rect.width;
      return aDistance - bDistance || bSpan - aSpan;
    });

  const candidate = candidates[0];
  if (!candidate) {
    return null;
  }

  return {
    kind: "area-edge",
    areaId: candidate.areaId,
    edge: candidate.edge,
    rect: candidate.rect,
    cursorSide: candidate.cursorSide,
  };
}

function expandRect(rect: DOMRect, horizontal: number, vertical: number): DOMRect {
  return new DOMRect(
    rect.left - horizontal,
    rect.top - vertical,
    rect.width + horizontal * 2,
    rect.height + vertical * 2,
  );
}

function getDropTargetLineRect(target: DropTarget): DOMRect {
  if (target.kind === "boundary") {
    return target.rect;
  }

  const thickness = DOCK_LINE_THICKNESS;
  const offset = DOCK_AREA_LINE_OFFSET;
  switch (target.edge) {
    case "left":
      return new DOMRect(
        target.rect.left - offset - thickness,
        target.rect.top,
        thickness,
        target.rect.height,
      );
    case "right":
      return new DOMRect(
        target.rect.right + offset,
        target.rect.top,
        thickness,
        target.rect.height,
      );
    case "top":
      return new DOMRect(
        target.rect.left,
        target.rect.top - offset - thickness,
        target.rect.width,
        thickness,
      );
    case "bottom":
      return new DOMRect(
        target.rect.left,
        target.rect.bottom + offset,
        target.rect.width,
        thickness,
      );
  }
}

function getDropArrowPlacement(
  target: DropTarget,
  lineRect: DOMRect,
): { direction: "left" | "right" | "up" | "down"; left: number; top: number } {
  const gap = DOCK_LINE_GAP;
  const size = DOCK_ARROW_SIZE;
  const arrowGap = DOCK_ARROW_GAP;

  if (target.kind === "boundary") {
    if (target.direction === "horizontal") {
      return target.cursorSide === "before"
        ? {
            direction: "left",
            left: lineRect.left - gap - size,
            top: lineRect.top + lineRect.height / 2 - size / 2,
          }
        : {
            direction: "right",
            left: lineRect.right + gap,
            top: lineRect.top + lineRect.height / 2 - size / 2,
          };
    }

    return target.cursorSide === "before"
      ? {
          direction: "up",
          left: lineRect.left + lineRect.width / 2 - size / 2,
          top: lineRect.top - gap - size,
        }
      : {
          direction: "down",
          left: lineRect.left + lineRect.width / 2 - size / 2,
          top: lineRect.bottom + gap,
        };
  }

  if (target.kind === "area-edge" || target.kind === "area") {
    if (target.edge === "left") {
      return {
        direction: "right",
        left: lineRect.right + arrowGap,
        top: lineRect.top + lineRect.height / 2 - size / 2,
      };
    }

    if (target.edge === "right") {
      return {
        direction: "left",
        left: lineRect.left - arrowGap - size,
        top: lineRect.top + lineRect.height / 2 - size / 2,
      };
    }

    if (target.edge === "top") {
      return {
        direction: "down",
        left: lineRect.left + lineRect.width / 2 - size / 2,
        top: lineRect.bottom + arrowGap,
      };
    }

    if (target.edge === "bottom") {
      return {
        direction: "up",
        left: lineRect.left + lineRect.width / 2 - size / 2,
        top: lineRect.top - arrowGap - size,
      };
    }

    return {
      direction: "down",
      left: lineRect.left + lineRect.width / 2 - size / 2,
      top: lineRect.top + lineRect.height / 2 - size / 2,
    };
  }

  return {
    direction: "down",
    left: lineRect.left + lineRect.width / 2 - size / 2,
    top: lineRect.top + lineRect.height / 2 - size / 2,
  };
}

function isVerticalLineTarget(target: DropTarget): boolean {
  if (target.kind === "boundary") {
    return target.direction === "horizontal";
  }

  return target.edge === "left" || target.edge === "right";
}

function createDockArrowSvg(): SVGSVGElement {
  const svgNamespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("editor-v2-dock-arrow");

  const path = document.createElementNS(svgNamespace, "path");
  path.setAttribute("d", buildRoundedDockArrowPath("right"));
  path.setAttribute("fill", "currentColor");
  svg.append(path);
  return svg;
}

function buildRoundedDockArrowPath(
  direction: "left" | "right" | "up" | "down",
): string {
  const points = getDockArrowPoints(direction);
  const radius = DOCK_ARROW_CORNER_RADIUS;
  const segments = buildRoundedPolygonSegments(points, radius);

  let d = `M ${segments[0]!.end.x.toFixed(2)} ${segments[0]!.end.y.toFixed(2)}`;

  for (let i = 1; i < segments.length; i += 1) {
    const segment = segments[i]!;
    const vertex = points[i]!;
    d += ` L ${segment.start.x.toFixed(2)} ${segment.start.y.toFixed(2)} Q ${vertex.x.toFixed(2)} ${vertex.y.toFixed(2)} ${segment.end.x.toFixed(2)} ${segment.end.y.toFixed(2)}`;
  }

  const firstVertex = points[0]!;
  d += ` L ${segments[0]!.start.x.toFixed(2)} ${segments[0]!.start.y.toFixed(2)} Q ${firstVertex.x.toFixed(2)} ${firstVertex.y.toFixed(2)} ${segments[0]!.end.x.toFixed(2)} ${segments[0]!.end.y.toFixed(2)} Z`;
  return d;
}

function getDockArrowPoints(direction: "left" | "right" | "up" | "down"): Array<{
  x: number;
  y: number;
}> {
  switch (direction) {
    case "right":
      return [
        { x: 14, y: 10 },
        { x: 6, y: 2 },
        { x: 6, y: 18 },
      ];
    case "left":
      return [
        { x: 6, y: 10 },
        { x: 14, y: 2 },
        { x: 14, y: 18 },
      ];
    case "up":
      return [
        { x: 10, y: 6 },
        { x: 18, y: 14 },
        { x: 2, y: 14 },
      ];
    case "down":
      return [
        { x: 10, y: 14 },
        { x: 2, y: 6 },
        { x: 18, y: 6 },
      ];
  }
}

function buildRoundedPolygonSegments(
  points: Array<{ x: number; y: number }>,
  radius: number,
): Array<{ start: { x: number; y: number }; end: { x: number; y: number } }> {
  const segments: Array<{ start: { x: number; y: number }; end: { x: number; y: number } }> = [];
  const count = points.length;

  for (let index = 0; index < count; index += 1) {
    const current = points[index]!;
    const previous = points[(index - 1 + count) % count]!;
    const next = points[(index + 1) % count]!;

    const toPrevious = normalizeVector({
      x: previous.x - current.x,
      y: previous.y - current.y,
    });
    const toNext = normalizeVector({
      x: next.x - current.x,
      y: next.y - current.y,
    });

    const angle = Math.acos(
      clampNumber(dotVector(toPrevious, toNext), -1, 1),
    );
    const maxEdge = Math.min(
      distanceBetween(previous, current),
      distanceBetween(next, current),
    ) / 2;
    const offset = Math.min(
      maxEdge,
      radius / Math.tan(Math.max(0.001, angle / 2)),
    );

    segments.push({
      start: {
        x: current.x + toPrevious.x * offset,
        y: current.y + toPrevious.y * offset,
      },
      end: {
        x: current.x + toNext.x * offset,
        y: current.y + toNext.y * offset,
      },
    });
  }

  return segments;
}

function normalizeVector(point: { x: number; y: number }): { x: number; y: number } {
  const length = Math.hypot(point.x, point.y) || 1;
  return { x: point.x / length, y: point.y / length };
}

function dotVector(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return a.x * b.x + a.y * b.y;
}

function distanceBetween(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getMockItems(contentType: EditorV2ContentType, areaId: string): string[] {
  const suffix = areaId.slice(-4);
  switch (contentType) {
    case "assetBrowser":
      return ["Primitive Assets", "Prefabs", "Scenes", `Instance ${suffix}`];
    case "outliner":
      return ["Scene Collection", "Camera", "Root Prefab", `Area ${suffix}`];
    case "inspector":
      return ["Transform", "Material", "Path Source", `Area ${suffix}`];
    case "timeline":
      return ["Dope Sheet", "Clip Lane", "Keyframes", `Area ${suffix}`];
    case "console":
      return ["Ready", "Layout saved to cookie", `Area ${suffix}`];
    case "properties":
      return ["Project", "Viewport", "Render", `Area ${suffix}`];
    case "toolbar":
      return ["Select", "Move", "Rotate", "Scale", `Area ${suffix}`];
    case "viewport":
      return [];
  }
}

function installDebugHook(): void {
  window.__editorV2Debug = {
    getLayout: () => cloneEditorV2Layout(layout),
    getCookieLayout: () => cloneEditorV2Layout(cookieLayout),
    getProjectLayouts: () =>
      projectLayouts.map((entry) => ({
        ...entry,
        layout: cloneEditorV2Layout(entry.layout),
      })),
    getFingerprint: () => createLayoutFingerprint(layout),
  };
}
