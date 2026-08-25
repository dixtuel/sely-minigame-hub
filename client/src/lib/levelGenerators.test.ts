import { describe, expect, it } from "vitest";
import { compareHaneGuess, generateCutLevel, generateEchoLevel, generateHaneLevel, generateKnotLevel, generateMarkerCases, generateShadowLevel, generateSparkLevel, generateSparkWorldSegment, isCutLevelSolvable, isEchoLevelSolvable, isHaneGuessValid, isShadowLevelSolvable, isSparkLevelFair, personalSeed, validateDailySeed } from "./levelGenerators";

describe("mini-game level generators", () => {
  it("keeps each daily generator deterministic and structurally valid", () => {
    const seed = 14151;
    expect(generateEchoLevel(seed, 2)).toEqual(generateEchoLevel(seed, 2));
    expect(generateKnotLevel(seed, 2).rotations).toHaveLength(16);
    expect(generateCutLevel(seed, 2).shapes.filter(shape => shape.target)).toHaveLength(4);
    expect(generateShadowLevel(seed, 2).pads).toHaveLength(2);
    expect(generateMarkerCases(seed, 2).every(item => item.options[item.correct])).toBe(true);
    expect(generateHaneLevel(seed, 2)).toEqual(generateHaneLevel(seed, 2));
    expect(generateSparkLevel(seed, 2)).toEqual(generateSparkLevel(seed, 2));
    expect(["echo", "knot", "cut", "shadow", "marker", "hane", "spark"].every(game => validateDailySeed(seed, game as any))).toBe(true);
  });

  it("changes a personal practice seed with mastery or attempt without changing the daily seed contract", () => {
    expect(personalSeed(99, "echo", 1, 1)).not.toBe(personalSeed(99, "echo", 2, 1));
    expect(personalSeed(99, "echo", 2, 1)).not.toBe(personalSeed(99, "echo", 2, 2));
  });

  it("finds a real completion route for the path, cut, and delayed-shadow generators", () => {
    for (const seed of [14151, 76321, 99183]) {
      expect(isEchoLevelSolvable(generateEchoLevel(seed, 2))).toBe(true);
      expect(isCutLevelSolvable(generateCutLevel(seed, 2))).toBe(true);
      expect(isShadowLevelSolvable(generateShadowLevel(seed, 2))).toBe(true);
      expect(isSparkLevelFair(generateSparkLevel(seed, 2))).toBe(true);
    }
  });

  it("keeps Echo Room’s longer three-mark route solvable within its sound budget", () => {
    const level = generateEchoLevel(76321, 2);
    expect(level.cols).toBeGreaterThanOrEqual(11);
    expect(level.rows).toBeGreaterThanOrEqual(7);
    expect(level.checkpoints).toHaveLength(3);
    expect(isEchoLevelSolvable(level)).toBe(true);
  });

  it("keeps Spark’s endless chapter compact, deterministic, and fair to replay", () => {
    const level = generateSparkLevel(99183, 3);
    expect(level.chapterDuration).toBeGreaterThanOrEqual(20);
    expect(level.events.length).toBeGreaterThan(10);
    expect(level.events.every(event => event.at < level.chapterDuration)).toBe(true);
    expect(level.events.every(event => event.drift >= .1 && event.drift <= .9)).toBe(true);
    expect(level.events.every(event => !("lane" in event))).toBe(true);
    expect(isSparkLevelFair(level)).toBe(true);
  });

  it("turns each Spark chapter into a bounded, deterministic world segment", () => {
    const level = generateSparkLevel(99183, 3);
    const first = generateSparkWorldSegment(level, 0);
    const next = generateSparkWorldSegment(level, 1);
    expect(first).toEqual(generateSparkWorldSegment(level, 0));
    expect(first.events).toHaveLength(level.events.length);
    expect(next.events.every(event => event.drift >= .08 && event.drift <= .92)).toBe(true);
    expect(next.events.map(event => event.drift)).not.toEqual(first.events.map(event => event.drift));
  });

  it("builds a valid Hane record and accounts for repeated digits without over-counting", () => {
    const novice = generateHaneLevel(74181, 1);
    const expert = generateHaneLevel(74181, 4);
    expect(novice.target).toMatch(/^\d{4}$/);
    expect(new Set(novice.target).size).toBe(4);
    expect(expert.target).toMatch(/^\d{5}$/);
    expect(isHaneGuessValid("1234", novice)).toBe(true);
    expect(isHaneGuessValid("0234", novice)).toBe(false);
    expect(compareHaneGuess("1212", "1111")).toEqual({ locks: 2, traces: 0 });
    expect(compareHaneGuess("1212", "2121")).toEqual({ locks: 0, traces: 4 });
  });
});
