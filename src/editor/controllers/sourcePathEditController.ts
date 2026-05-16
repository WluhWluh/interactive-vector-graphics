import {
  cloneStructuredBezierPath3D,
  type StructuredBezierPath3D,
} from "../../core/assets/structuredBezierPath3d";
import type { PrimitiveSvgAsset } from "../../core/assets/primitiveAssetTypes";
import {
  getPrimitiveAssetCapabilities,
  primitiveAssetHas3DSourcePath,
} from "../../core/assets/primitiveAssetCapabilities";
import {
  createPathEditSession,
  getPathEditScreenControls,
  type PathEditDragState,
  type PathEditScreenControl,
  type PathEditSession,
  type PathEditViewportAdapter,
} from "../tools/pathEditCore";
import type { SourcePathEdit3DSession } from "../tools/pathEdit3dCore";
import {
  createViewMorphProfileEditSession,
  type ViewMorphProfileEditDragState,
  type ViewMorphProfileEditSession,
} from "../tools/viewMorphProfileEditCore";
import { getInitialPathEditSelection } from "./pathEditSessionControls";

export type SourcePathEditSession = PathEditSession & {
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
    }
  | {
      mode: "viewMorphProfile";
      session: ViewMorphProfileEditSession;
    };

export type SourcePathEditState = {
  pathEditSession: SourcePathEditSession | null;
  pathEdit3DSession: SourcePathEdit3DSession | null;
  viewMorphProfileEditSession: ViewMorphProfileEditSession | null;
  pathEditDragState: PathEditDragState | null;
  viewMorphProfileEditDragState: ViewMorphProfileEditDragState | null;
};

export function createSourcePathEditSession(
  asset: PrimitiveSvgAsset,
): PathEditSessionDraft {
  if (!getPrimitiveAssetCapabilities(asset).canSourcePathEdit) {
    throw new Error("This asset kind does not support Source Path Edit.");
  }

  if (asset.assetKind === "viewMorphProfile") {
    return {
      mode: "viewMorphProfile",
      session: createViewMorphProfileEditSession({
        assetId: asset.id,
        profile: asset.viewMorphProfile,
      }),
    };
  }

  if (primitiveAssetHas3DSourcePath(asset)) {
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
    viewMorphProfileEditSession:
      sessionDraft.mode === "viewMorphProfile" ? sessionDraft.session : null,
    pathEditDragState: null,
    viewMorphProfileEditDragState: null,
    mode: sessionDraft.mode,
  };
}

export function clearSourcePathEditState(): SourcePathEditState {
  return {
    pathEditSession: null,
    pathEdit3DSession: null,
    viewMorphProfileEditSession: null,
    pathEditDragState: null,
    viewMorphProfileEditDragState: null,
  };
}

export function getSourcePathEditScreenControls(input: {
  session: SourcePathEditSession | null;
  adapter: PathEditViewportAdapter | null;
}): PathEditScreenControl[] {
  return getPathEditScreenControls(input.session, input.adapter);
}

export type SourcePathEdit3DDraft = StructuredBezierPath3D;
