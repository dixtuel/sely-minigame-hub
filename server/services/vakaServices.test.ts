import { describe, it, expect } from "vitest";
import { stripReasoningBlocks, cleanInterrogationText } from "./vakaLlmService";
import { processDeterministicInterrogation } from "./vakaDeterministicEngine";
import { VAKA_SAMPLE_CASES } from "../../shared/vakaCases";

describe("Vaka Services & Interrogation Engine", () => {
  it("strips LLM reasoning, thought, and dangling think blocks from responses", () => {
    expect(stripReasoningBlocks("<think>Analyzing alibi...</think>Ben odamdaydım.")).toBe("Ben odamdaydım.");
    expect(stripReasoningBlocks("İtiraf ediyorum.<think>Wait, don't say that")).toBe("İtiraf ediyorum.");
    expect(stripReasoningBlocks("internal thoughts</think>Görmedim!")).toBe("Görmedim!");
    expect(stripReasoningBlocks("<thought>P1</thought><reasoning>S1</reasoning>Masumum.")).toBe("Masumum.");
  });

  it("cleans tactical tags like [TAKTİKSEL BLÖF] and [SESSİZLİK & BASKI] from spoken dialogue", () => {
    expect(cleanInterrogationText("[TAKTİKSEL BLÖF] O saatte oradaydın!")).toBe("O saatte oradaydın!");
    expect(cleanInterrogationText("[TACTICAL BLUFF] Cell tower data places you there")).toBe("Cell tower data places you there");
    expect(cleanInterrogationText("[SESSİZLİK & BASKI] (Dedektif gözünü diker)")).toBe("(Dedektif gözünü diker)");
    expect(cleanInterrogationText("[ÇAPRAZ SORGU] Leyla senin hakkında konuştu")).toBe("Leyla senin hakkında konuştu");
    expect(cleanInterrogationText("Normal dedektif sorusu")).toBe("Normal dedektif sorusu");
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
    expect(silent.newStress).toBe(40); // Initial tension raises stress by 10

    // 5. Cross-examination: ask_about (gossip extraction) vs confront (credibility attack)
    const gossipAsk = processDeterministicInterrogation(
      sampleCase,
      "suspect-bora",
      "cross_examine",
      { crossSuspectId: "suspect-leyla", crossMode: "ask_about" },
      30,
      "tr"
    );
    expect(gossipAsk.text).toContain("Leyla");
    expect(gossipAsk.text).toContain("borsa"); // Bora's gossip about Leyla

    const crossConfront = processDeterministicInterrogation(
      sampleCase,
      "suspect-bora",
      "cross_examine",
      { crossSuspectId: "suspect-leyla", crossMode: "confront" },
      30,
      "tr"
    );
    expect(crossConfront.newStress).toBe(46); // +16 stress
    expect(crossConfront.text).toContain("iftira"); // Credibility attack against Leyla

    // 6. Two-way bluff dynamics (fails at low stress, succeeds at elevated stress)
    const bluffFail = processDeterministicInterrogation(sampleCase, "suspect-bora", "bluff", {}, 30, "tr");
    expect(bluffFail.newStress).toBe(18); // 30 - 12 (suspect relaxes)

    const bluffWin = processDeterministicInterrogation(sampleCase, "suspect-bora", "bluff", {}, 55, "tr");
    expect(bluffWin.newStress).toBe(71); // 55 + 16 (suspect cracks)

    // 7. Cross-mode Contradiction Awareness: when culprit was exposed in Contradiction Hunt
    const exposedInterrogation = processDeterministicInterrogation(
      sampleCase,
      "suspect-bora",
      "question",
      {
        question: "Şimdi ne diyeceksin?",
        isExposedByContradiction: true,
        exposedContradictionInfo: {
          sentence: "Saat tam 21:35 ile 21:50 arasında gök yarıldı...",
          clue: "Radar Kaydı",
        },
      },
      30,
      "tr"
    );
    expect(exposedInterrogation.confessed).toBe(true);
    expect(exposedInterrogation.newStress).toBeGreaterThanOrEqual(88);
    expect(exposedInterrogation.text).toContain("inkar etmenin bir anlamı kalmadı");
  });
});
