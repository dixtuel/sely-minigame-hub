import { describe, expect, it } from "vitest";
import { sparkCollision, sparkLaneBounds, sparkLaneOf, sparkPlayerScreenY, sparkSpeedRatio } from "./SparkCanvasGame";

describe("Spark Canvas top-down lane mapping", () => {
  it("splits the road into evenly spaced, non-overlapping lane centers", () => {
    const bounds = sparkLaneBounds(3);
    expect(bounds).toHaveLength(3);
    expect(bounds[0].center).toBeLessThan(bounds[1].center);
    expect(bounds[1].center).toBeLessThan(bounds[2].center);
    expect(bounds.every(bound => bound.half > 0)).toBe(true);
  });

  it("resolves an x position to its nearest lane", () => {
    const bounds = sparkLaneBounds(3);
    expect(sparkLaneOf(bounds[0].center, 3)).toBe(0);
    expect(sparkLaneOf(bounds[1].center, 3)).toBe(1);
    expect(sparkLaneOf(bounds[2].center, 3)).toBe(2);
  });

  it("only registers a collision when the player is in the hazard's lane and row", () => {
    const bounds = sparkLaneBounds(3);
    const hazardInLane1 = { lane: 1, z: 10 };
    expect(sparkCollision(bounds[1].center, 10, hazardInLane1, 3)).toBe(true);
    expect(sparkCollision(bounds[0].center, 10, hazardInLane1, 3)).toBe(false);
    expect(sparkCollision(bounds[2].center, 10, hazardInLane1, 3)).toBe(false);
    expect(sparkCollision(bounds[1].center, 15, hazardInLane1, 3)).toBe(false);
  });

  it("makes the car visibly creep forward on screen as speed rises, not just the road scroll", () => {
    expect(sparkSpeedRatio(6, 6, 15)).toBe(0);
    expect(sparkSpeedRatio(15, 6, 15)).toBe(1);
    expect(sparkSpeedRatio(10.5, 6, 15)).toBeCloseTo(.5, 1);
    const atRest = sparkPlayerScreenY(600, 0);
    const atMax = sparkPlayerScreenY(600, 1);
    expect(atMax).toBeLessThan(atRest); // daha yukarı = ekranda daha ileride
  });
});
