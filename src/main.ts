import "./styles.css";

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
const MIN_STAGE_HEIGHT = 1;

/**
 * This first foundation intentionally keeps every layer backed by a 2D canvas.
 * The Three.js layer is still named and ordered now, but we will only replace
 * its backing context with a WebGL renderer when a real 3D/background experiment
 * needs it. That keeps the base project understandable and avoids pulling the
 * rendering architecture forward too early.
 */
const layers = LAYER_IDS.map(createLayer);

let stageSize = resizeStage(layers);
let lastFrameTime = performance.now();

window.addEventListener("resize", () => {
  stageSize = resizeStage(layers);
});

requestAnimationFrame(tick);

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

  return { id, canvas, context };
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
  drawRuntimePlaceholder(getLayer("vector-canvas"), size, deltaSeconds);
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
  deltaSeconds: number,
): void {
  const { context } = layer;
  const centerX = size.cssWidth / 2;
  const centerY = size.cssHeight / 2;
  const radius = Math.max(42, Math.min(size.cssWidth, size.cssHeight) * 0.08);

  context.save();
  context.translate(centerX, centerY);
  context.fillStyle = "#ffcf4a";
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#111827";
  context.beginPath();
  context.arc(-radius * 0.32, -radius * 0.12, radius * 0.1, 0, Math.PI * 2);
  context.arc(radius * 0.32, -radius * 0.12, radius * 0.1, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "#111827";
  context.lineWidth = Math.max(3, radius * 0.07);
  context.lineCap = "round";
  context.beginPath();
  context.arc(0, radius * 0.04, radius * 0.42, 0.18 * Math.PI, 0.82 * Math.PI);
  context.stroke();
  context.restore();

  /**
   * Keep deltaSeconds referenced while the loop is still a placeholder. The
   * next milestone can replace this line with real animation-system sampling.
   */
  void deltaSeconds;
}
