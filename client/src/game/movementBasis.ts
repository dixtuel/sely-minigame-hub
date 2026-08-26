import type { GridPoint } from "./types";

// The camera azimuth is fixed. These axes describe the screen/world plane seen by the player.
// W/ArrowUp = forward, S/ArrowDown = reverse, A/ArrowLeft = left, D/ArrowRight = right.
export const CAMERA_FORWARD = Object.freeze({ x: 0.849, z: 0.528 });
export const CAMERA_RIGHT = Object.freeze({ x: 0.528, z: -0.849 });

export const moveFromInputAxes = (horizontal: number, vertical: number): GridPoint => {
  const forward = -vertical;
  const x = CAMERA_RIGHT.x * horizontal + CAMERA_FORWARD.x * forward;
  const z = CAMERA_RIGHT.z * horizontal + CAMERA_FORWARD.z * forward;
  const magnitude = Math.hypot(x, z);
  return magnitude > 1 ? { x: x / magnitude, z: z / magnitude } : { x, z };
};
