import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

export class CameraController {
  readonly camera: FreeCamera;
  private readonly target = new Vector3();
  private readonly desiredPosition = new Vector3();
  private readonly fixedCameraOffset: Vector3;
  private readonly fixedLookOffset = new Vector3(2.8, 0.58, 1.2);
  private readonly coarsePointer: boolean;
  private firstFrame = true;

  constructor(scene: Scene) {
    this.coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    this.camera = new FreeCamera("archive-camera", new Vector3(-12, 8.8, -13), scene);
    this.camera.fov = this.coarsePointer ? 0.92 : 0.86;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 72;
    // InputManager owns keyboard/touch gameplay input. Babylon must never rotate this camera.
    this.camera.inputs.clear();
    this.camera.detachControl();
    this.fixedCameraOffset = this.coarsePointer
      ? new Vector3(-9.8, 8.95, -6.6)
      : new Vector3(-9.4, 8.3, -6.4);
  }

  update(player: Vector3, _heading: Vector3, _objective: Vector3, delta: number) {
    // Deliberately ignore movement heading and objective direction. The camera translates
    // with the player but its azimuth is fixed, so W/A/S/D and arrow keys cannot rotate it.
    this.desiredPosition.set(
      player.x + this.fixedCameraOffset.x,
      this.fixedCameraOffset.y,
      player.z + this.fixedCameraOffset.z,
    );
    this.target.set(
      player.x + this.fixedLookOffset.x,
      this.fixedLookOffset.y,
      player.z + this.fixedLookOffset.z,
    );

    if (this.firstFrame) {
      this.camera.position.copyFrom(this.desiredPosition);
      this.firstFrame = false;
    } else {
      const smoothing = 1 - Math.exp(-delta * (this.coarsePointer ? 7.5 : 8.5));
      this.camera.position.x += (this.desiredPosition.x - this.camera.position.x) * smoothing;
      this.camera.position.y += (this.desiredPosition.y - this.camera.position.y) * smoothing;
      this.camera.position.z += (this.desiredPosition.z - this.camera.position.z) * smoothing;
    }
    this.camera.setTarget(this.target);
  }
}
