import { describe, expect, it } from "vitest";
import { cleanupDailyContent, createDailyManifest, ensureDailyContent } from "./dailyContent";

describe("daily content generator", () => {
  it("creates the same compact seven-game manifest for the same UTC date", () => {
    const first = createDailyManifest("2026-08-25");
    const second = createDailyManifest("2026-08-25");
    expect(first.games).toHaveLength(7);
    expect(first.games.map(game => game.seed)).toEqual(second.games.map(game => game.seed));
    expect(first.games.every(game => game.checksum.length === 16)).toBe(true);
    expect(first.games.every(game => game.rulesetVersion === "4" && game.params.v === 4)).toBe(true);
    expect(first.games.every(game => game.difficulty >= 1 && game.difficulty <= 4)).toBe(true);
  });

  it("changes the deterministic level seed when the date changes", () => {
    const today = createDailyManifest("2026-08-25");
    const tomorrow = createDailyManifest("2026-08-26");
    expect(today.games[0].seed).not.toBe(tomorrow.games[0].seed);
  });

  it("removes only daily manifests older than the configured retention threshold", async () => {
    await ensureDailyContent("2026-01-01");
    await ensureDailyContent("2026-08-25");
    const removed = await cleanupDailyContent(90, "2026-08-25");
    expect(removed).toBeGreaterThanOrEqual(1);
  });
});
