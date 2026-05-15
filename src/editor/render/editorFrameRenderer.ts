import type { PrimitiveSvgAsset } from "../../core/assets/primitiveSvg";
import type { StructuredBezierPath3D } from "../../core/assets/structuredBezierPath3d";
import { drawCenteredStatus, drawPrimitivePreview } from "../../core/stage/primitivePreview";
import type { CanvasStage } from "../../core/stage/canvasStage";
import type { DrawableBillboard } from "./billboardRenderer";

export type EditorFrameMode = "asset" | "path" | "scene";

export type EditorFrameRenderInput = {
  stage: CanvasStage;
  mode: EditorFrameMode;
  hasSelectedProject: boolean;
  selectedAsset: PrimitiveSvgAsset | null;
  assetAssemblyBillboards: DrawableBillboard[];
  sceneLayoutBillboards: DrawableBillboard[];
  clearCurve3DControls: () => void;
  renderThreeViewport: () => void;
  renderPathEditFrame: () => void;
  renderInPlacePathEditOverlay: () => void;
  drawBillboards: (
    context: CanvasRenderingContext2D,
    drawables: DrawableBillboard[],
  ) => void;
  drawSourcePathEdit3DPreview: (
    context: CanvasRenderingContext2D,
    asset: Extract<PrimitiveSvgAsset, { assetKind: "bezierCurve3d" }>,
    bezierPath3d: StructuredBezierPath3D,
  ) => void;
};

export function renderEditorFrame(input: EditorFrameRenderInput): void {
  input.stage.clearAll();

  if (input.mode === "path") {
    input.renderPathEditFrame();
    return;
  }

  input.clearCurve3DControls();
  input.renderThreeViewport();

  const context = input.stage.getLayer("vector-canvas").context;

  if (!input.hasSelectedProject) {
    drawCenteredStatus(context, input.stage.size, "Create or select a project");
    return;
  }

  if (input.mode === "asset") {
    renderAssetAssemblyFrame(input, context);
    return;
  }

  renderSceneLayoutFrame(input, context);
}

function renderAssetAssemblyFrame(
  input: EditorFrameRenderInput,
  context: CanvasRenderingContext2D,
): void {
  if (input.assetAssemblyBillboards.length > 0) {
    input.drawBillboards(context, input.assetAssemblyBillboards);
    input.renderInPlacePathEditOverlay();
    return;
  }

  if (input.selectedAsset) {
    if (input.selectedAsset.assetKind === "bezierCurve3d") {
      input.drawSourcePathEdit3DPreview(
        context,
        input.selectedAsset,
        input.selectedAsset.bezierPath3d,
      );
    } else {
      drawPrimitivePreview(context, input.stage.size, input.selectedAsset);
    }
    return;
  }

  drawCenteredStatus(
    context,
    input.stage.size,
    "Import SVG primitives and assemble a prefab",
  );
}

function renderSceneLayoutFrame(
  input: EditorFrameRenderInput,
  context: CanvasRenderingContext2D,
): void {
  if (input.sceneLayoutBillboards.length === 0) {
    drawCenteredStatus(context, input.stage.size, "Add a prefab instance to the scene");
    return;
  }

  input.drawBillboards(context, input.sceneLayoutBillboards);
}
