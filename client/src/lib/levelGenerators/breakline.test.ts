import { describe, expect, it } from "vitest";
import {
  BREAKLINE_MAX_BALLS,
  BREAKLINE_MAX_BALL_SPEED,
  BREAKLINE_MAX_EFFECTIVE_SPEED,
  BREAKLINE_MAX_POWERUPS_PER_RUN,
  BREAKLINE_POWERUP_COOLDOWN,
  BREAKLINE_POWERUP_DROP_CHANCE,
  breaklineAvailableBallSlots,
  breaklineEffectiveSpeed,
  breaklineNextBallSpeed,
  breaklinePowerupFromRoll,
  breaklineSplitDirections,
} from "../breaklineMechanics";
import { BREAKLINE_STAGE_COUNT, generateBreaklineRun } from "./breakline";

describe("Breakline run generation and mechanics", () => {
  it("produces deterministic, seed-sensitive runs with distinct valid patterns", () => {
    for (const seed of [0, 1, 14_151, 76_321, 991_831]) {
      for (const mastery of [1, 2, 3, 4]) {
        const run = generateBreaklineRun(seed, mastery);
        expect(generateBreaklineRun(seed, mastery)).toEqual(run);
        expect(run.stages).toHaveLength(BREAKLINE_STAGE_COUNT);
        expect(new Set(run.stages.map(stage => stage.patternIndex)).size).toBe(
          BREAKLINE_STAGE_COUNT
        );

        for (const stage of run.stages) {
          const cells = Array.from(stage.cells);
          expect(cells).toHaveLength(run.cols * run.rows);
          expect(
            cells.every(hp => Number.isInteger(hp) && hp >= 0 && hp <= 3)
          ).toBe(true);
          expect(cells.some(hp => hp > 0)).toBe(true);
        }
      }
    }

    expect(generateBreaklineRun(100, 2).stages).not.toEqual(
      generateBreaklineRun(101, 2).stages
    );
  });

  it("keeps pickup frequency bounded and power-up rolls in their weighted bands", () => {
    expect(BREAKLINE_POWERUP_DROP_CHANCE).toBe(0.1);
    expect(BREAKLINE_POWERUP_COOLDOWN).toBe(2.8);
    expect(BREAKLINE_MAX_POWERUPS_PER_RUN).toBe(8);
    expect(breaklinePowerupFromRoll(-1)).toBe("wide");
    expect(breaklinePowerupFromRoll(0.3399)).toBe("wide");
    expect(breaklinePowerupFromRoll(0.34)).toBe("multiball");
    expect(breaklinePowerupFromRoll(0.6)).toBe("slow");
    expect(breaklinePowerupFromRoll(0.85)).toBe("boost");
    expect(breaklinePowerupFromRoll(1)).toBe("boost");
    expect(breaklinePowerupFromRoll(Number.NaN)).toBe("boost");
  });

  it("caps ball speed and multiball while keeping split paths normalized", () => {
    expect(breaklineEffectiveSpeed(300, 0.86)).toBeCloseTo(258);
    expect(breaklineEffectiveSpeed(300, 1.08)).toBeCloseTo(324);
    expect(breaklineEffectiveSpeed(BREAKLINE_MAX_BALL_SPEED, 1.08)).toBe(
      BREAKLINE_MAX_EFFECTIVE_SPEED
    );
    expect(breaklineNextBallSpeed(300)).toBe(305);
    expect(breaklineNextBallSpeed(BREAKLINE_MAX_BALL_SPEED)).toBe(
      BREAKLINE_MAX_BALL_SPEED
    );

    expect(BREAKLINE_MAX_BALLS).toBe(3);
    expect(breaklineAvailableBallSlots(1)).toBe(2);
    expect(breaklineAvailableBallSlots(3)).toBe(0);
    expect(breaklineAvailableBallSlots(9)).toBe(0);
    expect(breaklineSplitDirections(1, 0, 0)).toEqual([]);

    const split = breaklineSplitDirections(0, -1, 4);
    expect(split).toHaveLength(2);
    for (const direction of split) {
      expect(Math.hypot(direction.vx, direction.vy)).toBeCloseTo(1);
    }
    expect(split[0].vx).toBeLessThan(0);
    expect(split[1].vx).toBeGreaterThan(0);
  });
});
