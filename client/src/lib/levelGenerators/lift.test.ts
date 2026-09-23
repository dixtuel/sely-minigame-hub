import { describe, expect, it } from "vitest";
import {
  canReachLiftPlatform,
  createLiftPlatformGenerator,
  createLiftPlatformSequence,
  liftDescendingTime,
  liftDifficultyForRow,
  liftHorizontalSpeed,
  liftJumpSpeed,
  liftReachableDistance,
  needsMoreLiftPlatforms,
} from "./lift";

describe("Lift procedural platform generator", () => {
  it("is deterministic for a seed and mastery, and varies for a new seed", () => {
    const generate = (seed: number) =>
      createLiftPlatformSequence(seed, 390, 2, 720, 100).platforms;
    expect(generate(12_345)).toEqual(generate(12_345));
    expect(generate(12_345)).not.toEqual(generate(12_346));
  });

  it("continues the same seeded route when the game asks for more rows", () => {
    const wholeRun = createLiftPlatformSequence(
      51_927,
      390,
      2,
      720,
      120
    ).platforms;
    const streamed = createLiftPlatformSequence(51_927, 390, 2, 720, 20);
    const continued = [...streamed.platforms];
    for (let i = 20; i < 120; i += 1) {
      const previous = continued[continued.length - 1];
      continued.push(
        streamed.next(previous.y, previous.x, 390, previous.width)
      );
    }
    expect(continued).toEqual(wholeRun);
  });

  it("keeps generating above the camera as the endless ascent scrolls upward", () => {
    const viewportHeight = 700;
    const topPlatformY = -1_400;
    expect(needsMoreLiftPlatforms(topPlatformY, 0, viewportHeight)).toBe(false);
    expect(needsMoreLiftPlatforms(topPlatformY, 200, viewportHeight)).toBe(
      true
    );
    expect(
      needsMoreLiftPlatforms(topPlatformY - 110, 200, viewportHeight)
    ).toBe(false);
  });

  it("streams fresh rows through a long ascent instead of stopping at a fixed height", () => {
    const next = createLiftPlatformGenerator(38_205, 390, 2);
    const viewportHeight = 700;
    let topY = -1_300;
    let topX = 100;
    let topWidth = 80;
    let rowsGenerated = 0;

    for (let frame = 1; frame <= 80; frame += 1) {
      const camera = frame * 50;
      while (needsMoreLiftPlatforms(topY, camera, viewportHeight)) {
        const platform = next(topY, topX, 390, topWidth);
        topY = platform.y;
        topX = platform.x;
        topWidth = platform.width;
        rowsGenerated += 1;
      }
    }

    expect(rowsGenerated).toBeGreaterThan(30);
    expect(topY).toBeLessThan(-5_000);
  });

  it("ramps pressure smoothly with height and mastery without exceeding its cap", () => {
    expect(liftDifficultyForRow(1, 1)).toBe(0);
    expect(liftDifficultyForRow(1, 53)).toBeGreaterThan(
      liftDifficultyForRow(1, 20)
    );
    expect(liftDifficultyForRow(4, 4)).toBeGreaterThan(
      liftDifficultyForRow(1, 4)
    );
    expect(liftDifficultyForRow(4, 500)).toBe(1);
  });

  it("increases platform spacing and route width variation later in a run", () => {
    const platforms = createLiftPlatformSequence(
      72_191,
      390,
      1,
      720,
      141
    ).platforms;
    const average = (values: number[]) =>
      values.reduce((total, value) => total + value, 0) / values.length;
    const gaps = platforms
      .slice(1)
      .map((platform, index) => platforms[index].y - platform.y);
    const earlyGap = average(gaps.slice(0, 16));
    const lateGap = average(gaps.slice(-40));
    const earlyWidths = platforms.slice(0, 16).map(platform => platform.width);
    const lateWidths = platforms.slice(-40).map(platform => platform.width);

    expect(lateGap).toBeGreaterThan(earlyGap + 5);
    expect(average(lateWidths)).toBeLessThan(average(earlyWidths));
    expect(new Set(gaps).size).toBeGreaterThan(80);
  });

  it("keeps every generated step inside the world and in the physics reach envelope", () => {
    for (const worldWidth of [240, 390, 580]) {
      for (const mastery of [1, 2, 4]) {
        const platforms = createLiftPlatformSequence(
          97_351 + mastery,
          worldWidth,
          mastery,
          720,
          320
        ).platforms;
        expect(platforms[0].kind).toBe("normal");
        for (let i = 0; i < platforms.length; i += 1) {
          const current = platforms[i];
          expect(current.x).toBeGreaterThanOrEqual(10);
          expect(current.x + current.width).toBeLessThanOrEqual(
            worldWidth - 10 + 0.001
          );
          if (i > 0) {
            const previous = platforms[i - 1];
            const gap = previous.y - current.y;
            expect(gap).toBeGreaterThanOrEqual(94 - 0.001);
            expect(gap).toBeLessThan(128 + 0.001);
            expect(
              canReachLiftPlatform(
                previous.x + previous.width / 2,
                current.x + current.width / 2,
                current.width,
                worldWidth,
                gap,
                liftJumpSpeed(mastery),
                liftHorizontalSpeed(worldWidth, mastery),
                current.moveRange
              )
            ).toBe(true);
          }
        }
      }
    }
  });

  it("introduces varied mechanics but spaces crumble platforms apart", () => {
    const platforms = createLiftPlatformSequence(
      8_264,
      390,
      2,
      720,
      1_000
    ).platforms;
    expect(
      platforms.slice(1, 4).every(platform => platform.kind === "normal")
    ).toBe(true);
    expect(platforms.some(platform => platform.kind === "moving")).toBe(true);
    expect(platforms.some(platform => platform.kind === "crumble")).toBe(true);
    expect(platforms.some(platform => platform.kind === "spring")).toBe(true);
    expect(
      platforms.filter(platform => platform.kind === "normal").length
    ).toBeGreaterThan(platforms.length * 0.4);
    for (let i = 2; i < platforms.length; i += 1) {
      expect(
        platforms[i].kind === "crumble" && platforms[i - 1].kind === "crumble"
      ).toBe(false);
    }
  });

  it("gives moving platforms different speeds, directions and ranges", () => {
    const moving = createLiftPlatformSequence(
      6_417,
      390,
      3,
      720,
      220
    ).platforms.filter(platform => platform.kind === "moving");
    expect(moving.length).toBeGreaterThan(20);
    expect(
      new Set(moving.map(platform => platform.moveSpeed)).size
    ).toBeGreaterThan(10);
    expect(
      new Set(moving.map(platform => platform.moveRange)).size
    ).toBeGreaterThan(10);
    expect(new Set(moving.map(platform => platform.direction)).size).toBe(2);
    expect(
      moving.every(
        platform => platform.moveSpeed >= 0.65 && platform.moveSpeed <= 2.01
      )
    ).toBe(true);
  });

  it("uses ballistic timing and accelerated steering when validating a landing", () => {
    expect(liftDescendingTime(120, 500)).not.toBeNull();
    expect(liftDescendingTime(160, 480)).toBeNull();
    expect(liftReachableDistance(0.12, 300)).toBeLessThan(25);
    expect(canReachLiftPlatform(100, 100, 60, 390, 120, 500, 300)).toBe(true);
    expect(canReachLiftPlatform(100, 100, 60, 390, 160, 480, 300)).toBe(false);
  });
});
