import type {
  BezierPoint3D,
  BezierSegment3D,
  StructuredBezierPath3D,
} from "../../core/assets/structuredBezierPath3d";
import type { PathEditComponent } from "./pathEditCore";
import { roundBezierValue } from "./pathEditCore";
import type { Vector3Tuple } from "../threeEditorViewport";

export type SourcePathEdit3DSelection = {
  segmentId: string;
  component: PathEditComponent;
};

export type SourcePathEdit3DSession = {
  assetId: string;
  draft: StructuredBezierPath3D;
  selected: SourcePathEdit3DSelection | null;
};

export function getPathEdit3DSegment(
  session: SourcePathEdit3DSession | null,
  segmentId: string,
): BezierSegment3D | null {
  return session?.draft.segments.find((segment) => segment.id === segmentId) ?? null;
}

export function getSelectedPathEdit3DSegment(
  session: SourcePathEdit3DSession | null,
): BezierSegment3D | null {
  return session?.selected
    ? getPathEdit3DSegment(session, session.selected.segmentId)
    : null;
}

export function getPathEdit3DComponentPoint(
  segment: BezierSegment3D,
  component: PathEditComponent,
): BezierPoint3D {
  if (component === "anchor") {
    return [...segment.anchor];
  }

  return [...segment[component]];
}

export function getSourcePathEdit3DControlId(
  segmentId: string,
  component: PathEditComponent,
): string {
  return `${segmentId}:${component}`;
}

export function parseSourcePathEdit3DControlId(
  controlId: string,
): SourcePathEdit3DSelection | null {
  const [segmentId, component] = controlId.split(":");

  if (
    !segmentId ||
    (component !== "anchor" && component !== "handleIn" && component !== "handleOut")
  ) {
    return null;
  }

  return { segmentId, component };
}

export function sourcePathEdit3DSelectionMatches(
  selection: SourcePathEdit3DSelection | null,
  segmentId: string,
  component: PathEditComponent,
): boolean {
  return selection?.segmentId === segmentId && selection.component === component;
}

export function addBezierPoints3D(
  left: BezierPoint3D,
  right: BezierPoint3D,
): Vector3Tuple {
  return [
    roundBezierValue(left[0] + right[0]),
    roundBezierValue(left[1] + right[1]),
    roundBezierValue(left[2] + right[2]),
  ];
}

export function subtractBezierPoints3D(
  left: BezierPoint3D,
  right: BezierPoint3D,
): BezierPoint3D {
  return [
    roundBezierValue(left[0] - right[0]),
    roundBezierValue(left[1] - right[1]),
    roundBezierValue(left[2] - right[2]),
  ];
}
