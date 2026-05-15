import type { BezierPoint, StructuredBezierPath } from "../../core/assets/structuredBezierPath";
import {
  findNearestPathEditControl,
  type PathEditControl,
  type PathEditDragState,
  type PathEditSelection,
  type PathEditSession,
  type PathEditViewportAdapter,
} from "../tools/pathEditCore";
import { applyPathEditCommand } from "../tools/pathEditCommands";

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
  const result = applyPathEditCommand(input.session, {
    type: "selectControl",
    control: input.control,
  });

  if (!result.ok || !result.dragState) {
    throw new Error("Could not select path edit control.");
  }

  return result.dragState;
}

export function dragPathEditSessionAtPoint(input: {
  session: PathEditSession;
  dragState: PathEditDragState;
  point: BezierPoint;
  altKey?: boolean;
  shiftKey?: boolean;
}): void {
  applyPathEditCommand(input.session, {
    type: "dragControl",
    dragState: input.dragState,
    point: input.point,
    modifiers: {
      altKey: input.altKey,
      shiftKey: input.shiftKey,
    },
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
