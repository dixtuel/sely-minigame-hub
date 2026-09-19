import { createClient, type Client } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import type { GameId, LeaderboardEntry } from "./leaderboard";
import { logger } from "../_core/logger";

/**
 * Turso Database Integration for SELY MiniGame Hub
 *
 * Capabilities:
 * - Free Tier Optimization: In-memory micro-caching (15s TTL) protecting the 500M reads/month quota.
 * - Multi-Environment:
 *    - Cloud: TURSO_DATABASE_URL (libsql://...) + TURSO_AUTH_TOKEN
 *    - VDS / Self-Hosted: TURSO_DATABASE_URL="file:./data/sely.db" (Zero servers, zero docker, native SQLite)
 *    - In-Memory: TURSO_DATABASE_URL=":memory:" (Ephemeral testing)
 * - Persistent Leaderboard Archive: Unlike Redis 48h TTL, Turso preserves daily records & all-time hall of fame.
 * - Core Auth/User Store: Backs users table when MySQL/Postgres is not configured.
 * - No Sleep / No Pause: Stays active 24/7 with zero cold start penalty.
 */

let tursoClient: Client | null = null;
let schemaInitialized = false;

// Free Tier Protection: In-memory micro-cache for top scores
interface CachedBoard {
  timestamp: number;
  data: {
    top: LeaderboardEntry[];
    totalPlayers: number;
  };
}
const boardCache = new Map<string, CachedBoard>();
const CACHE_TTL_MS = 15_000; // 15 seconds
const MAX_BOARD_CACHE_ENTRIES = 128;

function setCachedBoard(key: string, value: CachedBoard) {
  if (boardCache.size >= MAX_BOARD_CACHE_ENTRIES) {
    const oldest = boardCache.keys().next().value;
    if (oldest) boardCache.delete(oldest);
  }
  boardCache.set(key, value);
}

/**
 * Resolves the Turso connection configuration from environment variables.
 * In standalone self-hosted environments (PC/VPS/VDS), defaults to a local SQLite
 * database file (file:./data/sely.db) if no external database is configured.
 */
export function getTursoConfig(): { url: string; authToken?: string } | null {
  const explicitUrl =
    process.env.TURSO_DATABASE_URL ||
    process.env.TURSO_URL ||
    process.env.LIBSQL_URL ||
    null;

  if (explicitUrl) {
    const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
    return { url: explicitUrl, authToken };
  }

  // Self-Hosted / Standalone Fallback:
  // When not running on Vercel and no external database is configured,
  // enable zero-config local SQLite storage at ./data/sely.db.
  const isVercel = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
  const hasPostgres = Boolean(
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.CONTENT_DB_URL
  );

  if (!isVercel && !hasPostgres && process.env.NODE_ENV !== "test") {
    return { url: "file:./data/sely.db" };
  }

  return null;
}

export function isTursoConfigured(): boolean {
  return getTursoConfig() !== null;
}

/**
 * Returns or initializes the singleton Turso Client.
 */
export function getTursoClient(): Client | null {
  const config = getTursoConfig();
  if (!config) return null;

  if (!tursoClient) {
    try {
      // If local file path, ensure directory exists
      if (config.url.startsWith("file:")) {
        const filePath = config.url.replace(/^file:\/\/?/, "");
        if (filePath && filePath !== ":memory:" && !filePath.startsWith(":")) {
          const dir = path.dirname(path.resolve(filePath));
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
        }
      }

      tursoClient = createClient({
        url: config.url,
        authToken: config.authToken,
      });
    } catch (err) {
      logger.warn("turso", "Failed to initialize client", err);
      tursoClient = null;
    }
  }

  return tursoClient;
}

/**
 * Initializes required tables and indexes once.
 */
export async function ensureTursoSchema(): Promise<boolean> {
  const client = getTursoClient();
  if (!client) return false;
  if (schemaInitialized) return true;

  try {
    // 1. Daily mini leaderboard & historical archive
    await client.execute(`
      CREATE TABLE IF NOT EXISTS daily_scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id TEXT NOT NULL,
        date_str TEXT NOT NULL,
        nick TEXT NOT NULL,
        signature TEXT NOT NULL,
        score INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(game_id, date_str, signature)
      );
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_daily_scores_lookup
      ON daily_scores(game_id, date_str, score DESC);
    `);

    await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_daily_scores_all_time
      ON daily_scores(game_id, signature, score DESC);
    `);

    // 2. User auth table (for auth fallback when PostgreSQL/MySQL is absent)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        open_id TEXT NOT NULL UNIQUE,
        name TEXT,
        email TEXT,
        login_method TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_signed_in INTEGER NOT NULL
      );
    `);

    schemaInitialized = true;
    return true;
  } catch (err) {
    logger.error("turso", "Schema initialization failed", err);
    return false;
  }
}

/**
 * Saves or updates a score for today's leaderboard in Turso.
 * If user achieves a higher score, updates it. If lower, keeps their personal best.
 */
export async function saveTursoScore(
  gameId: GameId,
  score: number,
  nick: string,
  signature: string,
  dateStr: string
): Promise<boolean> {
  const client = getTursoClient();
  if (!client) return false;

  await ensureTursoSchema();

  try {
    const now = Date.now();
    await client.execute({
      sql: `
        INSERT INTO daily_scores (game_id, date_str, nick, signature, score, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(game_id, date_str, signature) DO UPDATE SET
          score = CASE WHEN excluded.score > daily_scores.score THEN excluded.score ELSE daily_scores.score END,
          nick = excluded.nick,
          created_at = excluded.created_at;
      `,
      args: [gameId, dateStr, nick, signature, score, now],
    });

    // Invalidate local cache for this game and date so fresh rank is computed
    const prefix = `${gameId}:${dateStr}`;
    for (const key of Array.from(boardCache.keys())) {
      if (key.startsWith(prefix)) {
        boardCache.delete(key);
      }
    }

    return true;
  } catch (err) {
    logger.warn("turso", "Error saving score", err);
    return false;
  }
}

/**
 * Calculates a player's rank in Turso for a given score.
 */
export async function getTursoPlayerRank(
  gameId: GameId,
  dateStr: string,
  score: number
): Promise<number | undefined> {
  const client = getTursoClient();
  if (!client) return undefined;

  try {
    const rs = await client.execute({
      sql: `
        SELECT COUNT(*) as rank_above
        FROM daily_scores
        WHERE game_id = ? AND date_str = ? AND score > ?;
      `,
      args: [gameId, dateStr, score],
    });

    const count = Number(rs.rows[0]?.rank_above ?? 0);
    return count + 1;
  } catch {
    return undefined;
  }
}

/**
 * Fetches top leaderboard scores from Turso with 15s in-memory caching.
 */
export async function getTursoTopScores(
  gameId: GameId,
  dateStr: string,
  limit: number = 10
): Promise<{ top: LeaderboardEntry[]; totalPlayers: number } | null> {
  const client = getTursoClient();
  if (!client) return null;

  await ensureTursoSchema();

  const cacheKey = `${gameId}:${dateStr}:${limit}`;
  const now = Date.now();
  const cached = boardCache.get(cacheKey);

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    // Single HTTP pipeline roundtrip via client.batch
    const [scoresRs, totalRs] = await client.batch(
      [
        {
          sql: `
            SELECT nick, signature, score, created_at
            FROM daily_scores
            WHERE game_id = ? AND date_str = ?
            ORDER BY score DESC
            LIMIT ?;
          `,
          args: [gameId, dateStr, limit],
        },
        {
          sql: `
            SELECT COUNT(*) as total
            FROM daily_scores
            WHERE game_id = ? AND date_str = ?;
          `,
          args: [gameId, dateStr],
        },
      ],
      "read"
    );

    const totalPlayers = Number(totalRs.rows[0]?.total ?? scoresRs.rows.length);

    const top: LeaderboardEntry[] = scoresRs.rows.map((row, index) => ({
      rank: index + 1,
      nick: String(row.nick),
      score: Number(row.score),
      signature: String(row.signature),
      timestamp: Number(row.created_at),
    }));

    const result = { top, totalPlayers };
    setCachedBoard(cacheKey, { timestamp: now, data: result });

    return result;
  } catch (err) {
    logger.warn("turso", "Error querying top scores", err);
    return null;
  }
}

/**
 * Retrieves all-time best scores across any historical date.
 */
export async function getTursoAllTimeTopScores(
  gameId: GameId,
  limit: number = 10
): Promise<LeaderboardEntry[]> {
  const client = getTursoClient();
  if (!client) return [];

  await ensureTursoSchema();

  try {
    const rs = await client.execute({
      sql: `
        SELECT nick, signature, MAX(score) as best_score, created_at
        FROM daily_scores
        WHERE game_id = ?
        GROUP BY signature
        ORDER BY best_score DESC
        LIMIT ?;
      `,
      args: [gameId, limit],
    });

    return rs.rows.map((row, index) => ({
      rank: index + 1,
      nick: String(row.nick),
      score: Number(row.best_score),
      signature: String(row.signature),
      timestamp: Number(row.created_at),
    }));
  } catch (err) {
    logger.warn("turso", "Error querying all-time scores", err);
    return [];
  }
}

/**
 * Turso-backed user lookup for OAuth authentication.
 */
export async function getTursoUserByOpenId(openId: string) {
  const client = getTursoClient();
  if (!client) return undefined;

  await ensureTursoSchema();

  try {
    const rs = await client.execute({
      sql: `SELECT * FROM users WHERE open_id = ? LIMIT 1;`,
      args: [openId],
    });

    if (rs.rows.length === 0) return undefined;

    const row = rs.rows[0];
    return {
      id: Number(row.id),
      openId: String(row.open_id),
      name: row.name ? String(row.name) : null,
      email: row.email ? String(row.email) : null,
      loginMethod: row.login_method ? String(row.login_method) : null,
      role: String(row.role) as "user" | "admin",
      createdAt: new Date(Number(row.created_at)),
      updatedAt: new Date(Number(row.updated_at)),
      lastSignedIn: new Date(Number(row.last_signed_in)),
    };
  } catch (err) {
    logger.warn("turso", "Error looking up user", err);
    return undefined;
  }
}

/**
 * Turso-backed user upsert for OAuth authentication.
 */
export async function upsertTursoUser(user: {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  role?: "user" | "admin";
  lastSignedIn?: Date;
}): Promise<void> {
  const client = getTursoClient();
  if (!client) return;

  await ensureTursoSchema();

  try {
    const now = Date.now();
    const lastSignedInMs = user.lastSignedIn ? user.lastSignedIn.getTime() : now;
    const role = user.role || "user";

    await client.execute({
      sql: `
        INSERT INTO users (open_id, name, email, login_method, role, created_at, updated_at, last_signed_in)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(open_id) DO UPDATE SET
          name = COALESCE(excluded.name, users.name),
          email = COALESCE(excluded.email, users.email),
          login_method = COALESCE(excluded.login_method, users.login_method),
          role = excluded.role,
          updated_at = excluded.updated_at,
          last_signed_in = excluded.last_signed_in;
      `,
      args: [
        user.openId,
        user.name ?? null,
        user.email ?? null,
        user.loginMethod ?? null,
        role,
        now,
        now,
        lastSignedInMs,
      ],
    });
  } catch (err) {
    logger.error("turso", "Failed to upsert user", err);
    throw err;
  }
}

/**
 * Reset client instance (useful for unit tests).
 */
export function _resetTursoClientForTests(): void {
  tursoClient = null;
  schemaInitialized = false;
  boardCache.clear();
}
