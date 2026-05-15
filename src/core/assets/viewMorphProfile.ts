import {
  cloneStructuredBezierPath,
  validateStructuredBezierPath,
  type BezierPoint,
  type StructuredBezierPath,
} from "./structuredBezierPath";

export type ViewMorphPoint3D = [number, number, number];

export type ViewMorphPlane = {
  id: string;
  name: string;
  normal: ViewMorphPoint3D;
  tangentU: ViewMorphPoint3D;
  tangentV: ViewMorphPoint3D;
  path: StructuredBezierPath;
};

export type ViewMorphProfile = {
  version: 1;
  center: ViewMorphPoint3D;
  planes: ViewMorphPlane[];
};

export type ViewMorphWeight = {
  planeId: string;
  weight: number;
};

export class ViewMorphProfileError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ViewMorphProfileError";
  }
}

const DEFAULT_RADIUS = 50;
const CIRCLE_KAPPA = 0.5522847498;
const WEIGHT_EXPONENT = 4;
export const VIEW_MORPH_PROFILE_DEFAULT_VIEW_BOX: [number, number, number, number] = [
  -50,
  -50,
  100,
  100,
];

export function createDefaultViewMorphProfile(): ViewMorphProfile {
  const circlePath = createDefaultCirclePath();

  return {
    version: 1,
    center: [0, 0, 0],
    planes: [
      {
        id: "plane-front",
        name: "Front",
        normal: [0, 0, 1],
        tangentU: [1, 0, 0],
        tangentV: [0, 1, 0],
        path: cloneStructuredBezierPath(circlePath),
      },
      {
        id: "plane-side",
        name: "Side",
        normal: [1, 0, 0],
        tangentU: [0, 0, -1],
        tangentV: [0, 1, 0],
        path: cloneStructuredBezierPath(circlePath),
      },
      {
        id: "plane-top",
        name: "Top",
        normal: [0, 1, 0],
        tangentU: [1, 0, 0],
        tangentV: [0, 0, -1],
        path: cloneStructuredBezierPath(circlePath),
      },
    ],
  };
}

export function cloneViewMorphProfile(profile: ViewMorphProfile): ViewMorphProfile {
  return {
    version: 1,
    center: [...profile.center],
    planes: profile.planes.map((plane) => ({
      id: plane.id,
      name: plane.name,
      normal: [...plane.normal],
      tangentU: [...plane.tangentU],
      tangentV: [...plane.tangentV],
      path: cloneStructuredBezierPath(plane.path),
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

  if (!Array.isArray(candidate.planes) || candidate.planes.length < 1) {
    throw new ViewMorphProfileError("view morph profile must contain planes");
  }

  const ids = new Set<string>();
  const planes = candidate.planes.map((plane, index) => {
    if (!plane || typeof plane !== "object") {
      throw new ViewMorphProfileError(`planes[${index}] must be an object`);
    }

    const partialPlane = plane as Partial<ViewMorphPlane>;

    if (typeof partialPlane.id !== "string" || !partialPlane.id.trim()) {
      throw new ViewMorphProfileError(`planes[${index}].id is required`);
    }

    if (ids.has(partialPlane.id)) {
      throw new ViewMorphProfileError(
        `duplicate view morph plane id "${partialPlane.id}"`,
      );
    }

    ids.add(partialPlane.id);

    const path = validateStructuredBezierPath(partialPlane.path, {
      expectedClosed: true,
    });

    return {
      id: partialPlane.id,
      name:
        typeof partialPlane.name === "string" && partialPlane.name.trim()
          ? partialPlane.name
          : partialPlane.id,
      normal: normalizePoint3D(
        readFinitePoint3D(partialPlane.normal, `planes[${index}].normal`),
        `planes[${index}].normal`,
      ),
      tangentU: normalizePoint3D(
        readFinitePoint3D(partialPlane.tangentU, `planes[${index}].tangentU`),
        `planes[${index}].tangentU`,
      ),
      tangentV: normalizePoint3D(
        readFinitePoint3D(partialPlane.tangentV, `planes[${index}].tangentV`),
        `planes[${index}].tangentV`,
      ),
      path,
    };
  });

  validateSharedSegmentTopology(planes);

  return {
    version: 1,
    center,
    planes,
  };
}

export function evaluateViewMorphProfileToBezierPath(
  profile: ViewMorphProfile,
  viewDirectionLocal: ViewMorphPoint3D,
): StructuredBezierPath {
  const validatedProfile = validateViewMorphProfile(profile);
  const normalizedViewDirection = normalizePoint3D(
    viewDirectionLocal,
    "viewDirectionLocal",
  );
  const weights = calculateViewMorphPlaneWeights(
    validatedProfile,
    normalizedViewDirection,
  );
  const [firstPlane] = validatedProfile.planes;

  if (!firstPlane) {
    throw new ViewMorphProfileError("view morph profile must contain planes");
  }

  return {
    version: 1,
    closed: true,
    segments: firstPlane.path.segments.map((segment, segmentIndex) => ({
      id: segment.id,
      anchor: blendPoint(weights, validatedProfile.planes, segmentIndex, "anchor"),
      handleIn: blendPoint(
        weights,
        validatedProfile.planes,
        segmentIndex,
        "handleIn",
      ),
      handleOut: blendPoint(
        weights,
        validatedProfile.planes,
        segmentIndex,
        "handleOut",
      ),
    })),
  };
}

export function calculateViewMorphPlaneWeights(
  profile: ViewMorphProfile,
  viewDirectionLocal: ViewMorphPoint3D,
): ViewMorphWeight[] {
  const rawWeights = profile.planes.map((plane) => ({
    planeId: plane.id,
    weight: Math.abs(dotPoint3D(viewDirectionLocal, plane.normal)) ** WEIGHT_EXPONENT,
  }));
  const totalWeight = rawWeights.reduce((sum, weight) => sum + weight.weight, 0);

  if (totalWeight <= 0) {
    const fallbackWeight = 1 / Math.max(profile.planes.length, 1);

    return profile.planes.map((plane) => ({
      planeId: plane.id,
      weight: fallbackWeight,
    }));
  }

  return rawWeights.map((weight) => ({
    planeId: weight.planeId,
    weight: weight.weight / totalWeight,
  }));
}

function createDefaultCirclePath(): StructuredBezierPath {
  const handleLength = Number((DEFAULT_RADIUS * CIRCLE_KAPPA).toFixed(4));

  return {
    version: 1,
    closed: true,
    segments: [
      {
        id: "seg-1",
        anchor: [0, -DEFAULT_RADIUS],
        handleIn: [-handleLength, 0],
        handleOut: [handleLength, 0],
      },
      {
        id: "seg-2",
        anchor: [DEFAULT_RADIUS, 0],
        handleIn: [0, -handleLength],
        handleOut: [0, handleLength],
      },
      {
        id: "seg-3",
        anchor: [0, DEFAULT_RADIUS],
        handleIn: [handleLength, 0],
        handleOut: [-handleLength, 0],
      },
      {
        id: "seg-4",
        anchor: [-DEFAULT_RADIUS, 0],
        handleIn: [0, handleLength],
        handleOut: [0, -handleLength],
      },
    ],
  };
}

function validateSharedSegmentTopology(planes: ViewMorphPlane[]): void {
  const [firstPlane] = planes;

  if (!firstPlane) {
    return;
  }

  const referenceIds = firstPlane.path.segments.map((segment) => segment.id);

  for (const plane of planes.slice(1)) {
    if (plane.path.segments.length !== referenceIds.length) {
      throw new ViewMorphProfileError(
        "all view morph plane paths must have the same segment count",
      );
    }

    for (const [index, segment] of plane.path.segments.entries()) {
      if (segment.id !== referenceIds[index]) {
        throw new ViewMorphProfileError(
          "all view morph plane paths must share segment id order",
        );
      }
    }
  }
}

function blendPoint(
  weights: ViewMorphWeight[],
  planes: ViewMorphPlane[],
  segmentIndex: number,
  property: "anchor" | "handleIn" | "handleOut",
): BezierPoint {
  const planeById = new Map(planes.map((plane) => [plane.id, plane]));
  const point = weights.reduce<BezierPoint>(
    (accumulator, weight) => {
      const plane = planeById.get(weight.planeId);
      const sourcePoint = plane?.path.segments[segmentIndex]?.[property];

      if (!sourcePoint) {
        return accumulator;
      }

      return [
        accumulator[0] + sourcePoint[0] * weight.weight,
        accumulator[1] + sourcePoint[1] * weight.weight,
      ];
    },
    [0, 0],
  );

  return roundPoint(point);
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

function normalizePoint3D(point: ViewMorphPoint3D, path: string): ViewMorphPoint3D {
  const length = Math.hypot(point[0], point[1], point[2]);

  if (length <= 0.000001) {
    throw new ViewMorphProfileError(`${path} must not be a zero vector`);
  }

  return roundPoint3D([point[0] / length, point[1] / length, point[2] / length]);
}

function dotPoint3D(left: ViewMorphPoint3D, right: ViewMorphPoint3D): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function roundPoint(point: BezierPoint): BezierPoint {
  return [roundNumber(point[0]), roundNumber(point[1])];
}

function roundPoint3D(point: ViewMorphPoint3D): ViewMorphPoint3D {
  return [roundNumber(point[0]), roundNumber(point[1]), roundNumber(point[2])];
}

function roundNumber(value: number): number {
  return Number(value.toFixed(4));
}
