import { describe, expect, it } from "vitest";
import { resultActionsFor, runMasteryFor } from "./GameStudio";

describe("GameStudio orchestration logic", () => {
  it("determines mastery difficulty band across daily score states", () => {
    expect(runMasteryFor(0, 3)).toBe(3);
    const startedWith = runMasteryFor(0, 2);
    const scoreSavedDuringRun = runMasteryFor(1_185, 2);
    expect(startedWith).toBe(2);
    expect(scoreSavedDuringRun).toBe(3);
  });

  it("evaluates post-run result actions (retry vs advance) for all game modes", () => {
    // Standard game flows
    expect(resultActionsFor("success", 0)).toEqual({ canRetry: false, canAdvance: true });
    expect(resultActionsFor("failure", 1)).toEqual({ canRetry: true, canAdvance: false });
    expect(resultActionsFor("failure", 2)).toEqual({ canRetry: true, canAdvance: false });
    expect(resultActionsFor("failure", 3)).toEqual({ canRetry: true, canAdvance: true });

    // Spark endless flow (retry only)
    expect(resultActionsFor("success", 0, "spark")).toEqual({ canRetry: true, canAdvance: false });
    expect(resultActionsFor("failure", 0, "spark")).toEqual({ canRetry: true, canAdvance: false });
    expect(resultActionsFor("failure", 3, "spark")).toEqual({ canRetry: true, canAdvance: false });
    expect(resultActionsFor("failure", 3, "apex")).toEqual({ canRetry: true, canAdvance: false });
    for (const gameId of ["coil", "apex", "lift", "breakline"] as const) {
      expect(resultActionsFor("failure", 3, gameId)).toEqual({ canRetry: true, canAdvance: false });
    }

    // Hane dictionary flow (retry with new word or advance)
    expect(resultActionsFor("success", 0, "hane")).toEqual({ canRetry: true, canAdvance: true });
    expect(resultActionsFor("failure", 1, "hane")).toEqual({ canRetry: true, canAdvance: false });
    expect(resultActionsFor("failure", 3, "hane")).toEqual({ canRetry: true, canAdvance: true });
  });
});
