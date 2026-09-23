import { describe, expect, it } from "vitest";
import { cleanupDailyContent, createDailyManifest, ensureDailyContent, DAILY_GAMES } from "./dailyContentStore";

describe("daily content generator", () => {
  it("creates deterministic catalogue manifests per UTC date and enforces retention cleanup", async () => {
    // Deterministic manifest check
    const first = createDailyManifest("2026-08-25");
    const second = createDailyManifest("2026-08-25");
    expect(first.games).toHaveLength(DAILY_GAMES.length);
    expect(first.featuredGameIds).toHaveLength(4);
    expect(new Set(first.featuredGameIds).size).toBe(4);
    expect(first.featuredGameIds).toEqual(second.featuredGameIds);
    expect(first.games.map(game => game.seed)).toEqual(second.games.map(game => game.seed));
    expect(first.games.every(game => game.checksum.length === 16)).toBe(true);
    expect(first.games.every(game => game.rulesetVersion === "5" && game.params.v === 5)).toBe(true);
    expect(first.games.every(game => game.difficulty >= 1 && game.difficulty <= 4)).toBe(true);

    // Changes across dates
    const tomorrow = createDailyManifest("2026-08-26");
    expect(first.games[0].seed).not.toBe(tomorrow.games[0].seed);

    // Retention cleanup
    await ensureDailyContent("2026-01-01");
    await ensureDailyContent("2026-08-25");
    const removed = await cleanupDailyContent(90, "2026-08-25");
    expect(removed).toBeGreaterThanOrEqual(1);
  });
});
