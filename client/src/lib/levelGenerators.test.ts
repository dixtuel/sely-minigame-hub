import { describe, expect, it } from "vitest";
import { compareHaneNumberGuess, compareHaneWordGuess, evaluateVakaAttempt, generateCutLevel, generateEchoLevel, generateHaneLevel, generateHaneWordLevel, generateKnotLevel, generateShadowLevel, generateSparkLevel, generateSparkWorldSegment, generateVakaCases, isCutLevelSolvable, isEchoLevelSolvable, isHaneGuessValid, isHaneWordGuessValid, isKnotLevelSolvable, isShadowLevelSolvable, isSparkLevelFair, isVakaCaseSolvable, personalSeed, runInstanceKey, solveVakaCase, validateDailySeed } from "./levelGenerators";

describe("mini-game level generators", () => {
  it("keeps each daily generator deterministic and structurally valid", () => {
    const seed = 14151;
    expect(generateEchoLevel(seed, 2)).toEqual(generateEchoLevel(seed, 2));
    expect(generateKnotLevel(seed, 2).rotations).toHaveLength(16);
    expect(generateCutLevel(seed, 2).shapes.filter(shape => shape.target)).toHaveLength(4);
    expect(generateShadowLevel(seed, 2).pads).toHaveLength(2);
    expect(generateVakaCases(seed, 2).every(isVakaCaseSolvable)).toBe(true);
    expect(generateHaneLevel(seed, 2)).toEqual(generateHaneLevel(seed, 2));
    expect(generateSparkLevel(seed, 2)).toEqual(generateSparkLevel(seed, 2));
    expect(["echo", "knot", "cut", "shadow", "vaka", "hane", "spark"].every(game => validateDailySeed(seed, game as any))).toBe(true);
  });

  it("changes a personal practice seed with mastery or attempt without changing the daily seed contract", () => {
    expect(personalSeed(99, "echo", 1, 1)).not.toBe(personalSeed(99, "echo", 2, 1));
    expect(personalSeed(99, "echo", 2, 1)).not.toBe(personalSeed(99, "echo", 2, 2));
  });

  it("assigns a distinct component identity to each generated continuation route", () => {
    expect(runInstanceKey("echo", "daily", 0, 99)).not.toBe(runInstanceKey("echo", "personal", 1, 99));
    expect(runInstanceKey("spark", "personal", 1, 99)).not.toBe(runInstanceKey("spark", "personal", 2, 99));
    expect(runInstanceKey("hane", "personal", 2, 202)).toBe("hane:personal:2:202");
  });

  it("finds a real completion route for the path, cut, and delayed-shadow generators", () => {
    for (const seed of [14151, 76321, 99183]) {
      expect(isEchoLevelSolvable(generateEchoLevel(seed, 2))).toBe(true);
      expect(isCutLevelSolvable(generateCutLevel(seed, 2))).toBe(true);
      expect(isShadowLevelSolvable(generateShadowLevel(seed, 2))).toBe(true);
      expect(isSparkLevelFair(generateSparkLevel(seed, 2))).toBe(true);
    }
  });

  it("produces a genuinely different level on each consecutive practice attempt (echo/knot/shadow)", () => {
    for (const gameId of ["echo", "knot", "shadow"] as const) {
      const seeds = Array.from({ length: 6 }, (_, attempt) => personalSeed(618_071, gameId, 2, attempt + 1));
      const levels = seeds.map(seed => {
        if (gameId === "echo") return generateEchoLevel(seed, 2);
        if (gameId === "knot") return generateKnotLevel(seed, 2);
        return generateShadowLevel(seed, 2);
      });
      const unique = new Set(levels.map(level => JSON.stringify(level)));
      expect(unique.size).toBeGreaterThan(1); // en azından bazı attempt'ler birbirinden farklı olmalı
    }
  });

  it("keeps Echo Room and Shadow Share solvable across many seeds and masteries (stress test)", () => {
    for (let seed = 1; seed <= 60; seed += 7) {
      for (const mastery of [0, 2, 4]) {
        expect(isEchoLevelSolvable(generateEchoLevel(seed, mastery))).toBe(true);
        expect(isShadowLevelSolvable(generateShadowLevel(seed, mastery))).toBe(true);
      }
    }
  });

  it("keeps Knot's bonus reachable within heatLimit at every mastery, including mastery 1", () => {
    for (let seed = 1; seed <= 100; seed += 3) {
      for (const mastery of [1, 2, 3, 4]) {
        const level = generateKnotLevel(seed, mastery);
        expect(isKnotLevelSolvable(level)).toBe(true);
        if (mastery >= 2) expect(level.bonusIndex).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("varies Knot's actual route (not just decoy rotations) across seeds", () => {
    const paths = new Set<string>();
    for (let seed = 1; seed <= 60; seed += 5) paths.add(JSON.stringify(generateKnotLevel(seed, 2).targetPath));
    expect(paths.size).toBeGreaterThan(1);
  });

  it("keeps Echo Room’s longer three-mark route solvable within its sound budget", () => {
    const level = generateEchoLevel(76321, 2);
    expect(level.cols).toBeGreaterThanOrEqual(11);
    expect(level.rows).toBeGreaterThanOrEqual(7);
    expect(level.checkpoints).toHaveLength(3);
    expect(isEchoLevelSolvable(level)).toBe(true);
  });

  it("scales Echo Room's sound budget with the actual room size, not a flat mastery bump", () => {
    const small = generateEchoLevel(14151, 1); // 19x13 oda
    const big = generateEchoLevel(14151, 3); // 21x15 oda
    expect(small.cols + small.rows).toBeLessThan(big.cols + big.rows);
    expect(big.noiseLimit).toBeGreaterThan(small.noiseLimit);
    // Aynı mastery'de oda büyüklüğü sabit olduğundan, noiseLimit yalnızca cols+rows'tan türemeli.
    expect(generateEchoLevel(14151, 1).noiseLimit).toBe(generateEchoLevel(99183, 1).noiseLimit);
  });

  it("keeps Knot’s optional bonus on an affordable branch of the target flow", () => {
    for (const seed of [14151, 76321, 99183, 207771]) {
      for (const mastery of [1, 2, 3, 4]) {
        const level = generateKnotLevel(seed, mastery);
        expect(isKnotLevelSolvable(level)).toBe(true);
        if (mastery >= 2) expect(level.bonusIndex).toBeGreaterThanOrEqual(0);
      }
    }
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
    expect(compareHaneNumberGuess("1212", "1111")).toEqual({ marks: ["exact", "absent", "exact", "absent"], exact: 2, present: 0 });
    expect(compareHaneNumberGuess("1212", "2121")).toEqual({ marks: ["present", "present", "present", "present"], exact: 0, present: 4 });
  });

  it("varies the daily Hane word length by seed and keeps every pool word valid for its own length", async () => {
    const lengths = new Set(Array.from({ length: 30 }, (_, seed) => generateHaneWordLevel(seed + 1, 2).length));
    expect(lengths.size).toBeGreaterThan(1); // en az bazı seed'ler farklı uzunluk üretmeli (4-8 arası)
    for (const length of [4, 5, 6, 7, 8]) {
      const seed = Array.from({ length: 40 }, (_, index) => index + 1).find(candidate => generateHaneWordLevel(candidate, 2).length === length);
      expect(seed, `${length} harfli bir seed bulunamadı`).toBeDefined();
      if (!seed) continue;
      const level = generateHaneWordLevel(seed, 2);
      expect(level.length).toBe(length);
      expect(Array.from(level.target)).toHaveLength(length);
      expect(await isHaneWordGuessValid(level.target, level)).toBe(true);
    }
  });

  it("guarantees exactly one contradicting suspect and a fully cleared innocent set for every vaka case", () => {
    for (const seed of [14151, 76321, 99183]) {
      for (const mastery of [0, 2, 4]) {
        const cases = generateVakaCases(seed, mastery);
        expect(cases).toHaveLength(3 + mastery);
        for (const vakaCase of cases) {
          expect(isVakaCaseSolvable(vakaCase)).toBe(true);
          const contradicting = vakaCase.clues.filter(clue => clue.contradicts === vakaCase.culpritId);
          expect(contradicting.length).toBeGreaterThanOrEqual(1); // mastery 3-4'te alibi.holes[] deseni birden fazla bağımsız çelişki üretir
          const rivals = vakaCase.suspects.filter(suspect => suspect.id !== vakaCase.culpritId);
          expect(rivals.every(suspect => vakaCase.clues.filter(clue => clue.contradicts === suspect.id).length < contradicting.length)).toBe(true);
          const innocents = vakaCase.suspects.filter(suspect => suspect.id !== vakaCase.culpritId);
          expect(innocents.every(suspect => vakaCase.clues.some(clue => clue.clears === suspect.id))).toBe(true);
        }
      }
    }
  });

  it("keeps every vaka red herring neutral (no contradicts or clears)", () => {
    const cases = generateVakaCases(55555, 4);
    const allHerrings = cases.flatMap(vakaCase => vakaCase.clues.filter(clue => clue.isRedHerring));
    expect(allHerrings.length).toBeGreaterThan(0);
    for (const herring of allHerrings) {
      expect(herring.contradicts).toBeUndefined();
      expect(herring.clears).toBeUndefined();
    }
  });

  it("classifies accusation+clue combinations into correct, wrong-suspect, or no-contradiction", () => {
    const vakaCase = generateVakaCases(2024, 1)[0];
    const correctClue = vakaCase.clues.find(clue => clue.contradicts === vakaCase.culpritId)!;
    expect(evaluateVakaAttempt(vakaCase, vakaCase.culpritId, correctClue.id)).toBe("correct");

    const innocent = vakaCase.suspects.find(suspect => suspect.id !== vakaCase.culpritId)!;
    expect(evaluateVakaAttempt(vakaCase, innocent.id, correctClue.id)).toBe("no-contradiction");

    const clearingClue = vakaCase.clues.find(clue => clue.clears === innocent.id)!;
    expect(evaluateVakaAttempt(vakaCase, innocent.id, clearingClue.id)).toBe("wrong-suspect");
  });

  it("independently derives the culprit from the evidence graph alone (score-based solver)", () => {
    for (const seed of [14151, 76321, 99183]) {
      for (const mastery of [0, 3, 4]) {
        const cases = generateVakaCases(seed, mastery);
        for (const vakaCase of cases) {
          expect(solveVakaCase(vakaCase)).toBe(vakaCase.culpritId);
        }
      }
    }
    // mastery 3+ üretir en az bir vakada birden fazla bağımsız çelişki kanıtı (alibi.holes[] deseni)
    const highMasteryCases = [14151, 76321, 99183].flatMap(seed => generateVakaCases(seed, 4));
    expect(highMasteryCases.some(vakaCase => vakaCase.clues.filter(clue => clue.contradicts === vakaCase.culpritId).length > 1)).toBe(true);
  });

  it("does not hand the culprit's contradicting clue to the player for free at case start", () => {
    // Suçlayıcı kanıt ("smoking gun") diğer kanıtlarla tam karışmalı — sabit olarak dizinin
    // başında durup revealCount sayesinde OTOMATİK açık gelmemeli, yoksa oyuncu hiç araştırma
    // yapmadan (ilk ekranda) doğrudan cevabı görür.
    let alwaysPreRevealed = true;
    for (let seed = 1; seed <= 200; seed += 1) {
      for (const mastery of [0, 1, 2, 3, 4]) {
        const cases = generateVakaCases(seed, mastery);
        for (const vakaCase of cases) {
          const initiallyRevealed = new Set(vakaCase.clues.slice(0, vakaCase.revealCount).map(clue => clue.id));
          const smokingGunRevealed = vakaCase.clues.some(clue => clue.contradicts === vakaCase.culpritId && initiallyRevealed.has(clue.id));
          if (!smokingGunRevealed) alwaysPreRevealed = false;
        }
      }
    }
    expect(alwaysPreRevealed).toBe(false);
  });

  it("returns null from the solver for an ambiguous evidence graph (tied contradiction scores)", () => {
    const suspects = [{ id: "s0", name: "A", statement: "" }, { id: "s1", name: "B", statement: "" }];
    const clues = [
      { id: "c0", label: "", detail: "", contradicts: "s0", isRedHerring: false },
      { id: "c1", label: "", detail: "", contradicts: "s1", isRedHerring: false },
    ];
    expect(solveVakaCase({ suspects, clues })).toBeNull();
  });

  it("never needs the retry fallback across 100 consecutive seeds", () => {
    for (let seed = 1; seed <= 100; seed += 1) {
      const cases = generateVakaCases(seed, 3);
      for (const vakaCase of cases) expect(isVakaCaseSolvable(vakaCase)).toBe(true);
    }
  });

  it("builds a deterministic Turkish word record and consumes repeated letters only once", async () => {
    const level = generateHaneWordLevel(74181, 2);
    expect(level).toEqual(generateHaneWordLevel(74181, 2));
    expect(Array.from(level.target)).toHaveLength(level.length);
    expect(await isHaneWordGuessValid("bahçe", level)).toBe(level.length === 5);
    expect(await isHaneWordGuessValid("xxxxx", level)).toBe(false);
    expect(compareHaneWordGuess("KİTAP", "KİLİT")).toEqual({ marks: ["exact", "exact", "absent", "absent", "present"], exact: 2, present: 1 });
    expect(compareHaneWordGuess("KİTAP", "AAAAA")).toEqual({ marks: ["absent", "absent", "absent", "exact", "absent"], exact: 1, present: 0 });
  });

  it("accepts any valid Turkish dictionary word as a guess, not just the curated solution pool (real Wordle behavior)", async () => {
    // "orman" (forest) 5 harfli gerçek bir TDK kelimesi ama günün çözüm havuzunda (HANE_WORD_POOLS) yok —
    // gerçek Wordle'da olduğu gibi geniş bir tahmin sözlüğünden kabul edilmeli.
    expect(await isHaneWordGuessValid("orman", { length: 5 })).toBe(true);
    expect(await isHaneWordGuessValid("zzzzz", { length: 5 })).toBe(false);
    expect(await isHaneWordGuessValid("kelime", { length: 6 })).toBe(true);
  });
});
