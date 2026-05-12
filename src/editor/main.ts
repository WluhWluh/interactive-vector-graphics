import "../styles.css";
import {
  PrimitiveAssetRegistry,
  importPrimitiveSvg,
  type PrimitiveSvgAsset,
} from "../core/assets/primitiveSvg";
import { CanvasStage } from "../core/stage/canvasStage";
import {
  drawCenteredStatus,
  drawPrimitivePreview,
  drawStageGrid,
} from "../core/stage/primitivePreview";

const PRIMITIVE_ASSET_MANIFEST_URL = "/assets/primitive-assets.json";

type EditorElements = {
  fileInput: HTMLInputElement;
  assetList: HTMLUListElement;
  importError: HTMLParagraphElement;
  inspectorFields: HTMLDListElement;
};

const stage = new CanvasStage();
const assetRegistry = new PrimitiveAssetRegistry();
const elements = getEditorElements();

let selectedAssetId: string | null = null;
let lastImportError: string | null = null;
let lastFrameTime = performance.now();

stage.getLayer("vector-canvas").canvas.dataset.visualCheck = "editor-ready";
elements.fileInput.addEventListener("change", () => {
  void importSelectedFile();
});

void loadBuiltInAssets();
requestAnimationFrame(tick);
renderEditorShell();
exposeEditorDebugHooks();

declare global {
  interface Window {
    __vectorEditorDebug?: {
      getAssets: () => Array<{
        id: string;
        name: string;
        sourceUrl: string;
        viewBox: [number, number, number, number];
        fill: string;
        fillRule: string;
        pathD: string;
      }>;
      getSelectedAssetId: () => string | null;
      getLastImportError: () => string | null;
    };
  }
}

async function loadBuiltInAssets(): Promise<void> {
  try {
    await assetRegistry.loadManifest(PRIMITIVE_ASSET_MANIFEST_URL);
    selectedAssetId = assetRegistry.snapshot()[0]?.id ?? null;
    renderEditorShell();
    exposeEditorDebugHooks();
  } catch (error) {
    setImportError(error);
  }
}

async function importSelectedFile(): Promise<void> {
  const file = elements.fileInput.files?.[0];

  if (!file) {
    return;
  }

  try {
    const svgText = await file.text();
    const assetId = assetRegistry.createUniqueId(file.name);
    const assetName = file.name.replace(/\.svg$/i, "") || assetId;
    const asset = importPrimitiveSvg(svgText, {
      id: assetId,
      name: assetName,
      sourceUrl: `local:${file.name}`,
    });

    assetRegistry.register(asset);
    selectedAssetId = asset.id;
    lastImportError = null;
    elements.importError.hidden = true;
    elements.importError.textContent = "";
    elements.fileInput.value = "";
    renderEditorShell();
    exposeEditorDebugHooks();
  } catch (error) {
    setImportError(error);
  }
}

function getEditorElements(): EditorElements {
  const fileInput = document.getElementById("svg-file-input");
  const assetList = document.getElementById("asset-list");
  const importError = document.getElementById("import-error");
  const inspectorFields = document.getElementById("inspector-fields");

  if (!(fileInput instanceof HTMLInputElement)) {
    throw new Error("Expected #svg-file-input to be an input element.");
  }

  if (!(assetList instanceof HTMLUListElement)) {
    throw new Error("Expected #asset-list to be a list element.");
  }

  if (!(importError instanceof HTMLParagraphElement)) {
    throw new Error("Expected #import-error to be a paragraph element.");
  }

  if (!(inspectorFields instanceof HTMLDListElement)) {
    throw new Error("Expected #inspector-fields to be a description list.");
  }

  return { fileInput, assetList, importError, inspectorFields };
}

function renderEditorShell(): void {
  renderAssetList();
  renderInspector();
}

function renderAssetList(): void {
  elements.assetList.replaceChildren(
    ...assetRegistry.snapshot().map((asset) => {
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

  const selectedAsset = getSelectedAsset();

  if (!selectedAsset) {
    appendInspectorRow("Status", "No primitive selected");
    return;
  }

  appendInspectorRow("ID", selectedAsset.id);
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

  /**
   * This first editor shell has no timeline yet, but keeping the loop shape now
   * makes it easy to plug animation sampling into the preview stage later.
   */
  void deltaSeconds;
}

function renderPreviewFrame(): void {
  stage.clearAll();
  drawStageGrid(stage.getLayer("three-canvas"), stage.size);

  const context = stage.getLayer("vector-canvas").context;
  const selectedAsset = getSelectedAsset();

  if (!selectedAsset) {
    drawCenteredStatus(context, stage.size, "Import or select a primitive SVG");
    return;
  }

  drawPrimitivePreview(context, stage.size, selectedAsset);
}

function getSelectedAsset(): PrimitiveSvgAsset | null {
  if (!selectedAssetId) {
    return null;
  }

  try {
    return assetRegistry.get(selectedAssetId);
  } catch {
    return null;
  }
}

function setImportError(error: unknown): void {
  const message = error instanceof Error ? error.message : "Unknown import error";
  lastImportError = message;
  elements.importError.textContent = message;
  elements.importError.hidden = false;
  elements.fileInput.value = "";
  console.error(error);
  exposeEditorDebugHooks();
}

function exposeEditorDebugHooks(): void {
  window.__vectorEditorDebug = {
    getAssets: () =>
      assetRegistry.snapshot().map((asset) => ({
        id: asset.id,
        name: asset.name,
        sourceUrl: asset.sourceUrl,
        viewBox: asset.viewBox,
        fill: asset.fill,
        fillRule: asset.fillRule,
        pathD: asset.pathD,
      })),
    getSelectedAssetId: () => selectedAssetId,
    getLastImportError: () => lastImportError,
  };
}
