import {
  cloneStructuredBezierPath,
  type StructuredBezierPath,
} from "../../core/assets/structuredBezierPath";
import type { PrimitiveSvgAsset } from "../../core/assets/primitiveAssetTypes";
import { canInPlaceEditPrimitiveAssetPath } from "../../core/assets/primitiveAssetCapabilities";
import type { PrefabNode } from "../api";
import {
  getPathEditScreenControls,
  type PathEditScreenControl,
  type PathEditSession,
  type PathEditViewportAdapter,
} from "../tools/pathEditCore";
import type { TimelineStagingPose } from "../timeline/stagingPose";
import { getRestoredPathEditSelection } from "./pathEditSessionControls";

export type InPlacePathEditSession = PathEditSession & {
  nodeId: string;
  assetId: string;
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

  if (!canInPlaceEditPrimitiveAssetPath(asset)) {
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
      canInPlaceEditPrimitiveAssetPath(asset) &&
      stagingPose,
  );
}

export function getInPlacePathEditScreenControls(input: {
  session: InPlacePathEditSession | null;
  adapter: PathEditViewportAdapter | null;
}): PathEditScreenControl[] {
  return getPathEditScreenControls(input.session, input.adapter);
}
