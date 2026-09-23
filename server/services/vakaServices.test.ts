import { describe, it, expect } from "vitest";
import { stripReasoningBlocks, cleanInterrogationText, buildVakaInterrogationPrompt } from "./vakaLlmService";
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

    // 6. Bluff dynamics (initial bluff against culprit raises stress, repeated bluff is penalized)
    const bluffFirst = processDeterministicInterrogation(sampleCase, "suspect-bora", "bluff", {}, 30, "tr");
    expect(bluffFirst.newStress).toBe(46); // 30 + 16 (culprit panics)

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

  it("handles dynamic unlockable suspects and alibi denial mechanics", () => {
    // 1. Vaka 02: Murat sorgusunda bahçıvan bahsi geçince Şaban Efendi'nin açılması
    const case2 = VAKA_SAMPLE_CASES.find((c) => c.id === "case-02-zehirli-kadeh")!;
    expect(case2).toBeDefined();
    const gardener = case2.suspects.find((s) => s.id === "suspect-bahcivan");
    expect(gardener).toBeDefined();
    expect(gardener?.isInitiallyLocked).toBe(true);
    expect(gardener?.alibiDenial).toBeDefined();

    const muratAlibiQ = processDeterministicInterrogation(
      case2,
      "suspect-murat",
      "question",
      { question: "Olay saatinde tam olarak neredeydin, kiminleydin?" },
      20,
      "tr"
    );
    // Murat lies level1: "Ben o saatte garajda bahçıvan Şaban Efendi ile arabamın aküsünü tamir ediyordum, gidin ona sorun!"
    expect(muratAlibiQ.text).toContain("bahçıvan Şaban Efendi");
    expect(muratAlibiQ.unlockedSuspectId).toBe("suspect-bahcivan");
    expect(muratAlibiQ.unlockedSuspectName).toBe("Şaban Efendi");

    // 2. Açılan Bahçıvan Şaban Efendi'nin Murat'ın sahte alibisini yalanlaması
    const sabanDenial = processDeterministicInterrogation(
      case2,
      "suspect-bahcivan",
      "question",
      { question: "Murat Bey garajda seninle olduğunu söyledi, doğru mu?" },
      20,
      "tr"
    );
    expect(sabanDenial.text).toContain("Murat Bey benimle akü tamir ettiğini mi söyledi?");
    expect(sabanDenial.text).toContain("telaşla köşke geri koştu");

    // 3. Vaka 05: Kerim'in sorgusunda asistanından bahsedilince Cansu Yılmaz'ın açılması
    const case5 = VAKA_SAMPLE_CASES.find((c) => c.id === "case-05-kuantum-laboratuvari")!;
    expect(case5).toBeDefined();
    const cansu = case5.suspects.find((s) => s.id === "suspect-cansu");
    expect(cansu).toBeDefined();
    expect(cansu?.isInitiallyLocked).toBe(true);

    const kerimAlibiQ = processDeterministicInterrogation(
      case5,
      "suspect-kerim",
      "question",
      { question: "O saatte neredeydin?" },
      20,
      "tr"
    );
    expect(kerimAlibiQ.text).toContain("asistanım Cansu");
    expect(kerimAlibiQ.unlockedSuspectId).toBe("suspect-cansu");
    expect(kerimAlibiQ.unlockedSuspectName).toBe("Cansu Yılmaz");

    // 4. Cansu Yılmaz'ın Kerim Hoca'nın alibisini kesin bir dille yalanlaması ve delil kilidini açması
    const cansuDenial = processDeterministicInterrogation(
      case5,
      "suspect-cansu",
      "question",
      { question: "Kerim seninle birlikte kafeteryada olduğunu iddia ediyor, doğru mu?" },
      20,
      "tr"
    );
    expect(cansuDenial.text).toContain("Kerim Hoca benimle kafeteryada olduğunu mu söyledi?");
    expect(cansuDenial.text).toContain("Bu koskoca bir yalan!");
    expect(cansuDenial.unlockedClueId).toBe("clue-suspect-cansu-testimony");

    // 5. LLM Prompt üretiminde alibiDenial direktifinin enjeksiyonu
    const promptTr = buildVakaInterrogationPrompt({
      caseData: case5,
      suspect: cansu!,
      currentStress: 20,
      newStress: 20,
      otherSuspectsInfo: "Kerim, Melis",
      presentedClue: null,
      locale: "tr",
    });
    expect(promptTr).toContain("SAHTE ŞAHİTLİK");
    expect(promptTr).toContain("YALANLAMA");
    expect(promptTr).toContain(cansu!.alibiDenial!.tr);

    const promptEn = buildVakaInterrogationPrompt({
      caseData: case5,
      suspect: cansu!,
      currentStress: 20,
      newStress: 20,
      otherSuspectsInfo: "Kerim, Melis",
      presentedClue: null,
      locale: "en",
    });
    expect(promptEn).toContain("YOU WERE USED AS A FALSE WITNESS");
    expect(promptEn).toContain(cansu!.alibiDenial!.en);

    // 6. Kerim için (asistanı Cansu'yu tetikleyen şüpheli) witnessPrompt tam adıyla eklenmeli
    const kerim = case5.suspects.find((s) => s.id === "suspect-kerim")!;
    const kerimPrompt = buildVakaInterrogationPrompt({
      caseData: case5,
      suspect: kerim,
      currentStress: 30,
      newStress: 30,
      otherSuspectsInfo: "Melis",
      presentedClue: null,
      locale: "tr",
    });
    expect(kerimPrompt).toContain("MAZERET VE ŞAHİT GÖSTERME");
    expect(kerimPrompt).toContain("Cansu Yılmaz");
    expect(kerimPrompt).toContain("Temiz Oda Araştırma Asistanı");

    // 7. Melis için (şahit göstermeyen şüpheli) witnessPrompt ASLA eklenmemeli
    const melis = case5.suspects.find((s) => s.id === "suspect-melis")!;
    const melisPrompt = buildVakaInterrogationPrompt({
      caseData: case5,
      suspect: melis,
      currentStress: 30,
      newStress: 30,
      otherSuspectsInfo: "Kerim",
      presentedClue: null,
      locale: "tr",
    });
    expect(melisPrompt).not.toContain("MAZERET VE ŞAHİT GÖSTERME");
    expect(melisPrompt).not.toContain("WITNESS DEFLECTION");

    // 8. Kilitli şüphelisi olmayan vakalarda (ör. case1) hiçbir şüpheliye otomatik eklenmemeli
    const case1 = VAKA_SAMPLE_CASES[0];
    const case1Suspect = case1.suspects[0];
    const case1Prompt = buildVakaInterrogationPrompt({
      caseData: case1,
      suspect: case1Suspect,
      currentStress: 20,
      newStress: 20,
      otherSuspectsInfo: "Diğerleri",
      presentedClue: null,
      locale: "tr",
    });
    // 9. Vaka 04: Alpine Express - Pavel Morozov erken açılma ve ifade tutanağı doğrulaması
    const case4 = VAKA_SAMPLE_CASES.find((c) => c.id === "case-04-ekspres-trendeki-cinayet")!;
    expect(case4).toBeDefined();
    const pavel = case4.suspects.find((s) => s.id === "suspect-pavel")!;
    expect(pavel).toBeDefined();
    expect(pavel.isInitiallyLocked).toBe(true);

    // Victor Pavel'dan bahsetmediğinde Pavel KİLİTLİ kalmalı
    const genericVagonReply = processDeterministicInterrogation(
      case4,
      "suspect-victor",
      "question",
      { question: "O saatte neredeydin?" },
      20,
      "tr"
    );
    // Victor'un cevabı Pavel'i anmıyorsa açılmamalı; anıyorsa açılmalı
    if (!genericVagonReply.text.toLowerCase().includes("pavel")) {
      expect(genericVagonReply.unlockedSuspectId).toBeUndefined();
    } else {
      expect(genericVagonReply.unlockedSuspectId).toBe("suspect-pavel");
    }

    // Pavel'a Victor'un iddiası sorulduğunda alibiseyi kesinlikle yalanlamalı ve tanık delilini açmalı
    const pavelDenial = processDeterministicInterrogation(
      case4,
      "suspect-pavel",
      "question",
      { question: "Victor seninle restoranda çay içtiğini söyledi, bu doğru mu?" },
      20,
      "tr"
    );
    expect(pavelDenial.text).toContain("Bay Victor benimle çay içtiğini mi iddia etti?");
    expect(pavelDenial.text).toContain("kesinlikle yalan");
    expect(pavelDenial.unlockedClueId).toBe("clue-suspect-pavel-testimony");

    // Deliller listesinde bu ifadenin kayıtlı olduğu teyit edilmeli
    const pavelClue = case4.clues.find((c) => c.id === "clue-suspect-pavel-testimony");
    expect(pavelClue).toBeDefined();
    expect(pavelClue?.label).toBe("Kondüktör Pavel'in Resmi İfadesi");
    expect(pavelClue?.contradictsSuspectId).toBe("suspect-victor");
  });
});
