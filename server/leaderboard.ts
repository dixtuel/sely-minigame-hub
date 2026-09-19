import type { Request, Response } from "express";
import { Redis as UpstashRedis } from "@upstash/redis";
import IORedis from "ioredis";
import {
  isTursoConfigured,
  getTursoTopScores,
  saveTursoScore,
  getTursoPlayerRank,
} from "./turso";

export type GameId = "echo" | "knot" | "cut" | "shadow" | "marker" | "hane" | "spark" | "vaka";

export interface LeaderboardEntry {
  rank: number;
  nick: string;
  score: number;
  signature: string;
  timestamp: number;
}

export interface LeaderboardResponse {
  gameId: GameId;
  date: string;
  top: LeaderboardEntry[];
  totalPlayers: number;
  source: "upstash" | "vds-redis" | "turso" | "memory";
}

const VALID_GAMES: readonly string[] = ["echo", "knot", "cut", "shadow", "marker", "hane", "spark", "vaka"];

const MAX_SCORE_CEILINGS: Record<string, number> = {
  echo: 5_000,
  knot: 4_000,
  cut: 3_000,
  shadow: 3_000,
  marker: 3_000,
  hane: 2_500,
  spark: 2_000,
  vaka: 500,
};

// In-Memory store fallback when neither Redis URL nor Upstash credentials are provided
const memoryStore = new Map<string, Map<string, { nick: string; score: number; timestamp: number }>>();

function getMemoryKey(gameId: string, dateStr: string): string {
  return `lb:${gameId}:${dateStr}`;
}

export function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// 1. VDS / Self-Hosted TCP Redis Client (ioredis)
let tcpRedisInstance: IORedis | null = null;
function getTcpRedisClient(): IORedis | null {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  if (!tcpRedisInstance) {
    try {
      tcpRedisInstance = new IORedis(redisUrl, {
        lazyConnect: false,
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        commandTimeout: 3000,
        enableOfflineQueue: false,
        retryStrategy(times) {
          if (times > 3) return null;
          return Math.min(times * 100, 1000);
        },
      });

      tcpRedisInstance.on("error", (err) => {
        console.warn("[Leaderboard:VDS-Redis] Connection error:", err.message);
      });
    } catch {
      tcpRedisInstance = null;
    }
  }
  return tcpRedisInstance;
}

// 2. Vercel Marketplace Upstash Redis Client (HTTP REST - Serverless Recommended)
let upstashInstance: UpstashRedis | null = null;
function getUpstashClient(): UpstashRedis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (url && token) {
    if (!upstashInstance) {
      upstashInstance = new UpstashRedis({
        url: url.replace(/\/$/, ""),
        token,
      });
    }
    return upstashInstance;
  }
  return null;
}

/**
 * Retrieves the top leaderboard entries for a given game and date.
 */
export async function getTopScores(gameId: GameId, dateStr: string = getTodayIsoDate()): Promise<LeaderboardResponse> {
  const key = `lb:${gameId}:${dateStr}`;

  // Strategy A: VDS / Self-Hosted Native TCP Redis (Preferred on VPS environments)
  const tcpRedis = getTcpRedisClient();
  if (tcpRedis) {
    try {
      const result = await tcpRedis.zrevrange(key, 0, 9, "WITHSCORES");
      const count = await tcpRedis.zcard(key);

      const entries: LeaderboardEntry[] = [];
      for (let i = 0; i < result.length; i += 2) {
        const rawMember = result[i];
        const score = Number(result[i + 1]);
        const parts = rawMember.split("::");
        const signature = parts[0] || "anon";
        const nick = parts.slice(1).join("::") || "Anonim Gezgin";

        entries.push({
          rank: entries.length + 1,
          nick,
          score,
          signature,
          timestamp: Date.now(),
        });
      }

      return {
        gameId,
        date: dateStr,
        top: entries,
        totalPlayers: count || entries.length,
        source: "vds-redis",
      };
    } catch {
      // Fallback to next strategy if TCP query fails
    }
  }

  // Strategy B: Vercel Marketplace Upstash Redis (Official Vercel HTTP REST client)
  const upstash = getUpstashClient();
  if (upstash) {
    try {
      // @upstash/redis zrange with rev and withScores options
      const rawResults = await upstash.zrange<{ member: string; score: number }[]>(key, 0, 9, {
        rev: true,
        withScores: true,
      });

      const totalPlayers = (await upstash.zcard(key)) ?? rawResults.length;
      const entries: LeaderboardEntry[] = [];

      for (let i = 0; i < rawResults.length; i++) {
        const item = rawResults[i];
        // In @upstash/redis withScores returns array of { member, score } or alternating elements
        const rawMember = typeof item === "object" && item !== null && "member" in item
          ? String((item as { member: string }).member)
          : String(item);
        const score = typeof item === "object" && item !== null && "score" in item
          ? Number((item as { score: number }).score)
          : 0;

        const parts = rawMember.split("::");
        const signature = parts[0] || "anon";
        const nick = parts.slice(1).join("::") || "Anonim Gezgin";

        entries.push({
          rank: i + 1,
          nick,
          score,
          signature,
          timestamp: Date.now(),
        });
      }

      return {
        gameId,
        date: dateStr,
        top: entries,
        totalPlayers,
        source: "upstash",
      };
    } catch {
      // Fallback to next strategy on network/Upstash error
    }
  }

  // Strategy C: Turso Database (Serverless libSQL / Local SQLite / Historical Archive)
  if (isTursoConfigured()) {
    try {
      const tursoResult = await getTursoTopScores(gameId, dateStr);
      if (tursoResult && tursoResult.top.length > 0) {
        return {
          gameId,
          date: dateStr,
          top: tursoResult.top,
          totalPlayers: tursoResult.totalPlayers,
          source: "turso",
        };
      }
    } catch {
      // Fallback to memory
    }
  }

  // Strategy D: Memory fallback (Local development / Zero-config environments)
  const memKey = getMemoryKey(gameId, dateStr);
  const gameMap = memoryStore.get(memKey) || new Map();
  const sorted = Array.from(gameMap.entries())
    .map(([signature, data]) => ({
      signature,
      nick: data.nick,
      score: data.score,
      timestamp: data.timestamp,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((item, index) => ({
      rank: index + 1,
      ...item,
    }));

  return {
    gameId,
    date: dateStr,
    top: sorted,
    totalPlayers: gameMap.size,
    source: "memory",
  };
}

/**
 * Submits an anonymous score for a game on today's leaderboard.
 * Respects maximum sanity thresholds to prevent impossible scores.
 */
export async function submitScore(
  gameId: GameId,
  score: number,
  nick: string,
  signature: string,
  dateStr: string = getTodayIsoDate()
): Promise<{ success: boolean; rank?: number; message?: string }> {
  // Anti-cheat sanity checks
  if (typeof score !== "number" || isNaN(score) || score <= 0) {
    return { success: false, message: "Geçersiz skor değeri." };
  }

  const maxCeiling = MAX_SCORE_CEILINGS[gameId] ?? 3_000;
  if (score > maxCeiling) {
    return { success: false, message: "Skor makul sınırların üzerinde." };
  }

  // Clean and validate nick & signature
  const cleanNick = nick.trim().slice(0, 32);
  const cleanSig = signature.trim().slice(0, 32);
  if (!cleanNick || !cleanSig) {
    return { success: false, message: "Eksik kod adı veya imza." };
  }

  const key = `lb:${gameId}:${dateStr}`;
  const member = `${cleanSig}::${cleanNick}`;

  // If Turso is configured, asynchronously persist to durable SQL store
  if (isTursoConfigured()) {
    saveTursoScore(gameId, score, cleanNick, cleanSig, dateStr).catch(() => {});
  }

  // Strategy A: VDS / Self-Hosted Native TCP Redis
  const tcpRedis = getTcpRedisClient();
  if (tcpRedis) {
    try {
      try {
        await tcpRedis.zadd(key, "GT", score, member);
      } catch {
        const currentScore = await tcpRedis.zscore(key, member);
        if (currentScore === null || score > Number(currentScore)) {
          await tcpRedis.zadd(key, score, member);
        }
      }

      await tcpRedis.expire(key, 172800); // 48 hours TTL
      const rank0 = await tcpRedis.zrevrank(key, member);
      const rank = typeof rank0 === "number" ? rank0 + 1 : undefined;

      return { success: true, rank };
    } catch {
      // Fallback
    }
  }

  // Strategy B: Vercel Marketplace Upstash Redis
  const upstash = getUpstashClient();
  if (upstash) {
    try {
      // Check existing score to preserve personal best
      const currentScore = await upstash.zscore(key, member);
      if (currentScore === null || score > Number(currentScore)) {
        await upstash.zadd(key, { score, member });
      }

      await upstash.expire(key, 172800); // 48h TTL
      const rank0 = await upstash.zrevrank(key, member);
      const rank = typeof rank0 === "number" ? rank0 + 1 : undefined;

      return { success: true, rank };
    } catch {
      // Fallback to next strategy on failure
    }
  }

  // Strategy C: Turso Database (Serverless libSQL / Local SQLite)
  if (isTursoConfigured()) {
    try {
      const saved = await saveTursoScore(gameId, score, cleanNick, cleanSig, dateStr);
      if (saved) {
        const rank = await getTursoPlayerRank(gameId, dateStr, score);
        return { success: true, rank };
      }
    } catch {
      // Fallback to memory
    }
  }

  // Strategy D: Memory fallback
  const memKey = getMemoryKey(gameId, dateStr);
  if (!memoryStore.has(memKey)) {
    memoryStore.set(memKey, new Map());
  }
  const gameMap = memoryStore.get(memKey)!;
  const existing = gameMap.get(cleanSig);

  if (!existing || score > existing.score) {
    gameMap.set(cleanSig, { nick: cleanNick, score, timestamp: Date.now() });
  }

  const sorted = Array.from(gameMap.entries()).sort((a, b) => b[1].score - a[1].score);
  const rankIndex = sorted.findIndex(([sig]) => sig === cleanSig);
  const rank = rankIndex !== -1 ? rankIndex + 1 : undefined;

  return { success: true, rank };
}

/**
 * Express handler for GET /api/leaderboard
 */
export async function getLeaderboardHandler(req: Request, res: Response) {
  const game = String(req.query.game || "echo") as GameId;
  const date = String(req.query.date || getTodayIsoDate());

  if (!VALID_GAMES.includes(game)) {
    return res.status(400).json({ error: "Geçersiz oyun kimliği." });
  }

  // Edge CDN caching: 30s browser, 60s CDN, 300s stale-while-revalidate
  res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60, stale-while-revalidate=300");

  try {
    const data = await getTopScores(game, date);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Liderlik tablosu alınamadı." });
  }
}

/**
 * Express handler for POST /api/leaderboard
 */
export async function submitLeaderboardHandler(req: Request, res: Response) {
  const { gameId, score, nick, signature } = req.body || {};

  if (!VALID_GAMES.includes(gameId)) {
    return res.status(400).json({ error: "Geçersiz oyun kimliği." });
  }

  try {
    const result = await submitScore(gameId, Number(score), String(nick || ""), String(signature || ""));
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: "Skor kaydedilemedi." });
  }
}
