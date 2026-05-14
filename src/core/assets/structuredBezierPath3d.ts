import type { BezierPoint, StructuredBezierPath } from "./structuredBezierPath";

export type BezierPoint3D = [number, number, number];

export type BezierSegment3D = {
  id: string;
  anchor: BezierPoint3D;
  handleIn: BezierPoint3D;
  handleOut: BezierPoint3D;
};

export type StructuredBezierPath3D = {
  version: 1;
  closed: false;
  segments: BezierSegment3D[];
};

export class StructuredBezierPath3DError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StructuredBezierPath3DError";
  }
}

export function convertStructuredBezierPathTo3D(
  path: StructuredBezierPath,
): StructuredBezierPath3D {
  if (path.closed) {
    throw new StructuredBezierPath3DError("3D curve assets must be open paths");
  }

  return validateStructuredBezierPath3D({
    version: 1,
    closed: false,
    segments: path.segments.map((segment) => ({
      id: segment.id,
      anchor: point2dTo3d(segment.anchor),
      handleIn: point2dTo3d(segment.handleIn),
      handleOut: point2dTo3d(segment.handleOut),
    })),
  });
}

export function projectStructuredBezierPath3DTo2D(
  path: StructuredBezierPath3D,
): StructuredBezierPath {
  const validated = validateStructuredBezierPath3D(path);

  return {
    version: 1,
    closed: false,
    segments: validated.segments.map((segment) => ({
      id: segment.id,
      anchor: point3dTo2d(segment.anchor),
      handleIn: point3dTo2d(segment.handleIn),
      handleOut: point3dTo2d(segment.handleOut),
    })),
  };
}

export function cloneStructuredBezierPath3D(
  path: StructuredBezierPath3D,
): StructuredBezierPath3D {
  return {
    version: 1,
    closed: false,
    segments: path.segments.map((segment) => ({
      id: segment.id,
      anchor: [...segment.anchor],
      handleIn: [...segment.handleIn],
      handleOut: [...segment.handleOut],
    })),
  };
}

export function validateStructuredBezierPath3D(
  path: unknown,
): StructuredBezierPath3D {
  if (!path || typeof path !== "object") {
    throw new StructuredBezierPath3DError("structured 3D Bezier path must be an object");
  }

  const candidate = path as Partial<StructuredBezierPath3D>;

  if (candidate.version !== 1) {
    throw new StructuredBezierPath3DError("structured 3D Bezier path version must be 1");
  }

  if (candidate.closed !== false) {
    throw new StructuredBezierPath3DError("structured 3D Bezier path must be open");
  }

  if (!Array.isArray(candidate.segments)) {
    throw new StructuredBezierPath3DError("structured 3D Bezier segments must be an array");
  }

  if (candidate.segments.length < 2) {
    throw new StructuredBezierPath3DError(
      "structured 3D Bezier path must contain at least 2 segments",
    );
  }

  const segmentIds = new Set<string>();

  return {
    version: 1,
    closed: false,
    segments: candidate.segments.map((segment, index) => {
      if (!segment || typeof segment !== "object") {
        throw new StructuredBezierPath3DError(`Bezier 3D segment ${index} must be an object`);
      }

      const partial = segment as Partial<BezierSegment3D>;

      if (!partial.id) {
        throw new StructuredBezierPath3DError("Bezier 3D segment id is required");
      }

      if (segmentIds.has(partial.id)) {
        throw new StructuredBezierPath3DError(
          `Bezier 3D segment id "${partial.id}" is duplicated`,
        );
      }

      segmentIds.add(partial.id);

      return {
        id: partial.id,
        anchor: readFinitePoint3D(partial.anchor, `segments[${index}].anchor`),
        handleIn: readFinitePoint3D(partial.handleIn, `segments[${index}].handleIn`),
        handleOut: readFinitePoint3D(partial.handleOut, `segments[${index}].handleOut`),
      };
    }),
  };
}

function point2dTo3d(point: BezierPoint): BezierPoint3D {
  return [point[0], point[1], 0];
}

function point3dTo2d(point: BezierPoint3D): BezierPoint {
  return [point[0], point[1]];
}

function readFinitePoint3D(value: unknown, path: string): BezierPoint3D {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new StructuredBezierPath3DError(`${path} must contain three numbers`);
  }

  const point = value.map(Number) as BezierPoint3D;

  if (!point.every(Number.isFinite)) {
    throw new StructuredBezierPath3DError(`${path} must contain finite numbers`);
  }

  return point;
}
