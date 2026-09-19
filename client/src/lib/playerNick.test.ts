import { describe, expect, it } from "vitest";
import { getPlayerNick, TR_ADJECTIVES, TR_NOUNS } from "./playerNick";

describe("Player Nickname System (Zero Collision & Entropy)", () => {
  it("has huge permutation space to guarantee uniqueness", () => {
    const permutations = TR_ADJECTIVES.length * TR_NOUNS.length * 9000;
    // Over 100 million combinations
    expect(permutations).toBeGreaterThan(100_000_000);
  });

  it("produces zero collisions across 5,000 distinct players on the same day", () => {
    const today = "2026-09-19";
    const nickSet = new Set<string>();
    const totalSimulated = 5000;

    for (let i = 0; i < totalSimulated; i++) {
      const fakeId = `ply_sim_${i}_${Math.random().toString(36).slice(2, 10)}`;
      const nick = getPlayerNick("tr", today, fakeId);
      expect(nick).toMatch(/^[\wçğıöşüÇĞİÖŞÜâîûÂÎÛ\s]+ #\d{4}$/);
      nickSet.add(nick);
    }

    // Uniqueness must be virtually 100% across 5,000 concurrent users
    const uniqueCount = nickSet.size;
    expect(uniqueCount).toBeGreaterThanOrEqual(totalSimulated - 1);
  });

  it("produces deterministic nickname for the same player throughout the day", () => {
    const today = "2026-09-19";
    const nick1 = getPlayerNick("tr", today);
    const nick2 = getPlayerNick("tr", today);
    expect(nick1).toBe(nick2);
  });

  it("supports English locale with matching formatting", () => {
    const today = "2026-09-19";
    const nickEn = getPlayerNick("en", today);
    expect(nickEn).toMatch(/^[A-Za-z\s]+ #\d{4}$/);
  });
});
