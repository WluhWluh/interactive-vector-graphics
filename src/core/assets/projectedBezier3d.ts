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

export type Project3DCurveOptions = {
  camera: Camera;
  viewport: StageSize;
  worldMatrix?: Matrix4;
  screenErrorPx?: number;
  maxDepth?: number;
  maxCommands?: number;
};

type Cubic3D = [Vector3, Vector3, Vector3, Vector3];

const DEFAULT_SCREEN_ERROR_PX = 1;
const DEFAULT_MAX_DEPTH = 8;
const DEFAULT_MAX_COMMANDS = 256;

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

export function projectPoint3DToScreen(
  point: BezierPoint3D,
  options: Project3DCurveOptions,
): [number, number] | null {
  return projectWorldVectorToScreen(
    pointToWorldVector(point, options.worldMatrix ?? new Matrix4()),
    options,
  );
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

function evaluateCubic3D(cubic: Cubic3D, time: number): Vector3 {
  const inverse = 1 - time;

  return cubic[0]
    .clone()
    .multiplyScalar(inverse ** 3)
    .add(cubic[1].clone().multiplyScalar(3 * inverse ** 2 * time))
    .add(cubic[2].clone().multiplyScalar(3 * inverse * time ** 2))
    .add(cubic[3].clone().multiplyScalar(time ** 3));
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

function getCommandEndPoint(command: ProjectedCurveCommand): [number, number] {
  return command.point;
}

function pointsNearlyEqual(left: [number, number], right: [number, number]): boolean {
  return Math.hypot(left[0] - right[0], left[1] - right[1]) < 0.001;
}

function roundScreenNumber(value: number): number {
  return Number(value.toFixed(3));
}
