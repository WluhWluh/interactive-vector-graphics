import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import type { PrefabNode } from "../api";
import {
  eulerToTuple,
  tupleToVector,
  vectorToTuple,
  type Vector3Tuple,
} from "../threeEditorViewport";

export type TransformSnapshot = {
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  scale: Vector3Tuple;
};

export function getPrefabWorldTransforms(
  nodes: PrefabNode[],
  baseMatrix = new Matrix4(),
): Map<string, Matrix4> {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const cache = new Map<string, Matrix4>();

  function resolve(node: PrefabNode): Matrix4 {
    const cached = cache.get(node.id);

    if (cached) {
      return cached.clone();
    }

    const local = transformToMatrix(node);
    const parent = node.parentId ? nodeById.get(node.parentId) : null;
    const world = parent
      ? resolve(parent).multiply(local)
      : baseMatrix.clone().multiply(local);

    cache.set(node.id, world.clone());
    return world;
  }

  for (const node of nodes) {
    resolve(node);
  }

  return cache;
}

export function applyWorldTransformToPrefabNode(
  nodes: PrefabNode[],
  node: PrefabNode,
  worldTransform: TransformSnapshot,
): void {
  const localTransform = getLocalTransformFromPrefabWorldTransform(
    nodes,
    node,
    worldTransform,
  );
  node.position = localTransform.position;
  node.rotation = localTransform.rotation;
  node.scale = localTransform.scale;
}

export function getLocalTransformFromPrefabWorldTransform(
  nodes: PrefabNode[],
  node: PrefabNode,
  worldTransform: TransformSnapshot,
): TransformSnapshot {
  const worldMatrix = transformToMatrix(worldTransform);
  const nodeById = new Map(nodes.map((candidate) => [candidate.id, candidate]));
  const parent = node.parentId ? nodeById.get(node.parentId) : null;

  if (!parent) {
    return cloneTransform(worldTransform);
  }

  const parentWorldMatrix =
    getPrefabWorldTransforms(nodes).get(parent.id) ?? transformToMatrix(parent);
  const localMatrix = parentWorldMatrix.clone().invert().multiply(worldMatrix);

  return matrixToTransform(localMatrix);
}

export function transformToMatrix(transform: TransformSnapshot): Matrix4 {
  const position = tupleToVector(transform.position);
  const rotation = new Quaternion().setFromEuler(
    new Euler(transform.rotation[0], transform.rotation[1], transform.rotation[2], "XYZ"),
  );
  const scale = tupleToVector(transform.scale);

  return new Matrix4().compose(position, rotation, scale);
}

export function matrixToTransform(matrix: Matrix4): TransformSnapshot {
  const position = new Vector3();
  const rotation = new Quaternion();
  const scale = new Vector3();

  matrix.decompose(position, rotation, scale);

  return {
    position: vectorToTuple(position),
    rotation: eulerToTuple(new Euler().setFromQuaternion(rotation, "XYZ")),
    scale: vectorToTuple(scale),
  };
}

export function cloneTransform(transform: TransformSnapshot): TransformSnapshot {
  return {
    position: [...transform.position],
    rotation: [...transform.rotation],
    scale: [...transform.scale],
  };
}
