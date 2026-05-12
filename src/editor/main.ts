import "../styles.css";
import type { PrimitiveSvgAsset } from "../core/assets/primitiveSvg";
import { CanvasStage } from "../core/stage/canvasStage";
import {
  drawCenteredStatus,
  drawPrimitivePreview,
  drawStageGrid,
} from "../core/stage/primitivePreview";
import {
  createProject,
  deleteAsset,
  deleteProject,
  listAssets,
  listProjects,
  uploadAsset,
  type ProjectRecord,
} from "./api";

type EditorElements = {
  projectForm: HTMLFormElement;
  projectNameInput: HTMLInputElement;
  projectList: HTMLUListElement;
  deleteProjectButton: HTMLButtonElement;
  fileInput: HTMLInputElement;
  assetList: HTMLUListElement;
  deleteAssetButton: HTMLButtonElement;
  importError: HTMLParagraphElement;
  inspectorFields: HTMLDListElement;
};

const stage = new CanvasStage();
const elements = getEditorElements();

let projects: ProjectRecord[] = [];
let assets: PrimitiveSvgAsset[] = [];
let selectedProjectId: string | null = null;
let selectedAssetId: string | null = null;
let lastImportError: string | null = null;
let lastFrameTime = performance.now();

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
elements.deleteAssetButton.addEventListener("click", () => {
  void deleteSelectedAsset();
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
      getSelectedProjectId: () => string | null;
      getSelectedAssetId: () => string | null;
      getLastImportError: () => string | null;
    };
  }
}

async function refreshProjects(): Promise<void> {
  try {
    projects = await listProjects();
    selectedProjectId = chooseStableSelection(
      selectedProjectId,
      projects.map((project) => project.id),
    );
    await refreshAssets();
  } catch (error) {
    setImportError(error);
  }
}

async function refreshAssets(): Promise<void> {
  if (!selectedProjectId) {
    assets = [];
    selectedAssetId = null;
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
    await deleteAsset(selectedProjectId, selectedAssetId);
    selectedAssetId = null;
    lastImportError = null;
    hideError();
    await refreshAssets();
  } catch (error) {
    setImportError(error);
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
  const deleteAssetButton = getRequiredElement(
    "delete-asset-button",
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
    deleteAssetButton,
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
  renderInspector();
  elements.fileInput.disabled = !selectedProjectId;
  elements.deleteProjectButton.disabled = !selectedProjectId;
  elements.deleteAssetButton.disabled = !selectedProjectId || !selectedAssetId;
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

function renderInspector(): void {
  elements.inspectorFields.replaceChildren();

  const selectedProject = getSelectedProject();
  const selectedAsset = getSelectedAsset();

  if (!selectedProject) {
    appendInspectorRow("Status", "Create or select a project");
    return;
  }

  appendInspectorRow("Project", selectedProject.name);
  appendInspectorRow("Project ID", selectedProject.id);

  if (!selectedAsset) {
    appendInspectorRow("Asset", "No primitive selected");
    return;
  }

  appendInspectorRow("Asset ID", selectedAsset.id);
  appendInspectorRow("Name", selectedAsset.name);
  appendInspectorRow("Source", selectedAsset.sourceUrl);
  appendInspectorRow("ViewBox", selectedAsset.viewBox.join(", "));
  appendInspectorRow("Fill", selectedAsset.fill);
  appendInspectorRow("Fill Rule", selectedAsset.fillRule);
  appendInspectorRow("Path Length", `${selectedAsset.pathD.length} chars`);
}

function appendInspectorRow(label: string, value: string): void {
  const term = document.createElement("dt");
  const description = document.createElement("dd");

  term.textContent = label;
  description.textContent = value;
  elements.inspectorFields.append(term, description);
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
  drawStageGrid(stage.getLayer("three-canvas"), stage.size);

  const context = stage.getLayer("vector-canvas").context;
  const selectedAsset = getSelectedAsset();

  if (!selectedProjectId) {
    drawCenteredStatus(context, stage.size, "Create or select a project");
    return;
  }

  if (!selectedAsset) {
    drawCenteredStatus(context, stage.size, "Import or select a primitive SVG");
    return;
  }

  drawPrimitivePreview(context, stage.size, selectedAsset);
}

function getSelectedProject(): ProjectRecord | null {
  return projects.find((project) => project.id === selectedProjectId) ?? null;
}

function getSelectedAsset(): PrimitiveSvgAsset | null {
  return assets.find((asset) => asset.id === selectedAssetId) ?? null;
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
    getSelectedProjectId: () => selectedProjectId,
    getSelectedAssetId: () => selectedAssetId,
    getLastImportError: () => lastImportError,
  };
}
