import "../styles.css";
import type { PrimitiveSvgAsset } from "../core/assets/primitiveSvg";
import { CanvasStage } from "../core/stage/canvasStage";
import { drawCenteredStatus } from "../core/stage/primitivePreview";
import {
  createProject,
  deleteAsset,
  deleteProject,
  listAssets,
  listProjects,
  uploadAsset,
  type ProjectRecord,
} from "./api";
import {
  ThreeEditorViewport,
  tupleToVector,
  type CameraProjection,
  type EditorSceneNode,
  type TransformMode,
  type Vector3Tuple,
} from "./threeEditorViewport";

type EditorElements = {
  projectForm: HTMLFormElement;
  projectNameInput: HTMLInputElement;
  projectList: HTMLUListElement;
  deleteProjectButton: HTMLButtonElement;
  fileInput: HTMLInputElement;
  assetList: HTMLUListElement;
  addNodeButton: HTMLButtonElement;
  deleteAssetButton: HTMLButtonElement;
  sceneNodeList: HTMLUListElement;
  projectionToggleButton: HTMLButtonElement;
  transformTranslateButton: HTMLButtonElement;
  transformRotateButton: HTMLButtonElement;
  transformScaleButton: HTMLButtonElement;
  resetViewButton: HTMLButtonElement;
  importError: HTMLParagraphElement;
  inspectorFields: HTMLDListElement;
};

const stage = new CanvasStage(["vector-canvas", "paper-canvas"]);
const threeViewport = new ThreeEditorViewport();
const elements = getEditorElements();

let projects: ProjectRecord[] = [];
let assets: PrimitiveSvgAsset[] = [];
let sceneNodes: EditorSceneNode[] = [];
let selectedProjectId: string | null = null;
let selectedAssetId: string | null = null;
let selectedNodeId: string | null = null;
let lastImportError: string | null = null;
let lastFrameTime = performance.now();
let nextSceneNodeNumber = 1;

stage.getLayer("vector-canvas").canvas.dataset.visualCheck = "editor-ready";
elements.projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void createProjectFromInput();
});
elements.deleteProjectButton.addEventListener("click", () => {
  void deleteSelectedProject();
});
elements.fileInput.addEventListener("change", () => {
  void importSelectedFile();
});
elements.addNodeButton.addEventListener("click", () => {
  addSelectedAssetToScene();
});
elements.deleteAssetButton.addEventListener("click", () => {
  void deleteSelectedAsset();
});
elements.projectionToggleButton.addEventListener("click", () => {
  toggleProjection();
});
elements.transformTranslateButton.addEventListener("click", () => {
  setTransformMode("translate");
});
elements.transformRotateButton.addEventListener("click", () => {
  setTransformMode("rotate");
});
elements.transformScaleButton.addEventListener("click", () => {
  setTransformMode("scale");
});
elements.resetViewButton.addEventListener("click", () => {
  threeViewport.resetView();
  renderEditorShell();
  exposeEditorDebugHooks();
});
threeViewport.setCallbacks({
  onSelectionChange: (nodeId) => {
    selectedNodeId = nodeId;
    renderEditorShell();
    exposeEditorDebugHooks();
  },
  onObjectTransform: (nodeId) => {
    const node = getSceneNode(nodeId);

    if (!node) {
      return;
    }

    threeViewport.syncNodeFromProxy(node);
    renderEditorShell();
    exposeEditorDebugHooks();
  },
});

void refreshProjects();
requestAnimationFrame(tick);
renderEditorShell();
exposeEditorDebugHooks();

declare global {
  interface Window {
    __vectorEditorDebug?: {
      getProjects: () => ProjectRecord[];
      getAssets: () => Array<{
        id: string;
        name: string;
        sourceUrl: string;
        viewBox: [number, number, number, number];
        fill: string;
        fillRule: string;
        pathD: string;
      }>;
      getExperimentScene: () => {
        camera: {
          projection: CameraProjection;
          position: [number, number, number];
          target: [number, number, number];
          fov: number;
          zoom: number;
        };
        nodes: EditorSceneNode[];
        selectedNodeId: string | null;
        transformMode: TransformMode;
      };
      getSelectedProjectId: () => string | null;
      getSelectedAssetId: () => string | null;
      getLastImportError: () => string | null;
    };
  }
}

async function refreshProjects(): Promise<void> {
  try {
    projects = await listProjects();
    const nextSelectedProjectId = chooseStableSelection(
      selectedProjectId,
      projects.map((project) => project.id),
    );

    if (selectedProjectId !== nextSelectedProjectId) {
      clearExperimentScene();
      selectedAssetId = null;
    }

    selectedProjectId = nextSelectedProjectId;
    await refreshAssets();
  } catch (error) {
    setImportError(error);
  }
}

async function refreshAssets(): Promise<void> {
  if (!selectedProjectId) {
    assets = [];
    selectedAssetId = null;
    clearExperimentScene();
    renderEditorShell();
    exposeEditorDebugHooks();
    return;
  }

  assets = await listAssets(selectedProjectId);
  selectedAssetId = chooseStableSelection(
    selectedAssetId,
    assets.map((asset) => asset.id),
  );
  renderEditorShell();
  exposeEditorDebugHooks();
}

async function createProjectFromInput(): Promise<void> {
  const name = elements.projectNameInput.value.trim();

  if (!name) {
    setImportError(new Error("Project name is required."));
    return;
  }

  try {
    const project = await createProject(name);
    elements.projectNameInput.value = "";
    if (selectedProjectId !== project.id) {
      clearExperimentScene();
      selectedAssetId = null;
    }
    selectedProjectId = project.id;
    lastImportError = null;
    hideError();
    await refreshProjects();
  } catch (error) {
    setImportError(error);
  }
}

async function deleteSelectedProject(): Promise<void> {
  if (!selectedProjectId) {
    return;
  }

  try {
    await deleteProject(selectedProjectId);
    selectedProjectId = null;
    selectedAssetId = null;
    clearExperimentScene();
    lastImportError = null;
    hideError();
    await refreshProjects();
  } catch (error) {
    setImportError(error);
  }
}

async function importSelectedFile(): Promise<void> {
  const file = elements.fileInput.files?.[0];

  if (!file || !selectedProjectId) {
    elements.fileInput.value = "";
    if (!selectedProjectId) {
      setImportError(new Error("Create or select a project before importing SVG."));
    }
    return;
  }

  try {
    const asset = await uploadAsset(selectedProjectId, file);
    selectedAssetId = asset.id;
    lastImportError = null;
    hideError();
    elements.fileInput.value = "";
    await refreshAssets();
    selectedAssetId = asset.id;
    renderEditorShell();
    exposeEditorDebugHooks();
  } catch (error) {
    setImportError(error);
  }
}

async function deleteSelectedAsset(): Promise<void> {
  if (!selectedProjectId || !selectedAssetId) {
    return;
  }

  try {
    const deletedAssetId = selectedAssetId;
    await deleteAsset(selectedProjectId, deletedAssetId);
    removeSceneNodesForAsset(deletedAssetId);
    selectedAssetId = null;
    lastImportError = null;
    hideError();
    await refreshAssets();
  } catch (error) {
    setImportError(error);
  }
}

function addSelectedAssetToScene(): void {
  const selectedAsset = getSelectedAsset();

  if (!selectedAsset) {
    setImportError(new Error("Select an SVG primitive asset before adding a node."));
    return;
  }

  const node: EditorSceneNode = {
    id: `node-${nextSceneNodeNumber}`,
    assetId: selectedAsset.id,
    position: [0, 1, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    billboardMode: "spherical",
  };

  nextSceneNodeNumber += 1;
  sceneNodes = [...sceneNodes, node];
  selectedNodeId = node.id;
  threeViewport.addOrUpdateNode(node, selectedAsset);
  threeViewport.setSelectedNode(node.id);
  lastImportError = null;
  hideError();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function toggleProjection(): void {
  threeViewport.toggleProjection();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function setTransformMode(mode: TransformMode): void {
  threeViewport.setTransformMode(mode);
  renderEditorShell();
  exposeEditorDebugHooks();
}

function clearExperimentScene(): void {
  for (const node of sceneNodes) {
    threeViewport.removeNode(node.id);
  }

  sceneNodes = [];
  selectedNodeId = null;
}

function removeSceneNodesForAsset(assetId: string): void {
  const nodesToRemove = sceneNodes.filter((node) => node.assetId === assetId);

  for (const node of nodesToRemove) {
    threeViewport.removeNode(node.id);
  }

  sceneNodes = sceneNodes.filter((node) => node.assetId !== assetId);

  if (selectedNodeId && !sceneNodes.some((node) => node.id === selectedNodeId)) {
    selectedNodeId = null;
    threeViewport.setSelectedNode(null);
  }
}

function getEditorElements(): EditorElements {
  const projectForm = getRequiredElement("project-form", HTMLFormElement);
  const projectNameInput = getRequiredElement(
    "project-name-input",
    HTMLInputElement,
  );
  const projectList = getRequiredElement("project-list", HTMLUListElement);
  const deleteProjectButton = getRequiredElement(
    "delete-project-button",
    HTMLButtonElement,
  );
  const fileInput = getRequiredElement("svg-file-input", HTMLInputElement);
  const assetList = getRequiredElement("asset-list", HTMLUListElement);
  const addNodeButton = getRequiredElement("add-node-button", HTMLButtonElement);
  const deleteAssetButton = getRequiredElement(
    "delete-asset-button",
    HTMLButtonElement,
  );
  const sceneNodeList = getRequiredElement("scene-node-list", HTMLUListElement);
  const projectionToggleButton = getRequiredElement(
    "projection-toggle-button",
    HTMLButtonElement,
  );
  const transformTranslateButton = getRequiredElement(
    "transform-translate-button",
    HTMLButtonElement,
  );
  const transformRotateButton = getRequiredElement(
    "transform-rotate-button",
    HTMLButtonElement,
  );
  const transformScaleButton = getRequiredElement(
    "transform-scale-button",
    HTMLButtonElement,
  );
  const resetViewButton = getRequiredElement(
    "reset-view-button",
    HTMLButtonElement,
  );
  const importError = getRequiredElement("import-error", HTMLParagraphElement);
  const inspectorFields = getRequiredElement(
    "inspector-fields",
    HTMLDListElement,
  );

  return {
    projectForm,
    projectNameInput,
    projectList,
    deleteProjectButton,
    fileInput,
    assetList,
    addNodeButton,
    deleteAssetButton,
    sceneNodeList,
    projectionToggleButton,
    transformTranslateButton,
    transformRotateButton,
    transformScaleButton,
    resetViewButton,
    importError,
    inspectorFields,
  };
}

function getRequiredElement<T extends HTMLElement>(
  id: string,
  constructor: new () => T,
): T {
  const element = document.getElementById(id);

  if (!(element instanceof constructor)) {
    throw new Error(`Expected #${id} to be ${constructor.name}.`);
  }

  return element;
}

function renderEditorShell(): void {
  renderProjectList();
  renderAssetList();
  renderSceneNodeList();
  renderInspector();
  elements.fileInput.disabled = !selectedProjectId;
  elements.deleteProjectButton.disabled = !selectedProjectId;
  elements.addNodeButton.disabled = !selectedAssetId;
  elements.deleteAssetButton.disabled = !selectedProjectId || !selectedAssetId;
  elements.projectionToggleButton.textContent =
    threeViewport.currentProjection === "perspective"
      ? "Perspective"
      : "Orthographic";
  elements.transformTranslateButton.dataset.selected = String(
    threeViewport.currentTransformMode === "translate",
  );
  elements.transformRotateButton.dataset.selected = String(
    threeViewport.currentTransformMode === "rotate",
  );
  elements.transformScaleButton.dataset.selected = String(
    threeViewport.currentTransformMode === "scale",
  );
}

function renderProjectList(): void {
  elements.projectList.replaceChildren(
    ...projects.map((project) => {
      const item = document.createElement("li");
      const button = document.createElement("button");

      button.type = "button";
      button.className = "asset-list-item";
      button.dataset.projectId = project.id;
      button.dataset.selected = String(project.id === selectedProjectId);
      button.textContent = project.name;
      button.addEventListener("click", () => {
        if (selectedProjectId !== project.id) {
          clearExperimentScene();
        }
        selectedProjectId = project.id;
        selectedAssetId = null;
        void refreshAssets();
      });

      item.append(button);
      return item;
    }),
  );
}

function renderAssetList(): void {
  elements.assetList.replaceChildren(
    ...assets.map((asset) => {
      const item = document.createElement("li");
      const button = document.createElement("button");

      button.type = "button";
      button.className = "asset-list-item";
      button.dataset.assetId = asset.id;
      button.dataset.selected = String(asset.id === selectedAssetId);
      button.textContent = asset.name;
      button.addEventListener("click", () => {
        selectedAssetId = asset.id;
        renderEditorShell();
        exposeEditorDebugHooks();
      });

      item.append(button);
      return item;
    }),
  );
}

function renderSceneNodeList(): void {
  elements.sceneNodeList.replaceChildren(
    ...sceneNodes.map((node) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const asset = getAssetById(node.assetId);

      button.type = "button";
      button.className = "asset-list-item";
      button.dataset.nodeId = node.id;
      button.dataset.selected = String(node.id === selectedNodeId);
      button.textContent = `${node.id} · ${asset?.name ?? node.assetId}`;
      button.addEventListener("click", () => {
        selectedNodeId = node.id;
        threeViewport.setSelectedNode(node.id);
        renderEditorShell();
        exposeEditorDebugHooks();
      });

      item.append(button);
      return item;
    }),
  );
}

function renderInspector(): void {
  elements.inspectorFields.replaceChildren();

  const selectedProject = getSelectedProject();
  const selectedAsset = getSelectedAsset();
  const camera = threeViewport.getCameraSnapshot();
  const selectedNode = getSelectedNode();

  if (!selectedProject) {
    appendInspectorRow("Status", "Create or select a project");
    return;
  }

  appendInspectorRow("Project", selectedProject.name);
  appendInspectorRow("Project ID", selectedProject.id);
  appendInspectorRow("Projection", camera.projection);
  appendInspectorRow("Camera Pos", camera.position.join(", "));
  appendInspectorRow("Camera Target", camera.target.join(", "));

  if (!selectedAsset) {
    appendInspectorRow("Asset", "No primitive selected");
  } else {
    appendInspectorRow("Asset ID", selectedAsset.id);
    appendInspectorRow("Name", selectedAsset.name);
    appendInspectorRow("Source", selectedAsset.sourceUrl);
    appendInspectorRow("ViewBox", selectedAsset.viewBox.join(", "));
    appendInspectorRow("Fill", selectedAsset.fill);
    appendInspectorRow("Fill Rule", selectedAsset.fillRule);
    appendInspectorRow("Path Length", `${selectedAsset.pathD.length} chars`);
  }

  if (!selectedNode) {
    appendInspectorRow("Scene Node", "No node selected");
    return;
  }

  appendInspectorRow("Scene Node", selectedNode.id);
  appendInspectorRow("Node Asset", selectedNode.assetId);
  appendTransformInspectorRow("Position", selectedNode, "position");
  appendTransformInspectorRow("Rotation", selectedNode, "rotation");
  appendTransformInspectorRow("Scale", selectedNode, "scale");
  appendInspectorRow("Billboard", selectedNode.billboardMode);
  appendInspectorRow(
    "Rotation Note",
    "Canvas shows local Z roll; X/Y stay in the Three proxy.",
  );
}

function appendInspectorRow(label: string, value: string): void {
  const term = document.createElement("dt");
  const description = document.createElement("dd");

  term.textContent = label;
  description.textContent = value;
  elements.inspectorFields.append(term, description);
}

function appendTransformInspectorRow(
  label: string,
  node: EditorSceneNode,
  property: "position" | "rotation" | "scale",
): void {
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  const editor = document.createElement("div");

  term.textContent = label;
  editor.className = "transform-input-row";

  node[property].forEach((value, axisIndex) => {
    const input = document.createElement("input");
    const axisName = ["X", "Y", "Z"][axisIndex] ?? "?";

    input.className = "transform-number-input";
    input.type = "text";
    input.inputMode = "decimal";
    input.dataset.transformProperty = property;
    input.dataset.transformAxis = axisName.toLowerCase();
    input.ariaLabel = `${label} ${axisName}`;
    input.value = formatTransformValue(value);
    input.addEventListener("focus", () => {
      input.dataset.previousValue = input.value;
    });
    input.addEventListener("blur", () => {
      applyTransformInput(input, node.id, property, axisIndex);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        input.blur();
      }

      if (event.key === "Escape") {
        input.value = input.dataset.previousValue ?? formatTransformValue(value);
        input.blur();
      }
    });

    editor.append(input);
  });

  description.append(editor);
  elements.inspectorFields.append(term, description);
}

function applyTransformInput(
  input: HTMLInputElement,
  nodeId: string,
  property: "position" | "rotation" | "scale",
  axisIndex: number,
): void {
  const node = getSceneNode(nodeId);
  const parsedValue = Number(input.value.trim());

  if (!node || !Number.isFinite(parsedValue)) {
    restoreTransformInput(input, node, property, axisIndex);
    return;
  }

  if (property === "scale" && Math.abs(parsedValue) < 0.0001) {
    restoreTransformInput(input, node, property, axisIndex);
    return;
  }

  const nextValue = [...node[property]] as Vector3Tuple;
  nextValue[axisIndex] = roundTransformValue(parsedValue);
  node[property] = nextValue;
  threeViewport.syncProxyFromNode(node);
  renderEditorShell();
  exposeEditorDebugHooks();
}

function restoreTransformInput(
  input: HTMLInputElement,
  node: EditorSceneNode | null,
  property: "position" | "rotation" | "scale",
  axisIndex: number,
): void {
  input.value = node
    ? formatTransformValue(node[property][axisIndex] ?? 0)
    : (input.dataset.previousValue ?? "");
}

function tick(now: DOMHighResTimeStamp): void {
  const deltaSeconds = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;

  renderPreviewFrame();
  requestAnimationFrame(tick);
  void deltaSeconds;
}

function renderPreviewFrame(): void {
  stage.clearAll();
  threeViewport.render(stage.size);

  const context = stage.getLayer("vector-canvas").context;

  if (!selectedProjectId) {
    drawCenteredStatus(context, stage.size, "Create or select a project");
    return;
  }

  if (sceneNodes.length === 0) {
    drawCenteredStatus(context, stage.size, "Import an SVG and add it to the scene");
    return;
  }

  drawSceneBillboards(context);
}

function getSelectedProject(): ProjectRecord | null {
  return projects.find((project) => project.id === selectedProjectId) ?? null;
}

function getSelectedAsset(): PrimitiveSvgAsset | null {
  return assets.find((asset) => asset.id === selectedAssetId) ?? null;
}

function getSelectedNode(): EditorSceneNode | null {
  return selectedNodeId ? getSceneNode(selectedNodeId) : null;
}

function getSceneNode(nodeId: string): EditorSceneNode | null {
  return sceneNodes.find((node) => node.id === nodeId) ?? null;
}

function getAssetById(assetId: string): PrimitiveSvgAsset | null {
  return assets.find((asset) => asset.id === assetId) ?? null;
}

function drawSceneBillboards(context: CanvasRenderingContext2D): void {
  const drawableNodes = sceneNodes
    .map((node) => {
      const asset = getAssetById(node.assetId);
      const worldPosition = tupleToVector(node.position);
      const projected = threeViewport.projectWorldPosition(worldPosition, stage.size);

      if (!asset || !projected) {
        return null;
      }

      return {
        asset,
        node,
        projected,
        scale: threeViewport.getDistanceScale(worldPosition, 1),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.projected.depth - a.projected.depth);

  for (const entry of drawableNodes) {
    drawBillboardNode(context, entry.asset, entry.node, entry.projected, entry.scale);
  }
}

function drawBillboardNode(
  context: CanvasRenderingContext2D,
  asset: PrimitiveSvgAsset,
  node: EditorSceneNode,
  projected: { x: number; y: number },
  screenScale: number,
): void {
  const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] = asset.viewBox;
  const largestDimension = Math.max(viewBoxWidth, viewBoxHeight);
  const assetScale = screenScale / largestDimension;
  const selected = node.id === selectedNodeId;

  context.save();
  context.translate(projected.x, projected.y);
  context.rotate(node.rotation[2]);
  context.scale(assetScale * node.scale[0], assetScale * node.scale[1]);
  context.translate(
    -(viewBoxX + viewBoxWidth / 2),
    -(viewBoxY + viewBoxHeight / 2),
  );
  context.fillStyle = asset.fill;
  context.fill(asset.path, asset.fillRule);

  if (selected) {
    context.lineWidth = 3 / Math.max(assetScale, 0.001);
    context.strokeStyle = "#ffcf4a";
    context.strokeRect(viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight);
  }

  context.restore();
}

function chooseStableSelection(
  currentId: string | null,
  availableIds: string[],
): string | null {
  if (currentId && availableIds.includes(currentId)) {
    return currentId;
  }

  return availableIds[0] ?? null;
}

function formatTransformValue(value: number): string {
  return String(roundTransformValue(value));
}

function roundTransformValue(value: number): number {
  return Number(value.toFixed(4));
}

function setImportError(error: unknown): void {
  const message = error instanceof Error ? error.message : "Unknown error";
  lastImportError = message;
  elements.importError.textContent = message;
  elements.importError.hidden = false;
  elements.fileInput.value = "";
  console.error(error);
  renderEditorShell();
  exposeEditorDebugHooks();
}

function hideError(): void {
  elements.importError.hidden = true;
  elements.importError.textContent = "";
}

function exposeEditorDebugHooks(): void {
  window.__vectorEditorDebug = {
    getProjects: () => [...projects],
    getAssets: () =>
      assets.map((asset) => ({
        id: asset.id,
        name: asset.name,
        sourceUrl: asset.sourceUrl,
        viewBox: asset.viewBox,
        fill: asset.fill,
        fillRule: asset.fillRule,
        pathD: asset.pathD,
      })),
    getExperimentScene: () => {
      const camera = threeViewport.getCameraSnapshot();

      return {
        camera: {
          projection: camera.projection,
          position: camera.position,
          target: camera.target,
          fov: camera.fov,
          zoom: camera.zoom,
        },
        nodes: sceneNodes.map((node) => ({
          id: node.id,
          assetId: node.assetId,
          position: [...node.position],
          rotation: [...node.rotation],
          scale: [...node.scale],
          billboardMode: node.billboardMode,
        })),
        selectedNodeId,
        transformMode: threeViewport.currentTransformMode,
      };
    },
    getSelectedProjectId: () => selectedProjectId,
    getSelectedAssetId: () => selectedAssetId,
    getLastImportError: () => lastImportError,
  };
}
