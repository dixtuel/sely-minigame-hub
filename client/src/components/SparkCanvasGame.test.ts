import { describe, expect, it } from "vitest";
import { projectSparkWorld, sceneryForSparkSegment, sparkWorldCollision } from "./SparkCanvasGame";

describe("Spark Canvas world mapping", () => {
  it("projects near entities larger and lower than distant entities", () => {
    const distant = projectSparkWorld(0, 28, 0, 1000, 600);
    const near = projectSparkWorld(0, 4, 0, 1000, 600);
    expect(near.scale).toBeGreaterThan(distant.scale);
    expect(near.y).toBeGreaterThan(distant.y);
  });

  it("uses the same x-z world coordinates for a hit and a safe pass", () => {
    const threat = { x: .32, z: 10, size: .68 };
    expect(sparkWorldCollision(.32, 10, threat)).toBe(true);
    expect(sparkWorldCollision(-.72, 10, threat)).toBe(false);
    expect(sparkWorldCollision(.32, 12.1, threat)).toBe(false);
  });

  it("prepares a deterministic, bounded ribbon of side scenery before a segment reaches view", () => {
    const first = sceneryForSparkSegment(618_071, 4);
    expect(first).toEqual(sceneryForSparkSegment(618_071, 4));
    expect(first).toHaveLength(7);
    expect(first.every(item => Math.abs(item.x) >= .9 && Math.abs(item.x) <= 1.46)).toBe(true);
    expect(first[0].z).toBeGreaterThan(4 * 54);
  });
});
