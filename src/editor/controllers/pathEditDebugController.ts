import {
  cloneStructuredBezierPath,
  type StructuredBezierPath,
} from "../../core/assets/structuredBezierPath";
import {
  cloneStructuredBezierPath3D,
  type StructuredBezierPath3D,
} from "../../core/assets/structuredBezierPath3d";
import { cloneViewMorphProfile } from "../../core/assets/viewMorphProfile";
import type {
  PathEditScreenControl,
  PathEditSelection,
} from "../tools/pathEditCore";
import type { SourcePathEdit3DSession } from "../tools/pathEdit3dCore";
import type { Curve3DControlDescriptor } from "../threeEditorViewport";
import type {
  ViewMorphEditSelection,
  ViewMorphProfileEditScreenControl,
  ViewMorphProfileEditSession,
} from "../tools/viewMorphProfileEditCore";
import type { InPlacePathEditSession } from "./inPlacePathEditController";
import type { SourcePathEditSession } from "./sourcePathEditController";

export type SourcePathEditDebugState = {
  is3d: boolean;
  isViewMorphProfile: boolean;
  assetId: string | null;
  selectedSegmentId: string | null;
  selectedComponent: PathEditSelection["component"] | null;
  selectedPlaneId: string | null;
  selectedPointId: string | null;
  hoveredSegmentId: string | null;
  hoveredComponent: PathEditSelection["component"] | null;
  hoveredPlaneId: string | null;
  hoveredPointId: string | null;
  hasDraft: boolean;
  draftBezierPath: StructuredBezierPath | null;
  draftBezierPath3d: StructuredBezierPath3D | null;
  draftViewMorphProfile: ViewMorphProfileEditSession["draft"] | null;
  controls: PathEditScreenControl[];
  controls3d: Curve3DControlDescriptor[];
  viewMorphControls: ViewMorphProfileEditScreenControl[];
  projectedCommandCount: number;
};

export function createSourcePathEditDebugState(input: {
  pathEditSession: SourcePathEditSession | null;
  pathEdit3DSession: SourcePathEdit3DSession | null;
  viewMorphProfileEditSession: ViewMorphProfileEditSession | null;
  hoveredControl: PathEditSelection | null;
  hoveredViewMorphControl: ViewMorphEditSelection | null;
  controls: PathEditScreenControl[];
  controls3d: Curve3DControlDescriptor[];
  viewMorphControls: ViewMorphProfileEditScreenControl[];
  projectedCommandCount: number;
}): SourcePathEditDebugState {
  const { pathEditSession, pathEdit3DSession, viewMorphProfileEditSession } =
    input;

  return {
    is3d: Boolean(pathEdit3DSession),
    isViewMorphProfile: Boolean(viewMorphProfileEditSession),
    assetId:
      viewMorphProfileEditSession?.assetId ??
      pathEdit3DSession?.assetId ??
      pathEditSession?.assetId ??
      null,
    selectedSegmentId:
      pathEdit3DSession?.selected?.segmentId ??
      pathEditSession?.selected?.segmentId ??
      null,
    selectedComponent:
      pathEdit3DSession?.selected?.component ??
      pathEditSession?.selected?.component ??
      null,
    selectedPlaneId: viewMorphProfileEditSession?.selected?.planeId ?? null,
    selectedPointId: viewMorphProfileEditSession?.selected?.pointId ?? null,
    hoveredSegmentId: input.hoveredControl?.segmentId ?? null,
    hoveredComponent: input.hoveredControl?.component ?? null,
    hoveredPlaneId: input.hoveredViewMorphControl?.planeId ?? null,
    hoveredPointId: input.hoveredViewMorphControl?.pointId ?? null,
    hasDraft: Boolean(
      pathEditSession || pathEdit3DSession || viewMorphProfileEditSession,
    ),
    draftBezierPath: pathEditSession
      ? cloneStructuredBezierPath(pathEditSession.draft)
      : null,
    draftBezierPath3d: pathEdit3DSession
      ? cloneStructuredBezierPath3D(pathEdit3DSession.draft)
      : null,
    draftViewMorphProfile: viewMorphProfileEditSession
      ? cloneViewMorphProfile(viewMorphProfileEditSession.draft)
      : null,
    controls: input.controls,
    controls3d: input.controls3d,
    viewMorphControls: input.viewMorphControls,
    projectedCommandCount: input.projectedCommandCount,
  };
}

export type InPlacePathEditDebugState = {
  nodeId: string | null;
  assetId: string | null;
  active: boolean;
  hasDraft: boolean;
  selectedSegmentId: string | null;
  selectedComponent: PathEditSelection["component"] | null;
  hoveredSegmentId: string | null;
  hoveredComponent: PathEditSelection["component"] | null;
  draftBezierPath: StructuredBezierPath | null;
  controls: PathEditScreenControl[];
};

export function createInPlacePathEditDebugState(input: {
  session: InPlacePathEditSession | null;
  active: boolean;
  hoveredControl: PathEditSelection | null;
  controls: PathEditScreenControl[];
}): InPlacePathEditDebugState {
  return {
    nodeId: input.session?.nodeId ?? null,
    assetId: input.session?.assetId ?? null,
    active: input.active,
    hasDraft: Boolean(input.session),
    selectedSegmentId: input.session?.selected?.segmentId ?? null,
    selectedComponent: input.session?.selected?.component ?? null,
    hoveredSegmentId: input.hoveredControl?.segmentId ?? null,
    hoveredComponent: input.hoveredControl?.component ?? null,
    draftBezierPath: input.session
      ? cloneStructuredBezierPath(input.session.draft)
      : null,
    controls: input.controls,
  };
}
