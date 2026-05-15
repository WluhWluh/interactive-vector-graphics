import { Vector3, type Camera } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

export function configureOrbitCameraControls(input: {
  orbitControls: OrbitControls;
  camera: Camera;
  target: Vector3;
}): void {
  input.orbitControls.object = input.camera;
  input.orbitControls.target.copy(input.target);
  input.orbitControls.enableDamping = true;
  input.orbitControls.dampingFactor = 0.08;
  input.orbitControls.update();
}

export function bindOrbitTransformInteraction(input: {
  orbitControls: OrbitControls;
  transformControls: TransformControls;
  getTransformControlsVisible: () => boolean;
  setOrbitInteractionActive: (active: boolean) => void;
}): void {
  const {
    orbitControls,
    transformControls,
    getTransformControlsVisible,
    setOrbitInteractionActive,
  } = input;

  orbitControls.addEventListener("start", () => {
    setOrbitInteractionActive(true);
    transformControls.enabled = false;
    transformControls.axis = null;
  });
  orbitControls.addEventListener("end", () => {
    setOrbitInteractionActive(false);
    transformControls.enabled = getTransformControlsVisible();
    transformControls.axis = null;
  });
}
