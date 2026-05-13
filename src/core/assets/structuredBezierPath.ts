import paper from "paper";

export type BezierPoint = [number, number];

export type BezierSegment = {
  id: string;
  anchor: BezierPoint;
  handleIn: BezierPoint;
  handleOut: BezierPoint;
};

export type StructuredBezierPath = {
  version: 1;
  closed: boolean;
  segments: BezierSegment[];
};

export class StructuredBezierPathError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "StructuredBezierPathError";
  }
}

paper.setup([1, 1]);

export function parsePathDToStructuredBezier(
  pathD: string,
  options: { expectedClosed: boolean },
): StructuredBezierPath {
  if (countMoveCommands(pathD) !== 1) {
    throw new StructuredBezierPathError(
      "structured Bezier paths must contain exactly one subpath",
    );
  }

  let paperPath: paper.Path;

  try {
    paperPath = new paper.Path(pathD);
  } catch {
    throw new StructuredBezierPathError("path data could not be parsed");
  }

  try {
    const structuredPath: StructuredBezierPath = {
      version: 1,
      closed: paperPath.closed,
      segments: paperPath.segments.map((segment, index) => ({
        id: `seg-${index + 1}`,
        anchor: roundPoint([segment.point.x, segment.point.y]),
        handleIn: roundPoint([segment.handleIn.x, segment.handleIn.y]),
        handleOut: roundPoint([segment.handleOut.x, segment.handleOut.y]),
      })),
    };

    return validateStructuredBezierPath(structuredPath, options);
  } finally {
    paperPath.remove();
  }
}

export function structuredBezierToPathD(path: StructuredBezierPath): string {
  const validatedPath = validateStructuredBezierPath(path, {
    expectedClosed: path.closed,
  });
  const [firstSegment, ...remainingSegments] = validatedPath.segments;

  if (!firstSegment) {
    throw new StructuredBezierPathError("structured Bezier path is empty");
  }

  const commands = [`M ${formatPoint(firstSegment.anchor)}`];
  let previousSegment = firstSegment;

  for (const segment of remainingSegments) {
    appendSegmentCommand(commands, previousSegment, segment);
    previousSegment = segment;
  }

  if (validatedPath.closed) {
    appendSegmentCommand(commands, previousSegment, firstSegment);
    commands.push("Z");
  }

  return commands.join(" ");
}

export function cloneStructuredBezierPath(
  path: StructuredBezierPath,
): StructuredBezierPath {
  return {
    version: 1,
    closed: path.closed,
    segments: path.segments.map((segment) => ({
      id: segment.id,
      anchor: [...segment.anchor],
      handleIn: [...segment.handleIn],
      handleOut: [...segment.handleOut],
    })),
  };
}

export function validateStructuredBezierPath(
  path: StructuredBezierPath,
  options: { expectedClosed: boolean },
): StructuredBezierPath {
  if (path.version !== 1) {
    throw new StructuredBezierPathError("structured Bezier path version must be 1");
  }

  if (path.closed !== options.expectedClosed) {
    throw new StructuredBezierPathError(
      options.expectedClosed
        ? "structured Bezier path must be closed"
        : "structured Bezier path must be open",
    );
  }

  const minimumSegments = options.expectedClosed ? 3 : 2;

  if (!Array.isArray(path.segments) || path.segments.length < minimumSegments) {
    throw new StructuredBezierPathError(
      `structured Bezier path must contain at least ${minimumSegments} segments`,
    );
  }

  const ids = new Set<string>();
  const segments = path.segments.map((segment, index) => {
    if (typeof segment.id !== "string" || !segment.id.trim()) {
      throw new StructuredBezierPathError("Bezier segment id is required");
    }

    if (ids.has(segment.id)) {
      throw new StructuredBezierPathError(
        `duplicate Bezier segment id "${segment.id}"`,
      );
    }

    ids.add(segment.id);

    return {
      id: segment.id,
      anchor: readFinitePoint(segment.anchor, `segments[${index}].anchor`),
      handleIn: readFinitePoint(segment.handleIn, `segments[${index}].handleIn`),
      handleOut: readFinitePoint(
        segment.handleOut,
        `segments[${index}].handleOut`,
      ),
    };
  });

  return {
    version: 1,
    closed: path.closed,
    segments,
  };
}

function appendSegmentCommand(
  commands: string[],
  previousSegment: BezierSegment,
  segment: BezierSegment,
): void {
  const firstControlPoint = addPoints(previousSegment.anchor, previousSegment.handleOut);
  const secondControlPoint = addPoints(segment.anchor, segment.handleIn);

  if (
    isZeroPoint(previousSegment.handleOut) &&
    isZeroPoint(segment.handleIn)
  ) {
    commands.push(`L ${formatPoint(segment.anchor)}`);
    return;
  }

  commands.push(
    `C ${formatPoint(firstControlPoint)} ${formatPoint(secondControlPoint)} ${formatPoint(segment.anchor)}`,
  );
}

function countMoveCommands(pathD: string): number {
  return (pathD.match(/[mM]/g) ?? []).length;
}

function addPoints(left: BezierPoint, right: BezierPoint): BezierPoint {
  return [roundNumber(left[0] + right[0]), roundNumber(left[1] + right[1])];
}

function isZeroPoint(point: BezierPoint): boolean {
  return Math.abs(point[0]) < 0.000001 && Math.abs(point[1]) < 0.000001;
}

function readFinitePoint(value: unknown, path: string): BezierPoint {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new StructuredBezierPathError(`${path} must contain two numbers`);
  }

  const point: BezierPoint = [Number(value[0]), Number(value[1])];

  if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
    throw new StructuredBezierPathError(`${path} must contain finite numbers`);
  }

  return roundPoint(point);
}

function roundPoint(point: BezierPoint): BezierPoint {
  return [roundNumber(point[0]), roundNumber(point[1])];
}

function roundNumber(value: number): number {
  return Number(value.toFixed(4));
}

function formatPoint(point: BezierPoint): string {
  return `${formatNumber(point[0])} ${formatNumber(point[1])}`;
}

function formatNumber(value: number): string {
  return String(roundNumber(value));
}
