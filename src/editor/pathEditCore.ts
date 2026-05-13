import {
  cloneStructuredBezierPath,
  type BezierPoint,
  type BezierSegment,
  type StructuredBezierPath,
} from "../core/assets/structuredBezierPath";

export type PathEditComponent = "anchor" | "handleIn" | "handleOut";

export type PathEditSelection = {
  segmentId: string;
  component: PathEditComponent;
};

export type PathEditSession = {
  draft: StructuredBezierPath;
  selected: PathEditSelection | null;
};

export type PathEditDragState = PathEditSelection;

export type PathEditControl = {
  segmentId: string;
  component: PathEditComponent;
  point: BezierPoint;
};

export type PathEditScreenControl = {
  segmentId: string;
  component: PathEditComponent;
  x: number;
  y: number;
};

export type PathEditViewportAdapter = {
  pathToScreen(point: BezierPoint): BezierPoint | null;
  screenToPath(point: BezierPoint): BezierPoint | null;
};

export type PathEditDragModifiers = {
  altKey?: boolean;
  shiftKey?: boolean;
};

export function createPathEditSession(
  sourcePath: StructuredBezierPath,
): PathEditSession {
  return {
    draft: cloneStructuredBezierPath(sourcePath),
    selected: {
      segmentId: sourcePath.segments[0]?.id ?? "",
      component: "anchor",
    },
  };
}

export function clonePathEditSession(
  session: PathEditSession,
): PathEditSession {
  return {
    draft: cloneStructuredBezierPath(session.draft),
    selected: session.selected ? { ...session.selected } : null,
  };
}

export function getPathEditControls(
  path: StructuredBezierPath,
): PathEditControl[] {
  const controls: PathEditControl[] = [];

  for (const segment of path.segments) {
    controls.push({
      segmentId: segment.id,
      component: "handleIn",
      point: addBezierPoints(segment.anchor, segment.handleIn),
    });
    controls.push({
      segmentId: segment.id,
      component: "handleOut",
      point: addBezierPoints(segment.anchor, segment.handleOut),
    });
    controls.push({
      segmentId: segment.id,
      component: "anchor",
      point: segment.anchor,
    });
  }

  return controls;
}

export function getPathEditScreenControls(
  session: PathEditSession | null,
  adapter: PathEditViewportAdapter | null,
): PathEditScreenControl[] {
  if (!session || !adapter) {
    return [];
  }

  return getPathEditControls(session.draft)
    .map((control) => {
      const screenPoint = adapter.pathToScreen(control.point);

      if (!screenPoint) {
        return null;
      }

      return {
        segmentId: control.segmentId,
        component: control.component,
        x: screenPoint[0],
        y: screenPoint[1],
      };
    })
    .filter((control): control is PathEditScreenControl => control !== null);
}

export function findNearestPathEditControl(
  screenPoint: BezierPoint,
  session: PathEditSession,
  adapter: PathEditViewportAdapter,
  hitRadius: number,
): PathEditControl | null {
  let nearest: { control: PathEditControl; distance: number } | null = null;

  for (const control of getPathEditControls(session.draft)) {
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

    if (
      !nearest ||
      distance < nearest.distance ||
      (distance === nearest.distance &&
        nearest.control.component === "anchor" &&
        control.component !== "anchor")
    ) {
      nearest = { control, distance };
    }
  }

  return nearest?.control ?? null;
}

export function selectPathEditControl(
  session: PathEditSession,
  control: PathEditControl,
): PathEditDragState {
  session.selected = {
    segmentId: control.segmentId,
    component: control.component,
  };

  return { ...session.selected };
}

export function dragPathEditControl(
  session: PathEditSession,
  dragState: PathEditDragState,
  pathPoint: BezierPoint,
  _modifiers: PathEditDragModifiers = {},
): void {
  const segment = getPathEditSegment(session, dragState.segmentId);

  if (!segment) {
    return;
  }

  if (dragState.component === "anchor") {
    segment.anchor = pathPoint;
  } else {
    segment[dragState.component] = subtractBezierPoints(pathPoint, segment.anchor);
  }

  session.selected = {
    segmentId: dragState.segmentId,
    component: dragState.component,
  };
}

export function getSelectedPathEditSegment(
  session: PathEditSession | null,
): BezierSegment | null {
  if (!session?.selected) {
    return null;
  }

  return getPathEditSegment(session, session.selected.segmentId);
}

export function getPathEditSegment(
  session: PathEditSession | null,
  segmentId: string,
): BezierSegment | null {
  return session?.draft.segments.find((segment) => segment.id === segmentId) ?? null;
}

export function getPathEditComponentPoint(
  segment: BezierSegment,
  component: PathEditComponent,
): BezierPoint {
  if (component === "anchor") {
    return [...segment.anchor];
  }

  return [...segment[component]];
}

export function setPathEditComponentAxisValue(
  session: PathEditSession,
  segmentId: string,
  component: PathEditComponent,
  axisIndex: number,
  value: number,
): boolean {
  const segment = getPathEditSegment(session, segmentId);

  if (!segment || !Number.isFinite(value)) {
    return false;
  }

  const point = getPathEditComponentPoint(segment, component);
  point[axisIndex] = roundBezierValue(value);

  if (component === "anchor") {
    segment.anchor = point;
  } else {
    segment[component] = point;
  }

  session.selected = { segmentId, component };
  return true;
}

export function addBezierPoints(
  left: BezierPoint,
  right: BezierPoint,
): BezierPoint {
  return [roundBezierValue(left[0] + right[0]), roundBezierValue(left[1] + right[1])];
}

export function subtractBezierPoints(
  left: BezierPoint,
  right: BezierPoint,
): BezierPoint {
  return [roundBezierValue(left[0] - right[0]), roundBezierValue(left[1] - right[1])];
}

export function roundBezierValue(value: number): number {
  return Number(value.toFixed(4));
}
