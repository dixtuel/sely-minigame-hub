import { describe, expect, it } from "vitest";
import { CAMERA_FORWARD, CAMERA_RIGHT, moveFromInputAxes } from "./movementBasis";

describe("standard movement basis", () => {
  it("maps W/up to forward and S/down to reverse", () => {
    const forward = moveFromInputAxes(0, -1);
    const reverse = moveFromInputAxes(0, 1);
    expect(forward.x).toBeCloseTo(CAMERA_FORWARD.x);
    expect(forward.z).toBeCloseTo(CAMERA_FORWARD.z);
    expect(reverse.x).toBeCloseTo(-CAMERA_FORWARD.x);
    expect(reverse.z).toBeCloseTo(-CAMERA_FORWARD.z);
  });

  it("maps A/left to left and D/right to right", () => {
    const left = moveFromInputAxes(-1, 0);
    const right = moveFromInputAxes(1, 0);
    expect(left.x).toBeCloseTo(-CAMERA_RIGHT.x);
    expect(left.z).toBeCloseTo(-CAMERA_RIGHT.z);
    expect(right.x).toBeCloseTo(CAMERA_RIGHT.x);
    expect(right.z).toBeCloseTo(CAMERA_RIGHT.z);
  });

  it("normalizes diagonal input without changing its direction", () => {
    const diagonal = moveFromInputAxes(1, -1);
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(1);
    expect(diagonal.x).toBeGreaterThan(0);
    expect(diagonal.z).toBeLessThan(0);
  });
});
