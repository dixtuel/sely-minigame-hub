import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getTursoClient,
  ensureTursoSchema,
  saveTursoScore,
  getTursoTopScores,
  getTursoPlayerRank,
  getTursoAllTimeTopScores,
  upsertTursoUser,
  getTursoUserByOpenId,
  _resetTursoClientForTests,
} from "./turso";

describe("Turso Database Integration (Serverless libSQL & Local SQLite)", () => {
  const originalUrl = process.env.TURSO_DATABASE_URL;
  const originalToken = process.env.TURSO_AUTH_TOKEN;

  beforeEach(() => {
    // Configure in-memory Turso client for fast, isolated tests
    process.env.TURSO_DATABASE_URL = ":memory:";
    delete process.env.TURSO_AUTH_TOKEN;
    _resetTursoClientForTests();
  });

  afterEach(() => {
    if (originalUrl) {
      process.env.TURSO_DATABASE_URL = originalUrl;
    } else {
      delete process.env.TURSO_DATABASE_URL;
    }
    if (originalToken) {
      process.env.TURSO_AUTH_TOKEN = originalToken;
    } else {
      delete process.env.TURSO_AUTH_TOKEN;
    }
    _resetTursoClientForTests();
  });

  it("initializes schema and tables correctly", async () => {
    const initialized = await ensureTursoSchema();
    expect(initialized).toBe(true);

    const client = getTursoClient();
    expect(client).not.toBeNull();

    const rs = await client!.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('daily_scores', 'users')"
    );
    expect(rs.rows.length).toBe(2);
  });

  it("saves scores and orders leaderboard correctly", async () => {
    const today = "2026-09-19";

    await saveTursoScore("echo", 1200, "Cesur Yankı #14", "sig_a", today);
    await saveTursoScore("echo", 2400, "Sessiz Mimar #88", "sig_b", today);
    await saveTursoScore("echo", 1800, "Hızlı Gezgin #03", "sig_c", today);

    const board = await getTursoTopScores("echo", today);
    expect(board).not.toBeNull();
    expect(board!.totalPlayers).toBe(3);
    expect(board!.top.length).toBe(3);

    expect(board!.top[0].score).toBe(2400);
    expect(board!.top[0].nick).toBe("Sessiz Mimar #88");
    expect(board!.top[0].rank).toBe(1);

    expect(board!.top[1].score).toBe(1800);
    expect(board!.top[1].rank).toBe(2);

    expect(board!.top[2].score).toBe(1200);
    expect(board!.top[2].rank).toBe(3);
  });

  it("preserves higher score when player submits again with lower score", async () => {
    const today = "2026-09-19";
    const sig = "sig_player_1";

    await saveTursoScore("knot", 900, "Kıvılcım Tilkisi #07", sig, today);
    let board = await getTursoTopScores("knot", today);
    expect(board!.top[0].score).toBe(900);

    // Worse run should not overwrite personal best
    await saveTursoScore("knot", 500, "Kıvılcım Tilkisi #07", sig, today);
    board = await getTursoTopScores("knot", today);
    expect(board!.top[0].score).toBe(900);

    // Better run should update personal best
    await saveTursoScore("knot", 1500, "Kıvılcım Tilkisi #07", sig, today);
    board = await getTursoTopScores("knot", today);
    expect(board!.top[0].score).toBe(1500);
  });

  it("correctly calculates player rank with getTursoPlayerRank", async () => {
    const today = "2026-09-19";

    await saveTursoScore("shadow", 3000, "P1", "sig_1", today);
    await saveTursoScore("shadow", 2000, "P2", "sig_2", today);
    await saveTursoScore("shadow", 1000, "P3", "sig_3", today);

    const rankFirst = await getTursoPlayerRank("shadow", today, 3000);
    expect(rankFirst).toBe(1);

    const rankSecond = await getTursoPlayerRank("shadow", today, 2000);
    expect(rankSecond).toBe(2);

    const rankThird = await getTursoPlayerRank("shadow", today, 1000);
    expect(rankThird).toBe(3);

    const rankNewChamp = await getTursoPlayerRank("shadow", today, 3500);
    expect(rankNewChamp).toBe(1);
  });

  it("queries all-time hall of fame across multiple days", async () => {
    await saveTursoScore("vaka", 300, "Dedektif A", "sig_a", "2026-09-17");
    await saveTursoScore("vaka", 450, "Dedektif B", "sig_b", "2026-09-18");
    await saveTursoScore("vaka", 400, "Dedektif A", "sig_a", "2026-09-19");

    const allTime = await getTursoAllTimeTopScores("vaka", 10);
    expect(allTime.length).toBe(2);
    expect(allTime[0].nick).toBe("Dedektif B");
    expect(allTime[0].score).toBe(450);
    expect(allTime[1].nick).toBe("Dedektif A");
    expect(allTime[1].score).toBe(400); // Max score between 300 and 400
  });

  it("stores and retrieves OAuth user records via Turso", async () => {
    await upsertTursoUser({
      openId: "usr_turso_123",
      name: "Test User",
      email: "testuser@example.com",
      loginMethod: "manus",
      role: "admin",
    });

    const user = await getTursoUserByOpenId("usr_turso_123");
    expect(user).toBeDefined();
    expect(user!.name).toBe("Test User");
    expect(user!.email).toBe("testuser@example.com");
    expect(user!.role).toBe("admin");

    // Update user
    await upsertTursoUser({
      openId: "usr_turso_123",
      name: "Test User (Updated)",
    });

    const updated = await getTursoUserByOpenId("usr_turso_123");
    expect(updated!.name).toBe("Test User (Updated)");
    expect(updated!.email).toBe("testuser@example.com"); // Preserved
  });
});
