import { describe, expect, it } from "vitest";
import { resultActionsFor, runMasteryFor } from "./GameStudio";

describe("runMasteryFor", () => {
  it("uses the stricter daily difficulty when the saved score is lower", () => {
    expect(runMasteryFor(0, 3)).toBe(3);
  });

  it("uses the saved-score band only when a new run is intentionally started", () => {
    const startedWith = runMasteryFor(0, 2);
    const scoreSavedDuringRun = runMasteryFor(1_185, 2);
    expect(startedWith).toBe(2);
    expect(scoreSavedDuringRun).toBe(3);
  });
});

describe("resultActionsFor", () => {
  it("offers the next generated level after a successful run", () => {
    expect(resultActionsFor("success", 0)).toEqual({ canRetry: false, canAdvance: true });
  });

  it("keeps only retry available for the first two failed runs", () => {
    expect(resultActionsFor("failure", 1)).toEqual({ canRetry: true, canAdvance: false });
    expect(resultActionsFor("failure", 2)).toEqual({ canRetry: true, canAdvance: false });
  });

  it("unlocks the next generated level on the third failed run", () => {
    expect(resultActionsFor("failure", 3)).toEqual({ canRetry: true, canAdvance: true });
  });
});
