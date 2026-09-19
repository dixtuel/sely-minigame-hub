import { describe, expect, it } from "vitest";
import { getTopScores, submitScore } from "./leaderboard";

describe("Leaderboard Service (Zero PII & Sanity Safeguards)", () => {
  it("should accept valid score submissions and order them correctly", async () => {
    const today = "2026-09-19";
    const sub1 = await submitScore("echo", 1200, "Cesur Yankı #14", "sig_user_a", today);
    expect(sub1.success).toBe(true);

    const sub2 = await submitScore("echo", 1500, "Sessiz Mimar #88", "sig_user_b", today);
    expect(sub2.success).toBe(true);

    const board = await getTopScores("echo", today);
    expect(board.top.length).toBeGreaterThanOrEqual(2);
    expect(board.top[0].score).toBe(1500);
    expect(board.top[0].nick).toBe("Sessiz Mimar #88");
    expect(board.top[1].score).toBe(1200);
    expect(board.top[1].nick).toBe("Cesur Yankı #14");
  });

  it("should reject scores exceeding game ceiling limits (anti-cheat sanity)", async () => {
    const today = "2026-09-19";
    const impossible = await submitScore("echo", 999999, "Hacker #99", "sig_hacker", today);
    expect(impossible.success).toBe(false);
    expect(impossible.message).toContain("makul sınırların üzerinde");
  });

  it("should reject invalid, zero, or negative scores", async () => {
    const today = "2026-09-19";
    const zero = await submitScore("spark", 0, "Guest", "sig_0", today);
    expect(zero.success).toBe(false);

    const negative = await submitScore("spark", -50, "Guest", "sig_neg", today);
    expect(negative.success).toBe(false);
  });

  it("should update a player's score when they achieve a higher personal best in the same day", async () => {
    const today = "2026-09-19";
    const playerSig = "sig_progressive_player";

    await submitScore("knot", 400, "Kıvılcım Tilkisi #07", playerSig, today);
    let board = await getTopScores("knot", today);
    const entry1 = board.top.find(e => e.signature === playerSig);
    expect(entry1?.score).toBe(400);

    // Player improves their score
    await submitScore("knot", 850, "Kıvılcım Tilkisi #07", playerSig, today);
    board = await getTopScores("knot", today);
    const entry2 = board.top.find(e => e.signature === playerSig);
    expect(entry2?.score).toBe(850);
  });

  it("should serve top scores and invalidate L1 cache when a new score is submitted", async () => {
    const today = "2026-09-19";
    const game = "cut";
    await submitScore(game, 500, "Usta Kesici #1", "sig_cut_1", today);

    const firstRead = await getTopScores(game, today);
    expect(firstRead.top[0].score).toBe(500);

    // Score improvement invalidates L1 cache
    await submitScore(game, 900, "Usta Kesici #1", "sig_cut_1", today);
    const secondRead = await getTopScores(game, today);
    expect(secondRead.top[0].score).toBe(900);
  });
});
