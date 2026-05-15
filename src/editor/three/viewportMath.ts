import { Euler, Vector3 } from "three";

export type Vector3Tuple = [number, number, number];

export function tupleToVector(value: Vector3Tuple): Vector3 {
  return new Vector3(value[0], value[1], value[2]);
}

export function vectorToTuple(value: Vector3): Vector3Tuple {
  return [roundNumber(value.x), roundNumber(value.y), roundNumber(value.z)];
}

export function eulerToTuple(value: Euler): Vector3Tuple {
  return [roundNumber(value.x), roundNumber(value.y), roundNumber(value.z)];
}

export function largestAbsoluteScaleRatio(
  current: Vector3,
  start: Vector3,
): number {
  const ratios = [
    current.x / safeScaleBase(start.x),
    current.y / safeScaleBase(start.y),
    current.z / safeScaleBase(start.z),
  ];

  return ratios.reduce((best, candidate) =>
    Math.abs(candidate - 1) > Math.abs(best - 1) ? candidate : best,
  );
}

function roundNumber(value: number): number {
  return Number(value.toFixed(4));
}

function safeScaleBase(value: number): number {
  return Math.abs(value) < 0.0001 ? 0.0001 : value;
}
