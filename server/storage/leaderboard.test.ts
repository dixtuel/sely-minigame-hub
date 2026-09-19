import { describe, expect, it } from "vitest";
import { getTopScores, submitScore } from "./leaderboard";

describe("Leaderboard Service", () => {
  it("accepts valid scores, orders rank correctly, updates personal bests, and invalidates L1 cache", async () => {
    const today = "2026-09-19";

    // 1. Submit multiple players and verify order
    await submitScore("echo", 1200, "Cesur Yankı #14", "sig_user_a", today);
    await submitScore("echo", 1500, "Sessiz Mimar #88", "sig_user_b", today);
    const board = await getTopScores("echo", today);
    expect(board.top.length).toBeGreaterThanOrEqual(2);
    expect(board.top[0].score).toBe(1500);
    expect(board.top[1].score).toBe(1200);

    // 2. Personal best improvement
    const playerSig = "sig_prog_player";
    await submitScore("knot", 400, "Kıvılcım Tilkisi #07", playerSig, today);
    let knotBoard = await getTopScores("knot", today);
    expect(knotBoard.top.find(e => e.signature === playerSig)?.score).toBe(400);

    await submitScore("knot", 850, "Kıvılcım Tilkisi #07", playerSig, today);
    knotBoard = await getTopScores("knot", today);
    expect(knotBoard.top.find(e => e.signature === playerSig)?.score).toBe(850);

    // 3. L1 cache invalidation on new high score
    const game = "cut";
    await submitScore(game, 500, "Usta Kesici #1", "sig_cut_1", today);
    const firstRead = await getTopScores(game, today);
    expect(firstRead.top[0].score).toBe(500);

    await submitScore(game, 900, "Süper Kesici #2", "sig_cut_2", today);
    const secondRead = await getTopScores(game, today);
    expect(secondRead.top[0].score).toBe(900);
  });

  it("enforces anti-cheat sanity checks rejecting negative, zero, or impossible ceiling scores", async () => {
    const today = "2026-09-19";
    const impossible = await submitScore("echo", 999999, "Hacker #99", "sig_hacker", today);
    expect(impossible.success).toBe(false);

    const zero = await submitScore("spark", 0, "Guest", "sig_0", today);
    expect(zero.success).toBe(false);

    const negative = await submitScore("spark", -50, "Guest", "sig_neg", today);
    expect(negative.success).toBe(false);
  });
});
