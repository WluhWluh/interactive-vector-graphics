import "../styles.css";
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { PrimitiveSvgAsset } from "../core/assets/primitiveSvg";
import { CanvasStage } from "../core/stage/canvasStage";
import {
  drawCenteredStatus,
  drawPrimitivePreview,
} from "../core/stage/primitivePreview";
import {
  createPrefab,
  createProject,
  createScene,
  deleteAsset,
  deletePrefab,
  deleteProject,
  deleteScene,
  getPrefab,
  getScene,
  listAssets,
  listPrefabs,
  listProjects,
  listScenes,
  savePrefab,
  saveScene,
  uploadAsset,
  type PrefabDocument,
  type PrefabNode,
  type PrefabRecord,
  type ProjectRecord,
  type SceneDocument,
  type SceneNode,
  type ScenePrefabInstanceNode,
  type ScenePrimitiveNode,
  type SceneRecord,
} from "./api";
import {
  ThreeEditorViewport,
  tupleToVector,
  type CameraProjection,
  type EditorTransformNode,
  type TransformMode,
  type Vector3Tuple,
} from "./threeEditorViewport";

type EditorMode = "asset" | "scene";
type TransformProperty = "position" | "rotation" | "scale";
type SceneCreateSource = "empty" | "current";

type EditorElements = {
  assetModeButton: HTMLButtonElement;
  sceneModeButton: HTMLButtonElement;
  assetModePanel: HTMLElement;
  sceneModePanel: HTMLElement;
  projectForm: HTMLFormElement;
  projectNameInput: HTMLInputElement;
  projectList: HTMLUListElement;
  deleteProjectButton: HTMLButtonElement;
  prefabNameInput: HTMLInputElement;
  prefabList: HTMLUListElement;
  createPrefabButton: HTMLButtonElement;
  loadPrefabButton: HTMLButtonElement;
  savePrefabButton: HTMLButtonElement;
  deletePrefabButton: HTMLButtonElement;
  prefabNodeList: HTMLUListElement;
  createPrefabGroupButton: HTMLButtonElement;
  deletePrefabNodeButton: HTMLButtonElement;
  sceneNameInput: HTMLInputElement;
  sceneList: HTMLUListElement;
  createSceneButton: HTMLButtonElement;
  cloneSceneButton: HTMLButtonElement;
  loadSceneButton: HTMLButtonElement;
  saveSceneButton: HTMLButtonElement;
  deleteSceneButton: HTMLButtonElement;
  fileInput: HTMLInputElement;
  assetList: HTMLUListElement;
  addNodeButton: HTMLButtonElement;
  addPrefabInstanceButton: HTMLButtonElement;
  deleteAssetButton: HTMLButtonElement;
  sceneNodeList: HTMLUListElement;
  deleteSceneNodeButton: HTMLButtonElement;
  projectionToggleButton: HTMLButtonElement;
  transformTranslateButton: HTMLButtonElement;
  transformRotateButton: HTMLButtonElement;
  transformScaleButton: HTMLButtonElement;
  resetViewButton: HTMLButtonElement;
  importError: HTMLParagraphElement;
  inspectorFields: HTMLDListElement;
};

type TransformSnapshot = {
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
};

type DrawableBillboard = {
  id: string;
  asset: PrimitiveSvgAsset;
  transform: TransformSnapshot;
  selected: boolean;
};

type PrefabNodeTreeEntry = {
  node: PrefabNode;
  depth: number;
};

const stage = new CanvasStage(["vector-canvas", "paper-canvas"]);
const threeViewport = new ThreeEditorViewport();
const elements = getEditorElements();

let projects: ProjectRecord[] = [];
let assets: PrimitiveSvgAsset[] = [];
let prefabs: PrefabRecord[] = [];
let prefabNodes: PrefabNode[] = [];
let prefabDocuments = new Map<string, PrefabDocument>();
let scenes: SceneRecord[] = [];
let sceneNodes: SceneNode[] = [];
let editorMode: EditorMode = "asset";
let selectedProjectId: string | null = null;
let selectedAssetId: string | null = null;
let selectedPrefabId: string | null = null;
let loadedPrefabId: string | null = null;
let selectedPrefabNodeId: string | null = null;
let selectedSceneId: string | null = null;
let loadedSceneId: string | null = null;
let selectedSceneNodeId: string | null = null;
let lastImportError: string | null = null;
let lastFrameTime = performance.now();
let nextSceneNodeNumber = 1;
let nextPrefabNodeNumber = 1;

stage.getLayer("vector-canvas").canvas.dataset.visualCheck = "editor-ready";
bindEditorEvents();
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
      getPrefabs: () => PrefabRecord[];
      getPrefabAssembly: () => {
        nodes: PrefabNode[];
        selectedPrefabId: string | null;
        loadedPrefabId: string | null;
        selectedPrefabNodeId: string | null;
      };
      getExperimentScene: () => {
        camera: {
          projection: CameraProjection;
          position: [number, number, number];
          target: [number, number, number];
          fov: number;
          zoom: number;
          near: number;
          far: number;
        };
        nodes: SceneNode[];
        selectedNodeId: string | null;
        transformMode: TransformMode;
      };
      getScenes: () => SceneRecord[];
      getEditorMode: () => EditorMode;
      getSelectedProjectId: () => string | null;
      getSelectedAssetId: () => string | null;
      getSelectedPrefabId: () => string | null;
      getLoadedPrefabId: () => string | null;
      getSelectedSceneId: () => string | null;
      getLoadedSceneId: () => string | null;
      getLastImportError: () => string | null;
    };
  }
}

function bindEditorEvents(): void {
  elements.assetModeButton.addEventListener("click", () => {
    setEditorMode("asset");
  });
  elements.sceneModeButton.addEventListener("click", () => {
    setEditorMode("scene");
  });
  elements.projectForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void createProjectFromInput();
  });
  elements.deleteProjectButton.addEventListener("click", () => {
    void deleteSelectedProject();
  });
  elements.createPrefabButton.addEventListener("click", () => {
    void createPrefabFromInput();
  });
  elements.loadPrefabButton.addEventListener("click", () => {
    void loadSelectedPrefab();
  });
  elements.savePrefabButton.addEventListener("click", () => {
    void saveSelectedPrefab();
  });
  elements.deletePrefabButton.addEventListener("click", () => {
    void deleteSelectedPrefab();
  });
  elements.createPrefabGroupButton.addEventListener("click", () => {
    createPrefabGroup();
  });
  elements.deletePrefabNodeButton.addEventListener("click", () => {
    deleteSelectedPrefabNode();
  });
  elements.createSceneButton.addEventListener("click", () => {
    void createSceneFromInput("empty");
  });
  elements.cloneSceneButton.addEventListener("click", () => {
    void createSceneFromInput("current");
  });
  elements.loadSceneButton.addEventListener("click", () => {
    void loadSelectedScene();
  });
  elements.saveSceneButton.addEventListener("click", () => {
    void saveSelectedScene();
  });
  elements.deleteSceneButton.addEventListener("click", () => {
    void deleteSelectedScene();
  });
  elements.fileInput.addEventListener("change", () => {
    void importSelectedFile();
  });
  elements.addNodeButton.addEventListener("click", () => {
    addSelectedAssetToPrefab();
  });
  elements.addPrefabInstanceButton.addEventListener("click", () => {
    void addSelectedPrefabToScene();
  });
  elements.deleteAssetButton.addEventListener("click", () => {
    void deleteSelectedAsset();
  });
  elements.deleteSceneNodeButton.addEventListener("click", () => {
    deleteSelectedSceneNode();
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
    if (editorMode === "scene") {
      loadedSceneId = null;
    }
    renderEditorShell();
    exposeEditorDebugHooks();
  });
  threeViewport.setCallbacks({
    onSelectionChange: (nodeId) => {
      if (editorMode === "asset") {
        selectedPrefabNodeId = nodeId;
        syncSelectionFromPrefabNode();
      } else {
        selectedSceneNodeId = nodeId;
        syncSelectionFromSceneNode();
      }

      renderEditorShell();
      exposeEditorDebugHooks();
    },
    onObjectTransform: (nodeId) => {
      syncNodeFromViewport(nodeId);
      renderEditorShell();
      exposeEditorDebugHooks();
    },
    onCameraChange: () => {
      if (editorMode === "scene") {
        loadedSceneId = null;
      }
      renderInspector();
      exposeEditorDebugHooks();
    },
  });
}

async function refreshProjects(): Promise<void> {
  try {
    projects = await listProjects();
    const nextProjectId = chooseStableSelection(
      selectedProjectId,
      projects.map((project) => project.id),
    );

    if (selectedProjectId !== nextProjectId) {
      clearProjectWorkspace();
    }

    selectedProjectId = nextProjectId;
    await refreshAssets();
    await refreshPrefabs();
    await refreshScenes();
    lastImportError = null;
    hideError();
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

async function refreshPrefabs(): Promise<void> {
  if (!selectedProjectId) {
    prefabs = [];
    prefabDocuments = new Map();
    selectedPrefabId = null;
    loadedPrefabId = null;
    selectedPrefabNodeId = null;
    renderEditorShell();
    exposeEditorDebugHooks();
    return;
  }

  prefabs = await listPrefabs(selectedProjectId);
  const nextDocuments = new Map<string, PrefabDocument>();

  await Promise.all(
    prefabs.map(async (prefab) => {
      try {
        const detail = await getPrefab(selectedProjectId!, prefab.id);
        nextDocuments.set(prefab.id, detail.document);
      } catch (error) {
        console.error(error);
      }
    }),
  );

  prefabDocuments = nextDocuments;
  selectedPrefabId = chooseStableSelection(
    selectedPrefabId,
    prefabs.map((prefab) => prefab.id),
  );

  if (loadedPrefabId && !prefabs.some((prefab) => prefab.id === loadedPrefabId)) {
    loadedPrefabId = null;
    prefabNodes = [];
    selectedPrefabNodeId = null;
  }

  if (editorMode === "asset") {
    rebuildViewportProxies();
  }

  renderEditorShell();
  exposeEditorDebugHooks();
}

async function refreshScenes(): Promise<void> {
  if (!selectedProjectId) {
    scenes = [];
    selectedSceneId = null;
    loadedSceneId = null;
    renderEditorShell();
    exposeEditorDebugHooks();
    return;
  }

  scenes = await listScenes(selectedProjectId);
  selectedSceneId = chooseStableSelection(
    selectedSceneId,
    scenes.map((scene) => scene.id),
  );

  if (loadedSceneId && !scenes.some((scene) => scene.id === loadedSceneId)) {
    loadedSceneId = null;
  }

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
    clearProjectWorkspace();
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
    clearProjectWorkspace();
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
    rebuildViewportProxies();
  } catch (error) {
    setImportError(error);
  }
}

async function createPrefabFromInput(): Promise<void> {
  if (!selectedProjectId) {
    setImportError(new Error("Create or select a project before creating a prefab."));
    return;
  }

  const name = elements.prefabNameInput.value.trim();

  if (!name) {
    setImportError(new Error("Prefab name is required."));
    return;
  }

  try {
    const result = await createPrefab(
      selectedProjectId,
      name,
      createCurrentPrefabDocument(),
    );

    elements.prefabNameInput.value = "";
    selectedPrefabId = result.prefab.id;
    loadedPrefabId = result.prefab.id;
    applyPrefabDocument(result.document);
    prefabDocuments.set(result.prefab.id, result.document);
    lastImportError = null;
    hideError();
    await refreshPrefabs();
  } catch (error) {
    setImportError(error);
  }
}

async function loadSelectedPrefab(): Promise<void> {
  if (!selectedProjectId || !selectedPrefabId) {
    setImportError(new Error("Select a saved prefab before loading."));
    return;
  }

  try {
    const result = await getPrefab(selectedProjectId, selectedPrefabId);
    selectedPrefabId = result.prefab.id;
    loadedPrefabId = result.prefab.id;
    prefabDocuments.set(result.prefab.id, result.document);
    applyPrefabDocument(result.document);
    setEditorMode("asset");
    lastImportError = null;
    hideError();
  } catch (error) {
    setImportError(error);
  }
}

async function saveSelectedPrefab(): Promise<void> {
  if (!selectedProjectId || !selectedPrefabId) {
    setImportError(new Error("Select a saved prefab before saving."));
    return;
  }

  try {
    const result = await savePrefab(
      selectedProjectId,
      selectedPrefabId,
      createCurrentPrefabDocument(),
    );

    selectedPrefabId = result.prefab.id;
    loadedPrefabId = result.prefab.id;
    prefabDocuments.set(result.prefab.id, result.document);
    lastImportError = null;
    hideError();
    await refreshPrefabs();
  } catch (error) {
    setImportError(error);
  }
}

async function deleteSelectedPrefab(): Promise<void> {
  if (!selectedProjectId || !selectedPrefabId) {
    return;
  }

  try {
    const deletedPrefabId = selectedPrefabId;
    await deletePrefab(selectedProjectId, deletedPrefabId);
    prefabDocuments.delete(deletedPrefabId);

    if (loadedPrefabId === deletedPrefabId) {
      prefabNodes = [];
      selectedPrefabNodeId = null;
      loadedPrefabId = null;
    }

    selectedPrefabId = null;
    lastImportError = null;
    hideError();
    await refreshPrefabs();
    rebuildViewportProxies();
  } catch (error) {
    setImportError(error);
  }
}

function createPrefabGroup(): void {
  if (!selectedProjectId) {
    setImportError(new Error("Create or select a project before editing a prefab."));
    return;
  }

  const nodeNumber = nextPrefabNodeNumber;
  const node: PrefabNode = {
    id: `prefab-node-${nodeNumber}`,
    kind: "group",
    parentId: getParentIdForNewPrefabNode(),
    name: `Group ${nodeNumber}`,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    billboardMode: "spherical",
  };

  nextPrefabNodeNumber += 1;
  prefabNodes = [...prefabNodes, node];
  selectedPrefabNodeId = node.id;
  loadedPrefabId = null;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function addSelectedAssetToPrefab(): void {
  const selectedAsset = getSelectedAsset();

  if (!selectedProjectId || !selectedAsset) {
    setImportError(new Error("Select an SVG primitive asset before adding it."));
    return;
  }

  const node: PrefabNode = {
    id: `prefab-node-${nextPrefabNodeNumber}`,
    kind: "primitive",
    parentId: getParentIdForNewPrefabNode(),
    assetId: selectedAsset.id,
    name: selectedAsset.name,
    position: [0, 1, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    billboardMode: "spherical",
  };

  nextPrefabNodeNumber += 1;
  prefabNodes = [...prefabNodes, node];
  selectedPrefabNodeId = node.id;
  selectedAssetId = selectedAsset.id;
  loadedPrefabId = null;
  lastImportError = null;
  hideError();
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function deleteSelectedPrefabNode(): void {
  if (!selectedPrefabNodeId) {
    return;
  }

  const deletedNodeIds = getPrefabNodeAndDescendantIds(selectedPrefabNodeId);
  prefabNodes = prefabNodes.filter((node) => !deletedNodeIds.has(node.id));
  selectedPrefabNodeId = null;
  loadedPrefabId = null;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

async function addSelectedPrefabToScene(): Promise<void> {
  if (!selectedProjectId || !selectedPrefabId) {
    setImportError(new Error("Select a prefab before adding a scene instance."));
    return;
  }

  if (!prefabDocuments.has(selectedPrefabId)) {
    const result = await getPrefab(selectedProjectId, selectedPrefabId);
    prefabDocuments.set(result.prefab.id, result.document);
  }

  const node: ScenePrefabInstanceNode = {
    id: `node-${nextSceneNodeNumber}`,
    kind: "prefabInstance",
    prefabId: selectedPrefabId,
    position: [0, 1, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };

  nextSceneNodeNumber += 1;
  sceneNodes = [...sceneNodes, node];
  selectedSceneNodeId = node.id;
  loadedSceneId = null;
  setEditorMode("scene");
  lastImportError = null;
  hideError();
}

async function createSceneFromInput(source: SceneCreateSource): Promise<void> {
  if (!selectedProjectId) {
    setImportError(new Error("Create or select a project before creating a scene."));
    return;
  }

  const name = elements.sceneNameInput.value.trim();

  if (!name) {
    setImportError(new Error("Scene name is required."));
    return;
  }

  try {
    const result = await createScene(
      selectedProjectId,
      name,
      source === "empty" ? createEmptySceneDocument() : createCurrentSceneDocument(),
    );

    elements.sceneNameInput.value = "";
    selectedSceneId = result.scene.id;
    loadedSceneId = result.scene.id;
    applySceneDocument(result.document);
    setEditorMode("scene");
    lastImportError = null;
    hideError();
    await refreshScenes();
  } catch (error) {
    setImportError(error);
  }
}

async function saveSelectedScene(): Promise<void> {
  if (!selectedProjectId || !selectedSceneId) {
    setImportError(new Error("Select a saved scene before saving."));
    return;
  }

  try {
    const result = await saveScene(
      selectedProjectId,
      selectedSceneId,
      createCurrentSceneDocument(),
    );

    selectedSceneId = result.scene.id;
    loadedSceneId = result.scene.id;
    lastImportError = null;
    hideError();
    await refreshScenes();
  } catch (error) {
    setImportError(error);
  }
}

async function loadSelectedScene(): Promise<void> {
  if (!selectedProjectId || !selectedSceneId) {
    setImportError(new Error("Select a saved scene before loading."));
    return;
  }

  try {
    const result = await getScene(selectedProjectId, selectedSceneId);
    applySceneDocument(result.document);
    selectedSceneId = result.scene.id;
    loadedSceneId = result.scene.id;
    setEditorMode("scene");
    lastImportError = null;
    hideError();
  } catch (error) {
    setImportError(error);
  }
}

async function deleteSelectedScene(): Promise<void> {
  if (!selectedProjectId || !selectedSceneId) {
    return;
  }

  try {
    const deletedSceneId = selectedSceneId;
    await deleteScene(selectedProjectId, deletedSceneId);

    if (loadedSceneId === deletedSceneId) {
      clearSceneLayout();
    }

    selectedSceneId = null;
    lastImportError = null;
    hideError();
    await refreshScenes();
  } catch (error) {
    setImportError(error);
  }
}

function deleteSelectedSceneNode(): void {
  if (!selectedSceneNodeId) {
    return;
  }

  sceneNodes = sceneNodes.filter((node) => node.id !== selectedSceneNodeId);
  selectedSceneNodeId = null;
  loadedSceneId = null;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function toggleProjection(): void {
  threeViewport.toggleProjection();
  if (editorMode === "scene") {
    loadedSceneId = null;
  }
  renderEditorShell();
  exposeEditorDebugHooks();
}

function setTransformMode(mode: TransformMode): void {
  threeViewport.setTransformMode(mode);
  renderEditorShell();
  exposeEditorDebugHooks();
}

function setEditorMode(mode: EditorMode): void {
  editorMode = mode;
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function clearProjectWorkspace(): void {
  assets = [];
  prefabs = [];
  prefabDocuments = new Map();
  scenes = [];
  prefabNodes = [];
  sceneNodes = [];
  selectedAssetId = null;
  selectedPrefabId = null;
  loadedPrefabId = null;
  selectedPrefabNodeId = null;
  selectedSceneId = null;
  loadedSceneId = null;
  selectedSceneNodeId = null;
  nextPrefabNodeNumber = 1;
  nextSceneNodeNumber = 1;
  threeViewport.clearNodes();
}

function clearSceneLayout(): void {
  sceneNodes = [];
  selectedSceneNodeId = null;
  loadedSceneId = null;
  nextSceneNodeNumber = 1;

  if (editorMode === "scene") {
    rebuildViewportProxies();
  }
}

function createCurrentPrefabDocument(): PrefabDocument {
  return {
    version: 1,
    nodes: prefabNodes.map(clonePrefabNode),
  };
}

function applyPrefabDocument(document: PrefabDocument): void {
  prefabNodes = document.nodes.map(clonePrefabNode);
  selectedPrefabNodeId = prefabNodes[0]?.id ?? null;
  nextPrefabNodeNumber = getNextNodeNumber(
    prefabNodes.map((node) => node.id),
    "prefab-node",
  );
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function createCurrentSceneDocument(): SceneDocument {
  return {
    version: 2,
    camera: threeViewport.getCameraSnapshot(),
    nodes: sceneNodes.map(cloneSceneNode),
    animation: {
      fps: 24,
      activeClipId: null,
      clips: [],
    },
  };
}

function createEmptySceneDocument(): SceneDocument {
  return {
    version: 2,
    camera: threeViewport.getDefaultCameraSnapshot(),
    nodes: [],
    animation: {
      fps: 24,
      activeClipId: null,
      clips: [],
    },
  };
}

function applySceneDocument(document: SceneDocument): void {
  threeViewport.applyCameraSnapshot(document.camera);
  sceneNodes = document.nodes.map(cloneSceneNode);
  selectedSceneNodeId = sceneNodes[0]?.id ?? null;
  nextSceneNodeNumber = getNextNodeNumber(
    sceneNodes.map((node) => node.id),
    "node",
  );
  rebuildViewportProxies();
  renderEditorShell();
  exposeEditorDebugHooks();
}

function rebuildViewportProxies(): void {
  threeViewport.clearNodes();

  if (!selectedProjectId) {
    return;
  }

  if (editorMode === "asset") {
    const worldTransforms = getPrefabWorldTransforms(prefabNodes);

    for (const node of prefabNodes) {
      const worldTransform = matrixToTransform(
        worldTransforms.get(node.id) ?? transformToMatrix(node),
      );
      const proxyNode: EditorTransformNode = {
        id: node.id,
        ...worldTransform,
      };
      const asset =
        node.kind === "primitive" && node.assetId
          ? getAssetById(node.assetId)
          : null;
      threeViewport.addOrUpdateNode(proxyNode, asset ?? undefined);
    }

    threeViewport.setSelectedNode(selectedPrefabNodeId);
    return;
  }

  for (const node of sceneNodes) {
    const asset = node.kind === "primitive" ? getAssetById(node.assetId) : null;
    threeViewport.addOrUpdateNode(node, asset ?? undefined);
  }

  threeViewport.setSelectedNode(selectedSceneNodeId);
}

function syncNodeFromViewport(nodeId: string): void {
  if (editorMode === "asset") {
    const node = getPrefabNode(nodeId);

    if (!node) {
      return;
    }

    const worldNode: EditorTransformNode = {
      id: node.id,
      position: [...node.position],
      rotation: [...node.rotation],
      scale: [...node.scale],
    };

    threeViewport.syncNodeFromProxy(worldNode);
    applyWorldTransformToPrefabNode(node, worldNode);
    loadedPrefabId = null;

    /**
     * TransformControls fires continuously while the user drags a handle. Do
     * not rebuild the proxy scene here: clearing and recreating the selected
     * Three object detaches the active handle and makes group dragging feel like
     * it stops after a tiny movement. Instead, keep the selected proxy alive and
     * only refresh the world-space transforms of the other prefab proxies.
     */
    syncPrefabProxyWorldTransforms(node.id);

    return;
  }

  const node = getSceneNode(nodeId);

  if (!node) {
    return;
  }

  threeViewport.syncNodeFromProxy(node);
  loadedSceneId = null;
}

function syncSelectionFromPrefabNode(): void {
  const node = selectedPrefabNodeId ? getPrefabNode(selectedPrefabNodeId) : null;

  if (node?.kind === "primitive" && node.assetId) {
    selectedAssetId = node.assetId;
  }
}

function syncSelectionFromSceneNode(): void {
  const node = selectedSceneNodeId ? getSceneNode(selectedSceneNodeId) : null;

  if (!node) {
    return;
  }

  if (node.kind === "primitive") {
    selectedAssetId = node.assetId;
  } else {
    selectedPrefabId = node.prefabId;
  }
}

function syncPrefabProxyWorldTransforms(exceptNodeId: string | null = null): void {
  const worldTransforms = getPrefabWorldTransforms(prefabNodes);

  for (const node of prefabNodes) {
    if (node.id === exceptNodeId) {
      continue;
    }

    const worldTransform = worldTransforms.get(node.id);

    if (!worldTransform) {
      continue;
    }

    threeViewport.syncProxyFromNode({
      id: node.id,
      ...matrixToTransform(worldTransform),
    });
  }
}

function getEditorElements(): EditorElements {
  return {
    assetModeButton: getRequiredElement("asset-mode-button", HTMLButtonElement),
    sceneModeButton: getRequiredElement("scene-mode-button", HTMLButtonElement),
    assetModePanel: getRequiredElement("asset-mode-panel", HTMLElement),
    sceneModePanel: getRequiredElement("scene-mode-panel", HTMLElement),
    projectForm: getRequiredElement("project-form", HTMLFormElement),
    projectNameInput: getRequiredElement("project-name-input", HTMLInputElement),
    projectList: getRequiredElement("project-list", HTMLUListElement),
    deleteProjectButton: getRequiredElement(
      "delete-project-button",
      HTMLButtonElement,
    ),
    prefabNameInput: getRequiredElement("prefab-name-input", HTMLInputElement),
    prefabList: getRequiredElement("prefab-list", HTMLUListElement),
    createPrefabButton: getRequiredElement(
      "create-prefab-button",
      HTMLButtonElement,
    ),
    loadPrefabButton: getRequiredElement("load-prefab-button", HTMLButtonElement),
    savePrefabButton: getRequiredElement("save-prefab-button", HTMLButtonElement),
    deletePrefabButton: getRequiredElement(
      "delete-prefab-button",
      HTMLButtonElement,
    ),
    prefabNodeList: getRequiredElement("prefab-node-list", HTMLUListElement),
    createPrefabGroupButton: getRequiredElement(
      "create-prefab-group-button",
      HTMLButtonElement,
    ),
    deletePrefabNodeButton: getRequiredElement(
      "delete-prefab-node-button",
      HTMLButtonElement,
    ),
    sceneNameInput: getRequiredElement("scene-name-input", HTMLInputElement),
    sceneList: getRequiredElement("scene-list", HTMLUListElement),
    createSceneButton: getRequiredElement(
      "create-scene-button",
      HTMLButtonElement,
    ),
    cloneSceneButton: getRequiredElement(
      "clone-scene-button",
      HTMLButtonElement,
    ),
    loadSceneButton: getRequiredElement("load-scene-button", HTMLButtonElement),
    saveSceneButton: getRequiredElement("save-scene-button", HTMLButtonElement),
    deleteSceneButton: getRequiredElement(
      "delete-scene-button",
      HTMLButtonElement,
    ),
    fileInput: getRequiredElement("svg-file-input", HTMLInputElement),
    assetList: getRequiredElement("asset-list", HTMLUListElement),
    addNodeButton: getRequiredElement("add-node-button", HTMLButtonElement),
    addPrefabInstanceButton: getRequiredElement(
      "add-prefab-instance-button",
      HTMLButtonElement,
    ),
    deleteAssetButton: getRequiredElement(
      "delete-asset-button",
      HTMLButtonElement,
    ),
    sceneNodeList: getRequiredElement("scene-node-list", HTMLUListElement),
    deleteSceneNodeButton: getRequiredElement(
      "delete-scene-node-button",
      HTMLButtonElement,
    ),
    projectionToggleButton: getRequiredElement(
      "projection-toggle-button",
      HTMLButtonElement,
    ),
    transformTranslateButton: getRequiredElement(
      "transform-translate-button",
      HTMLButtonElement,
    ),
    transformRotateButton: getRequiredElement(
      "transform-rotate-button",
      HTMLButtonElement,
    ),
    transformScaleButton: getRequiredElement(
      "transform-scale-button",
      HTMLButtonElement,
    ),
    resetViewButton: getRequiredElement("reset-view-button", HTMLButtonElement),
    importError: getRequiredElement("import-error", HTMLParagraphElement),
    inspectorFields: getRequiredElement("inspector-fields", HTMLDListElement),
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
  renderPrefabList();
  renderPrefabNodeList();
  renderSceneList();
  renderSceneNodeList();
  renderInspector();
  elements.assetModePanel.hidden = editorMode !== "asset";
  elements.sceneModePanel.hidden = editorMode !== "scene";
  elements.assetModeButton.dataset.selected = String(editorMode === "asset");
  elements.sceneModeButton.dataset.selected = String(editorMode === "scene");
  elements.fileInput.disabled = !selectedProjectId;
  elements.deleteProjectButton.disabled = !selectedProjectId;
  elements.prefabNameInput.disabled = !selectedProjectId;
  elements.createPrefabButton.disabled = !selectedProjectId;
  elements.loadPrefabButton.disabled = !selectedProjectId || !selectedPrefabId;
  elements.savePrefabButton.disabled = !selectedProjectId || !selectedPrefabId;
  elements.deletePrefabButton.disabled = !selectedProjectId || !selectedPrefabId;
  elements.createPrefabGroupButton.disabled = !selectedProjectId;
  elements.deletePrefabNodeButton.disabled = !selectedPrefabNodeId;
  elements.sceneNameInput.disabled = !selectedProjectId;
  elements.createSceneButton.disabled = !selectedProjectId;
  elements.cloneSceneButton.disabled = !selectedProjectId;
  elements.loadSceneButton.disabled = !selectedProjectId || !selectedSceneId;
  elements.saveSceneButton.disabled = !selectedProjectId || !selectedSceneId;
  elements.deleteSceneButton.disabled = !selectedProjectId || !selectedSceneId;
  elements.addNodeButton.disabled = !selectedProjectId || !selectedAssetId;
  elements.addPrefabInstanceButton.disabled = !selectedProjectId || !selectedPrefabId;
  elements.deleteAssetButton.disabled = !selectedProjectId || !selectedAssetId;
  elements.deleteSceneNodeButton.disabled = !selectedSceneNodeId;
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
          clearProjectWorkspace();
        }

        selectedProjectId = project.id;
        void refreshAssets();
        void refreshPrefabs();
        void refreshScenes();
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

function renderPrefabList(): void {
  elements.prefabList.replaceChildren(
    ...prefabs.map((prefab) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const loadedMarker = prefab.id === loadedPrefabId ? " *" : "";

      button.type = "button";
      button.className = "asset-list-item";
      button.dataset.prefabId = prefab.id;
      button.dataset.selected = String(prefab.id === selectedPrefabId);
      button.textContent = `${prefab.name}${loadedMarker}`;
      button.addEventListener("click", () => {
        selectedPrefabId = prefab.id;
        renderEditorShell();
        exposeEditorDebugHooks();
      });

      item.append(button);
      return item;
    }),
  );
}

function renderPrefabNodeList(): void {
  elements.prefabNodeList.replaceChildren(
    ...getPrefabNodeTreeEntries().map(({ node, depth }) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const asset =
        node.kind === "primitive" && node.assetId
          ? getAssetById(node.assetId)
          : null;
      const label =
        node.kind === "group"
          ? `Group: ${node.name}`
          : `Primitive: ${asset?.name ?? `Missing ${node.assetId ?? "asset id"}`}`;

      button.type = "button";
      button.className = "asset-list-item";
      button.dataset.prefabNodeId = node.id;
      button.dataset.selected = String(node.id === selectedPrefabNodeId);
      button.style.paddingLeft = `${12 + depth * 14}px`;
      button.textContent = label;
      button.addEventListener("click", () => {
        selectedPrefabNodeId = node.id;
        syncSelectionFromPrefabNode();
        if (editorMode === "asset") {
          threeViewport.setSelectedNode(node.id);
        }
        renderEditorShell();
        exposeEditorDebugHooks();
      });

      item.append(button);
      return item;
    }),
  );
}

function renderSceneList(): void {
  elements.sceneList.replaceChildren(
    ...scenes.map((scene) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const loadedMarker = scene.id === loadedSceneId ? " *" : "";

      button.type = "button";
      button.className = "asset-list-item";
      button.dataset.sceneId = scene.id;
      button.dataset.selected = String(scene.id === selectedSceneId);
      button.textContent = `${scene.name}${loadedMarker}`;
      button.addEventListener("click", () => {
        selectedSceneId = scene.id;
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

      button.type = "button";
      button.className = "asset-list-item";
      button.dataset.nodeId = node.id;
      button.dataset.selected = String(node.id === selectedSceneNodeId);
      button.textContent = getSceneNodeLabel(node);
      button.addEventListener("click", () => {
        selectedSceneNodeId = node.id;
        syncSelectionFromSceneNode();
        if (editorMode === "scene") {
          threeViewport.setSelectedNode(node.id);
        }
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
  const camera = threeViewport.getCameraSnapshot();

  if (!selectedProject) {
    appendInspectorRow("Status", "Create or select a project");
    return;
  }

  appendInspectorRow("Mode", editorMode === "asset" ? "Asset Assembly" : "Scene Layout");
  appendInspectorRow("Project", selectedProject.name);
  appendInspectorRow("Project ID", selectedProject.id);
  appendInspectorRow("Projection", camera.projection);
  appendInspectorRow("Camera Pos", camera.position.join(", "));
  appendInspectorRow("Camera Target", camera.target.join(", "));

  if (editorMode === "asset") {
    renderAssetModeInspector();
  } else {
    renderSceneModeInspector();
  }
}

function renderAssetModeInspector(): void {
  const selectedPrefab = getSelectedPrefab();
  const selectedNode = selectedPrefabNodeId ? getPrefabNode(selectedPrefabNodeId) : null;
  const inspectedAsset =
    selectedNode?.kind === "primitive" && selectedNode.assetId
      ? getAssetById(selectedNode.assetId)
      : getSelectedAsset();

  appendInspectorRow("Selected Prefab", selectedPrefab?.name ?? "None");
  appendInspectorRow("Loaded Prefab", loadedPrefabId ?? "None");
  appendAssetInspectorRows(inspectedAsset);

  if (!selectedNode) {
    appendInspectorRow("Prefab Node", "No node selected");
    return;
  }

  appendInspectorRow("Prefab Node", selectedNode.id);
  appendInspectorRow("Node Name", selectedNode.name);
  appendInspectorRow("Kind", selectedNode.kind);
  appendInspectorRow("Parent", selectedNode.parentId ?? "Root");

  if (selectedNode.kind === "primitive") {
    const assetId = selectedNode.assetId ?? "Missing asset id";
    appendInspectorRow("Node Asset", assetId);
    if (!selectedNode.assetId || !getAssetById(selectedNode.assetId)) {
      appendInspectorRow("Missing Asset", assetId);
    }
  }

  appendTransformInspectorRow("Position", selectedNode, "position");
  appendTransformInspectorRow("Rotation", selectedNode, "rotation");
  appendTransformInspectorRow("Scale", selectedNode, "scale");
  appendInspectorRow("Billboard", selectedNode.billboardMode);
}

function renderSceneModeInspector(): void {
  const selectedScene = getSelectedScene();
  const selectedNode = selectedSceneNodeId ? getSceneNode(selectedSceneNodeId) : null;

  appendInspectorRow("Selected Scene", selectedScene?.name ?? "None");
  appendInspectorRow("Loaded Scene", loadedSceneId ?? "None");

  if (!selectedNode) {
    appendInspectorRow("Scene Node", "No node selected");
    return;
  }

  appendInspectorRow("Scene Node", selectedNode.id);
  appendInspectorRow("Kind", selectedNode.kind);

  if (selectedNode.kind === "primitive") {
    const asset = getAssetById(selectedNode.assetId);

    appendAssetInspectorRows(asset);
    appendInspectorRow("Node Asset", selectedNode.assetId);
    if (!asset) {
      appendInspectorRow("Missing Asset", selectedNode.assetId);
    }
    appendInspectorRow("Billboard", selectedNode.billboardMode);
  } else {
    const prefab = getPrefabRecordById(selectedNode.prefabId);

    appendInspectorRow("Prefab", prefab?.name ?? "Missing Prefab");
    appendInspectorRow("Prefab ID", selectedNode.prefabId);
    if (!getPrefabDocumentById(selectedNode.prefabId)) {
      appendInspectorRow("Missing Prefab", selectedNode.prefabId);
    }
  }

  appendTransformInspectorRow("Position", selectedNode, "position");
  appendTransformInspectorRow("Rotation", selectedNode, "rotation");
  appendTransformInspectorRow("Scale", selectedNode, "scale");
}

function appendAssetInspectorRows(asset: PrimitiveSvgAsset | null): void {
  if (!asset) {
    appendInspectorRow("Asset", "No primitive selected");
    return;
  }

  appendInspectorRow("Asset ID", asset.id);
  appendInspectorRow("Name", asset.name);
  appendInspectorRow("Source", asset.sourceUrl);
  appendInspectorRow("ViewBox", asset.viewBox.join(", "));
  appendInspectorRow("Fill", asset.fill);
  appendInspectorRow("Fill Rule", asset.fillRule);
  appendInspectorRow("Path Length", `${asset.pathD.length} chars`);
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
  node: EditorTransformNode,
  property: TransformProperty,
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
  property: TransformProperty,
  axisIndex: number,
): void {
  const node = getActiveTransformNode(nodeId);
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

  if (editorMode === "asset") {
    loadedPrefabId = null;
    rebuildViewportProxies();
  } else {
    loadedSceneId = null;
    threeViewport.syncProxyFromNode(node);
  }

  renderEditorShell();
  exposeEditorDebugHooks();
}

function restoreTransformInput(
  input: HTMLInputElement,
  node: EditorTransformNode | null,
  property: TransformProperty,
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

  if (editorMode === "asset") {
    const drawables = getAssetAssemblyBillboards();

    if (drawables.length > 0) {
      drawBillboards(context, drawables);
      return;
    }

    const selectedAsset = getSelectedAsset();
    if (selectedAsset) {
      drawPrimitivePreview(context, stage.size, selectedAsset);
      return;
    }

    drawCenteredStatus(context, stage.size, "Import SVG primitives and assemble a prefab");
    return;
  }

  const drawables = getSceneLayoutBillboards();

  if (drawables.length === 0) {
    drawCenteredStatus(context, stage.size, "Add a prefab instance to the scene");
    return;
  }

  drawBillboards(context, drawables);
}

function getAssetAssemblyBillboards(): DrawableBillboard[] {
  return flattenPrefabBillboards(
    prefabNodes,
    new Matrix4(),
    (nodeId) => nodeId === selectedPrefabNodeId,
  );
}

function getSceneLayoutBillboards(): DrawableBillboard[] {
  const drawables: DrawableBillboard[] = [];

  for (const node of sceneNodes) {
    if (node.kind === "primitive") {
      const asset = getAssetById(node.assetId);

      if (asset) {
        drawables.push({
          id: node.id,
          asset,
          transform: cloneTransform(node),
          selected: node.id === selectedSceneNodeId,
        });
      }

      continue;
    }

    const document = getPrefabDocumentById(node.prefabId);

    if (!document) {
      continue;
    }

    drawables.push(
      ...flattenPrefabBillboards(
        document.nodes,
        transformToMatrix(node),
        () => node.id === selectedSceneNodeId,
        `${node.id}/`,
      ),
    );
  }

  return drawables;
}

function flattenPrefabBillboards(
  nodes: PrefabNode[],
  baseMatrix: Matrix4,
  isSelected: (nodeId: string) => boolean,
  idPrefix = "",
): DrawableBillboard[] {
  const worldTransforms = getPrefabWorldTransforms(nodes, baseMatrix);
  const drawables: DrawableBillboard[] = [];

  for (const node of nodes) {
    if (node.kind !== "primitive") {
      continue;
    }

    const asset = node.assetId ? getAssetById(node.assetId) : null;
    const matrix = worldTransforms.get(node.id);

    if (!asset || !matrix) {
      continue;
    }

    drawables.push({
      id: `${idPrefix}${node.id}`,
      asset,
      transform: matrixToTransform(matrix),
      selected: isSelected(node.id),
    });
  }

  return drawables;
}

function drawBillboards(
  context: CanvasRenderingContext2D,
  drawables: DrawableBillboard[],
): void {
  const sortedDrawables = drawables
    .map((drawable) => {
      const worldPosition = tupleToVector(drawable.transform.position);
      const projected = threeViewport.projectWorldPosition(worldPosition, stage.size);

      if (!projected) {
        return null;
      }

      return {
        ...drawable,
        projected,
        screenScale: threeViewport.getDistanceScale(worldPosition, 1),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => b.projected.depth - a.projected.depth);

  for (const drawable of sortedDrawables) {
    drawBillboardNode(context, drawable);
  }
}

function drawBillboardNode(
  context: CanvasRenderingContext2D,
  drawable: DrawableBillboard & {
    projected: { x: number; y: number };
    screenScale: number;
  },
): void {
  const { asset, transform, projected, screenScale, selected } = drawable;
  const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] = asset.viewBox;
  const largestDimension = Math.max(viewBoxWidth, viewBoxHeight);
  const assetScale = screenScale / largestDimension;

  context.save();
  context.translate(projected.x, projected.y);
  context.rotate(transform.rotation[2]);
  context.scale(assetScale * transform.scale[0], assetScale * transform.scale[1]);
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

function getSelectedProject(): ProjectRecord | null {
  return projects.find((project) => project.id === selectedProjectId) ?? null;
}

function getSelectedAsset(): PrimitiveSvgAsset | null {
  return selectedAssetId ? getAssetById(selectedAssetId) : null;
}

function getSelectedPrefab(): PrefabRecord | null {
  return selectedPrefabId ? getPrefabRecordById(selectedPrefabId) : null;
}

function getSelectedScene(): SceneRecord | null {
  return scenes.find((scene) => scene.id === selectedSceneId) ?? null;
}

function getAssetById(assetId: string): PrimitiveSvgAsset | null {
  return assets.find((asset) => asset.id === assetId) ?? null;
}

function getPrefabRecordById(prefabId: string): PrefabRecord | null {
  return prefabs.find((prefab) => prefab.id === prefabId) ?? null;
}

function getPrefabDocumentById(prefabId: string): PrefabDocument | null {
  if (prefabId === loadedPrefabId) {
    return createCurrentPrefabDocument();
  }

  return prefabDocuments.get(prefabId) ?? null;
}

function getPrefabNode(nodeId: string): PrefabNode | null {
  return prefabNodes.find((node) => node.id === nodeId) ?? null;
}

function getSceneNode(nodeId: string): SceneNode | null {
  return sceneNodes.find((node) => node.id === nodeId) ?? null;
}

function getActiveTransformNode(nodeId: string): EditorTransformNode | null {
  if (editorMode === "asset") {
    return getPrefabNode(nodeId);
  }

  return getSceneNode(nodeId);
}

function getParentIdForNewPrefabNode(): string | null {
  const selectedNode = selectedPrefabNodeId ? getPrefabNode(selectedPrefabNodeId) : null;

  return selectedNode?.kind === "group" ? selectedNode.id : null;
}

function getPrefabNodeAndDescendantIds(rootNodeId: string): Set<string> {
  const ids = new Set<string>([rootNodeId]);
  let changed = true;

  while (changed) {
    changed = false;

    for (const node of prefabNodes) {
      if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
        ids.add(node.id);
        changed = true;
      }
    }
  }

  return ids;
}

function getPrefabNodeTreeEntries(): PrefabNodeTreeEntry[] {
  const entries: PrefabNodeTreeEntry[] = [];
  const childrenByParent = new Map<string | null, PrefabNode[]>();

  for (const node of prefabNodes) {
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }

  function appendChildren(parentId: string | null, depth: number): void {
    for (const node of childrenByParent.get(parentId) ?? []) {
      entries.push({ node, depth });
      appendChildren(node.id, depth + 1);
    }
  }

  appendChildren(null, 0);
  return entries;
}

function getSceneNodeLabel(node: SceneNode): string {
  if (node.kind === "primitive") {
    const asset = getAssetById(node.assetId);
    return asset
      ? `${node.id} Primitive: ${asset.name}`
      : `${node.id} Primitive: Missing ${node.assetId}`;
  }

  const prefab = getPrefabRecordById(node.prefabId);
  return prefab
    ? `${node.id} Prefab: ${prefab.name}`
    : `${node.id} Prefab: Missing ${node.prefabId}`;
}

function getPrefabWorldTransforms(
  nodes: PrefabNode[],
  baseMatrix = new Matrix4(),
): Map<string, Matrix4> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const cache = new Map<string, Matrix4>();

  function resolve(node: PrefabNode): Matrix4 {
    const cached = cache.get(node.id);

    if (cached) {
      return cached.clone();
    }

    const local = transformToMatrix(node);
    const parent = node.parentId ? nodeById.get(node.parentId) : null;
    const world = parent
      ? resolve(parent).multiply(local)
      : baseMatrix.clone().multiply(local);

    cache.set(node.id, world.clone());
    return world;
  }

  for (const node of nodes) {
    resolve(node);
  }

  return cache;
}

function applyWorldTransformToPrefabNode(
  node: PrefabNode,
  worldTransform: EditorTransformNode,
): void {
  const worldMatrix = transformToMatrix(worldTransform);
  const parent = node.parentId ? getPrefabNode(node.parentId) : null;

  if (!parent) {
    node.position = [...worldTransform.position];
    node.rotation = [...worldTransform.rotation];
    node.scale = [...worldTransform.scale];
    return;
  }

  const parentWorldMatrix =
    getPrefabWorldTransforms(prefabNodes).get(parent.id) ?? transformToMatrix(parent);
  const localMatrix = parentWorldMatrix.clone().invert().multiply(worldMatrix);
  const localTransform = matrixToTransform(localMatrix);

  node.position = localTransform.position;
  node.rotation = localTransform.rotation;
  node.scale = localTransform.scale;
}

function transformToMatrix(transform: TransformSnapshot): Matrix4 {
  const position = tupleToVector(transform.position);
  const rotation = new Quaternion().setFromEuler(
    new Euler(transform.rotation[0], transform.rotation[1], transform.rotation[2], "XYZ"),
  );
  const scale = tupleToVector(transform.scale);

  return new Matrix4().compose(position, rotation, scale);
}

function matrixToTransform(matrix: Matrix4): TransformSnapshot {
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();

  matrix.decompose(position, rotation, scale);

  return {
    position: vectorToTuple(position),
    rotation: eulerToTuple(new Euler().setFromQuaternion(rotation, "XYZ")),
    scale: vectorToTuple(scale),
  };
}

function cloneTransform(transform: TransformSnapshot): TransformSnapshot {
  return {
    position: [...transform.position],
    rotation: [...transform.rotation],
    scale: [...transform.scale],
  };
}

function clonePrefabNode(node: PrefabNode): PrefabNode {
  if (node.kind === "group") {
    return {
      id: node.id,
      kind: "group",
      parentId: node.parentId,
      name: node.name,
      position: [...node.position],
      rotation: [...node.rotation],
      scale: [...node.scale],
      billboardMode: node.billboardMode,
    };
  }

  return {
    id: node.id,
    kind: "primitive",
    parentId: node.parentId,
    assetId: node.assetId,
    name: node.name,
    position: [...node.position],
    rotation: [...node.rotation],
    scale: [...node.scale],
    billboardMode: node.billboardMode,
  };
}

function cloneSceneNode(node: SceneNode): SceneNode {
  if (node.kind === "primitive") {
    const primitiveNode: ScenePrimitiveNode = {
      id: node.id,
      kind: "primitive",
      assetId: node.assetId,
      position: [...node.position],
      rotation: [...node.rotation],
      scale: [...node.scale],
      billboardMode: node.billboardMode,
    };

    return primitiveNode;
  }

  const prefabInstanceNode: ScenePrefabInstanceNode = {
    id: node.id,
    kind: "prefabInstance",
    prefabId: node.prefabId,
    position: [...node.position],
    rotation: [...node.rotation],
    scale: [...node.scale],
  };

  return prefabInstanceNode;
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

function getNextNodeNumber(ids: string[], prefix: string): number {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}-(\\d+)$`);
  const largestExistingNumber = ids.reduce((largest, id) => {
    const match = pattern.exec(id);
    const value = match ? Number(match[1]) : 0;

    return Number.isFinite(value) ? Math.max(largest, value) : largest;
  }, 0);

  return largestExistingNumber + 1;
}

function formatTransformValue(value: number): string {
  return String(roundTransformValue(value));
}

function roundTransformValue(value: number): number {
  return Number(value.toFixed(4));
}

function vectorToTuple(value: Vector3): Vector3Tuple {
  return [roundTransformValue(value.x), roundTransformValue(value.y), roundTransformValue(value.z)];
}

function eulerToTuple(value: Euler): Vector3Tuple {
  return [roundTransformValue(value.x), roundTransformValue(value.y), roundTransformValue(value.z)];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
    getPrefabs: () => [...prefabs],
    getPrefabAssembly: () => ({
      nodes: prefabNodes.map(clonePrefabNode),
      selectedPrefabId,
      loadedPrefabId,
      selectedPrefabNodeId,
    }),
    getExperimentScene: () => {
      const camera = threeViewport.getCameraSnapshot();

      return {
        camera: {
          projection: camera.projection,
          position: camera.position,
          target: camera.target,
          fov: camera.fov,
          zoom: camera.zoom,
          near: camera.near,
          far: camera.far,
        },
        nodes: sceneNodes.map(cloneSceneNode),
        selectedNodeId: selectedSceneNodeId,
        transformMode: threeViewport.currentTransformMode,
      };
    },
    getScenes: () => [...scenes],
    getEditorMode: () => editorMode,
    getSelectedProjectId: () => selectedProjectId,
    getSelectedAssetId: () => selectedAssetId,
    getSelectedPrefabId: () => selectedPrefabId,
    getLoadedPrefabId: () => loadedPrefabId,
    getSelectedSceneId: () => selectedSceneId,
    getLoadedSceneId: () => loadedSceneId,
    getLastImportError: () => lastImportError,
  };
}
