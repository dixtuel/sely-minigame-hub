import { describe, it, expect } from "vitest";
import { stripReasoningBlocks } from "./vakaLlmService";
import { processDeterministicInterrogation } from "./vakaDeterministicEngine";
import { VAKA_SAMPLE_CASES } from "../../shared/vakaCases";

describe("Vaka LLM Service - stripReasoningBlocks", () => {
  it("should strip complete <think> blocks", () => {
    const input = "<think>Analyzing suspect alibi...</think>Ben saat 21:00'de odamdaydım.";
    expect(stripReasoningBlocks(input)).toBe("Ben saat 21:00'de odamdaydım.");
  });

  it("should strip unclosed trailing <think> blocks", () => {
    const input = "İtiraf ediyorum.<think>Wait, maybe I should not say that";
    expect(stripReasoningBlocks(input)).toBe("İtiraf ediyorum.");
  });

  it("should strip leading dangling </think> tags", () => {
    const input = "internal thoughts</think>Hiçbir şey görmedim!";
    expect(stripReasoningBlocks(input)).toBe("Hiçbir şey görmedim!");
  });

  it("should strip <thought> and <reasoning> blocks", () => {
    const input = "<thought>Plan:</thought><reasoning>Step 1</reasoning>Ben masumum.";
    expect(stripReasoningBlocks(input)).toBe("Ben masumum.");
  });
});

describe("Vaka Deterministic Fallback Engine - Deep Actions", () => {
  const sampleCase = VAKA_SAMPLE_CASES[0]; // Atlantis Saati (Culprit: Bora Kaya)

  it("should increase stress when confronted with contradicting evidence", () => {
    const result = processDeterministicInterrogation(
      sampleCase,
      "suspect-bora",
      "present_evidence",
      { presentedClueId: "clue-rain-log" },
      20,
      "tr"
    );

    expect(result.newStress).toBeGreaterThan(20);
    expect(result.confessed).toBe(false);
    expect(result.unlockedClueId).toBe("clue-rain-log");
  });

  it("should trigger confession when stress exceeds break threshold", () => {
    const result = processDeterministicInterrogation(
      sampleCase,
      "suspect-bora",
      "present_evidence",
      { presentedClueId: "clue-rain-log" },
      65,
      "tr"
    );

    expect(result.newStress).toBeGreaterThanOrEqual(68);
    expect(result.confessed).toBe(true);
    expect(result.text).toContain("ben aldım");
  });

  it("should decrease stress when confronted with clearing evidence", () => {
    const result = processDeterministicInterrogation(
      sampleCase,
      "suspect-cengiz",
      "present_evidence",
      { presentedClueId: "clue-phone-bill" },
      40,
      "tr"
    );

    expect(result.newStress).toBeLessThan(40);
    expect(result.confessed).toBe(false);
  });

  it("should handle stay_silent action with psychological pressure", () => {
    const result = processDeterministicInterrogation(
      sampleCase,
      "suspect-bora",
      "stay_silent",
      {},
      30,
      "tr"
    );

    expect(result.newStress).toBe(40);
    expect(result.text.length).toBeGreaterThan(10);
  });

  it("should handle cross_examine action quoting other suspects", () => {
    const result = processDeterministicInterrogation(
      sampleCase,
      "suspect-bora",
      "cross_examine",
      { crossSuspectId: "suspect-leyla" },
      30,
      "tr"
    );

    expect(result.newStress).toBe(46);
    expect(result.text).toContain("Leyla");
  });
});
