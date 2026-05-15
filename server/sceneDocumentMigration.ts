import type { SceneDocument } from "./types";
import {
  createLatestDocumentMigrationResult,
  createUnsupportedDocumentMigrationResult,
  readDocumentVersion,
  type DocumentMigrationResult,
} from "../src/core/documents/documentMigration";

export const SCENE_DOCUMENT_VERSION = 2;

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

function cloneSceneDocument(document: SceneDocument): SceneDocument {
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
