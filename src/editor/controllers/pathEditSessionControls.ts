import type { BezierPoint, StructuredBezierPath } from "../../core/assets/structuredBezierPath";
import {
  dragPathEditControl,
  findNearestPathEditControl,
  selectPathEditControl,
  type PathEditControl,
  type PathEditDragState,
  type PathEditSelection,
  type PathEditSession,
  type PathEditViewportAdapter,
} from "../tools/pathEditCore";

export function toPathEditSelection(
  control: PathEditControl | null,
): PathEditSelection | null {
  return control
    ? {
        segmentId: control.segmentId,
        component: control.component,
      }
    : null;
}

export function pathEditSelectionsEqual(
  left: PathEditSelection | null,
  right: PathEditSelection | null,
): boolean {
  return (
    left?.segmentId === right?.segmentId &&
    left?.component === right?.component
  );
}

export function findPathEditControlAtPoint(input: {
  point: BezierPoint;
  session: PathEditSession | null;
  adapter: PathEditViewportAdapter | null;
  hitRadius: number;
}): PathEditControl | null {
  return input.session && input.adapter
    ? findNearestPathEditControl(
        input.point,
        input.session,
        input.adapter,
        input.hitRadius,
      )
    : null;
}

export function selectPathEditSessionControl(input: {
  session: PathEditSession;
  control: PathEditControl;
}): PathEditDragState {
  return selectPathEditControl(input.session, input.control);
}

export function dragPathEditSessionAtPoint(input: {
  session: PathEditSession;
  dragState: PathEditDragState;
  point: BezierPoint;
  altKey?: boolean;
  shiftKey?: boolean;
}): void {
  dragPathEditControl(input.session, input.dragState, input.point, {
    altKey: input.altKey,
    shiftKey: input.shiftKey,
  });
}

export function getRestoredPathEditSelection(
  path: StructuredBezierPath,
  previousSelection: PathEditSelection | null,
): PathEditSelection {
  if (
    previousSelection &&
    path.segments.some((segment) => segment.id === previousSelection.segmentId)
  ) {
    return previousSelection;
  }

  return getInitialPathEditSelection(path);
}

export function getInitialPathEditSelection(path: {
  segments: Array<{ id: string }>;
}): PathEditSelection {
  return {
    segmentId: path.segments[0]?.id ?? "",
    component: "anchor",
  };
}
