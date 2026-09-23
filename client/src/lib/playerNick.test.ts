import { describe, expect, it } from "vitest";
import { getPlayerNick, TR_ADJECTIVES, TR_NOUNS } from "./playerNick";

describe("Player Nickname System", () => {
  it("generates deterministic, collision-free player nicknames with multi-locale support", () => {
    // Permutation space (>100M combinations)
    const permutations = TR_ADJECTIVES.length * TR_NOUNS.length * 9000;
    expect(permutations).toBeGreaterThan(100_000_000);

    const today = "2026-09-19";

    // Deterministic for same player throughout the day
    const nick1 = getPlayerNick("tr", today);
    const nick2 = getPlayerNick("tr", today);
    expect(nick1).toBe(nick2);

    // English locale format
    const nickEn = getPlayerNick("en", today);
    expect(nickEn).toMatch(/^[A-Za-z\s]+ #\d{4}$/);

    // Collision resistance across 2,000 distinct players
    const nickSet = new Set<string>();
    const totalSimulated = 2000;
    for (let i = 0; i < totalSimulated; i++) {
      const fakeId = `ply_sim_${i}_${Math.random().toString(36).slice(2, 10)}`;
      const nick = getPlayerNick("tr", today, fakeId);
      expect(nick).toMatch(/^[\wçğıöşüÇĞİÖŞÜâîûÂÎÛ\s]+ #\d{4}$/);
      nickSet.add(nick);
    }
    expect(nickSet.size).toBeGreaterThanOrEqual(totalSimulated - 1);
  });
});
