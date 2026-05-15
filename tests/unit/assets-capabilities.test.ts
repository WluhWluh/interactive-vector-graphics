import { strict as assert } from "node:assert";
import {
  getPrimitiveAssetCapabilities,
  getPrimitiveAssetCapabilityDefinitions,
} from "../../src/core/assets/primitiveAssetCapabilities";
import type { PrimitiveAssetKind } from "../../src/core/assets/primitiveAssetTypes";

export function runAssetCapabilityUnitTests(): void {
  const definitions = getPrimitiveAssetCapabilityDefinitions();
  const kinds = definitions.map((definition) => definition.kind).sort();
  const expectedKinds: PrimitiveAssetKind[] = [
    "bezierCurve3d",
    "filledPath",
    "strokePath",
    "viewMorphProfile",
  ];

  assert.deepEqual(kinds, expectedKinds.sort());

  const filled = getPrimitiveAssetCapabilities("filledPath");
  const stroke = getPrimitiveAssetCapabilities("strokePath");
  const curve3d = getPrimitiveAssetCapabilities("bezierCurve3d");
  const viewMorph = getPrimitiveAssetCapabilities("viewMorphProfile");

  assert.equal(filled.renderStyle, "fill");
  assert.equal(filled.usesFillStyle, true);
  assert.equal(filled.expectedStructuredPathClosed, true);
  assert.equal(filled.canPathKeyframe, true);

  assert.equal(stroke.renderStyle, "stroke");
  assert.equal(stroke.usesStrokeStyle, true);
  assert.equal(stroke.expectedStructuredPathClosed, false);
  assert.equal(stroke.canConvertTo3DCurve, true);

  assert.equal(curve3d.renderStyle, "projectedStroke3d");
  assert.equal(curve3d.has3DSourcePath, true);
  assert.equal(curve3d.canUpdate2DSourcePath, false);
  assert.equal(curve3d.canInPlacePathEdit, false);
  assert.equal(curve3d.canPathKeyframe, false);

  assert.equal(viewMorph.renderStyle, "viewMorphProfile");
  assert.equal(viewMorph.usesFillStyle, true);
  assert.equal(viewMorph.expectedStructuredPathClosed, true);
  assert.equal(viewMorph.canUpdate2DSourcePath, false);
  assert.equal(viewMorph.canSourcePathEdit, false);
  assert.equal(viewMorph.canInPlacePathEdit, false);
  assert.equal(viewMorph.canPathKeyframe, false);
}
