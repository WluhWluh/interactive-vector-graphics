export type EntityId =
  | ProjectId
  | PrimitiveAssetId
  | PrefabId
  | SceneId
  | PrefabNodeId
  | SceneNodeId;

export type ProjectId = string;
export type PrimitiveAssetId = string;
export type PrefabId = string;
export type SceneId = string;
export type PrefabNodeId = string;
export type SceneNodeId = string;

export type IdNamespace =
  | "project"
  | "primitiveAsset"
  | "prefab"
  | "scene"
  | "prefabNode"
  | "sceneNode";

const UUID_V7_VERSION = 0x70;
const UUID_VARIANT = 0x80;

export function createOpaqueId(namespace: "project"): ProjectId;
export function createOpaqueId(namespace: "primitiveAsset"): PrimitiveAssetId;
export function createOpaqueId(namespace: "prefab"): PrefabId;
export function createOpaqueId(namespace: "scene"): SceneId;
export function createOpaqueId(namespace: "prefabNode"): PrefabNodeId;
export function createOpaqueId(namespace: "sceneNode"): SceneNodeId;
export function createOpaqueId(namespace: IdNamespace): EntityId {
  const bytes = new Uint8Array(16);
  fillRandomBytes(bytes);

  const timestamp = BigInt(Date.now());
  bytes[0] = Number((timestamp >> 40n) & 0xffn);
  bytes[1] = Number((timestamp >> 32n) & 0xffn);
  bytes[2] = Number((timestamp >> 24n) & 0xffn);
  bytes[3] = Number((timestamp >> 16n) & 0xffn);
  bytes[4] = Number((timestamp >> 8n) & 0xffn);
  bytes[5] = Number(timestamp & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | UUID_V7_VERSION;
  bytes[8] = (bytes[8] & 0x3f) | UUID_VARIANT;

  return `${getNamespacePrefix(namespace)}_${formatUuidBytes(bytes)}`;
}

export function isOpaqueId(value: string, namespace?: IdNamespace): boolean {
  const prefixPattern = namespace ? getNamespacePrefix(namespace) : "[a-z]+";
  return new RegExp(
    `^${prefixPattern}_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`,
  ).test(value);
}

function getNamespacePrefix(namespace: IdNamespace): string {
  switch (namespace) {
    case "project":
      return "proj";
    case "primitiveAsset":
      return "asset";
    case "prefab":
      return "prefab";
    case "scene":
      return "scene";
    case "prefabNode":
      return "pnode";
    case "sceneNode":
      return "snode";
  }
}

function fillRandomBytes(bytes: Uint8Array): void {
  const cryptoLike = globalThis.crypto;

  if (cryptoLike?.getRandomValues) {
    cryptoLike.getRandomValues(bytes as Uint8Array<ArrayBuffer>);
    return;
  }

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }
}

function formatUuidBytes(bytes: Uint8Array): string {
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));

  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}
