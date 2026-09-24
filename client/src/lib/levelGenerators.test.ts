import { describe, expect, it } from "vitest";
import { compareHaneNumberGuess, compareHaneWordGuess, echoMinimalNoise, evaluateVakaAttempt, generateCutLevel, generateEchoLevel, generateHaneLevel, generateHaneWordLevel, generateKnotLevel, generateShadowLevel, generateVakaCases, isCutLevelSolvable, isEchoLevelSolvable, isHaneGuessValid, isHaneWordGuessValid, isKnotLevelSolvable, isShadowLevelSolvable, isVakaCaseSolvable, personalSeed, runInstanceKey, solveVakaCase, validateDailySeed } from "./levelGenerators";

describe("mini-game level generators", () => {
  it("maintains core determinism, personal practice seed derivation, and continuation route identities", () => {
    const seed = 14151;
    expect(generateEchoLevel(seed, 2)).toEqual(generateEchoLevel(seed, 2));
    expect(generateKnotLevel(seed, 2).rotations).toHaveLength(16);
    expect(generateCutLevel(seed, 2).shapes.filter(shape => shape.target)).toHaveLength(4);
    expect(generateShadowLevel(seed, 2).pads).toHaveLength(2);
    expect(generateHaneLevel(seed, 2)).toEqual(generateHaneLevel(seed, 2));
    expect(["echo", "knot", "cut", "shadow", "vaka", "hane", "spark"].every(game => validateDailySeed(seed, game as any))).toBe(true);

    // Personal practice seeds
    expect(personalSeed(99, "echo", 1, 1)).not.toBe(personalSeed(99, "echo", 2, 1));
    expect(personalSeed(99, "echo", 2, 1)).not.toBe(personalSeed(99, "echo", 2, 2));

    // Continuation route component identities
    expect(runInstanceKey("echo", "daily", 0, 99)).not.toBe(runInstanceKey("echo", "personal", 1, 99));
    expect(runInstanceKey("spark", "personal", 1, 99)).not.toBe(runInstanceKey("spark", "personal", 2, 99));
    expect(runInstanceKey("hane", "personal", 2, 202)).toBe("hane:personal:2:202");
  });

  it("generates diverse and solvable Cutout and Shadow Share layouts across seeds and masteries", () => {
    // 1. Solvability across multiple seeds
    for (const seed of [14151, 76321, 99183]) {
      expect(isCutLevelSolvable(generateCutLevel(seed, 2))).toBe(true);
      expect(isShadowLevelSolvable(generateShadowLevel(seed, 2))).toBe(true);
    }

    // 2. Practice attempt differentiation (Cutout & Shadow)
    for (const gameId of ["shadow", "cut"] as const) {
      const seeds = Array.from({ length: 6 }, (_, attempt) => personalSeed(618_071, gameId, 2, attempt + 1));
      const levels = seeds.map(seed => (gameId === "cut" ? generateCutLevel(seed, 2) : generateShadowLevel(seed, 2)));
      const unique = new Set(levels.map(level => JSON.stringify(level)));
      expect(unique.size).toBeGreaterThan(1);
    }

    // 3. Cutout layout and target variance
    const cutLayouts = new Set<string>();
    const targetSets = new Set<string>();
    for (let seed = 1; seed <= 80; seed += 5) {
      for (const mastery of [0, 2, 4]) {
        const level = generateCutLevel(seed, mastery);
        expect(isCutLevelSolvable(level)).toBe(true);
        cutLayouts.add(JSON.stringify(level.shapes.map(shape => [shape.x, shape.y])));
        targetSets.add(JSON.stringify(level.shapes.filter(shape => shape.target).map(shape => shape.id).sort()));
      }
    }
    expect(cutLayouts.size).toBeGreaterThan(1);
    expect(targetSets.size).toBeGreaterThan(1);

    // 4. Shadow Share pad/exit layout diversity
    const padLayouts = new Set<string>();
    const exits = new Set<string>();
    for (let seed = 1; seed <= 60; seed += 3) {
      for (const mastery of [0, 2, 4]) {
        const level = generateShadowLevel(seed, mastery);
        expect(isShadowLevelSolvable(level)).toBe(true);
        padLayouts.add(JSON.stringify(level.pads));
        exits.add(JSON.stringify(level.exit));
      }
    }
    expect(padLayouts.size).toBeGreaterThan(4);
    expect(exits.size).toBeGreaterThan(1);
  }, 15000);

  it("keeps Echo Room sound budgets and Knot routes solvable with reachable bonuses across seeds", () => {
    // 1. Practice attempt differentiation (Echo & Knot)
    for (const gameId of ["echo", "knot"] as const) {
      const seeds = Array.from({ length: 6 }, (_, attempt) => personalSeed(618_071, gameId, 2, attempt + 1));
      const levels = seeds.map(seed => (gameId === "echo" ? generateEchoLevel(seed, 2) : generateKnotLevel(seed, 2)));
      const unique = new Set(levels.map(level => JSON.stringify(level)));
      expect(unique.size).toBeGreaterThan(1);
    }

    // 2. Echo Room stress test across masteries
    for (let seed = 1; seed <= 60; seed += 7) {
      for (const mastery of [0, 2, 4]) {
        expect(isEchoLevelSolvable(generateEchoLevel(seed, mastery))).toBe(true);
      }
    }

    // 3. Echo Room noise budget margin and multi-checkpoint route
    const echoLevel = generateEchoLevel(76321, 2);
    expect(echoLevel.cols).toBeGreaterThanOrEqual(11);
    expect(echoLevel.rows).toBeGreaterThanOrEqual(7);
    expect(echoLevel.checkpoints).toHaveLength(3);

    for (const seed of [14151, 76321, 99183, 207771]) {
      for (const mastery of [0, 1, 2, 3, 4]) {
        const level = generateEchoLevel(seed, mastery);
        expect(isEchoLevelSolvable(level)).toBe(true);
        const minimal = echoMinimalNoise(level);
        const margin = level.noiseLimit - minimal;
        expect(margin).toBeGreaterThanOrEqual(4);
        expect(margin).toBeLessThanOrEqual(14);
        expect(isEchoLevelSolvable({ ...level, noiseLimit: level.noiseLimit - 1 })).toBe(true);
      }
    }

    // 4. Knot route diversity, solvability, and optional bonus reachability
    const knotPaths = new Set<string>();
    for (let seed = 1; seed <= 60; seed += 5) knotPaths.add(JSON.stringify(generateKnotLevel(seed, 2).targetPath));
    expect(knotPaths.size).toBeGreaterThan(1);

    const knotSeeds = new Set([...Array.from({ length: 34 }, (_, index) => 1 + index * 3), 14151, 76321, 99183, 207771]);
    for (const seed of knotSeeds) {
      for (const mastery of [1, 2, 3, 4]) {
        const level = generateKnotLevel(seed, mastery);
        expect(isKnotLevelSolvable(level)).toBe(true);
        if (mastery >= 2) expect(level.bonusIndex).toBeGreaterThanOrEqual(0);
      }
    }

  }, 15000);

  it("generates valid Hane number and word levels with multi-language (TR/EN) dictionary verification and Wordle-compliant scoring", async () => {
    // 1. Number mode structure and mark comparison
    const novice = generateHaneLevel(74181, 1);
    const expert = generateHaneLevel(74181, 4);
    expect(novice.target).toMatch(/^\d{4}$/);
    expect(new Set(novice.target).size).toBe(4);
    expect(expert.target).toMatch(/^\d{5}$/);
    expect(isHaneGuessValid("1234", novice)).toBe(true);
    expect(isHaneGuessValid("0234", novice)).toBe(false);
    expect(compareHaneNumberGuess("1212", "1111")).toEqual({ marks: ["exact", "absent", "exact", "absent"], exact: 2, present: 0 });
    expect(compareHaneNumberGuess("1212", "2121")).toEqual({ marks: ["present", "present", "present", "present"], exact: 0, present: 4 });

    // 2. Daily Hane word length variance (4 or 5)
    const lengths = new Set(Array.from({ length: 30 }, (_, seed) => generateHaneWordLevel(seed + 1, 2).length));
    expect(lengths.size).toBe(2);
    expect(lengths.has(4)).toBe(true);
    expect(lengths.has(5)).toBe(true);

    for (const length of [4, 5]) {
      const seed = Array.from({ length: 40 }, (_, index) => index + 1).find(candidate => generateHaneWordLevel(candidate, 2).length === length);
      expect(seed, `${length} harfli bir seed bulunamadı`).toBeDefined();
      if (!seed) continue;
      const trLevel = generateHaneWordLevel(seed, 2, "tr");
      expect(trLevel.length).toBe(length);
      expect(Array.from(trLevel.target)).toHaveLength(length);
      expect(await isHaneWordGuessValid(trLevel.target, trLevel, "tr")).toBe(true);

      const enLevel = generateHaneWordLevel(seed, 2, "en");
      expect(enLevel.length).toBe(length);
      expect(Array.from(enLevel.target)).toHaveLength(length);
      expect(await isHaneWordGuessValid(enLevel.target, enLevel, "en")).toBe(true);
    }

    // 3. Turkish word mode with repeated letter handling
    const trLevel = generateHaneWordLevel(74181, 2, "tr");
    expect(trLevel).toEqual(generateHaneWordLevel(74181, 2, "tr"));
    expect(Array.from(trLevel.target)).toHaveLength(trLevel.length);
    expect(await isHaneWordGuessValid("bahçe", trLevel, "tr")).toBe(trLevel.length === 5);
    expect(await isHaneWordGuessValid("xxxxx", trLevel, "tr")).toBe(false);
    expect(compareHaneWordGuess("KİTAP", "KİLİT", "tr")).toEqual({ marks: ["exact", "exact", "absent", "absent", "present"], exact: 2, present: 1 });
    expect(compareHaneWordGuess("KİTAP", "AAAAA", "tr")).toEqual({ marks: ["absent", "absent", "absent", "exact", "absent"], exact: 1, present: 0 });

    // 4. English word mode dictionary and mark comparison
    const enLevel = generateHaneWordLevel(74181, 2, "en");
    expect(enLevel).toEqual(generateHaneWordLevel(74181, 2, "en"));
    expect(enLevel.length).toBeLessThanOrEqual(5);
    expect(Array.from(enLevel.target)).toHaveLength(enLevel.length);
    expect(await isHaneWordGuessValid(enLevel.target, enLevel, "en")).toBe(true);
    expect(await isHaneWordGuessValid("CRANE", { length: 5 }, "en")).toBe(true);
    expect(await isHaneWordGuessValid("apple", { length: 5 }, "en")).toBe(true);
    expect(await isHaneWordGuessValid("zzzzz", { length: 5 }, "en")).toBe(false);
    expect(compareHaneWordGuess("PLANT", "POINT", "en")).toEqual({ marks: ["exact", "absent", "absent", "exact", "exact"], exact: 3, present: 0 });

    // 5. General dictionary validation (TR & EN up to 5 letters)
    expect(await isHaneWordGuessValid("orman", { length: 5 }, "tr")).toBe(true);
    expect(await isHaneWordGuessValid("boya", { length: 4 }, "tr")).toBe(true);
    expect(await isHaneWordGuessValid("zzzzz", { length: 5 }, "tr")).toBe(false);
    expect(await isHaneWordGuessValid("cloud", { length: 5 }, "en")).toBe(true);
    expect(await isHaneWordGuessValid("word", { length: 4 }, "en")).toBe(true);
    expect(await isHaneWordGuessValid("qqqqq", { length: 5 }, "en")).toBe(false);
  });

  it("generates solvable procedural mystery cases (Vaka) with robust contradiction graphs and solvability guarantees", () => {
    // 1. Solver result, contradiction margin, and fully cleared innocent set
    let hasMultipleWinningContradictions = false;
    for (const seed of [14151, 76321, 99183]) {
      for (const mastery of [0, 2, 3, 4]) {
        const cases = generateVakaCases(seed, mastery);
        expect(cases).toHaveLength(3 + mastery);
        for (const vakaCase of cases) {
          expect(isVakaCaseSolvable(vakaCase)).toBe(true);
          const contradicting = vakaCase.clues.filter(clue => clue.contradicts === vakaCase.culpritId);
          expect(contradicting.length).toBeGreaterThanOrEqual(1);
          if (mastery === 4 && contradicting.length > 1) hasMultipleWinningContradictions = true;
          const rivals = vakaCase.suspects.filter(suspect => suspect.id !== vakaCase.culpritId);
          expect(rivals.every(suspect => vakaCase.clues.filter(clue => clue.contradicts === suspect.id).length < contradicting.length)).toBe(true);
          const innocents = vakaCase.suspects.filter(suspect => suspect.id !== vakaCase.culpritId);
          expect(innocents.every(suspect => vakaCase.clues.some(clue => clue.clears === suspect.id))).toBe(true);
        }
      }
    }
    expect(hasMultipleWinningContradictions).toBe(true);

    // 2. Red herrings neutrality
    const herringCases = generateVakaCases(55555, 4);
    const allHerrings = herringCases.flatMap(vakaCase => vakaCase.clues.filter(clue => clue.isRedHerring));
    expect(allHerrings.length).toBeGreaterThan(0);
    for (const herring of allHerrings) {
      expect(herring.contradicts).toBeUndefined();
      expect(herring.clears).toBeUndefined();
    }

    // 3. Accusation evaluation (correct, wrong-suspect, no-contradiction)
    const testCase = generateVakaCases(2024, 1)[0];
    const correctClue = testCase.clues.find(clue => clue.contradicts === testCase.culpritId)!;
    expect(evaluateVakaAttempt(testCase, testCase.culpritId, correctClue.id)).toBe("correct");

    const innocent = testCase.suspects.find(suspect => suspect.id !== testCase.culpritId)!;
    expect(evaluateVakaAttempt(testCase, innocent.id, correctClue.id)).toBe("no-contradiction");

    const clearingClue = testCase.clues.find(clue => clue.clears === innocent.id)!;
    expect(evaluateVakaAttempt(testCase, innocent.id, clearingClue.id)).toBe("wrong-suspect");

    // 4. Smoking gun is not always pre-revealed
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

    // 5. Ambiguous graph fallback to null
    const ambiguousSuspects = [{ id: "s0", name: "A", statement: "" }, { id: "s1", name: "B", statement: "" }];
    const ambiguousClues = [
      { id: "c0", label: "", detail: "", contradicts: "s0", isRedHerring: false },
      { id: "c1", label: "", detail: "", contradicts: "s1", isRedHerring: false },
    ];
    expect(solveVakaCase({ suspects: ambiguousSuspects, clues: ambiguousClues })).toBeNull();

    // 6. No retry fallback across 100 seeds
    for (let seed = 1; seed <= 100; seed += 1) {
      const cases = generateVakaCases(seed, 3);
      for (const vakaCase of cases) expect(isVakaCaseSolvable(vakaCase)).toBe(true);
    }
  });

});
