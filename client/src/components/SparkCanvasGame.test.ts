import { describe, expect, it } from "vitest";
import {
  sparkCalculatePylonHeight,
  sparkDifficulty,
  sparkFlightCollision,
  sparkPhysicsStep,
  SPARK_DEFAULTS,
  type Pylon,
  type SparkState,
} from "./SparkCanvasGame";

describe("Spark Flight Canvas Physics & Mechanics", () => {
  it("applies gravity downward and upward impulse on flap", () => {
    const initial: SparkState = { x: 80, y: 250, vy: 0, rotation: 0 };
    // Normal frame: falls downward due to gravity
    const dropped = sparkPhysicsStep(initial, 1, false);
    expect(dropped.vy).toBeGreaterThan(0);
    expect(dropped.y).toBeGreaterThan(initial.y);

    // Flap frame: gives instant negative (upward) impulse
    const flapped = sparkPhysicsStep(dropped, 1, true);
    expect(flapped.vy).toBe(SPARK_DEFAULTS.flapImpulse);
    expect(flapped.rotation).toBeLessThan(0); // Tilts upward
  });

  it("produces deterministic and valid pylon heights from daily seed", () => {
    const seed = 42819;
    const h1 = sparkCalculatePylonHeight(seed, 0);
    const h1_repeat = sparkCalculatePylonHeight(seed, 0);
    const h2 = sparkCalculatePylonHeight(seed, 1);

    expect(h1).toBe(h1_repeat);
    expect(h1).toBeGreaterThanOrEqual(SPARK_DEFAULTS.minTopHeight);
    expect(h2).toBeGreaterThanOrEqual(SPARK_DEFAULTS.minTopHeight);
  });

  it("scales difficulty fairly with score and mastery", () => {
    const easy = sparkDifficulty(0, 0);
    const hard = sparkDifficulty(15, 3);

    expect(hard.speed).toBeGreaterThan(easy.speed);
    expect(hard.gap).toBeLessThan(easy.gap);
    expect(hard.gap).toBeGreaterThanOrEqual(SPARK_DEFAULTS.minGap);
  });

  it("accurately detects pylon and boundary collisions while keeping the gap safe", () => {
    const groundY = 535;
    const pylon: Pylon = {
      id: 0,
      x: 100,
      width: 50,
      topHeight: 120,
      gap: 150,
      bottomY: 270,
      bottomHeight: 265,
      passed: false,
    };
    const hitRadius = SPARK_DEFAULTS.hitRadius;

    // Safe inside the gap
    expect(sparkFlightCollision(125, 195, hitRadius, pylon, groundY)).toBe(false);

    // Top pylon collision
    expect(sparkFlightCollision(125, 100, hitRadius, pylon, groundY)).toBe(true);

    // Bottom pylon collision
    expect(sparkFlightCollision(125, 300, hitRadius, pylon, groundY)).toBe(true);

    // Ceiling collision
    expect(sparkFlightCollision(50, 5, hitRadius, pylon, groundY)).toBe(true);

    // Ground collision
    expect(sparkFlightCollision(50, 532, hitRadius, pylon, groundY)).toBe(true);
  });
});

