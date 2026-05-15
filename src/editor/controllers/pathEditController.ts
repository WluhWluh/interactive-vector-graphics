import {
  cloneStructuredBezierPath,
  type BezierPoint,
  type StructuredBezierPath,
} from "../../core/assets/structuredBezierPath";
import {
  cloneStructuredBezierPath3D,
  type StructuredBezierPath3D,
} from "../../core/assets/structuredBezierPath3d";
import type { PrimitiveSvgAsset } from "../../core/assets/primitiveSvg";
import type { PrefabNode } from "../api";
import {
  dragPathEditControl,
  findNearestPathEditControl,
  createPathEditSession,
  getPathEditScreenControls,
  selectPathEditControl,
  type PathEditControl,
  type PathEditDragState,
  type PathEditSelection,
  type PathEditScreenControl,
  type PathEditSession,
  type PathEditViewportAdapter,
} from "../tools/pathEditCore";
import {
  addBezierPoints3D,
  getSourcePathEdit3DControlId,
  sourcePathEdit3DSelectionMatches,
  type SourcePathEdit3DSession,
} from "../tools/pathEdit3dCore";
import type { TimelineStagingPose } from "../timeline/stagingPose";
import type {
  Curve3DControlComponent,
  Curve3DControlDescriptor,
  Curve3DHandleLineDescriptor,
  Vector3Tuple,
} from "../threeEditorViewport";

export type SourcePathEditSession = PathEditSession & {
  assetId: string;
};

export type InPlacePathEditSession = PathEditSession & {
  nodeId: string;
  assetId: string;
};

export type PathEditSessionDraft =
  | {
      mode: "2d";
      session: SourcePathEditSession;
    }
  | {
      mode: "3d";
      session: SourcePathEdit3DSession;
    };

export type SourcePathEditState = {
  pathEditSession: SourcePathEditSession | null;
  pathEdit3DSession: SourcePathEdit3DSession | null;
  pathEditDragState: PathEditDragState | null;
};

export type InPlacePathEditSessionInput = {
  selectedNode: PrefabNode | null;
  asset: PrimitiveSvgAsset | null;
  stagingPose: TimelineStagingPose | null;
  previousSession: InPlacePathEditSession | null;
};

export type InPlacePathEditSessionResult =
  | {
      ok: true;
      session: InPlacePathEditSession;
      pathDraft: StructuredBezierPath;
    }
  | {
      ok: false;
      error: string | null;
    };

export function createSourcePathEditSession(
  asset: PrimitiveSvgAsset,
): PathEditSessionDraft {
  if (asset.assetKind === "bezierCurve3d") {
    return {
      mode: "3d",
      session: {
        assetId: asset.id,
        draft: cloneStructuredBezierPath3D(asset.bezierPath3d),
        selected: getInitialPathEditSelection(asset.bezierPath3d),
      },
    };
  }

  return {
    mode: "2d",
    session: {
      ...createPathEditSession(asset.bezierPath),
      assetId: asset.id,
    },
  };
}

export function startSourcePathEditState(
  asset: PrimitiveSvgAsset,
): SourcePathEditState & { mode: PathEditSessionDraft["mode"] } {
  const sessionDraft = createSourcePathEditSession(asset);

  return {
    pathEditSession: sessionDraft.mode === "2d" ? sessionDraft.session : null,
    pathEdit3DSession: sessionDraft.mode === "3d" ? sessionDraft.session : null,
    pathEditDragState: null,
    mode: sessionDraft.mode,
  };
}

export function clearSourcePathEditState(): SourcePathEditState {
  return {
    pathEditSession: null,
    pathEdit3DSession: null,
    pathEditDragState: null,
  };
}

export function createInPlacePathEditSession(
  input: InPlacePathEditSessionInput,
): InPlacePathEditSessionResult {
  const { selectedNode, asset, stagingPose, previousSession } = input;

  if (!selectedNode || selectedNode.kind !== "primitive" || !asset || !stagingPose) {
    return {
      ok: false,
      error: null,
    };
  }

  if (asset.assetKind === "bezierCurve3d") {
    return {
      ok: false,
      error: "3D curve path keyframes are not supported yet.",
    };
  }

  const pathDraft = stagingPose.pathDraft
    ? cloneStructuredBezierPath(stagingPose.pathDraft)
    : cloneStructuredBezierPath(asset.bezierPath);
  const previousSelection =
    previousSession?.nodeId === selectedNode.id ? previousSession.selected : null;

  return {
    ok: true,
    pathDraft,
    session: {
      draft: pathDraft,
      selected: getRestoredPathEditSelection(pathDraft, previousSelection),
      nodeId: selectedNode.id,
      assetId: asset.id,
    },
  };
}

export function isInPlacePathEditSessionValid(input: {
  session: InPlacePathEditSession | null;
  selectedNodeId: string | null;
  node: PrefabNode | null;
  asset: PrimitiveSvgAsset | null;
  stagingPose: TimelineStagingPose | null;
  hasActiveClip: boolean;
}): boolean {
  const { session, selectedNodeId, node, asset, stagingPose, hasActiveClip } = input;

  return Boolean(
    session &&
      hasActiveClip &&
      node &&
      node.kind === "primitive" &&
      node.id === selectedNodeId &&
      asset &&
      node.assetId === asset.id &&
      stagingPose,
  );
}

export function getSourcePathEditScreenControls(input: {
  session: SourcePathEditSession | null;
  adapter: PathEditViewportAdapter | null;
}): PathEditScreenControl[] {
  return getPathEditScreenControls(input.session, input.adapter);
}

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

export function getInPlacePathEditScreenControls(input: {
  session: InPlacePathEditSession | null;
  adapter: PathEditViewportAdapter | null;
}): PathEditScreenControl[] {
  return getPathEditScreenControls(input.session, input.adapter);
}

export function getSourcePathEdit3DControls(input: {
  session: SourcePathEdit3DSession | null;
  getAssetById: (assetId: string) => PrimitiveSvgAsset | null;
  transformPoint3DToWorldUnit: (
    point: Vector3Tuple,
    asset: PrimitiveSvgAsset,
  ) => Vector3Tuple;
}): Curve3DControlDescriptor[] {
  const { session, getAssetById, transformPoint3DToWorldUnit } = input;

  if (!session) {
    return [];
  }

  const asset = getAssetById(session.assetId);

  if (!asset) {
    return [];
  }

  return session.draft.segments.flatMap((segment) => {
    const anchorSelected = sourcePathEdit3DSelectionMatches(
      session.selected,
      segment.id,
      "anchor",
    );
    const handleInSelected = sourcePathEdit3DSelectionMatches(
      session.selected,
      segment.id,
      "handleIn",
    );
    const handleOutSelected = sourcePathEdit3DSelectionMatches(
      session.selected,
      segment.id,
      "handleOut",
    );

    return [
      {
        id: getSourcePathEdit3DControlId(segment.id, "handleIn"),
        segmentId: segment.id,
        component: "handleIn" as Curve3DControlComponent,
        position: transformPoint3DToWorldUnit(
          addBezierPoints3D(segment.anchor, segment.handleIn),
          asset,
        ),
        selected: handleInSelected,
      },
      {
        id: getSourcePathEdit3DControlId(segment.id, "handleOut"),
        segmentId: segment.id,
        component: "handleOut" as Curve3DControlComponent,
        position: transformPoint3DToWorldUnit(
          addBezierPoints3D(segment.anchor, segment.handleOut),
          asset,
        ),
        selected: handleOutSelected,
      },
      {
        id: getSourcePathEdit3DControlId(segment.id, "anchor"),
        segmentId: segment.id,
        component: "anchor" as Curve3DControlComponent,
        position: transformPoint3DToWorldUnit(segment.anchor, asset),
        selected: anchorSelected,
      },
    ];
  });
}

export function getSourcePathEdit3DHandleLines(input: {
  session: SourcePathEdit3DSession | null;
  getAssetById: (assetId: string) => PrimitiveSvgAsset | null;
  transformPoint3DToWorldUnit: (
    point: Vector3Tuple,
    asset: PrimitiveSvgAsset,
  ) => Vector3Tuple;
}): Curve3DHandleLineDescriptor[] {
  const { session, getAssetById, transformPoint3DToWorldUnit } = input;

  if (!session) {
    return [];
  }

  const asset = getAssetById(session.assetId);

  if (!asset) {
    return [];
  }

  return session.draft.segments.flatMap((segment) => [
    {
      start: transformPoint3DToWorldUnit(segment.anchor, asset),
      end: transformPoint3DToWorldUnit(
        addBezierPoints3D(segment.anchor, segment.handleIn),
        asset,
      ),
    },
    {
      start: transformPoint3DToWorldUnit(segment.anchor, asset),
      end: transformPoint3DToWorldUnit(
        addBezierPoints3D(segment.anchor, segment.handleOut),
        asset,
      ),
    },
  ]);
}

export type SourcePathEditDebugState = {
  is3d: boolean;
  assetId: string | null;
  selectedSegmentId: string | null;
  selectedComponent: PathEditSelection["component"] | null;
  hoveredSegmentId: string | null;
  hoveredComponent: PathEditSelection["component"] | null;
  hasDraft: boolean;
  draftBezierPath: StructuredBezierPath | null;
  draftBezierPath3d: StructuredBezierPath3D | null;
  controls: PathEditScreenControl[];
  controls3d: Curve3DControlDescriptor[];
  projectedCommandCount: number;
};

export function createSourcePathEditDebugState(input: {
  pathEditSession: SourcePathEditSession | null;
  pathEdit3DSession: SourcePathEdit3DSession | null;
  hoveredControl: PathEditSelection | null;
  controls: PathEditScreenControl[];
  controls3d: Curve3DControlDescriptor[];
  projectedCommandCount: number;
}): SourcePathEditDebugState {
  const { pathEditSession, pathEdit3DSession } = input;

  return {
    is3d: Boolean(pathEdit3DSession),
    assetId: pathEdit3DSession?.assetId ?? pathEditSession?.assetId ?? null,
    selectedSegmentId:
      pathEdit3DSession?.selected?.segmentId ??
      pathEditSession?.selected?.segmentId ??
      null,
    selectedComponent:
      pathEdit3DSession?.selected?.component ??
      pathEditSession?.selected?.component ??
      null,
    hoveredSegmentId: input.hoveredControl?.segmentId ?? null,
    hoveredComponent: input.hoveredControl?.component ?? null,
    hasDraft: Boolean(pathEditSession || pathEdit3DSession),
    draftBezierPath: pathEditSession
      ? cloneStructuredBezierPath(pathEditSession.draft)
      : null,
    draftBezierPath3d: pathEdit3DSession
      ? cloneStructuredBezierPath3D(pathEdit3DSession.draft)
      : null,
    controls: input.controls,
    controls3d: input.controls3d,
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

function getInitialPathEditSelection(path: {
  segments: Array<{ id: string }>;
}): PathEditSelection {
  return {
    segmentId: path.segments[0]?.id ?? "",
    component: "anchor",
  };
}
