export type StageLayerId = "three-canvas" | "vector-canvas" | "paper-canvas";

export type StageLayer = {
  id: StageLayerId;
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
};

export type StageSize = {
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  dpr: number;
};

const DEFAULT_LAYER_IDS: StageLayerId[] = [
  "three-canvas",
  "vector-canvas",
  "paper-canvas",
];

const MAX_DEVICE_PIXEL_RATIO = 2;
const MIN_STAGE_WIDTH = 1;
const MIN_STAGE_HEIGHT = 1;

export class CanvasStage {
  readonly layers: StageLayer[];

  private currentSize: StageSize;
  private readonly resizeListener = (): void => {
    this.currentSize = this.resize();
  };

  constructor(layerIds: StageLayerId[] = DEFAULT_LAYER_IDS) {
    this.layers = layerIds.map(createLayer);
    this.currentSize = this.resize();
    window.addEventListener("resize", this.resizeListener);
  }

  get size(): StageSize {
    return this.currentSize;
  }

  getLayer(id: StageLayerId): StageLayer {
    const layer = this.layers.find((candidate) => candidate.id === id);

    if (!layer) {
      throw new Error(`Stage layer "${id}" is not registered.`);
    }

    return layer;
  }

  clearLayer(id: StageLayerId): void {
    const { context } = this.getLayer(id);
    context.clearRect(0, 0, this.currentSize.cssWidth, this.currentSize.cssHeight);
  }

  clearAll(): void {
    for (const layer of this.layers) {
      layer.context.clearRect(
        0,
        0,
        this.currentSize.cssWidth,
        this.currentSize.cssHeight,
      );
    }
  }

  dispose(): void {
    window.removeEventListener("resize", this.resizeListener);
  }

  private resize(): StageSize {
    const referenceRect = this.layers[0]?.canvas.getBoundingClientRect();
    const cssWidth = Math.max(
      MIN_STAGE_WIDTH,
      referenceRect?.width ?? window.innerWidth,
    );
    const cssHeight = Math.max(
      MIN_STAGE_HEIGHT,
      referenceRect?.height ?? window.innerHeight,
    );
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
    const pixelWidth = Math.round(cssWidth * dpr);
    const pixelHeight = Math.round(cssHeight * dpr);

    for (const layer of this.layers) {
      layer.canvas.width = pixelWidth;
      layer.canvas.height = pixelHeight;

      /**
       * Drawing code should work in CSS pixels. Resetting the transform on every
       * resize avoids compounding scale transforms across resize events.
       */
      layer.context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    return { cssWidth, cssHeight, pixelWidth, pixelHeight, dpr };
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

  return { id, canvas, context };
}
