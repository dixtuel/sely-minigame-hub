import type { Request, Response } from "express";
import IORedis from "ioredis";
import {
  isTursoConfigured,
  getTursoTopScores,
  saveTursoScore,
  getTursoPlayerRank,
} from "./turso";
import { logger } from "../_core/logger";

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
  source: "redis" | "turso" | "memory";
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

// In-Memory store fallback when no Redis URL is configured
const memoryStore = new Map<string, Map<string, { nick: string; score: number; timestamp: number }>>();

function getMemoryKey(gameId: string, dateStr: string): string {
  return `lb:${gameId}:${dateStr}`;
}

export function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// Redis client (ioredis, TCP): works with a self-hosted Redis or any managed Redis (e.g. Redis Cloud) via standard REDIS_URL
let tcpRedisInstance: IORedis | null = null;
let tcpRedisConnecting: Promise<void> | null = null;
async function getTcpRedisClient(): Promise<IORedis | null> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  if (!tcpRedisInstance) {
    try {
      tcpRedisInstance = new IORedis(redisUrl, {
        // Explicit connect (not lazy): on a cold serverless invocation the pipeline in
        // getTopScores/submitScore must not fire before the handshake finishes — with
        // enableOfflineQueue disabled that would reject instantly and silently fall through
        // to the next storage strategy. Awaiting `tcpRedisConnecting` below fixes that while
        // warm (Fluid Compute-reused) instances skip straight to the cached, ready client.
        lazyConnect: true,
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
        logger.warn("leaderboard:redis", "Connection error", err);
      });

      tcpRedisConnecting = tcpRedisInstance.connect().catch((err) => {
        logger.warn("leaderboard:redis", "Initial connect failed", err);
        tcpRedisInstance = null;
        tcpRedisConnecting = null;
      });
    } catch {
      tcpRedisInstance = null;
    }
  }

  if (tcpRedisConnecting) {
    await tcpRedisConnecting;
  }
  return tcpRedisInstance;
}

// In-process micro-cache for top scores (5s TTL) protecting Redis command quotas
interface L1LeaderboardEntry {
  timestamp: number;
  data: LeaderboardResponse;
}
const l1Cache = new Map<string, L1LeaderboardEntry>();
const L1_TTL_MS = 5_000;

/**
 * Retrieves the top leaderboard entries for a given game and date.
 */
export async function getTopScores(gameId: GameId, dateStr: string = getTodayIsoDate()): Promise<LeaderboardResponse> {
  const l1Key = `${gameId}:${dateStr}`;
  const l1Cached = l1Cache.get(l1Key);
  if (l1Cached && Date.now() - l1Cached.timestamp < L1_TTL_MS) {
    return l1Cached.data;
  }

  const key = `lb:${gameId}:${dateStr}`;

  // Strategy A: Redis (ioredis TCP)
  const tcpRedis = await getTcpRedisClient();
  if (tcpRedis) {
    try {
      // Pipelined retrieval: 1 network roundtrip for both top range and card
      const pipe = tcpRedis.pipeline();
      pipe.zrevrange(key, 0, 9, "WITHSCORES");
      pipe.zcard(key);
      const pipeResults = await pipe.exec();

      if (pipeResults && pipeResults[0] && !pipeResults[0][0]) {
        const result = (pipeResults[0][1] as string[]) || [];
        const count = Number(pipeResults[1]?.[1] ?? 0);

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

        const response: LeaderboardResponse = {
          gameId,
          date: dateStr,
          top: entries,
          totalPlayers: count || entries.length,
          source: "redis",
        };
        l1Cache.set(l1Key, { timestamp: Date.now(), data: response });
        return response;
      }
    } catch {
      // Fallback to next strategy if TCP query fails
    }
  }

  // Strategy B: Turso Database (Serverless libSQL / Local SQLite / Historical Archive)
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

  // Strategy C: Memory fallback (Local development / Zero-config environments)
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

  // Invalidate in-process L1 cache for this board so immediate reads reflect updates
  l1Cache.delete(`${gameId}:${dateStr}`);

  // If Turso is configured, asynchronously persist to durable SQL store
  if (isTursoConfigured()) {
    saveTursoScore(gameId, score, cleanNick, cleanSig, dateStr).catch(() => {});
  }

  // Strategy A: Redis (ioredis TCP — pipelined: 1 roundtrip for zadd GT, expire, zrevrank)
  const tcpRedis = await getTcpRedisClient();
  if (tcpRedis) {
    try {
      const pipe = tcpRedis.pipeline();
      pipe.zadd(key, "GT", score, member);
      pipe.expire(key, 172800); // 48 hours TTL
      pipe.zrevrank(key, member);
      const pipeResults = await pipe.exec();
      const rank0 = pipeResults?.[2]?.[1];
      const rank = typeof rank0 === "number" ? rank0 + 1 : undefined;

      return { success: true, rank };
    } catch {
      // Fallback
    }
  }

  // Strategy B: Turso Database (Serverless libSQL / Local SQLite)
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

  // Strategy C: Memory fallback
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
