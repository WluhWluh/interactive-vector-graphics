import type { ViewportCameraSnapshot } from "../contracts/records";
import {
  createLatestDocumentMigrationResult,
  createUnsupportedDocumentMigrationResult,
  readDocumentVersion,
  type DocumentMigrationResult,
} from "./documentMigration";

export const SCENE_DOCUMENT_VERSION = 2;

export type SceneTrackEasing = "linear" | "step" | "easeInOut";
export type SceneTrackTargetKind = "node" | "camera";
export type SceneTrackProperty =
  | "position"
  | "rotation"
  | "scale"
  | "target"
  | "fov"
  | "zoom";
export type SceneKeyframeValue = number | [number, number, number];

export type ScenePrimitiveNode = {
  id: string;
  kind: "primitive";
  assetId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  billboardMode: "spherical";
};

export type ScenePrefabInstanceNode = {
  id: string;
  kind: "prefabInstance";
  prefabId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
};

export type SceneNode = ScenePrimitiveNode | ScenePrefabInstanceNode;

export type SceneDocument = {
  version: typeof SCENE_DOCUMENT_VERSION;
  camera: ViewportCameraSnapshot;
  nodes: SceneNode[];
  animation: {
    fps: 24;
    activeClipId: string | null;
    clips: Array<{
      id: string;
      name: string;
      duration: number;
      tracks: Array<{
        id: string;
        target: {
          kind: SceneTrackTargetKind;
          nodeId?: string;
          property: SceneTrackProperty;
        };
        keyframes: Array<{
          time: number;
          value: SceneKeyframeValue;
          easing: SceneTrackEasing;
        }>;
      }>;
    }>;
  };
};

export function cloneSceneDocument(document: SceneDocument): SceneDocument {
  return {
    version: SCENE_DOCUMENT_VERSION,
    camera: {
      projection: document.camera.projection,
      position: [...document.camera.position],
      target: [...document.camera.target],
      fov: document.camera.fov,
      zoom: document.camera.zoom,
      near: document.camera.near,
      far: document.camera.far,
    },
    nodes: document.nodes.map((node) => ({
      ...node,
      position: [...node.position],
      rotation: [...node.rotation],
      scale: [...node.scale],
    })),
    animation: {
      fps: document.animation.fps,
      activeClipId: document.animation.activeClipId,
      clips: document.animation.clips.map((clip) => ({
        id: clip.id,
        name: clip.name,
        duration: clip.duration,
        tracks: clip.tracks.map((track) => ({
          id: track.id,
          target: { ...track.target },
          keyframes: track.keyframes.map((keyframe) => ({
            time: keyframe.time,
            value: Array.isArray(keyframe.value)
              ? [...keyframe.value]
              : keyframe.value,
            easing: keyframe.easing,
          })),
        })),
      })),
    },
  };
}

export function migrateSceneDocument(
  value: unknown,
): DocumentMigrationResult<SceneDocument> {
  const version = readDocumentVersion(value);

  if (version === SCENE_DOCUMENT_VERSION) {
    return createLatestDocumentMigrationResult({
      document: cloneSceneDocument(value as SceneDocument),
      version,
    });
  }

  return createUnsupportedDocumentMigrationResult({
    value,
    latestVersion: SCENE_DOCUMENT_VERSION,
    documentLabel: "Scene",
  });
}
