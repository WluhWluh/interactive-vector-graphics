import { Matrix4, Vector3, type Camera } from "three";
import type { StageSize } from "../stage/canvasStage";
import type {
  BezierPoint3D,
  StructuredBezierPath3D,
} from "./structuredBezierPath3d";

export type ProjectedCurveCommand =
  | { kind: "moveTo"; point: [number, number] }
  | {
      kind: "bezierCurveTo";
      cp1: [number, number];
      cp2: [number, number];
      point: [number, number];
    }
  | { kind: "lineTo"; point: [number, number] };

export type ProjectedCurveDepthSample = {
  t: number;
  point: [number, number];
  depth: number;
};

export type Project3DCurveOptions = {
  camera: Camera;
  viewport: StageSize;
  worldMatrix?: Matrix4;
  screenErrorPx?: number;
  maxDepth?: number;
  maxCommands?: number;
};

export type Project3DCurveDepthSampleOptions = Project3DCurveOptions & {
  sampleSpacingPx?: number;
  maxSamples?: number;
};

type Cubic3D = [Vector3, Vector3, Vector3, Vector3];

const DEFAULT_SCREEN_ERROR_PX = 1;
const DEFAULT_MAX_DEPTH = 8;
const DEFAULT_MAX_COMMANDS = 256;
const DEFAULT_SAMPLE_SPACING_PX = 10;
const DEFAULT_MAX_SAMPLES = 512;

export function projectBezierPath3DToCommands(
  path: StructuredBezierPath3D,
  options: Project3DCurveOptions,
): ProjectedCurveCommand[] {
  const commands: ProjectedCurveCommand[] = [];
  const worldMatrix = options.worldMatrix ?? new Matrix4();

  for (let index = 0; index < path.segments.length - 1; index += 1) {
    if (commands.length >= (options.maxCommands ?? DEFAULT_MAX_COMMANDS)) {
      break;
    }

    const start = path.segments[index];
    const end = path.segments[index + 1];

    if (!start || !end) {
      continue;
    }

    const cubic: Cubic3D = [
      pointToWorldVector(start.anchor, worldMatrix),
      pointToWorldVector(addPoint3D(start.anchor, start.handleOut), worldMatrix),
      pointToWorldVector(addPoint3D(end.anchor, end.handleIn), worldMatrix),
      pointToWorldVector(end.anchor, worldMatrix),
    ];

    appendProjectedCubic(cubic, options, commands, 0);
  }

  return commands;
}

export function drawProjectedCurveCommands(
  context: CanvasRenderingContext2D,
  commands: ProjectedCurveCommand[],
): void {
  for (const command of commands) {
    if (command.kind === "moveTo") {
      context.moveTo(command.point[0], command.point[1]);
    } else if (command.kind === "lineTo") {
      context.lineTo(command.point[0], command.point[1]);
    } else {
      context.bezierCurveTo(
        command.cp1[0],
        command.cp1[1],
        command.cp2[0],
        command.cp2[1],
        command.point[0],
        command.point[1],
      );
    }
  }
}

export function projectBezierPath3DToDepthSamples(
  path: StructuredBezierPath3D,
  options: Project3DCurveDepthSampleOptions,
): ProjectedCurveDepthSample[] {
  const worldMatrix = options.worldMatrix ?? new Matrix4();
  const sampleSpacingPx = Math.max(options.sampleSpacingPx ?? DEFAULT_SAMPLE_SPACING_PX, 1);
  const maxSamples = Math.max(options.maxSamples ?? DEFAULT_MAX_SAMPLES, 2);
  const cubics = getPathCubics(path, worldMatrix);
  const samples: ProjectedCurveDepthSample[] = [];

  for (let cubicIndex = 0; cubicIndex < cubics.length; cubicIndex += 1) {
    const cubic = cubics[cubicIndex];

    if (!cubic || samples.length >= maxSamples) {
      break;
    }

    const approximateLength = estimateProjectedCubicLength(cubic, options);
    const steps = Math.max(2, Math.ceil(approximateLength / sampleSpacingPx));

    for (let stepIndex = 0; stepIndex <= steps; stepIndex += 1) {
      if (samples.length >= maxSamples) {
        break;
      }

      if (cubicIndex > 0 && stepIndex === 0) {
        continue;
      }

      const localT = stepIndex / steps;
      const worldPoint = evaluateCubic3D(cubic, localT);
      const projected = projectWorldVectorToScreenWithDepth(worldPoint, options);

      if (!projected) {
        continue;
      }

      const globalT = cubics.length <= 1 ? localT : (cubicIndex + localT) / cubics.length;

      samples.push({
        t: roundSampleNumber(globalT),
        point: projected.point,
        depth: projected.depth,
      });
    }
  }

  return samples;
}

export function projectBezierPath3DRangeToCommands(
  path: StructuredBezierPath3D,
  startT: number,
  endT: number,
  options: Project3DCurveOptions,
): ProjectedCurveCommand[] {
  const commands: ProjectedCurveCommand[] = [];
  const worldMatrix = options.worldMatrix ?? new Matrix4();
  const cubics = getPathCubics(path, worldMatrix);
  const clampedStart = Math.min(Math.max(startT, 0), 1);
  const clampedEnd = Math.min(Math.max(endT, 0), 1);

  if (cubics.length === 0 || clampedEnd <= clampedStart) {
    return commands;
  }

  for (let index = 0; index < cubics.length; index += 1) {
    const cubic = cubics[index];

    if (!cubic) {
      continue;
    }

    const segmentStartT = index / cubics.length;
    const segmentEndT = (index + 1) / cubics.length;
    const overlapStart = Math.max(clampedStart, segmentStartT);
    const overlapEnd = Math.min(clampedEnd, segmentEndT);

    if (overlapEnd <= overlapStart) {
      continue;
    }

    const localStart = (overlapStart - segmentStartT) * cubics.length;
    const localEnd = (overlapEnd - segmentStartT) * cubics.length;
    const rangedCubic = trimCubic3D(cubic, localStart, localEnd);
    appendProjectedCubic(rangedCubic, options, commands, 0);
  }

  return commands;
}

export function projectPoint3DToScreen(
  point: BezierPoint3D,
  options: Project3DCurveOptions,
): [number, number] | null {
  return projectWorldVectorToScreen(
    pointToWorldVector(point, options.worldMatrix ?? new Matrix4()),
    options,
  );
}

function getPathCubics(
  path: StructuredBezierPath3D,
  worldMatrix: Matrix4,
): Cubic3D[] {
  const cubics: Cubic3D[] = [];

  for (let index = 0; index < path.segments.length - 1; index += 1) {
    const start = path.segments[index];
    const end = path.segments[index + 1];

    if (!start || !end) {
      continue;
    }

    cubics.push([
      pointToWorldVector(start.anchor, worldMatrix),
      pointToWorldVector(addPoint3D(start.anchor, start.handleOut), worldMatrix),
      pointToWorldVector(addPoint3D(end.anchor, end.handleIn), worldMatrix),
      pointToWorldVector(end.anchor, worldMatrix),
    ]);
  }

  return cubics;
}

function appendProjectedCubic(
  cubic: Cubic3D,
  options: Project3DCurveOptions,
  commands: ProjectedCurveCommand[],
  depth: number,
): void {
  const maxCommands = options.maxCommands ?? DEFAULT_MAX_COMMANDS;

  if (commands.length >= maxCommands) {
    return;
  }

  const projected = cubic.map((point) => projectWorldVectorToScreen(point, options));

  if (projected.every((point) => point === null)) {
    return;
  }

  if (projected.some((point) => point === null)) {
    if (depth >= (options.maxDepth ?? DEFAULT_MAX_DEPTH)) {
      appendProjectedPolyline(cubic, options, commands);
      return;
    }

    const [left, right] = splitCubic3D(cubic);
    appendProjectedCubic(left, options, commands, depth + 1);
    appendProjectedCubic(right, options, commands, depth + 1);
    return;
  }

  const points = projected as [[number, number], [number, number], [number, number], [number, number]];
  const shouldAccept =
    depth >= (options.maxDepth ?? DEFAULT_MAX_DEPTH) ||
    cubicProjectionErrorIsAcceptable(
      cubic,
      points,
      options,
      options.screenErrorPx ?? DEFAULT_SCREEN_ERROR_PX,
    );

  if (!shouldAccept) {
    const [left, right] = splitCubic3D(cubic);
    appendProjectedCubic(left, options, commands, depth + 1);
    appendProjectedCubic(right, options, commands, depth + 1);
    return;
  }

  appendProjectedCubicCommand(points, commands);
}

function appendProjectedCubicCommand(
  points: [[number, number], [number, number], [number, number], [number, number]],
  commands: ProjectedCurveCommand[],
): void {
  const previous = commands[commands.length - 1];

  if (!previous || !pointsNearlyEqual(getCommandEndPoint(previous), points[0])) {
    commands.push({ kind: "moveTo", point: points[0] });
  }

  commands.push({
    kind: "bezierCurveTo",
    cp1: points[1],
    cp2: points[2],
    point: points[3],
  });
}

function appendProjectedPolyline(
  cubic: Cubic3D,
  options: Project3DCurveOptions,
  commands: ProjectedCurveCommand[],
): void {
  for (const time of [0, 0.25, 0.5, 0.75, 1]) {
    const point = projectWorldVectorToScreen(evaluateCubic3D(cubic, time), options);

    if (!point) {
      continue;
    }

    const previous = commands[commands.length - 1];

    if (!previous) {
      commands.push({ kind: "moveTo", point });
    } else if (!pointsNearlyEqual(getCommandEndPoint(previous), point)) {
      commands.push({ kind: "lineTo", point });
    }
  }
}

function cubicProjectionErrorIsAcceptable(
  cubic: Cubic3D,
  projectedControlPoints: [[number, number], [number, number], [number, number], [number, number]],
  options: Project3DCurveOptions,
  errorPx: number,
): boolean {
  for (const time of [0.25, 0.5, 0.75]) {
    const projectedTruePoint = projectWorldVectorToScreen(
      evaluateCubic3D(cubic, time),
      options,
    );

    if (!projectedTruePoint) {
      return false;
    }

    const projectedCubicPoint = evaluateCubic2D(projectedControlPoints, time);
    const error = Math.hypot(
      projectedTruePoint[0] - projectedCubicPoint[0],
      projectedTruePoint[1] - projectedCubicPoint[1],
    );

    if (error > errorPx) {
      return false;
    }
  }

  return true;
}

function projectWorldVectorToScreen(
  worldPoint: Vector3,
  options: Project3DCurveOptions,
): [number, number] | null {
  const projected = worldPoint.clone().project(options.camera);

  if (
    !Number.isFinite(projected.x) ||
    !Number.isFinite(projected.y) ||
    !Number.isFinite(projected.z) ||
    projected.z < -1 ||
    projected.z > 1
  ) {
    return null;
  }

  return [
    roundScreenNumber((projected.x * 0.5 + 0.5) * options.viewport.cssWidth),
    roundScreenNumber((-projected.y * 0.5 + 0.5) * options.viewport.cssHeight),
  ];
}

function projectWorldVectorToScreenWithDepth(
  worldPoint: Vector3,
  options: Project3DCurveOptions,
): { point: [number, number]; depth: number } | null {
  const projected = worldPoint.clone().project(options.camera);

  if (
    !Number.isFinite(projected.x) ||
    !Number.isFinite(projected.y) ||
    !Number.isFinite(projected.z) ||
    projected.z < -1 ||
    projected.z > 1
  ) {
    return null;
  }

  return {
    point: [
      roundScreenNumber((projected.x * 0.5 + 0.5) * options.viewport.cssWidth),
      roundScreenNumber((-projected.y * 0.5 + 0.5) * options.viewport.cssHeight),
    ],
    depth: roundDepthNumber(projected.z),
  };
}

function splitCubic3D(cubic: Cubic3D): [Cubic3D, Cubic3D] {
  const p01 = midpoint3D(cubic[0], cubic[1]);
  const p12 = midpoint3D(cubic[1], cubic[2]);
  const p23 = midpoint3D(cubic[2], cubic[3]);
  const p012 = midpoint3D(p01, p12);
  const p123 = midpoint3D(p12, p23);
  const p0123 = midpoint3D(p012, p123);

  return [
    [cubic[0], p01, p012, p0123],
    [p0123, p123, p23, cubic[3]],
  ];
}

function trimCubic3D(cubic: Cubic3D, startT: number, endT: number): Cubic3D {
  const clampedStart = Math.min(Math.max(startT, 0), 1);
  const clampedEnd = Math.min(Math.max(endT, 0), 1);

  if (clampedStart <= 0 && clampedEnd >= 1) {
    return cubic;
  }

  const [, right] = splitCubicAtT(cubic, clampedStart);
  const normalizedEnd =
    clampedStart >= 1
      ? 1
      : (clampedEnd - clampedStart) / Math.max(1 - clampedStart, 0.000001);
  const [trimmed] = splitCubicAtT(right, normalizedEnd);

  return trimmed;
}

function splitCubicAtT(cubic: Cubic3D, time: number): [Cubic3D, Cubic3D] {
  const t = Math.min(Math.max(time, 0), 1);
  const p01 = lerpVector3(cubic[0], cubic[1], t);
  const p12 = lerpVector3(cubic[1], cubic[2], t);
  const p23 = lerpVector3(cubic[2], cubic[3], t);
  const p012 = lerpVector3(p01, p12, t);
  const p123 = lerpVector3(p12, p23, t);
  const p0123 = lerpVector3(p012, p123, t);

  return [
    [cubic[0], p01, p012, p0123],
    [p0123, p123, p23, cubic[3]],
  ];
}

function evaluateCubic3D(cubic: Cubic3D, time: number): Vector3 {
  const inverse = 1 - time;

  return cubic[0]
    .clone()
    .multiplyScalar(inverse ** 3)
    .add(cubic[1].clone().multiplyScalar(3 * inverse ** 2 * time))
    .add(cubic[2].clone().multiplyScalar(3 * inverse * time ** 2))
    .add(cubic[3].clone().multiplyScalar(time ** 3));
}

function estimateProjectedCubicLength(
  cubic: Cubic3D,
  options: Project3DCurveOptions,
): number {
  let length = 0;
  let previous: [number, number] | null = null;

  for (let index = 0; index <= 12; index += 1) {
    const projected = projectWorldVectorToScreen(
      evaluateCubic3D(cubic, index / 12),
      options,
    );

    if (!projected) {
      continue;
    }

    if (previous) {
      length += Math.hypot(projected[0] - previous[0], projected[1] - previous[1]);
    }

    previous = projected;
  }

  return length;
}

function evaluateCubic2D(
  cubic: [[number, number], [number, number], [number, number], [number, number]],
  time: number,
): [number, number] {
  const inverse = 1 - time;

  return [
    cubic[0][0] * inverse ** 3 +
      cubic[1][0] * 3 * inverse ** 2 * time +
      cubic[2][0] * 3 * inverse * time ** 2 +
      cubic[3][0] * time ** 3,
    cubic[0][1] * inverse ** 3 +
      cubic[1][1] * 3 * inverse ** 2 * time +
      cubic[2][1] * 3 * inverse * time ** 2 +
      cubic[3][1] * time ** 3,
  ];
}

function pointToWorldVector(point: BezierPoint3D, worldMatrix: Matrix4): Vector3 {
  return new Vector3(point[0], point[1], point[2]).applyMatrix4(worldMatrix);
}

function addPoint3D(left: BezierPoint3D, right: BezierPoint3D): BezierPoint3D {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function midpoint3D(left: Vector3, right: Vector3): Vector3 {
  return left.clone().add(right).multiplyScalar(0.5);
}

function lerpVector3(left: Vector3, right: Vector3, time: number): Vector3 {
  return left.clone().lerp(right, time);
}

function getCommandEndPoint(command: ProjectedCurveCommand): [number, number] {
  return command.point;
}

function pointsNearlyEqual(left: [number, number], right: [number, number]): boolean {
  return Math.hypot(left[0] - right[0], left[1] - right[1]) < 0.001;
}

function roundScreenNumber(value: number): number {
  return Number(value.toFixed(3));
}

function roundSampleNumber(value: number): number {
  return Number(value.toFixed(6));
}

function roundDepthNumber(value: number): number {
  return Number(value.toFixed(6));
}
