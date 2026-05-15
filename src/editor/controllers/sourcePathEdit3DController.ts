import type { PrimitiveSvgAsset } from "../../core/assets/primitiveSvg";
import {
  addBezierPoints3D,
  getSourcePathEdit3DControlId,
  sourcePathEdit3DSelectionMatches,
  type SourcePathEdit3DSession,
} from "../tools/pathEdit3dCore";
import type {
  Curve3DControlComponent,
  Curve3DControlDescriptor,
  Curve3DHandleLineDescriptor,
  Vector3Tuple,
} from "../threeEditorViewport";

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
