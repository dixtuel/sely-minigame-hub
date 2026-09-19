import { describe, it, expect } from "vitest";
import { stripReasoningBlocks } from "./vakaLlmService";
import { processDeterministicInterrogation } from "./vakaDeterministicEngine";
import { VAKA_SAMPLE_CASES } from "../../shared/vakaCases";

describe("Vaka Services & Interrogation Engine", () => {
  it("strips LLM reasoning, thought, and dangling think blocks from responses", () => {
    expect(stripReasoningBlocks("<think>Analyzing alibi...</think>Ben odamdaydım.")).toBe("Ben odamdaydım.");
    expect(stripReasoningBlocks("İtiraf ediyorum.<think>Wait, don't say that")).toBe("İtiraf ediyorum.");
    expect(stripReasoningBlocks("internal thoughts</think>Görmedim!")).toBe("Görmedim!");
    expect(stripReasoningBlocks("<thought>P1</thought><reasoning>S1</reasoning>Masumum.")).toBe("Masumum.");
  });

  it("handles deterministic interrogation: evidence, psychological pressure, bluffing, and confession thresholds", () => {
    const sampleCase = VAKA_SAMPLE_CASES[0]; // Atlantis Saati (Culprit: Bora Kaya)

    // 1. Evidence confrontation (increasing stress on contradiction, decreasing on clearing)
    const evContradict = processDeterministicInterrogation(sampleCase, "suspect-bora", "present_evidence", { presentedClueId: "clue-rain-log" }, 20, "tr");
    expect(evContradict.newStress).toBeGreaterThan(20);
    expect(evContradict.confessed).toBe(false);

    const evClear = processDeterministicInterrogation(sampleCase, "suspect-cengiz", "present_evidence", { presentedClueId: "clue-phone-bill" }, 40, "tr");
    expect(evClear.newStress).toBeLessThan(40);
    expect(evClear.confessed).toBe(false);

    // 2. Confession only triggered when stress exceeds threshold AND confronting with culprit clue
    const evConfess = processDeterministicInterrogation(sampleCase, "suspect-bora", "present_evidence", { presentedClueId: "clue-rain-log" }, 65, "tr");
    expect(evConfess.newStress).toBeGreaterThanOrEqual(68);
    expect(evConfess.confessed).toBe(true);

    // 3. Plain question never triggers confession even at maximum stress
    const plainQ = processDeterministicInterrogation(sampleCase, "suspect-bora", "question", { question: "Katil sensin!" }, 75, "tr");
    expect(plainQ.confessed).toBe(false);

    // 4. Psychological tactics: silence pressure & cross-examination
    const silent = processDeterministicInterrogation(sampleCase, "suspect-bora", "stay_silent", {}, 30, "tr");
    expect(silent.newStress).toBe(40);

    const cross = processDeterministicInterrogation(sampleCase, "suspect-bora", "cross_examine", { crossSuspectId: "suspect-leyla" }, 30, "tr");
    expect(cross.newStress).toBe(46);

    // 5. Two-way bluff dynamics (fails at low stress, succeeds at elevated stress)
    const bluffFail = processDeterministicInterrogation(sampleCase, "suspect-bora", "bluff", {}, 30, "tr");
    expect(bluffFail.newStress).toBe(18); // 30 - 12 (suspect relaxes)

    const bluffWin = processDeterministicInterrogation(sampleCase, "suspect-bora", "bluff", {}, 55, "tr");
    expect(bluffWin.newStress).toBe(71); // 55 + 16 (suspect cracks)
  });
});
