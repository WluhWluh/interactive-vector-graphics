import {
  cloneStructuredBezierPath,
  type StructuredBezierPath,
} from "../../core/assets/structuredBezierPath";
import { cloneStructuredBezierPath3D } from "../../core/assets/structuredBezierPath3d";
import type { PrimitiveSvgAsset } from "../../core/assets/primitiveSvg";
import type { PrefabNode } from "../api";
import {
  createPathEditSession,
  type PathEditSelection,
  type PathEditSession,
} from "../tools/pathEditCore";
import type { SourcePathEdit3DSession } from "../tools/pathEdit3dCore";
import type { TimelineStagingPose } from "../timeline/stagingPose";

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
