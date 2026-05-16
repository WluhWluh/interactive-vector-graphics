import paper from "paper";
import type { StructuredBezierPath } from "./structuredBezierPath";

export type ViewMorphPoint2D = [number, number];
export type ViewMorphPoint3D = [number, number, number];

export type ViewMorphPolylinePoint = {
  id: string;
  point: ViewMorphPoint2D;
};

export type ViewMorphClosedPolyline = {
  points: ViewMorphPolylinePoint[];
};

export type ViewMorphVerticalPlane = {
  id: string;
  name: string;
  normal: ViewMorphPoint3D;
  tangentU: ViewMorphPoint3D;
  path: ViewMorphClosedPolyline;
};

export type ViewMorphHorizontalPlane = {
  id: string;
  name: string;
  normal: [0, 1, 0];
  tangentU: [1, 0, 0];
  tangentV: [0, 0, 1];
  path: ViewMorphClosedPolyline;
};

export type ViewMorphProfile = {
  version: 1;
  center: ViewMorphPoint3D;
  verticalPlanes: ViewMorphVerticalPlane[];
  horizontalPlane: ViewMorphHorizontalPlane;
};

export type ViewMorphVerticalBlendDebug = {
  leftPlaneId: string;
  rightPlaneId: string;
  leftWeight: number;
  rightWeight: number;
  leftMirrored: boolean;
  rightMirrored: boolean;
};

export type ViewMorphProfileEvaluationDebug = {
  verticalBlend: ViewMorphVerticalBlendDebug;
  horizontalWeight: number;
  verticalWeight: number;
  horizontalRotationRad: number;
};

export type ViewMorphProfileEvaluationOptions = {
  horizontalRotationReferenceLocal?: ViewMorphPoint3D;
  screenUpReferenceLocal?: ViewMorphPoint3D;
};

type ViewMorphHorizontalBasis2D = {
  right: ViewMorphPoint2D;
  up: ViewMorphPoint2D;
};

export class ViewMorphProfileError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ViewMorphProfileError";
  }
}

const DEFAULT_RADIUS = 50;
const EPSILON = 0.000001;

export const VIEW_MORPH_PROFILE_DEFAULT_VIEW_BOX: [number, number, number, number] = [
  -50,
  -50,
  100,
  100,
];

paper.setup([1, 1]);

export function createDefaultViewMorphProfile(): ViewMorphProfile {
  const verticalPath = createDefaultVerticalPolyline();
  const horizontalPath = createDefaultHorizontalPolyline();

  return {
    version: 1,
    center: [0, 0, 0],
    verticalPlanes: [
      {
        id: "vertical-front",
        name: "Front",
        normal: [0, 0, 1],
        tangentU: [1, 0, 0],
        path: cloneViewMorphClosedPolyline(verticalPath),
      },
      {
        id: "vertical-side",
        name: "Side",
        normal: [1, 0, 0],
        tangentU: [0, 0, -1],
        path: cloneViewMorphClosedPolyline(verticalPath),
      },
    ],
    horizontalPlane: {
      id: "horizontal-top",
      name: "Top",
      normal: [0, 1, 0],
      tangentU: [1, 0, 0],
      tangentV: [0, 0, 1],
      path: horizontalPath,
    },
  };
}

export function cloneViewMorphProfile(profile: ViewMorphProfile): ViewMorphProfile {
  return {
    version: 1,
    center: [...profile.center],
    verticalPlanes: profile.verticalPlanes.map((plane) => ({
      id: plane.id,
      name: plane.name,
      normal: [...plane.normal],
      tangentU: [...plane.tangentU],
      path: cloneViewMorphClosedPolyline(plane.path),
    })),
    horizontalPlane: {
      id: profile.horizontalPlane.id,
      name: profile.horizontalPlane.name,
      normal: [0, 1, 0],
      tangentU: [1, 0, 0],
      tangentV: [0, 0, 1],
      path: cloneViewMorphClosedPolyline(profile.horizontalPlane.path),
    },
  };
}

export function cloneViewMorphClosedPolyline(
  path: ViewMorphClosedPolyline,
): ViewMorphClosedPolyline {
  return {
    points: path.points.map((point) => ({
      id: point.id,
      point: [...point.point],
    })),
  };
}

export function validateViewMorphProfile(profile: unknown): ViewMorphProfile {
  if (!profile || typeof profile !== "object") {
    throw new ViewMorphProfileError("view morph profile must be an object");
  }

  const candidate = profile as Partial<ViewMorphProfile>;

  if (candidate.version !== 1) {
    throw new ViewMorphProfileError("view morph profile version must be 1");
  }

  const center = readFinitePoint3D(candidate.center, "center");

  if (!Array.isArray(candidate.verticalPlanes) || candidate.verticalPlanes.length < 2) {
    throw new ViewMorphProfileError(
      "view morph profile must contain at least two vertical planes",
    );
  }

  const verticalPlaneIds = new Set<string>();
  const verticalPlanes = candidate.verticalPlanes.map((plane, index) =>
    validateVerticalPlane(plane, index, verticalPlaneIds),
  );
  const horizontalPlane = validateHorizontalPlane(candidate.horizontalPlane);

  validateVerticalPlaneTopology(verticalPlanes);

  return {
    version: 1,
    center,
    verticalPlanes,
    horizontalPlane,
  };
}

export function evaluateViewMorphProfileToBezierPath(
  profile: ViewMorphProfile,
  viewDirectionLocal: ViewMorphPoint3D,
  options: ViewMorphProfileEvaluationOptions = {},
): StructuredBezierPath {
  return evaluateViewMorphProfile(profile, viewDirectionLocal, options).path;
}

export function evaluateViewMorphProfile(
  profile: ViewMorphProfile,
  viewDirectionLocal: ViewMorphPoint3D,
  options: ViewMorphProfileEvaluationOptions = {},
): { path: StructuredBezierPath; debug: ViewMorphProfileEvaluationDebug } {
  const validatedProfile = validateViewMorphProfile(profile);
  const viewDirection = normalizePoint3D(viewDirectionLocal, "viewDirectionLocal");
  const horizontalViewDirection = normalizePoint2D(
    [viewDirection[0], viewDirection[2]],
    [0, 1],
  );
  const horizontalBasis = resolveHorizontalRenderBasis(
    viewDirection,
    options.horizontalRotationReferenceLocal,
    options.screenUpReferenceLocal,
  );
  const verticalBlend = blendVerticalPlanes(
    validatedProfile.verticalPlanes,
    horizontalViewDirection,
  );
  const rotatedHorizontalPath = rotateHorizontalPolylineForView(
    validatedProfile.horizontalPlane.path,
    horizontalBasis,
  );
  const horizontalWeight = Math.abs(viewDirection[1]);
  const verticalWeight = Math.max(0, Math.hypot(viewDirection[0], viewDirection[2]));
  const totalWeight = horizontalWeight + verticalWeight;
  const normalizedHorizontalWeight =
    totalWeight <= EPSILON ? 0 : horizontalWeight / totalWeight;
  const normalizedVerticalWeight =
    totalWeight <= EPSILON ? 1 : verticalWeight / totalWeight;

  return {
    path: blendSmoothedViewMorphPaths(
      verticalBlend.path,
      rotatedHorizontalPath,
      normalizedVerticalWeight,
      normalizedHorizontalWeight,
    ),
    debug: {
      verticalBlend: verticalBlend.debug,
      horizontalWeight: roundNumber(normalizedHorizontalWeight),
      verticalWeight: roundNumber(normalizedVerticalWeight),
      horizontalRotationRad: getHorizontalRotationForView(horizontalBasis.right),
    },
  };
}

export function createViewMorphPreviewPath(profile: ViewMorphProfile): StructuredBezierPath {
  return evaluateViewMorphProfileToBezierPath(profile, [0, 0, 1]);
}

export function smoothViewMorphPolylineToBezierPath(
  path: ViewMorphClosedPolyline,
): StructuredBezierPath {
  return smoothPolylineToBezierPath(path);
}

function validateVerticalPlane(
  plane: unknown,
  index: number,
  ids: Set<string>,
): ViewMorphVerticalPlane {
  if (!plane || typeof plane !== "object") {
    throw new ViewMorphProfileError(`verticalPlanes[${index}] must be an object`);
  }

  const candidate = plane as Partial<ViewMorphVerticalPlane>;

  if (typeof candidate.id !== "string" || !candidate.id.trim()) {
    throw new ViewMorphProfileError(`verticalPlanes[${index}].id is required`);
  }

  if (ids.has(candidate.id)) {
    throw new ViewMorphProfileError(
      `duplicate vertical plane id "${candidate.id}"`,
    );
  }

  ids.add(candidate.id);

  const normal = normalizePoint3D(
    readFinitePoint3D(candidate.normal, `verticalPlanes[${index}].normal`),
    `verticalPlanes[${index}].normal`,
  );
  const tangentU = normalizePoint3D(
    readFinitePoint3D(candidate.tangentU, `verticalPlanes[${index}].tangentU`),
    `verticalPlanes[${index}].tangentU`,
  );

  if (Math.abs(normal[1]) > EPSILON || Math.abs(tangentU[1]) > EPSILON) {
    throw new ViewMorphProfileError(
      `verticalPlanes[${index}] must keep the Y axis inside the plane`,
    );
  }

  if (Math.abs(dotPoint3D(normal, tangentU)) > 0.0001) {
    throw new ViewMorphProfileError(
      `verticalPlanes[${index}].normal and tangentU must be perpendicular`,
    );
  }

  return {
    id: candidate.id,
    name:
      typeof candidate.name === "string" && candidate.name.trim()
        ? candidate.name
        : candidate.id,
    normal,
    tangentU,
    path: validateClosedPolyline(candidate.path, `verticalPlanes[${index}].path`),
  };
}

function validateHorizontalPlane(plane: unknown): ViewMorphHorizontalPlane {
  if (!plane || typeof plane !== "object") {
    throw new ViewMorphProfileError("horizontalPlane must be an object");
  }

  const candidate = plane as Partial<ViewMorphHorizontalPlane>;

  if (typeof candidate.id !== "string" || !candidate.id.trim()) {
    throw new ViewMorphProfileError("horizontalPlane.id is required");
  }

  const path = validateClosedPolyline(candidate.path, "horizontalPlane.path");

  return {
    id: candidate.id,
    name:
      typeof candidate.name === "string" && candidate.name.trim()
        ? candidate.name
        : candidate.id,
    normal: [0, 1, 0],
    tangentU: [1, 0, 0],
    tangentV: [0, 0, 1],
    path,
  };
}

function validateClosedPolyline(
  path: unknown,
  pathLabel: string,
): ViewMorphClosedPolyline {
  if (!path || typeof path !== "object") {
    throw new ViewMorphProfileError(`${pathLabel} must be an object`);
  }

  const candidate = path as Partial<ViewMorphClosedPolyline>;

  if (!Array.isArray(candidate.points) || candidate.points.length < 4) {
    throw new ViewMorphProfileError(`${pathLabel} must contain at least 4 points`);
  }

  const ids = new Set<string>();
  const points = candidate.points.map((point, index) => {
    if (!point || typeof point !== "object") {
      throw new ViewMorphProfileError(`${pathLabel}.points[${index}] is required`);
    }

    const candidatePoint = point as Partial<ViewMorphPolylinePoint>;

    if (typeof candidatePoint.id !== "string" || !candidatePoint.id.trim()) {
      throw new ViewMorphProfileError(`${pathLabel}.points[${index}].id is required`);
    }

    if (ids.has(candidatePoint.id)) {
      throw new ViewMorphProfileError(
        `duplicate point id "${candidatePoint.id}" in ${pathLabel}`,
      );
    }

    ids.add(candidatePoint.id);

    return {
      id: candidatePoint.id,
      point: readFinitePoint2D(
        candidatePoint.point,
        `${pathLabel}.points[${index}].point`,
      ),
    };
  });

  return { points };
}

function validateVerticalPlaneTopology(planes: ViewMorphVerticalPlane[]): void {
  const [firstPlane] = planes;

  if (!firstPlane) {
    return;
  }

  const referenceIds = firstPlane.path.points.map((point) => point.id);

  if (referenceIds.length % 2 !== 0) {
    throw new ViewMorphProfileError(
      "vertical plane paths must have an even number of points",
    );
  }

  const topPoint = firstPlane.path.points[0];
  const bottomPoint = firstPlane.path.points[referenceIds.length / 2];

  if (!topPoint || !bottomPoint) {
    throw new ViewMorphProfileError("vertical plane paths are missing Y-axis points");
  }

  for (const plane of planes) {
    if (plane.path.points.length !== referenceIds.length) {
      throw new ViewMorphProfileError(
        "all vertical plane paths must have the same point count",
      );
    }

    for (const [index, point] of plane.path.points.entries()) {
      if (point.id !== referenceIds[index]) {
        throw new ViewMorphProfileError(
          "all vertical plane paths must share point id order",
        );
      }
    }

    const planeTop = plane.path.points[0];
    const planeBottom = plane.path.points[referenceIds.length / 2];

    if (
      !planeTop ||
      !planeBottom ||
      Math.abs(planeTop.point[0]) > EPSILON ||
      Math.abs(planeBottom.point[0]) > EPSILON
    ) {
      throw new ViewMorphProfileError(
        "vertical plane top/bottom points must stay on the Y axis",
      );
    }
  }
}

function blendVerticalPlanes(
  planes: ViewMorphVerticalPlane[],
  horizontalViewDirection: ViewMorphPoint2D,
): { path: ViewMorphClosedPolyline; debug: ViewMorphVerticalBlendDebug } {
  const orientedPlanes = planes.flatMap((plane) => [
    createOrientedVerticalPlane(plane, false),
    createOrientedVerticalPlane(plane, true),
  ]);
  const sortedPlanes = orientedPlanes.sort(
    (left, right) => left.angleRad - right.angleRad,
  );
  const viewAngle = normalizeAngle(Math.atan2(horizontalViewDirection[1], horizontalViewDirection[0]));
  const exactMatch = sortedPlanes.find(
    (plane) => dotPoint2D(horizontalViewDirection, plane.normal2D) > 1 - 0.0001,
  );

  if (exactMatch) {
    return {
      path: exactMatch.mirrored
        ? mirrorPolylineHorizontally(exactMatch.source.path)
        : cloneViewMorphClosedPolyline(exactMatch.source.path),
      debug: {
        leftPlaneId: exactMatch.source.id,
        rightPlaneId: exactMatch.source.id,
        leftWeight: 1,
        rightWeight: 0,
        leftMirrored: exactMatch.mirrored,
        rightMirrored: exactMatch.mirrored,
      },
    };
  }

  let bestPair = {
    left: sortedPlanes[0],
    right: sortedPlanes[1] ?? sortedPlanes[0],
    width: Number.POSITIVE_INFINITY,
  };

  for (let index = 0; index < sortedPlanes.length; index += 1) {
    const left = sortedPlanes[index];
    const right = sortedPlanes[(index + 1) % sortedPlanes.length];

    const leftAngle = left?.angleRad ?? 0;
    const rightAngle =
      index + 1 < sortedPlanes.length
        ? right?.angleRad ?? 0
        : (right?.angleRad ?? 0) + Math.PI * 2;
    const width = rightAngle - leftAngle;

    if (!left || !right || left.source.id === right.source.id || width <= EPSILON) {
      continue;
    }

    const adjustedViewAngle =
      viewAngle < leftAngle ? viewAngle + Math.PI * 2 : viewAngle;

    if (
      adjustedViewAngle + EPSILON >= leftAngle &&
      adjustedViewAngle <= rightAngle + EPSILON &&
      width < bestPair.width
    ) {
      bestPair = {
        left,
        right,
        width,
      };
    }
  }

  const leftDot = Math.max(0, dotPoint2D(horizontalViewDirection, bestPair.left.normal2D));
  const rightDot = Math.max(0, dotPoint2D(horizontalViewDirection, bestPair.right.normal2D));
  const totalDot = leftDot + rightDot;
  const leftWeight = totalDot <= EPSILON ? 0.5 : leftDot / totalDot;
  const rightWeight = totalDot <= EPSILON ? 0.5 : rightDot / totalDot;
  const leftPath = bestPair.left.mirrored
    ? mirrorPolylineHorizontally(bestPair.left.source.path)
    : bestPair.left.source.path;
  const rightPath = bestPair.right.mirrored
    ? mirrorPolylineHorizontally(bestPair.right.source.path)
    : bestPair.right.source.path;

  return {
    path: blendPolylines(leftPath, rightPath, leftWeight, rightWeight),
    debug: {
      leftPlaneId: bestPair.left.source.id,
      rightPlaneId: bestPair.right.source.id,
      leftWeight: roundNumber(leftWeight),
      rightWeight: roundNumber(rightWeight),
      leftMirrored: bestPair.left.mirrored,
      rightMirrored: bestPair.right.mirrored,
    },
  };
}

function createOrientedVerticalPlane(
  plane: ViewMorphVerticalPlane,
  mirrored: boolean,
): {
  source: ViewMorphVerticalPlane;
  normal2D: ViewMorphPoint2D;
  angleRad: number;
  mirrored: boolean;
} {
  const normal2D: ViewMorphPoint2D = mirrored
    ? [-plane.normal[0], -plane.normal[2]]
    : [plane.normal[0], plane.normal[2]];
  const normalized = normalizePoint2D(normal2D, [1, 0]);

  return {
    source: plane,
    normal2D: normalized,
    angleRad: normalizeAngle(Math.atan2(normalized[1], normalized[0])),
    mirrored,
  };
}

function blendPolylines(
  left: ViewMorphClosedPolyline,
  right: ViewMorphClosedPolyline,
  leftWeight: number,
  rightWeight: number,
): ViewMorphClosedPolyline {
  return {
    points: left.points.map((leftPoint, index) => {
      const rightPoint = right.points[index] ?? leftPoint;

      return {
        id: leftPoint.id,
        point: blend2DPoints(leftPoint.point, rightPoint.point, leftWeight, rightWeight),
      };
    }),
  };
}

function mirrorPolylineHorizontally(
  path: ViewMorphClosedPolyline,
): ViewMorphClosedPolyline {
  const pointCount = path.points.length;
  const bottomIndex = pointCount / 2;

  return {
    points: path.points.map((point, index) => {
      const sourceIndex =
        index === 0 || index === bottomIndex
          ? index
          : (pointCount - index) % pointCount;
      const sourcePoint = path.points[sourceIndex] ?? point;

      return {
        id: point.id,
        point: roundPoint2D([-sourcePoint.point[0], sourcePoint.point[1]]),
      };
    }),
  };
}

function rotateHorizontalPolylineForView(
  path: ViewMorphClosedPolyline,
  basis: ViewMorphHorizontalBasis2D,
): ViewMorphClosedPolyline {
  return {
    points: path.points.map((point) => ({
      id: point.id,
      point: roundPoint2D([
        point.point[0] * basis.right[0] + point.point[1] * basis.up[0],
        point.point[0] * basis.right[1] + point.point[1] * basis.up[1],
      ]),
    })),
  };
}

function resolveHorizontalRenderBasis(
  viewDirection: ViewMorphPoint3D,
  horizontalRotationReferenceLocal: ViewMorphPoint3D | undefined,
  screenUpReferenceLocal: ViewMorphPoint3D | undefined,
): ViewMorphHorizontalBasis2D {
  const normalSide = viewDirection[1] < -EPSILON ? -1 : 1;

  if (horizontalRotationReferenceLocal && screenUpReferenceLocal) {
    const screenRightOnHorizontalPlane = normalizePoint2D(
      [horizontalRotationReferenceLocal[0], horizontalRotationReferenceLocal[2]],
      null,
    );
    const screenUpOnHorizontalPlane = normalizePoint2D(
      [screenUpReferenceLocal[0], screenUpReferenceLocal[2]],
      null,
    );

    if (screenRightOnHorizontalPlane && screenUpOnHorizontalPlane) {
      return {
        right: [
          screenRightOnHorizontalPlane[0] * normalSide,
          -screenUpOnHorizontalPlane[0] * normalSide,
        ],
        up: [
          screenRightOnHorizontalPlane[1],
          -screenUpOnHorizontalPlane[1],
        ],
      };
    }
  }

  const horizontalViewDirection = normalizePoint2D(
    [viewDirection[0], viewDirection[2]],
    null,
  );

  if (horizontalViewDirection) {
    return {
      right: [
        horizontalViewDirection[0] * normalSide,
        horizontalViewDirection[1] * normalSide,
      ],
      up: [-horizontalViewDirection[1], horizontalViewDirection[0]],
    };
  }

  return {
    right: [normalSide, 0],
    up: [0, -1],
  };
}

function getHorizontalRotationForView(horizontalViewDirection: ViewMorphPoint2D): number {
  return Math.atan2(horizontalViewDirection[1], horizontalViewDirection[0]);
}

function blendSmoothedViewMorphPaths(
  verticalPath: ViewMorphClosedPolyline,
  horizontalPath: ViewMorphClosedPolyline,
  verticalWeight: number,
  horizontalWeight: number,
): StructuredBezierPath {
  const verticalBlendPath = createSmoothPaperPath(verticalPath);
  const horizontalBlendPath = createSmoothPaperPath(horizontalPath);

  try {
    const correspondenceSegmentCount = getCubicCorrespondenceSegmentCount(
      verticalBlendPath,
      horizontalBlendPath,
      verticalPath.points.length + horizontalPath.points.length,
    );

    return blendPaperPathsByCubicCorrespondence(
      verticalBlendPath,
      horizontalBlendPath,
      correspondenceSegmentCount,
      verticalWeight,
      horizontalWeight,
    );
  } finally {
    verticalBlendPath.remove();
    horizontalBlendPath.remove();
  }
}

function createSmoothPaperPath(path: ViewMorphClosedPolyline): paper.Path {
  const paperPath = new paper.Path();

  for (const point of path.points) {
    paperPath.add(new paper.Point(point.point[0], point.point[1]));
  }

  paperPath.closed = true;
  paperPath.smooth({ type: "continuous" });

  return paperPath;
}

type CubicSegment2D = {
  id: string;
  anchor: ViewMorphPoint2D;
  handleIn: ViewMorphPoint2D;
  handleOut: ViewMorphPoint2D;
};

function blendPaperPathsByCubicCorrespondence(
  verticalPath: paper.Path,
  horizontalPath: paper.Path,
  segmentCount: number,
  verticalWeight: number,
  horizontalWeight: number,
): StructuredBezierPath {
  const targetSegmentCount = Math.max(
    4,
    segmentCount,
    verticalPath.segments.length,
    horizontalPath.segments.length,
  );
  const verticalSegments = splitPaperPathIntoCubicSegments(
    verticalPath,
    targetSegmentCount,
  );
  const horizontalSegments = resamplePaperPathByReferenceSegments(
    horizontalPath,
    verticalSegments,
  );

  return {
    version: 1,
    closed: true,
    segments: verticalSegments.map((verticalSegment, index) => {
      const horizontalSegment = horizontalSegments[index] ?? verticalSegment;

      return {
        id: `point-${index + 1}`,
        anchor: blend2DPoints(
          verticalSegment.anchor,
          horizontalSegment.anchor,
          verticalWeight,
          horizontalWeight,
        ),
        handleIn: blend2DPoints(
          verticalSegment.handleIn,
          horizontalSegment.handleIn,
          verticalWeight,
          horizontalWeight,
        ),
        handleOut: blend2DPoints(
          verticalSegment.handleOut,
          horizontalSegment.handleOut,
          verticalWeight,
          horizontalWeight,
        ),
      };
    }),
  };
}

function resamplePaperPathByReferenceSegments(
  path: paper.Path,
  reference: CubicSegment2D[],
): CubicSegment2D[] {
  const pointCount = reference.length;

  if (pointCount <= 0) {
    return [];
  }

  const referenceOffsets = getReferenceSegmentOffsets(reference);
  const seamOffset = getTopmostPaperPathOffset(path);
  const sampleDirection =
    getReferenceOrientation(reference) === getPaperPathOrientation(path) ? 1 : -1;
  const candidateSamples = referenceOffsets.map((offset, index) =>
    getPaperPathSampleAtNormalizedOffset(
      path,
      seamOffset + offset * sampleDirection,
      `point-${index + 1}`,
      sampleDirection,
    ),
  );

  return createCubicSegmentsFromPathSamples(candidateSamples);
}

type PathSample2D = {
  id: string;
  point: ViewMorphPoint2D;
  tangent: ViewMorphPoint2D;
  offset: number;
};

function getReferenceSegmentOffsets(reference: CubicSegment2D[]): number[] {
  const lengths = reference.map((segment, index) =>
    estimateCubicSegmentLength(
      segment,
      reference[(index + 1) % reference.length] ?? segment,
    ),
  );
  const totalLength = lengths.reduce((total, length) => total + length, 0);

  if (totalLength <= EPSILON) {
    return reference.map((_, index) => index / reference.length);
  }

  let accumulatedLength = 0;

  return lengths.map((length) => {
    const offset = accumulatedLength / totalLength;
    accumulatedLength += length;

    return offset;
  });
}

function getPaperPathSampleAtNormalizedOffset(
  path: paper.Path,
  offset: number,
  id: string,
  tangentDirection = 1,
): PathSample2D {
  const distance = normalizeUnitOffset(offset) * path.length;
  const point = path.getPointAt(distance);
  const tangent = path.getTangentAt(distance);
  const fallbackTangent = normalizePoint2D(
    [point.x, point.y],
    [1, 0],
  );

  return {
    id,
    point: pointToViewMorphPoint2D(point),
    tangent: normalizePoint2D(
      [tangent.x * tangentDirection, tangent.y * tangentDirection],
      fallbackTangent,
    ),
    offset,
  };
}

function getTopmostPaperPathOffset(path: paper.Path): number {
  const sampleCount = 128;
  let bestOffset = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let index = 0; index < sampleCount; index += 1) {
    const offset = index / sampleCount;
    const point = path.getPointAt(offset * path.length);
    const score = point.y + Math.abs(point.x) * 0.0001;

    if (score < bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  }

  return bestOffset;
}

function getReferenceOrientation(reference: CubicSegment2D[]): number {
  const area = getSignedArea(reference.map((segment) => segment.anchor));

  return area < 0 ? -1 : 1;
}

function getPaperPathOrientation(path: paper.Path): number {
  const sampleCount = 48;
  const points = Array.from({ length: sampleCount }, (_, index): ViewMorphPoint2D => {
    const point = path.getPointAt((index / sampleCount) * path.length);

    return [point.x, point.y];
  });
  const area = getSignedArea(points);

  return area < 0 ? -1 : 1;
}

function getSignedArea(points: ViewMorphPoint2D[]): number {
  return points.reduce((area, point, index) => {
    const nextPoint = points[(index + 1) % points.length] ?? point;

    return area + point[0] * nextPoint[1] - nextPoint[0] * point[1];
  }, 0);
}

function createCubicSegmentsFromPathSamples(samples: PathSample2D[]): CubicSegment2D[] {
  if (samples.length === 0) {
    return [];
  }

  return samples.map((sample, index) => {
    const previousSample = samples[(index - 1 + samples.length) % samples.length] ?? sample;
    const nextSample = samples[(index + 1) % samples.length] ?? sample;
    const previousDistance = getSampleChordDistance(previousSample, sample);
    const nextDistance = getSampleChordDistance(sample, nextSample);

    return {
      id: sample.id,
      anchor: sample.point,
      handleIn: roundPoint2D([
        -sample.tangent[0] * previousDistance / 3,
        -sample.tangent[1] * previousDistance / 3,
      ]),
      handleOut: roundPoint2D([
        sample.tangent[0] * nextDistance / 3,
        sample.tangent[1] * nextDistance / 3,
      ]),
    };
  });
}

function getSampleChordDistance(left: PathSample2D, right: PathSample2D): number {
  return Math.hypot(left.point[0] - right.point[0], left.point[1] - right.point[1]);
}

function estimateCubicSegmentLength(
  segment: CubicSegment2D,
  nextSegment: CubicSegment2D,
): number {
  const sampleCount = 8;
  let previousPoint = segment.anchor;
  let length = 0;

  for (let index = 1; index <= sampleCount; index += 1) {
    const point = sampleCubicSegment(segment, nextSegment, index / sampleCount);
    length += Math.hypot(point[0] - previousPoint[0], point[1] - previousPoint[1]);
    previousPoint = point;
  }

  return length;
}

function sampleCubicSegment(
  segment: CubicSegment2D,
  nextSegment: CubicSegment2D,
  time: number,
): ViewMorphPoint2D {
  const p0 = segment.anchor;
  const p1: ViewMorphPoint2D = [
    segment.anchor[0] + segment.handleOut[0],
    segment.anchor[1] + segment.handleOut[1],
  ];
  const p2: ViewMorphPoint2D = [
    nextSegment.anchor[0] + nextSegment.handleIn[0],
    nextSegment.anchor[1] + nextSegment.handleIn[1],
  ];
  const p3 = nextSegment.anchor;
  const t = clamp01(time);
  const inverseT = 1 - t;

  return [
    inverseT ** 3 * p0[0] +
      3 * inverseT ** 2 * t * p1[0] +
      3 * inverseT * t ** 2 * p2[0] +
      t ** 3 * p3[0],
    inverseT ** 3 * p0[1] +
      3 * inverseT ** 2 * t * p1[1] +
      3 * inverseT * t ** 2 * p2[1] +
      t ** 3 * p3[1],
  ];
}

function splitPaperPathIntoCubicSegments(
  path: paper.Path,
  segmentCount: number,
): CubicSegment2D[] {
  const output: CubicSegment2D[] = [];
  const inputCurveCount = Math.max(1, path.curves.length);
  const subdivisionsPerCurve = Math.max(
    1,
    Math.round(Math.max(segmentCount, inputCurveCount) / inputCurveCount),
  );
  const handleIns: ViewMorphPoint2D[] = [];

  for (const curve of path.curves) {
    const cubic = paperCurveToAbsoluteCubicSegment(curve);

    for (let index = 0; index < subdivisionsPerCurve; index += 1) {
      const splitCurve = splitCubicSegment(
        cubic,
        index / subdivisionsPerCurve,
        (index + 1) / subdivisionsPerCurve,
      );
      const segmentIndex = output.length;

      output.push({
        id: `point-${segmentIndex + 1}`,
        anchor: splitCurve.start,
        handleIn: [0, 0],
        handleOut: roundPoint2D([
          splitCurve.handle1[0] - splitCurve.start[0],
          splitCurve.handle1[1] - splitCurve.start[1],
        ]),
      });
      handleIns[(segmentIndex + 1) % segmentCount] = roundPoint2D([
        splitCurve.handle2[0] - splitCurve.end[0],
        splitCurve.handle2[1] - splitCurve.end[1],
      ]);
    }
  }

  output.forEach((segment, index) => {
    segment.handleIn = handleIns[index] ?? [0, 0];
  });

  return output;
}

function getCubicCorrespondenceSegmentCount(
  verticalPath: paper.Path,
  horizontalPath: paper.Path,
  minimumSegmentCount: number,
): number {
  const verticalCurveCount = Math.max(1, verticalPath.curves.length);
  const horizontalCurveCount = Math.max(1, horizontalPath.curves.length);
  const commonCurveCount = leastCommonMultiple(
    verticalCurveCount,
    horizontalCurveCount,
  );
  const multiplier = Math.max(1, Math.ceil(minimumSegmentCount / commonCurveCount));

  return commonCurveCount * multiplier;
}

type AbsoluteCubicSegment2D = {
  start: ViewMorphPoint2D;
  handle1: ViewMorphPoint2D;
  handle2: ViewMorphPoint2D;
  end: ViewMorphPoint2D;
};

function splitCubicSegment(
  cubic: AbsoluteCubicSegment2D,
  startTime: number,
  endTime: number,
): AbsoluteCubicSegment2D {
  const start = clamp01(startTime);
  const end = clamp01(endTime);
  const afterStart = splitCubicAt(cubic, start).right;
  const normalizedEnd = start >= 1 ? 1 : clamp01((end - start) / (1 - start));

  return splitCubicAt(afterStart, normalizedEnd).left;
}

function splitCubicAt(
  cubic: AbsoluteCubicSegment2D,
  time: number,
): { left: AbsoluteCubicSegment2D; right: AbsoluteCubicSegment2D } {
  const t = clamp01(time);
  const p01 = lerpPoint2D(cubic.start, cubic.handle1, t);
  const p12 = lerpPoint2D(cubic.handle1, cubic.handle2, t);
  const p23 = lerpPoint2D(cubic.handle2, cubic.end, t);
  const p012 = lerpPoint2D(p01, p12, t);
  const p123 = lerpPoint2D(p12, p23, t);
  const p0123 = lerpPoint2D(p012, p123, t);

  return {
    left: {
      start: cubic.start,
      handle1: p01,
      handle2: p012,
      end: p0123,
    },
    right: {
      start: p0123,
      handle1: p123,
      handle2: p23,
      end: cubic.end,
    },
  };
}

function lerpPoint2D(
  left: ViewMorphPoint2D,
  right: ViewMorphPoint2D,
  time: number,
): ViewMorphPoint2D {
  return roundPoint2D([
    left[0] + (right[0] - left[0]) * time,
    left[1] + (right[1] - left[1]) * time,
  ]);
}

function pointToViewMorphPoint2D(point: paper.Point): ViewMorphPoint2D {
  return roundPoint2D([point.x, point.y]);
}

function paperCurveToAbsoluteCubicSegment(
  curve: paper.Curve,
): AbsoluteCubicSegment2D {
  const start = pointToViewMorphPoint2D(curve.point1);
  const end = pointToViewMorphPoint2D(curve.point2);

  return {
    start,
    handle1: roundPoint2D([
      start[0] + curve.handle1.x,
      start[1] + curve.handle1.y,
    ]),
    handle2: roundPoint2D([
      end[0] + curve.handle2.x,
      end[1] + curve.handle2.y,
    ]),
    end,
  };
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function normalizeUnitOffset(value: number): number {
  return ((value % 1) + 1) % 1;
}

function smoothPolylineToBezierPath(path: ViewMorphClosedPolyline): StructuredBezierPath {
  const paperPath = createSmoothPaperPath(path);

  try {
    return {
      version: 1,
      closed: true,
      segments: paperPath.segments.map((segment, index) => ({
        id: path.points[index]?.id ?? `point-${index + 1}`,
        anchor: roundPoint2D([segment.point.x, segment.point.y]),
        handleIn: roundPoint2D([segment.handleIn.x, segment.handleIn.y]),
        handleOut: roundPoint2D([segment.handleOut.x, segment.handleOut.y]),
      })),
    };
  } finally {
    paperPath.remove();
  }
}

function createDefaultVerticalPolyline(): ViewMorphClosedPolyline {
  return {
    points: [
      { id: "point-top", point: [0, -DEFAULT_RADIUS] },
      { id: "point-upper-right", point: [35.3553, -35.3553] },
      { id: "point-right", point: [DEFAULT_RADIUS, 0] },
      { id: "point-lower-right", point: [35.3553, 35.3553] },
      { id: "point-bottom", point: [0, DEFAULT_RADIUS] },
      { id: "point-lower-left", point: [-35.3553, 35.3553] },
      { id: "point-left", point: [-DEFAULT_RADIUS, 0] },
      { id: "point-upper-left", point: [-35.3553, -35.3553] },
    ],
  };
}

function createDefaultHorizontalPolyline(): ViewMorphClosedPolyline {
  return {
    points: [
      { id: "point-east", point: [DEFAULT_RADIUS, 0] },
      { id: "point-north-east", point: [35.3553, 35.3553] },
      { id: "point-north", point: [0, DEFAULT_RADIUS] },
      { id: "point-north-west", point: [-35.3553, 35.3553] },
      { id: "point-west", point: [-DEFAULT_RADIUS, 0] },
      { id: "point-south-west", point: [-35.3553, -35.3553] },
      { id: "point-south", point: [0, -DEFAULT_RADIUS] },
      { id: "point-south-east", point: [35.3553, -35.3553] },
    ],
  };
}

function blend2DPoints(
  left: ViewMorphPoint2D,
  right: ViewMorphPoint2D,
  leftWeight: number,
  rightWeight: number,
): ViewMorphPoint2D {
  return roundPoint2D([
    left[0] * leftWeight + right[0] * rightWeight,
    left[1] * leftWeight + right[1] * rightWeight,
  ]);
}

function readFinitePoint2D(value: unknown, path: string): ViewMorphPoint2D {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new ViewMorphProfileError(`${path} must contain two numbers`);
  }

  const point: ViewMorphPoint2D = [Number(value[0]), Number(value[1])];

  if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
    throw new ViewMorphProfileError(`${path} must contain finite numbers`);
  }

  return roundPoint2D(point);
}

function readFinitePoint3D(value: unknown, path: string): ViewMorphPoint3D {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new ViewMorphProfileError(`${path} must contain three numbers`);
  }

  const point: ViewMorphPoint3D = [Number(value[0]), Number(value[1]), Number(value[2])];

  if (!Number.isFinite(point[0]) || !Number.isFinite(point[1]) || !Number.isFinite(point[2])) {
    throw new ViewMorphProfileError(`${path} must contain finite numbers`);
  }

  return roundPoint3D(point);
}

function normalizePoint2D(
  point: ViewMorphPoint2D,
  fallback: ViewMorphPoint2D,
): ViewMorphPoint2D;
function normalizePoint2D(
  point: ViewMorphPoint2D,
  fallback: null,
): ViewMorphPoint2D | null;
function normalizePoint2D(
  point: ViewMorphPoint2D,
  fallback: ViewMorphPoint2D | null,
): ViewMorphPoint2D | null {
  const length = Math.hypot(point[0], point[1]);

  if (length <= EPSILON) {
    if (fallback) {
      return fallback;
    }

    return null;
  }

  return roundPoint2D([point[0] / length, point[1] / length]);
}

function normalizePoint3D(point: ViewMorphPoint3D, path: string): ViewMorphPoint3D {
  const length = Math.hypot(point[0], point[1], point[2]);

  if (length <= EPSILON) {
    throw new ViewMorphProfileError(`${path} must not be a zero vector`);
  }

  return roundPoint3D([point[0] / length, point[1] / length, point[2] / length]);
}

function dotPoint2D(left: ViewMorphPoint2D, right: ViewMorphPoint2D): number {
  return left[0] * right[0] + left[1] * right[1];
}

function dotPoint3D(left: ViewMorphPoint3D, right: ViewMorphPoint3D): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function leastCommonMultiple(left: number, right: number): number {
  return Math.abs(left * right) / greatestCommonDivisor(left, right);
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(Math.round(left));
  let b = Math.abs(Math.round(right));

  while (b > 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }

  return a || 1;
}

function normalizeAngle(angleRad: number): number {
  const fullTurn = Math.PI * 2;
  const normalized = angleRad % fullTurn;

  return normalized < 0 ? normalized + fullTurn : normalized;
}

function roundPoint2D(point: ViewMorphPoint2D): ViewMorphPoint2D {
  return [roundNumber(point[0]), roundNumber(point[1])];
}

function roundPoint3D(point: ViewMorphPoint3D): ViewMorphPoint3D {
  return [roundNumber(point[0]), roundNumber(point[1]), roundNumber(point[2])];
}

function roundNumber(value: number): number {
  return Number(value.toFixed(4));
}
