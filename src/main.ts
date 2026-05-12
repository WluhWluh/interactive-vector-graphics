import "./styles.css";
import {
  PrimitiveAssetRegistry,
  type PrimitiveSvgAsset,
} from "./core/assets/primitiveSvg";

type StageLayerId = "three-canvas" | "vector-canvas" | "paper-canvas";

type StageLayer = {
  id: StageLayerId;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
};

type StageSize = {
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  dpr: number;
};

const LAYER_IDS: StageLayerId[] = [
  "three-canvas",
  "vector-canvas",
  "paper-canvas",
];

const MAX_DEVICE_PIXEL_RATIO = 2;
const MIN_STAGE_WIDTH = 1;
const PRIMITIVE_ASSET_MANIFEST_URL = "/assets/primitive-assets.json";
const DEMO_ASSET_ID = "demo-face";

type AssetLoadState =
  | {
      status: "loading";
    }
  | {
      status: "ready";
      asset: PrimitiveSvgAsset;
    }
  | {
      status: "error";
      message: string;
    };
const MIN_STAGE_HEIGHT = 1;

/**
 * This first foundation intentionally keeps every layer backed by a 2D canvas.
 * The Three.js layer is still named and ordered now, but we will only replace
 * its backing context with a WebGL renderer when a real 3D/background experiment
 * needs it. That keeps the base project understandable and avoids pulling the
 * rendering architecture forward too early.
 */
const layers = LAYER_IDS.map(createLayer);
const assetRegistry = new PrimitiveAssetRegistry();

let stageSize = resizeStage(layers);
let lastFrameTime = performance.now();
let assetLoadState: AssetLoadState = { status: "loading" };

window.addEventListener("resize", () => {
  stageSize = resizeStage(layers);
});

void loadInitialAssets();
requestAnimationFrame(tick);

declare global {
  interface Window {
    __vectorStageDebug?: {
      getPrimitiveAssets: () => Array<{
        id: string;
        name: string;
        sourceUrl: string;
        viewBox: [number, number, number, number];
        fill: string;
        fillRule: string;
        pathD: string;
      }>;
      getAssetLoadState: () => AssetLoadState["status"];
    };
  }
}

function createLayer(id: StageLayerId): StageLayer {
  const canvas = document.getElementById(id);

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error(`Expected #${id} to be a canvas element.`);
  }

  const context = canvas.getContext("2d", {
    alpha: true,
    desynchronized: true,
  });

  if (!context) {
    throw new Error(`Could not create a 2D rendering context for #${id}.`);
  }

  if (id === "vector-canvas") {
    /**
     * This marker gives Playwright a stable hook for checking that the intended
     * visual layer is present before it inspects canvas pixels.
     */
    canvas.dataset.visualCheck = "loading";
  }

  return { id, canvas, context };
}

async function loadInitialAssets(): Promise<void> {
  try {
    await assetRegistry.loadManifest(PRIMITIVE_ASSET_MANIFEST_URL);
    const asset = assetRegistry.get(DEMO_ASSET_ID);
    assetLoadState = { status: "ready", asset };
    getLayer("vector-canvas").canvas.dataset.visualCheck = "imported-primitive";
    exposeDebugHooks();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown asset error";
    assetLoadState = { status: "error", message };
    getLayer("vector-canvas").canvas.dataset.visualCheck = "import-error";
    console.error(error);
    exposeDebugHooks();
  }
}

function exposeDebugHooks(): void {
  window.__vectorStageDebug = {
    getPrimitiveAssets: () =>
      assetRegistry.snapshot().map((asset) => ({
        id: asset.id,
        name: asset.name,
        sourceUrl: asset.sourceUrl,
        viewBox: asset.viewBox,
        fill: asset.fill,
        fillRule: asset.fillRule,
        pathD: asset.pathD,
      })),
    getAssetLoadState: () => assetLoadState.status,
  };
}

function resizeStage(stageLayers: StageLayer[]): StageSize {
  const cssWidth = Math.max(MIN_STAGE_WIDTH, window.innerWidth);
  const cssHeight = Math.max(MIN_STAGE_HEIGHT, window.innerHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
  const pixelWidth = Math.round(cssWidth * dpr);
  const pixelHeight = Math.round(cssHeight * dpr);

  for (const layer of stageLayers) {
    layer.canvas.width = pixelWidth;
    layer.canvas.height = pixelHeight;

    /**
     * Canvas dimensions are assigned in device pixels while CSS dimensions stay
     * in layout pixels. Resetting the transform after every resize lets future
     * drawing code use CSS-pixel world units without accidentally compounding
     * scale transforms across resize events.
     */
    layer.context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  return { cssWidth, cssHeight, pixelWidth, pixelHeight, dpr };
}

function tick(now: DOMHighResTimeStamp): void {
  const deltaSeconds = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;

  renderFoundationFrame(deltaSeconds, stageSize);
  requestAnimationFrame(tick);
}

function renderFoundationFrame(
  deltaSeconds: number,
  size: StageSize,
): void {
  /**
   * The foundation frame draws only non-demo scaffolding cues. Future runtime
   * code should move each responsibility into its own module:
   *
   * - Three/WebGL background layer: slow spatial ambience and high-volume simple
   *   entities such as stars, boids, or distant particles.
   * - Vector runtime layer: authored SVG-path parts, Path2D playback, character
   *   state machines, hit testing, and camera transforms.
   * - Paper layer: temporary local geometry experiments such as live path
   *   deformation, curve sampling, or authoring-time tools that may later bake
   *   their results back into animation data.
   */
  clearLayer("three-canvas", size);
  clearLayer("vector-canvas", size);
  clearLayer("paper-canvas", size);

  drawStageGrid(getLayer("three-canvas"), size);
  drawRuntimePlaceholder(getLayer("vector-canvas"), size, assetLoadState);

  /**
   * Keep deltaSeconds referenced while asset loading is the only asynchronous
   * behavior in the loop. The next milestone can replace this line with real
   * animation-system sampling.
   */
  void deltaSeconds;
}

function clearLayer(id: StageLayerId, size: StageSize): void {
  const { context } = getLayer(id);
  context.clearRect(0, 0, size.cssWidth, size.cssHeight);
}

function getLayer(id: StageLayerId): StageLayer {
  const layer = layers.find((candidate) => candidate.id === id);

  if (!layer) {
    throw new Error(`Stage layer "${id}" is not registered.`);
  }

  return layer;
}

function drawStageGrid(layer: StageLayer, size: StageSize): void {
  const { context } = layer;
  const gridSize = 64;

  context.save();
  context.globalAlpha = 0.16;
  context.strokeStyle = "#eef4ff";
  context.lineWidth = 1;

  for (let x = 0; x <= size.cssWidth; x += gridSize) {
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, size.cssHeight);
    context.stroke();
  }

  for (let y = 0; y <= size.cssHeight; y += gridSize) {
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(size.cssWidth, y + 0.5);
    context.stroke();
  }

  context.restore();
}

function drawRuntimePlaceholder(
  layer: StageLayer,
  size: StageSize,
  loadState: AssetLoadState,
): void {
  const { context } = layer;

  if (loadState.status === "loading") {
    drawCenteredStatus(context, size, "Loading primitive assets...");
    return;
  }

  if (loadState.status === "error") {
    drawCenteredStatus(context, size, "Primitive asset import failed");
    return;
  }

  drawImportedPrimitive(context, size, loadState.asset);
}

function drawImportedPrimitive(
  context: CanvasRenderingContext2D,
  size: StageSize,
  asset: PrimitiveSvgAsset,
): void {
  const centerX = size.cssWidth / 2;
  const centerY = size.cssHeight / 2;
  const [viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight] = asset.viewBox;
  const targetSize = Math.max(84, Math.min(size.cssWidth, size.cssHeight) * 0.16);
  const assetScale = targetSize / Math.max(viewBoxWidth, viewBoxHeight);

  context.save();
  context.translate(centerX, centerY);
  context.scale(assetScale, assetScale);
  context.translate(
    -(viewBoxX + viewBoxWidth / 2),
    -(viewBoxY + viewBoxHeight / 2),
  );
  context.fillStyle = asset.fill;
  context.fill(asset.path, asset.fillRule);

  context.fillStyle = "#111827";
  context.beginPath();
  context.arc(-32, -12, 10, 0, Math.PI * 2);
  context.arc(32, -12, 10, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#111827";
  context.lineWidth = 7;
  context.lineCap = "round";
  context.beginPath();
  context.arc(0, 4, 42, 0.18 * Math.PI, 0.82 * Math.PI);
  context.stroke();
  context.restore();
}

function drawCenteredStatus(
  context: CanvasRenderingContext2D,
  size: StageSize,
  message: string,
): void {
  context.save();
  context.fillStyle = "rgba(238, 244, 255, 0.82)";
  context.font = "600 16px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(message, size.cssWidth / 2, size.cssHeight / 2);
  context.restore();
}
