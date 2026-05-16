import {
  cloneViewMorphProfile,
  type ViewMorphClosedPolyline,
  type ViewMorphPoint2D,
  type ViewMorphProfile,
} from "../../core/assets/viewMorphProfile";
import type { BezierPoint } from "../../core/assets/structuredBezierPath";
import { roundBezierValue } from "./pathEditCore";

export type ViewMorphEditPlaneKind = "vertical" | "horizontal";

export type ViewMorphEditPlaneRef = {
  kind: ViewMorphEditPlaneKind;
  planeId: string;
};

export type ViewMorphEditSelection = ViewMorphEditPlaneRef & {
  pointId: string;
};

export type ViewMorphProfileEditSession = {
  assetId: string;
  draft: ViewMorphProfile;
  selectedPlane: ViewMorphEditPlaneRef;
  selected: ViewMorphEditSelection | null;
};

export type ViewMorphProfileEditDragState = ViewMorphEditSelection;

export type ViewMorphProfileEditControl = ViewMorphEditSelection & {
  point: ViewMorphPoint2D;
};

export type ViewMorphProfileEditScreenControl = ViewMorphEditSelection & {
  x: number;
  y: number;
};

export type ViewMorphProfileEditViewportAdapter = {
  pathToScreen(point: BezierPoint): BezierPoint | null;
  screenToPath(point: BezierPoint): BezierPoint | null;
};

export function createViewMorphProfileEditSession(input: {
  assetId: string;
  profile: ViewMorphProfile;
}): ViewMorphProfileEditSession {
  const draft = cloneViewMorphProfile(input.profile);
  const firstPlane = draft.verticalPlanes[0];
  const selectedPlane: ViewMorphEditPlaneRef = firstPlane
    ? { kind: "vertical", planeId: firstPlane.id }
    : { kind: "horizontal", planeId: draft.horizontalPlane.id };
  const firstPoint = getViewMorphProfileEditPath(draft, selectedPlane)?.points[0];

  return {
    assetId: input.assetId,
    draft,
    selectedPlane,
    selected: firstPoint
      ? {
          ...selectedPlane,
          pointId: firstPoint.id,
        }
      : null,
  };
}

export function cloneViewMorphProfileEditSession(
  session: ViewMorphProfileEditSession,
): ViewMorphProfileEditSession {
  return {
    assetId: session.assetId,
    draft: cloneViewMorphProfile(session.draft),
    selectedPlane: { ...session.selectedPlane },
    selected: session.selected ? { ...session.selected } : null,
  };
}

export function getViewMorphProfileEditPlaneRefs(
  profile: ViewMorphProfile,
): Array<ViewMorphEditPlaneRef & { name: string }> {
  return [
    ...profile.verticalPlanes.map((plane) => ({
      kind: "vertical" as const,
      planeId: plane.id,
      name: plane.name,
    })),
    {
      kind: "horizontal" as const,
      planeId: profile.horizontalPlane.id,
      name: profile.horizontalPlane.name,
    },
  ];
}

export function setViewMorphProfileEditPlane(
  session: ViewMorphProfileEditSession,
  plane: ViewMorphEditPlaneRef,
): void {
  const path = getViewMorphProfileEditPath(session.draft, plane);

  if (!path) {
    return;
  }

  session.selectedPlane = { ...plane };
  session.selected = path.points[0]
    ? {
        ...plane,
        pointId: path.points[0].id,
      }
    : null;
}

export function getSelectedViewMorphProfilePoint(
  session: ViewMorphProfileEditSession | null,
): ViewMorphProfileEditControl | null {
  if (!session?.selected) {
    return null;
  }

  const point = getViewMorphProfilePoint(session.draft, session.selected);

  return point
    ? {
        ...session.selected,
        point: [...point.point],
      }
    : null;
}

export function getViewMorphProfileEditControls(
  session: ViewMorphProfileEditSession,
): ViewMorphProfileEditControl[] {
  const path = getViewMorphProfileEditPath(session.draft, session.selectedPlane);

  if (!path) {
    return [];
  }

  return path.points.map((point) => ({
    ...session.selectedPlane,
    pointId: point.id,
    point: [...point.point],
  }));
}

export function getViewMorphProfileEditScreenControls(
  session: ViewMorphProfileEditSession | null,
  adapter: ViewMorphProfileEditViewportAdapter | null,
): ViewMorphProfileEditScreenControl[] {
  if (!session || !adapter) {
    return [];
  }

  return getViewMorphProfileEditControls(session)
    .map((control) => {
      const screenPoint = adapter.pathToScreen(control.point);

      return screenPoint
        ? {
            kind: control.kind,
            planeId: control.planeId,
            pointId: control.pointId,
            x: screenPoint[0],
            y: screenPoint[1],
          }
        : null;
    })
    .filter(
      (control): control is ViewMorphProfileEditScreenControl =>
        control !== null,
    );
}

export function findNearestViewMorphProfileEditControl(
  screenPoint: BezierPoint,
  session: ViewMorphProfileEditSession,
  adapter: ViewMorphProfileEditViewportAdapter,
  hitRadius: number,
): ViewMorphProfileEditControl | null {
  let nearest: { control: ViewMorphProfileEditControl; distance: number } | null =
    null;

  for (const control of getViewMorphProfileEditControls(session)) {
    const projected = adapter.pathToScreen(control.point);

    if (!projected) {
      continue;
    }

    const distance = Math.hypot(
      projected[0] - screenPoint[0],
      projected[1] - screenPoint[1],
    );

    if (distance > hitRadius) {
      continue;
    }

    if (!nearest || distance < nearest.distance) {
      nearest = { control, distance };
    }
  }

  return nearest?.control ?? null;
}

export function selectViewMorphProfileEditControl(
  session: ViewMorphProfileEditSession,
  control: ViewMorphProfileEditControl,
): ViewMorphProfileEditDragState {
  session.selectedPlane = {
    kind: control.kind,
    planeId: control.planeId,
  };
  session.selected = {
    kind: control.kind,
    planeId: control.planeId,
    pointId: control.pointId,
  };

  return { ...session.selected };
}

export function dragViewMorphProfileEditControl(
  session: ViewMorphProfileEditSession,
  dragState: ViewMorphProfileEditDragState,
  point: ViewMorphPoint2D,
): void {
  setViewMorphProfilePoint(session, dragState, point);
  session.selectedPlane = {
    kind: dragState.kind,
    planeId: dragState.planeId,
  };
  session.selected = { ...dragState };
}

export function setViewMorphProfilePointAxisValue(
  session: ViewMorphProfileEditSession,
  selection: ViewMorphEditSelection,
  axisIndex: number,
  value: number,
): boolean {
  if (!Number.isFinite(value)) {
    return false;
  }

  const currentPoint = getViewMorphProfilePoint(session.draft, selection);

  if (!currentPoint) {
    return false;
  }

  const nextPoint: ViewMorphPoint2D = [...currentPoint.point];
  nextPoint[axisIndex] = roundBezierValue(value);
  setViewMorphProfilePoint(session, selection, nextPoint);
  session.selectedPlane = {
    kind: selection.kind,
    planeId: selection.planeId,
  };
  session.selected = { ...selection };
  return true;
}

export function viewMorphProfileEditSelectionsEqual(
  left: ViewMorphEditSelection | null,
  right: ViewMorphEditSelection | null,
): boolean {
  return (
    left?.kind === right?.kind &&
    left?.planeId === right?.planeId &&
    left?.pointId === right?.pointId
  );
}

export function toViewMorphProfileEditSelection(
  control: ViewMorphProfileEditControl | null,
): ViewMorphEditSelection | null {
  return control
    ? {
        kind: control.kind,
        planeId: control.planeId,
        pointId: control.pointId,
      }
    : null;
}

function setViewMorphProfilePoint(
  session: ViewMorphProfileEditSession,
  selection: ViewMorphEditSelection,
  point: ViewMorphPoint2D,
): void {
  const target = getViewMorphProfilePoint(session.draft, selection);

  if (!target) {
    return;
  }

  target.point = constrainViewMorphProfilePoint(session.draft, selection, point);
}

function constrainViewMorphProfilePoint(
  profile: ViewMorphProfile,
  selection: ViewMorphEditSelection,
  point: ViewMorphPoint2D,
): ViewMorphPoint2D {
  const nextPoint: ViewMorphPoint2D = [
    roundBezierValue(point[0]),
    roundBezierValue(point[1]),
  ];

  if (selection.kind === "vertical") {
    const path = getViewMorphProfileEditPath(profile, selection);
    const pointIndex =
      path?.points.findIndex((candidate) => candidate.id === selection.pointId) ??
      -1;
    const bottomIndex = path ? path.points.length / 2 : -1;

    if (pointIndex === 0 || pointIndex === bottomIndex) {
      return [0, nextPoint[1]];
    }
  }

  return nextPoint;
}

function getViewMorphProfilePoint(
  profile: ViewMorphProfile,
  selection: ViewMorphEditSelection,
): { id: string; point: ViewMorphPoint2D } | null {
  const path = getViewMorphProfileEditPath(profile, selection);

  return path?.points.find((point) => point.id === selection.pointId) ?? null;
}

export function getViewMorphProfileEditPath(
  profile: ViewMorphProfile,
  plane: ViewMorphEditPlaneRef,
): ViewMorphClosedPolyline | null {
  if (plane.kind === "horizontal") {
    return profile.horizontalPlane.id === plane.planeId
      ? profile.horizontalPlane.path
      : null;
  }

  return (
    profile.verticalPlanes.find((candidate) => candidate.id === plane.planeId)
      ?.path ?? null
  );
}
