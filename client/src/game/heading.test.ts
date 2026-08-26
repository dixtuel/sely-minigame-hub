import { describe, expect, it } from "vitest";
import { movementYaw, shortestAngleDelta, stepFacingYaw } from "./heading";

describe("character facing", () => {
  it("maps a +Z movement vector to the character's local forward yaw", () => {
    expect(movementYaw(0, 1)).toBeCloseTo(0);
  });

  it("maps reverse, left and right movement vectors to the expected yaw", () => {
    expect(Math.abs(movementYaw(0, -1))).toBeCloseTo(Math.PI);
    expect(movementYaw(-1, 0)).toBeCloseTo(-Math.PI / 2);
    expect(movementYaw(1, 0)).toBeCloseTo(Math.PI / 2);
  });

  it("chooses the shortest turn across the -PI/PI seam", () => {
    const target = -Math.PI + 0.04;
    const current = Math.PI - 0.04;
    expect(shortestAngleDelta(target, current)).toBeCloseTo(0.08);
  });

  it("smoothly approaches the movement direction without changing the camera", () => {
    const next = stepFacingYaw(Math.PI / 2, 0, 1, 1 / 60);
    expect(next).toBeGreaterThan(0);
    expect(next).toBeLessThan(Math.PI / 2);
  });
});
