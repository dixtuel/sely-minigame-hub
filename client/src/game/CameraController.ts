import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

export class CameraController {
  readonly camera: FreeCamera;
  private readonly target = new Vector3();
  private readonly desiredPosition = new Vector3();
  private readonly objectiveVector = new Vector3();
  private readonly lateralVector = new Vector3();
  private readonly coarsePointer: boolean;
  private firstFrame = true;

  constructor(scene: Scene) {
    this.coarsePointer = window.matchMedia("(pointer: coarse)").matches;
    this.camera = new FreeCamera("archive-camera", new Vector3(-12, 8.8, -13), scene);
    this.camera.fov = this.coarsePointer ? 0.92 : 0.86;
    this.camera.minZ = 0.1;
    this.camera.maxZ = 72;
    this.camera.inputs.clear();
    this.camera.detachControl();
  }

  update(player: Vector3, heading: Vector3, objective: Vector3, delta: number) {
    const headingLength = Math.max(0.001, Math.hypot(heading.x, heading.z));
    const forwardX = heading.x / headingLength;
    const forwardZ = heading.z / headingLength;
    const followDistance = this.coarsePointer ? 10.4 : 9.7;
    const cameraHeight = this.coarsePointer ? 8.85 : 8.25;
    const lateral = this.coarsePointer ? 0.34 : 0.48;

    this.lateralVector.set(-forwardZ, 0, forwardX);
    this.desiredPosition.set(
      player.x - forwardX * followDistance + this.lateralVector.x * lateral,
      cameraHeight,
      player.z - forwardZ * followDistance + this.lateralVector.z * lateral,
    );

    this.objectiveVector.set(objective.x - player.x, 0, objective.z - player.z);
    const objectiveDistance = Math.hypot(this.objectiveVector.x, this.objectiveVector.z);
    const objectiveLead = Math.min(3.6, objectiveDistance * 0.44);
    if (objectiveDistance > 0.001) {
      this.objectiveVector.scaleInPlace(objectiveLead / objectiveDistance);
    } else {
      this.objectiveVector.set(0, 0, 0);
    }
    this.target.set(
      player.x + forwardX * 0.85 + this.objectiveVector.x,
      0.58,
      player.z + forwardZ * 0.85 + this.objectiveVector.z,
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
