import type { PrimitiveSvgAsset } from "../../core/assets/primitiveAssetTypes";
import {
  primitiveAssetHas3DSourcePath,
  primitiveAssetUsesStrokeStyle,
} from "../../core/assets/primitiveAssetCapabilities";
import type { BezierSegment } from "../../core/assets/structuredBezierPath";
import type { BezierSegment3D } from "../../core/assets/structuredBezierPath3d";
import type { PathEditComponent } from "../tools/pathEditCore";
import { getPathEditComponentPoint } from "../tools/pathEditCore";
import { getPathEdit3DComponentPoint } from "../tools/pathEdit3dCore";
import { formatTransformValue } from "../tools/editorUtils";
import type { TransformProperty } from "../tools/toolController";
import type { EditorElements } from "./editorDom";

export type InspectorTransformNode = {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

export type PathEditPointInputOptions = {
  ariaPrefix?: string;
  onApply: (
    input: HTMLInputElement,
    segmentId: string,
    component: PathEditComponent,
    axisIndex: number,
  ) => void;
};

export type TransformInputOptions = {
  onApply: (
    input: HTMLInputElement,
    nodeId: string,
    property: TransformProperty,
    axisIndex: number,
  ) => void;
};

export type Vector3InputOptions = {
  ariaPrefix?: string;
  onApply: (input: HTMLInputElement, axisIndex: number) => void;
};

export function appendInspectorRow(
  elements: EditorElements,
  label: string,
  value: string,
): void {
  const term = document.createElement("dt");
  const description = document.createElement("dd");

  term.textContent = label;
  description.textContent = value;
  elements.inspectorFields.append(term, description);
}

export function appendInspectorActionRow(
  elements: EditorElements,
  label: string,
  onClick: () => void,
): void {
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  const button = document.createElement("button");

  term.textContent = "Action";
  button.type = "button";
  button.className = "editor-button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  description.append(button);
  elements.inspectorFields.append(term, description);
}

export function appendAssetInspectorRows(
  elements: EditorElements,
  asset: PrimitiveSvgAsset | null,
): void {
  if (!asset) {
    appendInspectorRow(elements, "Asset", "No primitive selected");
    return;
  }

  appendInspectorRow(elements, "Asset ID", asset.id);
  appendInspectorRow(elements, "Type", asset.assetKind);
  appendInspectorRow(elements, "Name", asset.name);
  appendInspectorRow(elements, "Source", asset.sourceUrl);
  appendInspectorRow(elements, "ViewBox", asset.viewBox.join(", "));
  appendInspectorRow(
    elements,
    "Bezier Segments",
    String(asset.bezierPath.segments.length),
  );
  appendInspectorRow(elements, "Closed Path", asset.bezierPath.closed ? "true" : "false");

  if (primitiveAssetUsesStrokeStyle(asset)) {
    appendInspectorRow(elements, "Stroke", asset.stroke);
    appendInspectorRow(elements, "Stroke Width", String(asset.strokeWidth));
    appendInspectorRow(elements, "Line Cap", "round");
    appendInspectorRow(elements, "Line Join", "round");
    if (primitiveAssetHas3DSourcePath(asset)) {
      appendInspectorRow(
        elements,
        "3D Bezier Segments",
        String(asset.bezierPath3d.segments.length),
      );
      appendInspectorRow(elements, "3D Source", "true");
    }
  } else {
    appendInspectorRow(elements, "Fill", asset.fill);
    appendInspectorRow(elements, "Fill Rule", asset.fillRule);
    if (asset.assetKind === "viewMorphProfile") {
      appendInspectorRow(
        elements,
        "Vertical Planes",
        String(asset.viewMorphProfile.verticalPlanes.length),
      );
      appendInspectorRow(
        elements,
        "Vertical Points",
        String(asset.viewMorphProfile.verticalPlanes[0]?.path.points.length ?? 0),
      );
      appendInspectorRow(
        elements,
        "Horizontal Points",
        String(asset.viewMorphProfile.horizontalPlane.path.points.length),
      );
    }
  }

  appendInspectorRow(elements, "Path Length", `${asset.pathD.length} chars`);
  appendInspectorRow(
    elements,
    "Source Path Edit",
    "Use the Source Path Edit mode",
  );
}

export function appendPathEditInspectorInputRow(
  elements: EditorElements,
  label: string,
  segment: BezierSegment,
  component: PathEditComponent,
  options: PathEditPointInputOptions,
): void {
  const term = document.createElement("dt");
  const description = document.createElement("dd");

  term.textContent = label;
  description.append(createPathEditPointInputRow(segment, component, options));
  elements.inspectorFields.append(term, description);
}

export function createPathEditPointInputRow(
  segment: BezierSegment,
  component: PathEditComponent,
  options: PathEditPointInputOptions,
): HTMLDivElement {
  const row = document.createElement("div");
  const point = getPathEditComponentPoint(segment, component);
  const ariaPrefix = options.ariaPrefix ?? "Path";

  row.className = "path-edit-point-row";

  point.forEach((value, axisIndex) => {
    const input = document.createElement("input");
    const axisName = axisIndex === 0 ? "X" : "Y";

    input.className = "transform-number-input";
    input.type = "text";
    input.inputMode = "decimal";
    input.ariaLabel = `${ariaPrefix} ${component} ${axisName}`;
    input.value = formatTransformValue(value);
    input.addEventListener("focus", () => {
      input.dataset.previousValue = input.value;
    });
    input.addEventListener("blur", () => {
      options.onApply(input, segment.id, component, axisIndex);
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

    row.append(input);
  });

  return row;
}

export function createPathEdit3DPointInputRow(
  segment: BezierSegment3D,
  component: PathEditComponent,
  options: PathEditPointInputOptions,
): HTMLDivElement {
  const row = document.createElement("div");
  const point = getPathEdit3DComponentPoint(segment, component);

  row.className = "path-edit-point-row";

  point.forEach((value, axisIndex) => {
    const input = document.createElement("input");
    const axisName = ["X", "Y", "Z"][axisIndex] ?? "?";

    input.className = "transform-number-input";
    input.type = "text";
    input.inputMode = "decimal";
    input.ariaLabel = `3D path ${component} ${axisName}`;
    input.value = formatTransformValue(value);
    input.addEventListener("focus", () => {
      input.dataset.previousValue = input.value;
    });
    input.addEventListener("blur", () => {
      options.onApply(input, segment.id, component, axisIndex);
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

    row.append(input);
  });

  return row;
}

export function appendTransformInspectorRow(
  elements: EditorElements,
  label: string,
  node: InspectorTransformNode,
  property: TransformProperty,
  options: TransformInputOptions,
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
      options.onApply(input, node.id, property, axisIndex);
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

export function appendVector3InspectorRow(
  elements: EditorElements,
  label: string,
  value: [number, number, number],
  options: Vector3InputOptions,
): void {
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  const editor = document.createElement("div");

  term.textContent = label;
  editor.className = "transform-input-row";

  value.forEach((axisValue, axisIndex) => {
    const input = document.createElement("input");
    const axisName = ["X", "Y", "Z"][axisIndex] ?? "?";
    const ariaPrefix = options.ariaPrefix ?? label;

    input.className = "transform-number-input";
    input.type = "text";
    input.inputMode = "decimal";
    input.ariaLabel = `${ariaPrefix} ${axisName}`;
    input.value = formatTransformValue(axisValue);
    input.addEventListener("focus", () => {
      input.dataset.previousValue = input.value;
    });
    input.addEventListener("blur", () => {
      options.onApply(input, axisIndex);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        input.blur();
      }

      if (event.key === "Escape") {
        input.value = input.dataset.previousValue ?? formatTransformValue(axisValue);
        input.blur();
      }
    });

    editor.append(input);
  });

  description.append(editor);
  elements.inspectorFields.append(term, description);
}
