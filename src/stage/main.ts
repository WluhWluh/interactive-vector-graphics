import "../styles.css";
import { PrimitiveAssetRegistry } from "../core/assets/primitiveAssetRegistry";
import type { PrimitiveSvgAsset } from "../core/assets/primitiveAssetTypes";
import type { StructuredBezierPath } from "../core/assets/structuredBezierPath";
import { CanvasStage } from "../core/stage/canvasStage";
import {
  drawCenteredStatus,
  drawPrimitivePreview,
  drawStageGrid,
} from "../core/stage/primitivePreview";

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

const stage = new CanvasStage();
const assetRegistry = new PrimitiveAssetRegistry();

let lastFrameTime = performance.now();
let assetLoadState: AssetLoadState = { status: "loading" };

stage.getLayer("vector-canvas").canvas.dataset.visualCheck = "loading";

void loadInitialAssets();
requestAnimationFrame(tick);

declare global {
  interface Window {
    __vectorStageDebug?: {
      getPrimitiveAssets: () => Array<{
        id: string;
        assetKind: string;
        name: string;
        sourceUrl: string;
        viewBox: [number, number, number, number];
        fill: string;
        fillRule: string;
        stroke: string | null;
        strokeWidth: number | null;
        bezierPath: StructuredBezierPath;
        pathD: string;
      }>;
      getAssetLoadState: () => AssetLoadState["status"];
    };
  }
}

async function loadInitialAssets(): Promise<void> {
  try {
    await assetRegistry.loadManifest(PRIMITIVE_ASSET_MANIFEST_URL);
    const asset = assetRegistry.get(DEMO_ASSET_ID);
    assetLoadState = { status: "ready", asset };
    stage.getLayer("vector-canvas").canvas.dataset.visualCheck = "imported-primitive";
    exposeDebugHooks();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown asset error";
    assetLoadState = { status: "error", message };
    stage.getLayer("vector-canvas").canvas.dataset.visualCheck = "import-error";
    console.error(error);
    exposeDebugHooks();
  }
}

function exposeDebugHooks(): void {
  window.__vectorStageDebug = {
    getPrimitiveAssets: () =>
      assetRegistry.snapshot().map((asset) => ({
        id: asset.id,
        assetKind: asset.assetKind,
        name: asset.name,
        sourceUrl: asset.sourceUrl,
        viewBox: asset.viewBox,
        fill: asset.assetKind === "filledPath" ? asset.fill : "none",
        fillRule: asset.assetKind === "filledPath" ? asset.fillRule : "nonzero",
        stroke: asset.assetKind === "strokePath" ? asset.stroke : null,
        strokeWidth: asset.assetKind === "strokePath" ? asset.strokeWidth : null,
        bezierPath: asset.bezierPath,
        pathD: asset.pathD,
      })),
    getAssetLoadState: () => assetLoadState.status,
  };
}

function tick(now: DOMHighResTimeStamp): void {
  const deltaSeconds = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;

  renderStageFrame(assetLoadState);
  requestAnimationFrame(tick);

  /**
   * Keep deltaSeconds referenced while asset loading is the only asynchronous
   * behavior in the loop. The next milestone can replace this line with real
   * animation-system sampling.
   */
  void deltaSeconds;
}

function renderStageFrame(loadState: AssetLoadState): void {
  stage.clearAll();
  drawStageGrid(stage.getLayer("three-canvas"), stage.size);

  const vectorContext = stage.getLayer("vector-canvas").context;

  if (loadState.status === "loading") {
    drawCenteredStatus(vectorContext, stage.size, "Loading primitive assets...");
    return;
  }

  if (loadState.status === "error") {
    drawCenteredStatus(vectorContext, stage.size, "Primitive asset import failed");
    return;
  }

  drawPrimitivePreview(vectorContext, stage.size, loadState.asset);
  drawDemoFaceDetails(vectorContext, stage.size);
}

function drawDemoFaceDetails(
  context: CanvasRenderingContext2D,
  size: { cssWidth: number; cssHeight: number },
): void {
  const centerX = size.cssWidth / 2;
  const centerY = size.cssHeight / 2;
  const scale = Math.max(84, Math.min(size.cssWidth, size.cssHeight) * 0.16) / 200;

  context.save();
  context.translate(centerX, centerY);
  context.scale(scale, scale);
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
