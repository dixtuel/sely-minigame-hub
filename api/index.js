// server/app.ts
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/storage/db.ts
import pg from "pg";

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/storage/turso.ts
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

// server/_core/logger.ts
var LOG_LEVEL_WEIGHTS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};
var isDev = process.env.NODE_ENV === "development";
var isDebugEnabled = Boolean(process.env.DEBUG) && process.env.DEBUG !== "false" && process.env.DEBUG !== "0";
var currentLevelThreshold = isDebugEnabled || isDev ? "debug" : "info";
function sanitizeLogText(input) {
  if (!input) return "";
  return input.replace(/(:\/\/[\w%.-]+:)([^@]+)(@)/g, "$1***$3").replace(/(Bearer\s+)[A-Za-z0-9._~+/-]{8,}/gi, "$1***").replace(/(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,})/g, "jwt:***").replace(/\b(\d{1,3}\.\d{1,3})\.\d{1,3}\.\d{1,3}\b/g, "$1.*.*");
}
function formatError(err) {
  if (!err) return "";
  if (err instanceof Error) {
    if (isDebugEnabled || isDev) {
      return sanitizeLogText(err.stack || err.message);
    }
    return sanitizeLogText(err.message);
  }
  return sanitizeLogText(String(err));
}
function shouldLog(level) {
  return LOG_LEVEL_WEIGHTS[level] >= LOG_LEVEL_WEIGHTS[currentLevelThreshold];
}
var logger = {
  /**
   * Debug level: only active when DEBUG=true/1 or NODE_ENV=development.
   * Suppressed in normal production to protect Vercel log limits.
   */
  debug(scope, message, ...args) {
    if (!shouldLog("debug")) return;
    const sanitizedMsg = sanitizeLogText(message);
    console.debug(`[sely:${scope}] ${sanitizedMsg}`, ...args);
  },
  /**
   * Info level: key lifecycle events (server boot, cron jobs, schema migrations).
   */
  info(scope, message, ...args) {
    if (!shouldLog("info")) return;
    const sanitizedMsg = sanitizeLogText(message);
    console.info(`[sely:${scope}] ${sanitizedMsg}`, ...args);
  },
  /**
   * Warn level: actionable system warnings (fallbacks engaged, config discrepancies).
   * Routine unauthenticated visitor events should NOT be logged as warnings.
   */
  warn(scope, message, ...args) {
    if (!shouldLog("warn")) return;
    const sanitizedMsg = sanitizeLogText(message);
    console.warn(`[sely:${scope}] ${sanitizedMsg}`, ...args);
  },
  /**
   * Error level: unexpected exceptions or storage failures.
   */
  error(scope, message, err) {
    if (!shouldLog("error")) return;
    const sanitizedMsg = sanitizeLogText(message);
    const errText = err ? ` \u2014 ${formatError(err)}` : "";
    console.error(`[sely:${scope}] ${sanitizedMsg}${errText}`);
  }
};

// server/storage/turso.ts
var tursoClient = null;
var schemaInitialized = false;
var boardCache = /* @__PURE__ */ new Map();
var CACHE_TTL_MS = 15e3;
var MAX_BOARD_CACHE_ENTRIES = 128;
function setCachedBoard(key, value) {
  if (boardCache.size >= MAX_BOARD_CACHE_ENTRIES) {
    const oldest = boardCache.keys().next().value;
    if (oldest) boardCache.delete(oldest);
  }
  boardCache.set(key, value);
}
function getTursoConfig() {
  const explicitUrl = process.env.TURSO_DATABASE_URL || process.env.TURSO_URL || process.env.LIBSQL_URL || null;
  if (explicitUrl) {
    const authToken = process.env.TURSO_AUTH_TOKEN || void 0;
    return { url: explicitUrl, authToken };
  }
  const isVercel = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
  const hasPostgres = Boolean(
    process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.CONTENT_DB_URL
  );
  if (!isVercel && !hasPostgres && process.env.NODE_ENV !== "test") {
    return { url: "file:./data/sely.db" };
  }
  return null;
}
function isTursoConfigured() {
  return getTursoConfig() !== null;
}
function getTursoClient() {
  const config = getTursoConfig();
  if (!config) return null;
  if (!tursoClient) {
    try {
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
        authToken: config.authToken
      });
    } catch (err) {
      logger.warn("turso", "Failed to initialize client", err);
      tursoClient = null;
    }
  }
  return tursoClient;
}
async function ensureTursoSchema() {
  const client = getTursoClient();
  if (!client) return false;
  if (schemaInitialized) return true;
  try {
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
async function saveTursoScore(gameId, score, nick, signature, dateStr) {
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
      args: [gameId, dateStr, nick, signature, score, now]
    });
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
async function getTursoPlayerRank(gameId, dateStr, score) {
  const client = getTursoClient();
  if (!client) return void 0;
  try {
    const rs = await client.execute({
      sql: `
        SELECT COUNT(*) as rank_above
        FROM daily_scores
        WHERE game_id = ? AND date_str = ? AND score > ?;
      `,
      args: [gameId, dateStr, score]
    });
    const count = Number(rs.rows[0]?.rank_above ?? 0);
    return count + 1;
  } catch {
    return void 0;
  }
}
async function getTursoTopScores(gameId, dateStr, limit = 10) {
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
          args: [gameId, dateStr, limit]
        },
        {
          sql: `
            SELECT COUNT(*) as total
            FROM daily_scores
            WHERE game_id = ? AND date_str = ?;
          `,
          args: [gameId, dateStr]
        }
      ],
      "read"
    );
    const totalPlayers = Number(totalRs.rows[0]?.total ?? scoresRs.rows.length);
    const top = scoresRs.rows.map((row, index) => ({
      rank: index + 1,
      nick: String(row.nick),
      score: Number(row.score),
      signature: String(row.signature),
      timestamp: Number(row.created_at)
    }));
    const result = { top, totalPlayers };
    setCachedBoard(cacheKey, { timestamp: now, data: result });
    return result;
  } catch (err) {
    logger.warn("turso", "Error querying top scores", err);
    return null;
  }
}
async function getTursoUserByOpenId(openId) {
  const client = getTursoClient();
  if (!client) return void 0;
  await ensureTursoSchema();
  try {
    const rs = await client.execute({
      sql: `SELECT * FROM users WHERE open_id = ? LIMIT 1;`,
      args: [openId]
    });
    if (rs.rows.length === 0) return void 0;
    const row = rs.rows[0];
    return {
      id: Number(row.id),
      openId: String(row.open_id),
      name: row.name ? String(row.name) : null,
      email: row.email ? String(row.email) : null,
      loginMethod: row.login_method ? String(row.login_method) : null,
      role: String(row.role),
      createdAt: new Date(Number(row.created_at)),
      updatedAt: new Date(Number(row.updated_at)),
      lastSignedIn: new Date(Number(row.last_signed_in))
    };
  } catch (err) {
    logger.warn("turso", "Error looking up user", err);
    return void 0;
  }
}
async function upsertTursoUser(user) {
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
        lastSignedInMs
      ]
    });
  } catch (err) {
    logger.error("turso", "Failed to upsert user", err);
    throw err;
  }
}

// server/storage/dbUrl.ts
function isCloudPostgresUrl(url) {
  return url.includes("sslmode=require") || url.includes("neon.tech") || url.includes("vercel-storage.com") || url.includes("aws.connect");
}
var warnedCallers = /* @__PURE__ */ new Set();
function warnIfDatabaseUrlSchemeMismatch(callerLabel, expectedSchemes) {
  const url = process.env.DATABASE_URL;
  if (!url || warnedCallers.has(callerLabel)) return;
  const matches = expectedSchemes.some((scheme) => url.startsWith(scheme));
  if (!matches) {
    warnedCallers.add(callerLabel);
    logger.warn(
      `storage:${callerLabel}`,
      `DATABASE_URL is set but doesn't match the expected scheme(s) (${expectedSchemes.join(", ")}) \u2014 falling through to next storage strategy.`
    );
  }
}

// server/storage/db.ts
var { Pool } = pg;
var _pgPool = null;
var _pgSchemaInitialized = false;
function getPostgresUrl() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.CONTENT_DB_URL || null;
  if (url && (url.startsWith("postgres://") || url.startsWith("postgresql://"))) {
    return url;
  }
  warnIfDatabaseUrlSchemeMismatch("db.ts:getPostgresUrl", ["postgres://", "postgresql://"]);
  return null;
}
function getPgPool() {
  const url = getPostgresUrl();
  if (!url) return null;
  if (!_pgPool) {
    try {
      const isCloud = isCloudPostgresUrl(url);
      const isServerless = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV) || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
      _pgPool = new Pool({
        connectionString: url,
        // On Vercel serverless functions, limit to 2 connections per lambda to prevent exhausting Neon connection limits.
        // On long-running environments, allow up to 10 connections.
        max: isServerless ? 2 : 10,
        // 10s idle timeout allows idle connections to close, enabling Neon compute to cleanly scale to zero after 5 minutes.
        idleTimeoutMillis: isCloud ? 1e4 : 3e4,
        connectionTimeoutMillis: 5e3,
        ssl: isCloud ? { rejectUnauthorized: false } : void 0
      });
      _pgPool.on("error", (err) => {
        logger.warn("db:postgres", "Unexpected error on idle client", err);
      });
    } catch (error) {
      logger.warn("db:postgres", "Failed to initialize pool", error);
      _pgPool = null;
    }
  }
  return _pgPool;
}
async function ensurePgSchema(pool) {
  if (_pgSchemaInitialized) return true;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        open_id VARCHAR(64) NOT NULL UNIQUE,
        name TEXT,
        email VARCHAR(320),
        login_method VARCHAR(64),
        role VARCHAR(16) NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_signed_in TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    _pgSchemaInitialized = true;
    return true;
  } catch (err) {
    logger.error("db:postgres", "Failed to ensure schema", err);
    return false;
  }
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const pgPool = getPgPool();
  if (pgPool) {
    try {
      await ensurePgSchema(pgPool);
      const assignedRole = user.role !== void 0 ? user.role : user.openId === ENV.ownerOpenId ? "admin" : "user";
      const signedInDate = user.lastSignedIn || /* @__PURE__ */ new Date();
      await pgPool.query(
        `
        INSERT INTO users (open_id, name, email, login_method, role, last_signed_in)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (open_id) DO UPDATE SET
          name = COALESCE(EXCLUDED.name, users.name),
          email = COALESCE(EXCLUDED.email, users.email),
          login_method = COALESCE(EXCLUDED.login_method, users.login_method),
          role = EXCLUDED.role,
          updated_at = NOW(),
          last_signed_in = EXCLUDED.last_signed_in;
        `,
        [
          user.openId,
          user.name ?? null,
          user.email ?? null,
          user.loginMethod ?? null,
          assignedRole,
          signedInDate
        ]
      );
      return;
    } catch (err) {
      logger.error("db:postgres", "Failed to upsert user", err);
      throw err;
    }
  }
  if (isTursoConfigured()) {
    return upsertTursoUser({
      openId: user.openId,
      name: user.name,
      email: user.email,
      loginMethod: user.loginMethod,
      role: user.role,
      lastSignedIn: user.lastSignedIn
    });
  }
  logger.debug("db", "Cannot upsert user: database not available (running in memory mode)");
}
async function getUserByOpenId(openId) {
  const pgPool = getPgPool();
  if (pgPool) {
    try {
      await ensurePgSchema(pgPool);
      const res = await pgPool.query(
        `
        SELECT id, open_id as "openId", name, email, login_method as "loginMethod",
               role, created_at as "createdAt", updated_at as "updatedAt",
               last_signed_in as "lastSignedIn"
        FROM users
        WHERE open_id = $1
        LIMIT 1;
        `,
        [openId]
      );
      return res.rows.length > 0 ? res.rows[0] : void 0;
    } catch (err) {
      logger.error("db:postgres", "Failed to get user", err);
      return void 0;
    }
  }
  if (isTursoConfigured()) {
    return await getTursoUserByOpenId(openId);
  }
  logger.debug("db", "Cannot get user: database not available (running in memory mode)");
  return void 0;
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    logger.debug("oauth", `Initialized with baseURL: ${ENV.oAuthServerUrl || "none"}`);
    if (!ENV.oAuthServerUrl) {
      logger.debug(
        "oauth",
        "OAUTH_SERVER_URL is not configured; running in standalone / anonymous mode"
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /** Shared by getUserInfo()/getUserInfoWithJwt(): reduces the raw `platforms` list into `platform`/`loginMethod`. */
  applyLoginMethod(data) {
    const loginMethod = this.deriveLoginMethod(data.platforms, data.platform ?? null);
    return { ...data, platform: loginMethod, loginMethod };
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    return this.applyLoginMethod(data);
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      logger.debug("auth", "No session cookie provided for request");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        logger.warn("auth", "Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      logger.debug("auth", "Session verification failed (token expired or invalid)");
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    return this.applyLoginMethod(data);
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        logger.error("auth", "Failed to sync user from OAuth", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app2) {
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      logger.error("oauth", "Callback processing failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
import fs2 from "fs";
import path2 from "path";
function registerStorageProxy(app2) {
  const handleStorageRequest = (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    const candidateDirs = [
      path2.resolve(import.meta.dirname, "public", "storage"),
      // dist/index.js running in production
      path2.resolve(import.meta.dirname, "../..", "client", "public", "storage"),
      // development or tsx from source
      path2.resolve(process.cwd(), "dist", "public", "storage"),
      // production from project root
      path2.resolve(process.cwd(), "client", "public", "storage")
      // source fallback
    ];
    const localDir = candidateDirs.find((dir) => fs2.existsSync(dir)) || candidateDirs[0];
    const localPath = path2.resolve(localDir, key);
    if (localPath.startsWith(localDir) && fs2.existsSync(localPath)) {
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      res.sendFile(localPath);
      return;
    }
    res.status(404).send("File not found");
  };
  app2.get("/storage/*", handleStorageRequest);
  app2.get("/manus-storage/*", handleStorageRequest);
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";

// server/_core/forgeClient.ts
var FORGE_SERVICE = "webdevtoken.v1.WebDevService";
function buildForgeEndpointUrl(baseUrl, rpc) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(`${FORGE_SERVICE}/${rpc}`, normalizedBase).toString();
}
function getForgeHeaders(apiKey, extra) {
  return {
    accept: "application/json",
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
    "connect-protocol-version": "1",
    ...extra
  };
}

// server/_core/notification.ts
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildForgeEndpointUrl(ENV.forgeApiUrl, "SendNotification");
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: getForgeHeaders(ENV.forgeApiKey),
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      logger.warn(
        "notify",
        `Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    logger.warn("notify", "Error calling notification service", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/storage/dailyContentStore.ts
import { createHash } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { Pool as Pool2 } from "pg";
var DAILY_GAMES = ["echo", "knot", "cut", "shadow", "vaka", "hane", "spark"];
var RULESET_VERSION = "5";
var dayKey = (value = /* @__PURE__ */ new Date()) => value.toISOString().slice(0, 10);
var seedFor = (value) => {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) % 2147483647;
};
var checksum = (payload) => createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
function encodePayload(value) {
  const raw = JSON.stringify(value);
  if (raw.length < 96) return { codec: "json", payload: raw };
  return { codec: "deflate-base64url", payload: deflateRawSync(Buffer.from(raw)).toString("base64url") };
}
function decodePayload(codec, payload) {
  const raw = codec === "json" ? payload : inflateRawSync(Buffer.from(payload, "base64url")).toString("utf8");
  return JSON.parse(raw);
}
function createDailyManifest(date = dayKey()) {
  const games = DAILY_GAMES.map((gameId, index) => {
    const seed = seedFor(`${date}:${gameId}:v${RULESET_VERSION}`);
    const difficulty = 1 + (seed + index) % 4;
    const params = {
      v: Number(RULESET_VERSION),
      band: difficulty,
      variant: (seed >>> 5) % 5,
      objective: (seed >>> 11) % 4,
      pace: 2 + (seed >>> 17) % 4
    };
    return { gameId, seed, difficulty, rulesetVersion: RULESET_VERSION, params, checksum: checksum({ date, gameId, seed, difficulty, params }) };
  });
  return { date, games, generatedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
var MemoryStore = class {
  rows = /* @__PURE__ */ new Map();
  async ensure(manifest) {
    const current = this.rows.get(manifest.date);
    if (current) return current;
    this.rows.set(manifest.date, manifest);
    return manifest;
  }
  async cleanup(beforeDate) {
    const expired = Array.from(this.rows.keys()).filter((date) => date < beforeDate);
    expired.forEach((date) => this.rows.delete(date));
    return expired.length;
  }
};
var PostgresStore = class {
  constructor(pool) {
    this.pool = pool;
  }
  schemaChecked = false;
  async schema() {
    if (this.schemaChecked) return;
    const result = await this.pool.query("SELECT to_regclass('public.sely_daily_content') AS relation_name");
    if (!result.rows[0]?.relation_name) throw new Error("Daily content migration is missing");
    this.schemaChecked = true;
  }
  async ensure(manifest) {
    await this.schema();
    const rows = await this.pool.query("SELECT * FROM sely_daily_content WHERE content_date = $1 ORDER BY game_id", [manifest.date]);
    if (rows.rowCount === DAILY_GAMES.length) return fromRows(manifest.date, rows.rows);
    for (const game of manifest.games) {
      const packed = encodePayload(game.params);
      await this.pool.query(`INSERT INTO sely_daily_content (content_date, game_id, seed, difficulty, ruleset_version, payload_codec, payload, checksum)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (content_date, game_id) DO NOTHING`, [manifest.date, game.gameId, game.seed, game.difficulty, game.rulesetVersion, packed.codec, packed.payload, game.checksum]);
    }
    const stored = await this.pool.query("SELECT * FROM sely_daily_content WHERE content_date = $1 ORDER BY game_id", [manifest.date]);
    return fromRows(manifest.date, stored.rows);
  }
  async cleanup(beforeDate) {
    await this.schema();
    const result = await this.pool.query("DELETE FROM sely_daily_content WHERE content_date < $1", [beforeDate]);
    return result.rowCount ?? 0;
  }
};
var TursoStore = class {
  constructor(client) {
    this.client = client;
  }
  schemaInitialized = false;
  async schema() {
    if (this.schemaInitialized) return;
    await this.client.execute(`CREATE TABLE IF NOT EXISTS sely_daily_content (
      content_date TEXT NOT NULL, game_id TEXT NOT NULL, seed INTEGER NOT NULL, difficulty INTEGER NOT NULL,
      ruleset_version TEXT NOT NULL, payload_codec TEXT NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL,
      created_at TEXT NOT NULL, PRIMARY KEY (content_date, game_id)
    )`);
    await this.client.execute("CREATE INDEX IF NOT EXISTS sely_daily_content_date_idx ON sely_daily_content (content_date DESC)");
    this.schemaInitialized = true;
  }
  async ensure(manifest) {
    await this.schema();
    const existing = await this.client.execute({ sql: "SELECT * FROM sely_daily_content WHERE content_date = ? ORDER BY game_id", args: [manifest.date] });
    if (existing.rows.length === DAILY_GAMES.length) return fromRows(manifest.date, existing.rows);
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    const insertStatements = manifest.games.map((game) => {
      const packed = encodePayload(game.params);
      return {
        sql: `INSERT OR IGNORE INTO sely_daily_content
          (content_date, game_id, seed, difficulty, ruleset_version, payload_codec, payload, checksum, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
        args: [manifest.date, game.gameId, game.seed, game.difficulty, game.rulesetVersion, packed.codec, packed.payload, game.checksum, createdAt]
      };
    });
    await this.client.batch(insertStatements, "write");
    const stored = await this.client.execute({ sql: "SELECT * FROM sely_daily_content WHERE content_date = ? ORDER BY game_id", args: [manifest.date] });
    return fromRows(manifest.date, stored.rows);
  }
  async cleanup(beforeDate) {
    await this.schema();
    const result = await this.client.execute({ sql: "DELETE FROM sely_daily_content WHERE content_date < ?", args: [beforeDate] });
    return result.rowsAffected;
  }
};
function fromRows(date, rows) {
  const games = rows.map((row) => ({ gameId: String(row.game_id), seed: Number(row.seed), difficulty: Number(row.difficulty), rulesetVersion: String(row.ruleset_version), params: decodePayload(String(row.payload_codec), String(row.payload)), checksum: String(row.checksum) }));
  return { date, games, generatedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
var store = null;
function getDailyStore() {
  if (store) return store;
  const provider = process.env.CONTENT_DB_PROVIDER?.toLowerCase();
  const postgresUrl = process.env.CONTENT_DB_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if ((provider === "turso" || !provider) && isTursoConfigured()) {
    const client = getTursoClient();
    if (client) {
      store = new TursoStore(client);
      return store;
    }
  }
  if ((provider === "postgres" || !provider) && postgresUrl && /^(postgres|postgresql):\/\//.test(postgresUrl)) {
    const isCloud = isCloudPostgresUrl(postgresUrl);
    store = new PostgresStore(
      new Pool2({
        connectionString: postgresUrl,
        max: 2,
        idleTimeoutMillis: 1e4,
        ssl: isCloud ? { rejectUnauthorized: false } : void 0
      })
    );
    return store;
  }
  warnIfDatabaseUrlSchemeMismatch("dailyContentStore.ts:getDailyStore", ["postgres://", "postgresql://"]);
  store = new MemoryStore();
  return store;
}
async function ensureDailyContent(date = dayKey()) {
  return getDailyStore().ensure(createDailyManifest(date));
}
async function cleanupDailyContent(retentionDays = 90, referenceDate = dayKey()) {
  const reference = /* @__PURE__ */ new Date(`${referenceDate}T00:00:00.000Z`);
  reference.setUTCDate(reference.getUTCDate() - retentionDays);
  return getDailyStore().cleanup(reference.toISOString().slice(0, 10));
}

// server/routers/vakaRouter.ts
import { z as z2 } from "zod";

// shared/vakaCasesExtra.ts
var newCases = [
  // Case 09
  {
    id: "case-09-bogaz-yalisi",
    title: "Bo\u011Faz Yal\u0131s\u0131nda Kasa Soygunu",
    titleEn: "Vault Heist at the Bosphorus Mansion",
    difficulty: "normal",
    briefing: "Emekli armat\xF6r Hikmet Pa\u015Fazade'nin Bo\u011Faz'daki yal\u0131s\u0131ndan milyon dolarl\u0131k hamiline senetler ve antika m\xFCh\xFCr \xE7al\u0131nd\u0131.",
    briefingEn: "Million dollar bearer bonds and an antique seal were stolen from retired magnate Hikmet Pa\u015Fazade's Bosphorus mansion.",
    incidentTime: "23:15",
    location: "Yal\u0131 Ana Kasa Odas\u0131",
    locationEn: "Mansion Main Vault Room",
    victim: {
      name: "Hikmet Pa\u015Fazade",
      occupation: "Emekli Armat\xF6r",
      occupationEn: "Retired Shipping Magnate",
      causeOfDeath: "Can kayb\u0131 yok (Nitelikli H\u0131rs\u0131zl\u0131k)",
      causeOfDeathEn: "No casualties (Grand Larceny)"
    },
    timeline: [
      { time: "22:00", event: "Misafirler yal\u0131dan ayr\u0131ld\u0131.", eventEn: "Guests left the mansion.", verified: true },
      { time: "23:15", event: "Kasa kapa\u011F\u0131 a\xE7\u0131ld\u0131.", eventEn: "Vault door opened.", verified: true },
      { time: "00:30", event: "Kasan\u0131n bo\u015F oldu\u011Fu fark edildi.", eventEn: "Vault discovered empty.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Kasa \u015Fifre paneli temiz, zorlama yok.",
        "\u0130skelede taze s\xFCrt\xFCnme izleri."
      ],
      en: [
        "Vault combination panel is clean, no forced entry.",
        "Fresh friction marks on the dock."
      ]
    },
    culpritId: "suspect-selim",
    correctMethod: "\u015Eifresini bildi\u011Fi kasay\u0131 a\xE7\u0131p \xE7ald\u0131klar\u0131n\u0131 iskeledeki s\xFCrat motoruna gizledi.",
    correctMethodEn: "Opened the vault using the known code and hid the stolen items in his speedboat at the dock.",
    correctMotive: "B\xFCy\xFCk kumar bor\xE7lar\u0131n\u0131 kapatmak.",
    correctMotiveEn: "To pay off massive gambling debts.",
    winningContradiction: {
      suspectId: "suspect-selim",
      sentenceId: "selim-s2",
      clueId: "clue-yali-dock-rope"
    },
    analystSummary: {
      tr: "Analist Notu: \u015E\xFCpheli iskeleye inmedi\u011Fini iddia ediyor ancak iskele babas\u0131nda motorunun ipine ait lifler bulundu.",
      en: "Analyst Note: Suspect claims he never went to the dock, but fibers from his boat's rope were found on the bollard."
    },
    suspects: [
      {
        id: "suspect-selim",
        name: "Selim Pa\u015Fazade",
        role: "Mirasyedi Ye\u011Fen",
        roleEn: "Spendthrift Nephew",
        age: 28,
        temperament: "Kibirli ve rahat",
        temperamentEn: "Arrogant and relaxed",
        relationshipToVictim: "Hikmet Pa\u015Fazade'nin ye\u011Feni.",
        relationshipToVictimEn: "Nephew of Hikmet Pa\u015Fazade.",
        statement: "B\xFCt\xFCn ak\u015Fam kendi odamda oyun oynad\u0131m, d\u0131\u015Far\u0131 ad\u0131m atmad\u0131m.",
        statementEn: "I played games in my room all evening, didn't step outside.",
        isCulprit: true,
        alibi: "Odas\u0131nda oldu\u011Funu iddia ediyor.",
        alibiEn: "Claims to be in his room.",
        motive: "B\xFCy\xFCk kumar bor\xE7lar\u0131.",
        motiveEn: "Massive gambling debts.",
        minorSecret: "Amcas\u0131n\u0131n antika arabas\u0131n\u0131 izinsiz kullan\u0131rd\u0131.",
        minorSecretEn: "Used his uncle's antique car without permission.",
        breakThreshold: 85,
        gossip: {
          "suspect-aylin": { tr: "Doktorun amcama verdi\u011Fi ila\xE7lar \xE7ok \u015F\xFCpheli.", en: "The doctor's meds for my uncle are very suspicious." },
          "suspect-riza": { tr: "R\u0131za Efendi kasan\u0131n \u015Fifresini biliyor olabilir.", en: "R\u0131za Efendi might know the vault code." }
        },
        behavioralCues: {
          calm: { tr: "Telefonuyla oynuyor.", en: "Playing with his phone." },
          nervous: { tr: "Dudaklar\u0131n\u0131 kemiriyor.", en: "Chewing his lips." },
          breaking: { tr: "Ba\u011F\u0131rarak su\xE7lamalar\u0131 reddediyor.", en: "Yelling and denying accusations." }
        },
        lies: {
          level1: "Ben sadece oyun oynuyordum.",
          level2: "Amcam\u0131n kasas\u0131 umurumda de\u011Fil.",
          level3: "O motoru g\xFCnlerdir kullanmad\u0131m!"
        },
        confession: "Bor\xE7lar\u0131m vard\u0131, beni \xF6ld\xFCreceklerdi! Mecburdum!",
        confessionEn: "I had debts, they were going to kill me! I had to!",
        detailedStatements: [
          { id: "selim-s1", text: "Ak\u015Fam yeme\u011Finden sonra odama \xE7\u0131kt\u0131m.", textEn: "I went up to my room after dinner.", isContradiction: false },
          { id: "selim-s2", text: "B\xFCt\xFCn gece deniz taraf\u0131ndaki iskeleye ad\u0131m dahi atmad\u0131m.", textEn: "I didn't even step on the seaside dock all night.", isContradiction: true, contradictionClueId: "clue-yali-dock-rope", explanation: "\u0130skele babas\u0131ndaki taze palamar s\xFCrt\xFCnme izi ve Selim'in motorunun lifleri bulundu.", explanationEn: "Fresh mooring friction marks and fibers from Selim's speedboat rope were found on the dock bollard." }
        ]
      },
      {
        id: "suspect-aylin",
        name: "Dr. Aylin Kurt",
        role: "\xD6zel Hekim",
        roleEn: "Private Physician",
        age: 35,
        temperament: "Ciddi ve so\u011Fuk",
        temperamentEn: "Serious and cold",
        relationshipToVictim: "Hikmet Bey'in \xF6zel doktoru.",
        relationshipToVictimEn: "Hikmet's private doctor.",
        statement: "Sadece tansiyonunu \xF6l\xE7t\xFCm ve ayr\u0131ld\u0131m.",
        statementEn: "I only checked his blood pressure and left.",
        isCulprit: false,
        alibi: "Klinikte n\xF6bet\xE7iydi.",
        alibiEn: "Was on duty at the clinic.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Yanl\u0131\u015F ila\xE7 yazd\u0131\u011F\u0131n\u0131 gizliyordu.",
        minorSecretEn: "Hid the fact she prescribed the wrong medication.",
        breakThreshold: 94,
        gossip: {
          "suspect-selim": { tr: "Selim \xE7ok bor\xE7luydu.", en: "Selim was heavily in debt." }
        },
        behavioralCues: {
          calm: { tr: "Not defterine bak\u0131yor.", en: "Looking at her notepad." },
          nervous: { tr: "Stetoskopuyla oynuyor.", en: "Playing with her stethoscope." },
          breaking: { tr: "A\u011Flamaya ba\u015Fl\u0131yor.", en: "Starts crying." }
        },
        lies: {
          level1: "Ben sadece doktorum.",
          level2: "Kasa umurumda de\u011Fil.",
          level3: "Klini\u011Fin kameralar\u0131 bozuktu."
        },
        confession: "Masumum, sadece yanl\u0131\u015F ila\xE7 yazd\u0131m!",
        confessionEn: "I am innocent, I just prescribed the wrong med!",
        detailedStatements: [
          { id: "aylin-s1", text: "Hikmet Bey'in tedavisini yap\u0131p \xE7\u0131kt\u0131m.", textEn: "I treated Hikmet and left.", isContradiction: false }
        ]
      },
      {
        id: "suspect-riza",
        name: "R\u0131za Efendi",
        role: "Ba\u015F Kahya",
        roleEn: "Head Butler",
        age: 58,
        temperament: "Sad\u0131k ve tela\u015Fl\u0131",
        temperamentEn: "Loyal and frantic",
        relationshipToVictim: "Yal\u0131n\u0131n 30 y\u0131ll\u0131k \xE7al\u0131\u015Fan\u0131.",
        relationshipToVictimEn: "30-year employee of the mansion.",
        statement: "Mutfakta personeli y\xF6netiyordum.",
        statementEn: "I was managing the staff in the kitchen.",
        isCulprit: false,
        alibi: "Personelle birlikteydi.",
        alibiEn: "Was with the staff.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Mutfak b\xFCt\xE7esinden biraz kesinti yap\u0131yordu.",
        minorSecretEn: "Was skimming a bit off the kitchen budget.",
        breakThreshold: 92,
        gossip: {
          "suspect-selim": { tr: "Selim Bey anahtarlar\u0131 gizlice kopyalam\u0131\u015F olabilir.", en: "Mr. Selim might have secretly copied the keys." }
        },
        behavioralCues: {
          calm: { tr: "Ceketini ilikliyor.", en: "Buttoning his jacket." },
          nervous: { tr: "Terini siliyor.", en: "Wiping his sweat." },
          breaking: { tr: "Diz \xE7\xF6k\xFCp yalvar\u0131yor.", en: "Kneeling and begging." }
        },
        lies: {
          level1: "Ben y\u0131llar\u0131n kahyas\u0131y\u0131m.",
          level2: "H\u0131rs\u0131zl\u0131kla i\u015Fim olmaz.",
          level3: "Kasa \u015Fifresini bilmem."
        },
        confession: "Ben yapmad\u0131m, Hikmet Bey'e ihanet etmem!",
        confessionEn: "I didn't do it, I wouldn't betray Hikmet!",
        detailedStatements: [
          { id: "riza-s1", text: "Personelle ilgileniyordum.", textEn: "I was dealing with the staff.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-yali-dock-rope",
        label: "\u0130skele Babas\u0131nda S\xFCrt\xFCnme \u0130zi",
        labelEn: "Friction Mark on Dock Bollard",
        category: "forensic",
        type: "forensic",
        contradictsSuspectId: "suspect-selim",
        detail: "\u0130skele babas\u0131nda Selim'in s\xFCrat motoruna ait halat lifleri bulundu.",
        detailEn: "Rope fibers belonging to Selim's speedboat were found on the dock bollard.",
        significance: "Selim'in motoru o gece kulland\u0131\u011F\u0131n\u0131 kan\u0131tlar.",
        significanceEn: "Proves Selim used the boat that night."
      },
      {
        id: "clue-09-camera",
        label: "Klinik Kamera Kayd\u0131",
        labelEn: "Clinic Camera Footage",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-aylin",
        detail: "Aylin Han\u0131m gece boyunca klinikteydi.",
        detailEn: "Aylin was at the clinic all night.",
        significance: "Aylin'i temize \xE7\u0131kar\u0131r.",
        significanceEn: "Clears Aylin."
      },
      {
        id: "clue-09-staff",
        label: "Personel \u0130fadesi",
        labelEn: "Staff Statement",
        category: "witness",
        type: "alibi",
        clearsSuspectId: "suspect-riza",
        detail: "R\u0131za Efendi personelin yan\u0131ndan ayr\u0131lmad\u0131.",
        detailEn: "R\u0131za Efendi didn't leave the staff's side.",
        significance: "R\u0131za Efendi'yi temize \xE7\u0131kar\u0131r.",
        significanceEn: "Clears R\u0131za Efendi."
      }
    ]
  },
  // Case 10
  {
    id: "case-10-siber-zirve",
    title: "Siber Zirvede S\u0131f\u0131r\u0131nc\u0131 G\xFCn S\u0131z\u0131nt\u0131s\u0131",
    titleEn: "Zero-Day Leak at the Cyber Summit",
    difficulty: "hard",
    briefing: "Siber g\xFCvenlik zirvesinde, Kaan Sencer'in korudu\u011Fu ana sunucudan HSM anahtar\u0131 \xE7al\u0131nd\u0131.",
    briefingEn: "At the cybersecurity summit, the HSM key was stolen from the main server guarded by Kaan Sencer.",
    incidentTime: "14:30",
    location: "B-4 Sunucu Kat\u0131",
    locationEn: "B-4 Server Floor",
    victim: {
      name: "Kaan Sencer",
      occupation: "Ba\u015F G\xFCvenlik Mimar\u0131",
      occupationEn: "Chief Security Architect",
      causeOfDeath: "Sistem S\u0131z\u0131nt\u0131s\u0131",
      causeOfDeathEn: "System Leak"
    },
    timeline: [
      { time: "14:00", event: "Sunucu odas\u0131 yetkisiz giri\u015Flere kapat\u0131ld\u0131.", eventEn: "Server room locked for unauthorized access.", verified: true },
      { time: "14:30", event: "HSM anahtar\u0131 klonland\u0131.", eventEn: "HSM key was cloned.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Donan\u0131m bypass implant\u0131 lehimlenmi\u015F.",
        "Havaland\u0131rma filtresinde ila\xE7 kal\u0131nt\u0131s\u0131."
      ],
      en: [
        "Hardware bypass implant soldered.",
        "Drug residue in the ventilation filter."
      ]
    },
    culpritId: "suspect-ozan",
    correctMethod: "Donan\u0131m bypass implant\u0131 lehimleyip HSM anahtar\u0131n\u0131 USB belle\u011Fe klonlad\u0131.",
    correctMethodEn: "Soldered a hardware bypass implant and cloned the HSM key to a USB drive.",
    correctMotive: "Rakip firmaya s\u0131f\u0131r\u0131nc\u0131 g\xFCn a\xE7\u0131\u011F\u0131n\u0131 satmak.",
    correctMotiveEn: "To sell the zero-day exploit to a rival company.",
    winningContradiction: {
      suspectId: "suspect-ozan",
      sentenceId: "ozan-s2",
      clueId: "clue-inhaler-vent"
    },
    analystSummary: {
      tr: "Analist Notu: \u015E\xFCpheli sunucu kat\u0131na inmedi\u011Fini belirtiyor ancak havaland\u0131rmada ona ait ast\u0131m ilac\u0131 izi bulundu.",
      en: "Analyst Note: Suspect claims he didn't go down to the server floor, but his asthma drug residue was found in the vent."
    },
    suspects: [
      {
        id: "suspect-ozan",
        name: "Ozan \xC7elik",
        role: "K\u0131demli Pentester",
        roleEn: "Senior Pentester",
        age: 39,
        temperament: "Kibirli ve gergin",
        temperamentEn: "Arrogant and tense",
        relationshipToVictim: "Kaan'\u0131n ekibindeki k\u0131demli test\xE7i.",
        relationshipToVictimEn: "Senior tester in Kaan's team.",
        statement: "Benim ast\u0131m\u0131m var, so\u011Fuk sunucu odalar\u0131na girmem.",
        statementEn: "I have asthma, I don't enter cold server rooms.",
        isCulprit: true,
        alibi: "Odas\u0131nda kod yazd\u0131\u011F\u0131n\u0131 iddia ediyor.",
        alibiEn: "Claims to be writing code in his room.",
        motive: "Finansal kazan\xE7.",
        motiveEn: "Financial gain.",
        minorSecret: "\u015Eirket verilerini ki\u015Fisel diskine kopyal\u0131yordu.",
        minorSecretEn: "Was copying company data to his personal drive.",
        breakThreshold: 84,
        gossip: {
          "suspect-merve": { tr: "Merve \xE7ok dikkatsiz.", en: "Merve is very careless." },
          "suspect-tarik": { tr: "Tar\u0131k'\u0131n loglar\u0131 silmeye \xE7al\u0131\u015Ft\u0131\u011F\u0131n\u0131 g\xF6rd\xFCm.", en: "I saw Tar\u0131k trying to delete logs." }
        },
        behavioralCues: {
          calm: { tr: "G\xF6zl\xFC\u011F\xFCn\xFC siliyor.", en: "Cleaning his glasses." },
          nervous: { tr: "Ast\u0131m ilac\u0131na uzan\u0131yor.", en: "Reaching for his inhaler." },
          breaking: { tr: "Ekrana vurup k\xFCfrediyor.", en: "Hitting the screen and swearing." }
        },
        lies: {
          level1: "Ben sadece test yapar\u0131m.",
          level2: "Lehim yapmay\u0131 bilmem.",
          level3: "O odaya hi\xE7 girmedim!"
        },
        confession: "Evet, anahtar\u0131 ben klonlad\u0131m! Bu sistem zaten \xE7\xFCr\xFCkt\xFC!",
        confessionEn: "Yes, I cloned the key! This system was rotten anyway!",
        detailedStatements: [
          { id: "ozan-s1", text: "\xD6\u011Fleden sonra odamda testlerimi s\xFCrd\xFCrd\xFCm.", textEn: "I continued my tests in my room in the afternoon.", isContradiction: false },
          { id: "ozan-s2", text: "Ast\u0131m\u0131m y\xFCz\xFCnden so\u011Fuk hava olan B-4 sunucu kat\u0131na asla inmedim.", textEn: "Because of my asthma, I never went down to the cold B-4 server floor.", isContradiction: true, contradictionClueId: "clue-inhaler-vent", explanation: "Sunucu odas\u0131 hava filtresinde Ozan'\u0131n re\xE7eteli Salbutamol ilac\u0131 partik\xFClleri bulundu.", explanationEn: "Particles of Ozan's prescribed Salbutamol medication were found in the server room air filter." }
        ]
      },
      {
        id: "suspect-merve",
        name: "Merve Ayd\u0131n",
        role: "Altyap\u0131 \u015Eefi",
        roleEn: "Infrastructure Chief",
        age: 32,
        temperament: "Ciddi ve detayc\u0131",
        temperamentEn: "Serious and meticulous",
        relationshipToVictim: "Kaan'\u0131n altyap\u0131 y\xF6neticisi.",
        relationshipToVictimEn: "Kaan's infrastructure manager.",
        statement: "Kablolamalar\u0131 bitirip \xFCst kata \xE7\u0131kt\u0131m.",
        statementEn: "I finished the wiring and went upstairs.",
        isCulprit: false,
        alibi: "\xDCst katta toplant\u0131dayd\u0131.",
        alibiEn: "Was in a meeting upstairs.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Bir sunucuyu yanl\u0131\u015F konfig\xFCre etmi\u015Fti.",
        minorSecretEn: "Had misconfigured a server.",
        breakThreshold: 92,
        gossip: {
          "suspect-ozan": { tr: "Ozan \xE7ok gergindi.", en: "Ozan was very tense." }
        },
        behavioralCues: {
          calm: { tr: "Notlar\u0131na bak\u0131yor.", en: "Looking at her notes." },
          nervous: { tr: "Kalemini \xE7eviriyor.", en: "Spinning her pen." },
          breaking: { tr: "A\u011Flamaya ba\u015Fl\u0131yor.", en: "Starts crying." }
        },
        lies: {
          level1: "Sistem kusursuzdu.",
          level2: "Ben yapmad\u0131m.",
          level3: "O odaya d\xF6nmedim."
        },
        confession: "Masumum, sadece yanl\u0131\u015F konfig\xFCrasyon yapt\u0131m!",
        confessionEn: "I am innocent, I just did a misconfiguration!",
        detailedStatements: [
          { id: "merve-s1", text: "\xDCst katta toplant\u0131dayd\u0131m.", textEn: "I was in a meeting upstairs.", isContradiction: false }
        ]
      },
      {
        id: "suspect-tarik",
        name: "Tar\u0131k Do\u011Fan",
        role: "Denet\xE7i",
        roleEn: "Auditor",
        age: 41,
        temperament: "\u015E\xFCpheci ve so\u011Fuk",
        temperamentEn: "Suspicious and cold",
        relationshipToVictim: "D\u0131\u015F denet\xE7i.",
        relationshipToVictimEn: "External auditor.",
        statement: "Sadece loglar\u0131 inceliyordum.",
        statementEn: "I was only reviewing the logs.",
        isCulprit: false,
        alibi: "Kameralar onun ofisinde oldu\u011Funu do\u011Fruluyor.",
        alibiEn: "Cameras confirm he was in his office.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Denetim raporunu geciktirmi\u015Fti.",
        minorSecretEn: "Delayed the audit report.",
        breakThreshold: 95,
        gossip: {
          "suspect-ozan": { tr: "Ozan'\u0131n loglar\u0131nda bo\u015Fluklar var.", en: "There are gaps in Ozan's logs." }
        },
        behavioralCues: {
          calm: { tr: "Kravat\u0131n\u0131 d\xFCzeltiyor.", en: "Adjusting his tie." },
          nervous: { tr: "Saatine bak\u0131yor.", en: "Looking at his watch." },
          breaking: { tr: "Sinirle ba\u011F\u0131r\u0131yor.", en: "Yelling angrily." }
        },
        lies: {
          level1: "Ben sadece denetlerim.",
          level2: "Donan\u0131mla i\u015Fim olmaz.",
          level3: "S\u0131zma benim i\u015Fim de\u011Fil."
        },
        confession: "Ben masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "tarik-s1", text: "Ofisimde rapor yaz\u0131yordum.", textEn: "I was writing a report in my office.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-inhaler-vent",
        label: "Havaland\u0131rmadaki \u0130la\xE7 \u0130zi",
        labelEn: "Drug Trace in Vent",
        category: "forensic",
        type: "forensic",
        contradictsSuspectId: "suspect-ozan",
        detail: "Sunucu odas\u0131 hava filtresinde Ozan'\u0131n re\xE7eteli Salbutamol ilac\u0131 partik\xFClleri bulundu.",
        detailEn: "Ozan's prescribed Salbutamol medication particles were found in the server room air filter.",
        significance: "Ozan'\u0131n odaya girdi\u011Fini kan\u0131tlar.",
        significanceEn: "Proves Ozan entered the room."
      },
      {
        id: "clue-10-camera",
        label: "\xDCst Kat Kamera Kayd\u0131",
        labelEn: "Upper Floor Camera Footage",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-merve",
        detail: "Merve \xFCst kattaki toplant\u0131dan hi\xE7 ayr\u0131lmad\u0131.",
        detailEn: "Merve never left the meeting upstairs.",
        significance: "Merve'yi temize \xE7\u0131kar\u0131r.",
        significanceEn: "Clears Merve."
      },
      {
        id: "clue-10-office-cam",
        label: "Ofis Kameras\u0131",
        labelEn: "Office Camera",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-tarik",
        detail: "Tar\u0131k olay s\u0131ras\u0131nda kendi ofisindeydi.",
        detailEn: "Tar\u0131k was in his own office during the incident.",
        significance: "Tar\u0131k'\u0131 temize \xE7\u0131kar\u0131r.",
        significanceEn: "Clears Tar\u0131k."
      }
    ]
  },
  // Case 11
  {
    id: "case-11-acik-deniz-yat",
    title: "A\xE7\u0131k Deniz Yatta F\u0131rt\u0131na Vurgunu",
    titleEn: "Storm Strike on the Offshore Yacht",
    difficulty: "normal",
    briefing: "F\u0131rt\u0131nal\u0131 bir gecede Tar\u0131k Soydan'\u0131n yat\u0131ndan 5 milyon dolarl\u0131k 'Mavi Safir' kolye \xE7al\u0131nd\u0131.",
    briefingEn: "On a stormy night, a 5 million dollar 'Blue Sapphire' necklace was stolen from Tar\u0131k Soydan's yacht.",
    incidentTime: "23:50",
    location: "Yat Ana G\xFCverte ve Kasa Odas\u0131",
    locationEn: "Yacht Main Deck and Vault Room",
    victim: {
      name: "Tar\u0131k Soydan",
      occupation: "Portf\xF6y Y\xF6neticisi",
      occupationEn: "Portfolio Manager",
      causeOfDeath: "Can Kayb\u0131 Yok",
      causeOfDeathEn: "No Casualties"
    },
    timeline: [
      { time: "23:00", event: "F\u0131rt\u0131na \u015Fiddetlendi, herkes kamaralara \xE7ekildi.", eventEn: "Storm intensified, everyone retreated to cabins.", verified: true },
      { time: "23:50", event: "G\xFCverte pompas\u0131 \xE7al\u0131\u015Ft\u0131r\u0131ld\u0131, kasa a\xE7\u0131ld\u0131.", eventEn: "Deck pump activated, vault opened.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Seyir defteri manip\xFCle edilmeye \xE7al\u0131\u015F\u0131lm\u0131\u015F.",
        "Kasa \u015Fifresiyle a\xE7\u0131lm\u0131\u015F."
      ],
      en: [
        "Attempt to manipulate the logbook.",
        "Vault opened with code."
      ]
    },
    culpritId: "suspect-melih",
    correctMethod: "F\u0131rt\u0131nada g\xFCverteye \xE7\u0131k\u0131p pompay\u0131 \xE7al\u0131\u015Ft\u0131rarak dikkat da\u011F\u0131tt\u0131, ard\u0131ndan kasay\u0131 a\xE7t\u0131.",
    correctMethodEn: "Went to deck in the storm, started the pump to distract, then opened the vault.",
    correctMotive: "Kolye ile yurtd\u0131\u015F\u0131na ka\xE7\u0131p bor\xE7lar\u0131n\u0131 \xF6demek.",
    correctMotiveEn: "To flee abroad with the necklace and pay off debts.",
    winningContradiction: {
      suspectId: "suspect-melih",
      sentenceId: "melih-s2",
      clueId: "clue-deck-pump-log"
    },
    analystSummary: {
      tr: "Analist Notu: \u015E\xFCpheli t\xFCm gece uyudu\u011Funu s\xF6yl\xFCyor fakat anahtar kart\u0131 gece yar\u0131s\u0131 g\xFCverte pompas\u0131n\u0131 \xE7al\u0131\u015Ft\u0131rmak i\xE7in kullan\u0131lm\u0131\u015F.",
      en: "Analyst Note: Suspect claims he slept all night, but his keycard was used to activate the deck pump at midnight."
    },
    suspects: [
      {
        id: "suspect-melih",
        name: "Melih Erdem",
        role: "Ortak & CFO",
        roleEn: "Partner & CFO",
        age: 48,
        temperament: "Kurnaz ve so\u011Fukkanl\u0131",
        temperamentEn: "Cunning and stoic",
        relationshipToVictim: "Tar\u0131k'\u0131n i\u015F orta\u011F\u0131.",
        relationshipToVictimEn: "Tar\u0131k's business partner.",
        statement: "F\u0131rt\u0131na y\xFCz\xFCnden midem buland\u0131, b\xFCt\xFCn gece yatt\u0131m.",
        statementEn: "I was seasick from the storm, lay in bed all night.",
        isCulprit: true,
        alibi: "Kamaras\u0131nda oldu\u011Funu iddia ediyor.",
        alibiEn: "Claims to be in his cabin.",
        motive: "\u015Eirketin paras\u0131n\u0131 bat\u0131rd\u0131\u011F\u0131 i\xE7in ka\xE7\u0131\u015F fonu.",
        motiveEn: "Escape fund because he sank the company's money.",
        minorSecret: "Yat\u0131n yak\u0131t b\xFCt\xE7esinden \xE7al\u0131yordu.",
        minorSecretEn: "Was stealing from the yacht's fuel budget.",
        breakThreshold: 85,
        gossip: {
          "suspect-burak": { tr: "Kaptan seyir defterini s\u0131k s\u0131k de\u011Fi\u015Ftirir.", en: "The captain frequently changes the logbook." },
          "suspect-canan": { tr: "Canan kolyeden nefret ederdi.", en: "Canan hated the necklace." }
        },
        behavioralCues: {
          calm: { tr: "Viskisini yudumluyor.", en: "Sipping his whiskey." },
          nervous: { tr: "Parmaklar\u0131yla ritim tutuyor.", en: "Tapping his fingers." },
          breaking: { tr: "Barda\u011F\u0131 yere f\u0131rlat\u0131yor.", en: "Throws his glass to the floor." }
        },
        lies: {
          level1: "Ben sadece uyudum.",
          level2: "G\xFCverteye hi\xE7 \xE7\u0131kmad\u0131m.",
          level3: "Kolyenin nerede oldu\u011Funu bilmiyorum!"
        },
        confession: "Evet, ben ald\u0131m! Tar\u0131k bizi bat\u0131rm\u0131\u015Ft\u0131!",
        confessionEn: "Yes, I took it! Tar\u0131k had ruined us!",
        detailedStatements: [
          { id: "melih-s1", text: "F\u0131rt\u0131na ba\u015Flay\u0131nca kamarama girdim.", textEn: "When the storm started, I went to my cabin.", isContradiction: false },
          { id: "melih-s2", text: "B\xFCt\xFCn gece kamaramda uyudum, g\xFCverteye hi\xE7 \xE7\u0131kmad\u0131m.", textEn: "I slept in my cabin all night, never went out on deck.", isContradiction: true, contradictionClueId: "clue-deck-pump-log", explanation: "G\xFCverte otomatik y\u0131kama pompas\u0131 23:50'de Melih'in anahtar kart\u0131yla \xE7al\u0131\u015Ft\u0131r\u0131lm\u0131\u015F.", explanationEn: "The deck automatic wash pump was activated at 23:50 with Melih's keycard." }
        ]
      },
      {
        id: "suspect-burak",
        name: "Kaptan Burak Reis",
        role: "Yat Kaptan\u0131",
        roleEn: "Yacht Captain",
        age: 52,
        temperament: "Otoriter ve ciddi",
        temperamentEn: "Authoritative and serious",
        relationshipToVictim: "Yat\u0131n kaptan\u0131.",
        relationshipToVictimEn: "Captain of the yacht.",
        statement: "B\xFCt\xFCn gece k\xF6pr\xFC \xFCst\xFCnde d\xFCmen tutuyordum.",
        statementEn: "I was at the helm on the bridge all night.",
        isCulprit: false,
        alibi: "K\xF6pr\xFC kamera kay\u0131tlar\u0131.",
        alibiEn: "Bridge camera records.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Gizlice i\xE7ki i\xE7iyordu.",
        minorSecretEn: "Was secretly drinking.",
        breakThreshold: 95,
        gossip: {
          "suspect-melih": { tr: "Melih Bey'in o gece kap\u0131s\u0131 kilitli de\u011Fildi.", en: "Mr. Melih's door wasn't locked that night." }
        },
        behavioralCues: {
          calm: { tr: "Pipo i\xE7iyor.", en: "Smoking his pipe." },
          nervous: { tr: "Sakallar\u0131n\u0131 s\u0131vazl\u0131yor.", en: "Stroking his beard." },
          breaking: { tr: "Sinirle ba\u011F\u0131r\u0131yor.", en: "Yelling angrily." }
        },
        lies: {
          level1: "Ben sadece gemiyi y\xF6netirim.",
          level2: "A\u015Fa\u011F\u0131ya inmedim.",
          level3: "Kolye umurumda de\u011Fil."
        },
        confession: "Masumum, ben sadece gemiyi kurtarmaya \xE7al\u0131\u015F\u0131yordum!",
        confessionEn: "I am innocent, I was just trying to save the ship!",
        detailedStatements: [
          { id: "burak-s1", text: "K\xF6pr\xFCdeydim.", textEn: "I was on the bridge.", isContradiction: false }
        ]
      },
      {
        id: "suspect-canan",
        name: "Canan Soydan",
        role: "Tar\u0131k'\u0131n E\u015Fi",
        roleEn: "Tar\u0131k's Wife",
        age: 38,
        temperament: "So\u011Fuk ve mesafeli",
        temperamentEn: "Cold and distant",
        relationshipToVictim: "Tar\u0131k'\u0131n e\u015Fi.",
        relationshipToVictimEn: "Tar\u0131k's wife.",
        statement: "Kocamla salonda oturduk.",
        statementEn: "I sat in the lounge with my husband.",
        isCulprit: false,
        alibi: "Kocas\u0131yla birlikteydi.",
        alibiEn: "Was with her husband.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Gizli bir hesab\u0131 vard\u0131.",
        minorSecretEn: "Had a secret bank account.",
        breakThreshold: 93,
        gossip: {
          "suspect-melih": { tr: "Melih \xE7ok parag\xF6z biridir.", en: "Melih is a very greedy person." }
        },
        behavioralCues: {
          calm: { tr: "Kitap okuyor.", en: "Reading a book." },
          nervous: { tr: "Y\xFCz\xFC\u011F\xFCn\xFC \xE7eviriyor.", en: "Spinning her ring." },
          breaking: { tr: "A\u011Flamaya ba\u015Fl\u0131yor.", en: "Starts crying." }
        },
        lies: {
          level1: "Kocamlayd\u0131m.",
          level2: "Ben yapmad\u0131m.",
          level3: "Kolyeyi ben \xE7almad\u0131m."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "canan-s1", text: "Tar\u0131k ile birlikteydik.", textEn: "I was with Tar\u0131k.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-deck-pump-log",
        label: "G\xFCverte Pompas\u0131 Logu",
        labelEn: "Deck Pump Log",
        category: "digital",
        type: "digital",
        contradictsSuspectId: "suspect-melih",
        detail: "G\xFCverte otomatik y\u0131kama pompas\u0131 23:50'de Melih'in anahtar kart\u0131yla \xE7al\u0131\u015Ft\u0131r\u0131lm\u0131\u015F.",
        detailEn: "The deck automatic wash pump was activated at 23:50 with Melih's keycard.",
        significance: "Melih'in g\xFCverteye \xE7\u0131kt\u0131\u011F\u0131n\u0131 kan\u0131tlar.",
        significanceEn: "Proves Melih went on deck."
      },
      {
        id: "clue-11-bridge-cam",
        label: "K\xF6pr\xFC Kameras\u0131",
        labelEn: "Bridge Camera",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-burak",
        detail: "Kaptan k\xF6pr\xFCden hi\xE7 ayr\u0131lmad\u0131.",
        detailEn: "Captain never left the bridge.",
        significance: "Burak Reis'i temize \xE7\u0131kar\u0131r.",
        significanceEn: "Clears Captain Burak."
      },
      {
        id: "clue-11-witness",
        label: "Koca \u0130fadesi",
        labelEn: "Husband Statement",
        category: "witness",
        type: "alibi",
        clearsSuspectId: "suspect-canan",
        detail: "Tar\u0131k Soydan e\u015Finin t\xFCm gece yan\u0131nda oldu\u011Funu do\u011Frulad\u0131.",
        detailEn: "Tar\u0131k Soydan confirmed his wife was with him all night.",
        significance: "Canan'\u0131 temize \xE7\u0131kar\u0131r.",
        significanceEn: "Clears Canan."
      }
    ]
  },
  // Case 12
  {
    id: "case-12-kapadokya-balon",
    title: "Kapadokya Balonunda \u0130rtifa Vanas\u0131 Sabotaj\u0131",
    titleEn: "Altitude Valve Sabotage on the Cappadocia Balloon",
    difficulty: "normal",
    briefing: "Turizm Heyeti Ba\u015Fkan\u0131 Haldun Kaya'n\u0131n bulundu\u011Fu b\xF6lmenin mekanik emniyet kilidi a\xE7\u0131ld\u0131 ve sabotaj yap\u0131ld\u0131.",
    briefingEn: "The mechanical safety lock of the compartment where Tourism Board President Haldun Kaya was located was opened and sabotaged.",
    incidentTime: "06:15",
    location: "Kapadokya Hava Sahas\u0131",
    locationEn: "Cappadocia Airspace",
    victim: {
      name: "Haldun Kaya",
      occupation: "Turizm Heyeti Ba\u015Fkan\u0131",
      occupationEn: "Tourism Board President",
      causeOfDeath: "Ara\xE7 Hasar\u0131 (Sabotaj)",
      causeOfDeathEn: "Vehicle Damage (Sabotage)"
    },
    timeline: [
      { time: "05:30", event: "Balon havaland\u0131.", eventEn: "Balloon took off.", verified: true },
      { time: "06:15", event: "Emniyet kilidi a\xE7\u0131ld\u0131.", eventEn: "Safety lock was opened.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Kilit vidas\u0131nda zorlama izleri.",
        "Mekanizma elle m\xFCdahale ile gev\u015Fetilmi\u015F."
      ],
      en: [
        "Pry marks on the lock screw.",
        "Mechanism manually loosened."
      ]
    },
    culpritId: "suspect-mehmet",
    correctMethod: "Haldun Bey'in bulundu\u011Fu b\xF6lmenin mekanik emniyet kilidini karga burnu aletiyle gev\u015Fetti.",
    correctMethodEn: "Loosened the mechanical safety lock of Haldun's compartment using needle-nose pliers.",
    correctMotive: "Ba\u015Fkan\u0131n yeni u\xE7u\u015F lisans kurallar\u0131n\u0131 engellemesi.",
    correctMotiveEn: "To stop the president from imposing new flight license rules.",
    winningContradiction: {
      suspectId: "suspect-mehmet",
      sentenceId: "mehmet-s2",
      clueId: "clue-pliers-mark"
    },
    analystSummary: {
      tr: "Analist Notu: Pilot, yolcunun kemeri kendisinin a\xE7t\u0131\u011F\u0131n\u0131 s\xF6yl\xFCyor, fakat kilit \xFCzerinde alet izleri var.",
      en: "Analyst Note: Pilot claims the passenger unbuckled himself, but there are tool marks on the lock."
    },
    suspects: [
      {
        id: "suspect-mehmet",
        name: "Mehmet Usta",
        role: "K\u0131demli Balon Pilotu",
        roleEn: "Senior Balloon Pilot",
        age: 46,
        temperament: "Otoriter ve sinirli",
        temperamentEn: "Authoritative and angry",
        relationshipToVictim: "U\xE7u\u015Fu ger\xE7ekle\u015Ftiren pilot.",
        relationshipToVictimEn: "Pilot conducting the flight.",
        statement: "Haldun Bey panikleyip mandal\u0131 kendi a\xE7t\u0131.",
        statementEn: "Haldun panicked and opened the latch himself.",
        isCulprit: true,
        alibi: "Sepette g\xF6rev ba\u015F\u0131ndayd\u0131.",
        alibiEn: "Was on duty in the basket.",
        motive: "Lisans yenileme sorunlar\u0131.",
        motiveEn: "License renewal issues.",
        minorSecret: "G\xF6rme bozuklu\u011Fu vard\u0131.",
        minorSecretEn: "Had vision impairment.",
        breakThreshold: 83,
        gossip: {
          "suspect-gokhan": { tr: "G\xF6khan Bey u\xE7u\u015F \xF6ncesi bizim balona \xE7ok yakla\u015Ft\u0131.", en: "G\xF6khan got very close to our balloon pre-flight." }
        },
        behavioralCues: {
          calm: { tr: "Eldivenini d\xFCzeltiyor.", en: "Adjusts his glove." },
          nervous: { tr: "Burnunu \xE7ekiyor.", en: "Sniffles." },
          breaking: { tr: "Ba\u011F\u0131rarak inkar ediyor.", en: "Loudly denies." }
        },
        lies: {
          level1: "Ben sadece pilotum.",
          level2: "Haldun Bey kendi yapt\u0131.",
          level3: "Benim aletle i\u015Fim olmaz!"
        },
        confession: "Bizi i\u015Fimizden edecekti! Kilidi gev\u015Fettim, evet!",
        confessionEn: "He was going to put us out of business! I loosened the lock, yes!",
        detailedStatements: [
          { id: "mehmet-s1", text: "U\xE7u\u015F normal seyrindeydi.", textEn: "The flight was proceeding normally.", isContradiction: false },
          { id: "mehmet-s2", text: "Haldun Bey kemer mandal\u0131n\u0131 kendi eliyle a\xE7t\u0131.", textEn: "Mr. Haldun unbuckled the belt latch with his own hand.", isContradiction: true, contradictionClueId: "clue-pliers-mark", explanation: "Kilit vidas\u0131nda karga burnu aletiyle yap\u0131lm\u0131\u015F derin \xE7izikler bulundu.", explanationEn: "Deep scratches made by needle-nose pliers were found on the lock screw." }
        ]
      },
      {
        id: "suspect-gokhan",
        name: "G\xF6khan Varol",
        role: "Rakip \u015Eirket Sahibi",
        roleEn: "Rival Company Owner",
        age: 50,
        temperament: "Kibirli",
        temperamentEn: "Arrogant",
        relationshipToVictim: "Sekt\xF6rdeki rakibi.",
        relationshipToVictimEn: "Rival in the industry.",
        statement: "Kendi balonumdayd\u0131m.",
        statementEn: "I was in my own balloon.",
        isCulprit: false,
        alibi: "Kendi balonunun GPS ve kamera kay\u0131tlar\u0131.",
        alibiEn: "GPS and camera records of his own balloon.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Vergi ka\xE7\u0131r\u0131yordu.",
        minorSecretEn: "Was evading taxes.",
        breakThreshold: 92,
        gossip: {
          "suspect-mehmet": { tr: "Mehmet \xE7ok agresif bir pilot.", en: "Mehmet is a very aggressive pilot." }
        },
        behavioralCues: {
          calm: { tr: "G\xFCl\xFCmseyerek poz veriyor.", en: "Posing with a smile." },
          nervous: { tr: "G\xF6zl\xFC\u011F\xFCn\xFC siliyor.", en: "Cleaning his glasses." },
          breaking: { tr: "A\u011Flamaya ba\u015Fl\u0131yor.", en: "Starts crying." }
        },
        lies: {
          level1: "Benimle ilgisi yok.",
          level2: "Onlar\u0131n balonuna yakla\u015Fmad\u0131m.",
          level3: "Masumum."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "gokhan-s1", text: "Olay s\u0131ras\u0131nda havada kendi balonumdayd\u0131m.", textEn: "I was in the air in my own balloon during the incident.", isContradiction: false }
        ]
      },
      {
        id: "suspect-derya",
        name: "Derya Ak\u0131n",
        role: "Yer Ekibi \u015Eefi",
        roleEn: "Ground Crew Chief",
        age: 28,
        temperament: "Tela\u015Fl\u0131",
        temperamentEn: "Frantic",
        relationshipToVictim: "U\xE7u\u015F koordinat\xF6r\xFC.",
        relationshipToVictimEn: "Flight coordinator.",
        statement: "Yerde ekipmanlar\u0131 topluyordum.",
        statementEn: "I was gathering equipment on the ground.",
        isCulprit: false,
        alibi: "Yer ekibiyle birlikteydi.",
        alibiEn: "Was with the ground crew.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Ge\xE7 kalm\u0131\u015Ft\u0131.",
        minorSecretEn: "Was late.",
        breakThreshold: 95,
        gossip: {
          "suspect-mehmet": { tr: "Mehmet Usta \xE7ok k\u0131zg\u0131nd\u0131.", en: "Mehmet was very angry." }
        },
        behavioralCues: {
          calm: { tr: "Telsizi tutuyor.", en: "Holding the radio." },
          nervous: { tr: "T\u0131rnaklar\u0131n\u0131 yiyor.", en: "Biting her nails." },
          breaking: { tr: "Diz \xE7\xF6k\xFCp a\u011Fl\u0131yor.", en: "Kneels down and cries." }
        },
        lies: {
          level1: "Ben yer ekibindeyim.",
          level2: "Balona binmedim.",
          level3: "Kilitle i\u015Fim olmaz."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "derya-s1", text: "Yerde ekiple beraberdim.", textEn: "I was with the team on the ground.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-pliers-mark",
        label: "Kilit Vidas\u0131ndaki \u0130zler",
        labelEn: "Marks on Lock Screw",
        category: "forensic",
        type: "forensic",
        contradictsSuspectId: "suspect-mehmet",
        detail: "Kilit vidas\u0131nda karga burnu aletiyle yap\u0131lm\u0131\u015F derin \xE7izikler tespit edildi.",
        detailEn: "Deep scratches made by needle-nose pliers were detected on the lock screw.",
        significance: "Kilidin mekanik olarak zorland\u0131\u011F\u0131n\u0131 kan\u0131tlar.",
        significanceEn: "Proves the lock was mechanically forced."
      },
      {
        id: "clue-12-gokhan-gps",
        label: "GPS ve Kamera",
        labelEn: "GPS and Camera",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-gokhan",
        detail: "G\xF6khan'\u0131n kendi balonunda oldu\u011Fu tespit edildi.",
        detailEn: "Confirmed G\xF6khan was in his own balloon.",
        significance: "G\xF6khan'\u0131 temize \xE7\u0131kar\u0131r.",
        significanceEn: "Clears G\xF6khan."
      },
      {
        id: "clue-12-ground",
        label: "Yer Ekibi Tutanak",
        labelEn: "Ground Crew Log",
        category: "witness",
        type: "alibi",
        clearsSuspectId: "suspect-derya",
        detail: "Derya'n\u0131n yer ekibiyle t\xFCm zaman\u0131 ge\xE7irdi\u011Fi onayland\u0131.",
        detailEn: "Confirmed Derya spent the entire time with the ground crew.",
        significance: "Derya'y\u0131 temize \xE7\u0131kar\u0131r.",
        significanceEn: "Clears Derya."
      }
    ]
  },
  // Case 13
  {
    id: "case-13-gobeklitepe-muhur",
    title: "G\xF6beklitepe Kaz\u0131s\u0131nda \xC7al\u0131nan M\xFCh\xFCr",
    titleEn: "Stolen Seal at the G\xF6beklitepe Excavation",
    difficulty: "hard",
    briefing: "Prof. Dr. Demir Karahan'\u0131n kaz\u0131 ba\u015Fkanl\u0131\u011F\u0131n\u0131 yapt\u0131\u011F\u0131 G\xF6beklitepe'deki \xE7ad\u0131rdan orijinal Neolitik silindir m\xFCh\xFCr \xE7al\u0131n\u0131p yerine al\xE7\u0131 kopyas\u0131 kondu.",
    briefingEn: "An original Neolithic cylinder seal was stolen from the tent at G\xF6beklitepe directed by Prof. Dr. Demir Karahan and replaced with a plaster copy.",
    incidentTime: "01:30",
    location: "Ana Kaz\u0131 \xC7ad\u0131r\u0131",
    locationEn: "Main Excavation Tent",
    victim: {
      name: "Prof. Dr. Demir Karahan",
      occupation: "Kaz\u0131 Heyeti Ba\u015Fkan\u0131",
      occupationEn: "Head of Excavation",
      causeOfDeath: "Tarihi Eser \xC7al\u0131nmas\u0131",
      causeOfDeathEn: "Stolen Artifact"
    },
    timeline: [
      { time: "23:00", event: "\xC7ad\u0131r kilitlendi.", eventEn: "Tent was locked.", verified: true },
      { time: "01:30", event: "M\xFCh\xFCr \xE7al\u0131nd\u0131.", eventEn: "Seal was stolen.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "M\xFCh\xFCr kopyas\u0131 m\xFCkemmel bir \u015Fekilde yerle\u015Ftirilmi\u015F.",
        "Sens\xF6rler atlat\u0131lm\u0131\u015F."
      ],
      en: [
        "Seal copy placed perfectly.",
        "Sensors bypassed."
      ]
    },
    culpritId: "suspect-sinan",
    correctMethod: "Orijinal Neolitik silindir m\xFChr\xFC \xE7al\u0131p yerine al\xE7\u0131 kopyas\u0131n\u0131 b\u0131rakt\u0131.",
    correctMethodEn: "Stole the original Neolithic cylinder seal and left a plaster copy.",
    correctMotive: "Ka\xE7ak\xE7\u0131lara satmak.",
    correctMotiveEn: "To sell to smugglers.",
    winningContradiction: {
      suspectId: "suspect-sinan",
      sentenceId: "sinan-s2",
      clueId: "clue-laptop-power-log"
    },
    analystSummary: {
      tr: "Analist Notu: \u015E\xFCpheli t\xFCm gece bilgisayarda \xE7al\u0131\u015Ft\u0131\u011F\u0131n\u0131 s\xF6yl\xFCyor ancak batarya loglar\u0131 bilgisayar\u0131n o saatlerde kapal\u0131 oldu\u011Funu g\xF6steriyor.",
      en: "Analyst Note: Suspect claims to be working on his laptop all night, but battery logs show it was off during those hours."
    },
    suspects: [
      {
        id: "suspect-sinan",
        name: "Sinan Bilgin",
        role: "Saha Jeolo\u011Fu",
        roleEn: "Field Geologist",
        age: 37,
        temperament: "Kurnaz ve sessiz",
        temperamentEn: "Cunning and quiet",
        relationshipToVictim: "Kaz\u0131 ekibi \xFCyesi.",
        relationshipToVictimEn: "Excavation team member.",
        statement: "Gece boyu \xE7ad\u0131r\u0131mda bilgisayarda \xE7al\u0131\u015Ft\u0131m.",
        statementEn: "I worked on my laptop in my tent all night.",
        isCulprit: true,
        alibi: "\xC7ad\u0131r\u0131nda \xE7al\u0131\u015Ft\u0131\u011F\u0131n\u0131 iddia ediyor.",
        alibiEn: "Claims to be working in his tent.",
        motive: "Tarihi eser sat\u0131\u015F\u0131.",
        motiveEn: "Selling antiquities.",
        minorSecret: "Buluntular\u0131n kopyalar\u0131n\u0131 yap\u0131yordu.",
        minorSecretEn: "Was making copies of the finds.",
        breakThreshold: 85,
        gossip: {
          "suspect-zeynep": { tr: "Zeynep eserleri \xE7ok iyi inceler.", en: "Zeynep examines the artifacts very well." }
        },
        behavioralCues: {
          calm: { tr: "G\xF6zl\xFC\u011F\xFCn\xFC siliyor.", en: "Cleaning his glasses." },
          nervous: { tr: "Ellerini o\u011Fu\u015Fturuyor.", en: "Rubbing his hands." },
          breaking: { tr: "Bilgisayar\u0131 kapat\u0131yor.", en: "Shuts the laptop." }
        },
        lies: {
          level1: "Ben sadece jeolo\u011Fum.",
          level2: "Kopyalamakla i\u015Fim olmaz.",
          level3: "T\xFCm gece uyan\u0131kt\u0131m!"
        },
        confession: "Evet, o m\xFCh\xFCr benim gelece\u011Fimdi!",
        confessionEn: "Yes, that seal was my future!",
        detailedStatements: [
          { id: "sinan-s1", text: "Ak\u015Fam yeme\u011Finden sonra \xE7ad\u0131r\u0131ma \xE7ekildim.", textEn: "Retired to my tent after dinner.", isContradiction: false },
          { id: "sinan-s2", text: "Gece boyu \xE7ad\u0131r\u0131mda diz\xFCst\xFC bilgisayarda jeoradar verisi i\u015Fledim.", textEn: "I processed GPR data on my laptop in my tent all night.", isContradiction: true, contradictionClueId: "clue-laptop-power-log", explanation: "Bilgisayar\u0131n sistem loglar\u0131 23:30 - 02:15 aras\u0131 tamamen kapal\u0131 oldu\u011Funu g\xF6steriyor.", explanationEn: "System logs show the laptop was completely off from 23:30 to 02:15." }
        ]
      },
      {
        id: "suspect-zeynep",
        name: "Dr. Zeynep Ate\u015F",
        role: "Restorat\xF6r",
        roleEn: "Restorer",
        age: 41,
        temperament: "Ciddi",
        temperamentEn: "Serious",
        relationshipToVictim: "Kaz\u0131n\u0131n restorat\xF6r\xFC.",
        relationshipToVictimEn: "Restorer of the excavation.",
        statement: "Uyuyordum.",
        statementEn: "I was sleeping.",
        isCulprit: false,
        alibi: "\xC7ad\u0131r arkada\u015F\u0131 onayl\u0131yor.",
        alibiEn: "Tentmate confirms.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Ekipman b\xFCt\xE7esinden \xE7al\u0131yordu.",
        minorSecretEn: "Was stealing from the equipment budget.",
        breakThreshold: 94,
        gossip: {
          "suspect-sinan": { tr: "Sinan'\u0131n \xE7ad\u0131r\u0131ndan gece sesler geliyordu.", en: "Noises came from Sinan's tent at night." }
        },
        behavioralCues: {
          calm: { tr: "Notlar\u0131na bak\u0131yor.", en: "Looking at her notes." },
          nervous: { tr: "F\u0131r\xE7as\u0131yla oynuyor.", en: "Playing with her brush." },
          breaking: { tr: "A\u011Fl\u0131yor.", en: "Crying." }
        },
        lies: {
          level1: "Ben eserleri korurum.",
          level2: "M\xFCh\xFCr\xFC \xE7almad\u0131m.",
          level3: "Ben masumum."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "zeynep-s1", text: "T\xFCm gece uyudum.", textEn: "I slept all night.", isContradiction: false }
        ]
      },
      {
        id: "suspect-numan",
        name: "Numan \xC7avu\u015F",
        role: "Gece Bek\xE7isi",
        roleEn: "Night Watchman",
        age: 55,
        temperament: "Sakin",
        temperamentEn: "Calm",
        relationshipToVictim: "Bek\xE7i.",
        relationshipToVictimEn: "Guard.",
        statement: "N\xF6bet kul\xFCbesindeydim.",
        statementEn: "I was in the guardhouse.",
        isCulprit: false,
        alibi: "G\xFCvenlik kameralar\u0131.",
        alibiEn: "Security cameras.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "N\xF6bette uyuyordu.",
        minorSecretEn: "Slept on duty.",
        breakThreshold: 92,
        gossip: {
          "suspect-sinan": { tr: "Sinan \xE7ok garip davran\u0131yordu.", en: "Sinan was acting very weird." }
        },
        behavioralCues: {
          calm: { tr: "El fenerini tutuyor.", en: "Holding his flashlight." },
          nervous: { tr: "B\u0131y\u0131\u011F\u0131n\u0131 buruyor.", en: "Twirling his mustache." },
          breaking: { tr: "Diz \xE7\xF6k\xFCyor.", en: "Kneels down." }
        },
        lies: {
          level1: "Hep uyan\u0131kt\u0131m.",
          level2: "\xC7ad\u0131r\u0131 korudum.",
          level3: "Ben \xE7almad\u0131m."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "numan-s1", text: "N\xF6betteydim.", textEn: "I was on duty.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-laptop-power-log",
        label: "Diz\xFCst\xFC Bilgisayar G\xFC\xE7 Logu",
        labelEn: "Laptop Power Log",
        category: "digital",
        type: "digital",
        contradictsSuspectId: "suspect-sinan",
        detail: "Bilgisayar 23:30 ile 02:15 aras\u0131nda kapal\u0131yd\u0131.",
        detailEn: "Laptop was completely shut down between 23:30 and 02:15.",
        significance: "Sinan'\u0131n yalan\u0131n\u0131 kan\u0131tlar.",
        significanceEn: "Proves Sinan's lie."
      },
      {
        id: "clue-13-zeynep-alibi",
        label: "\xC7ad\u0131r Arkada\u015F\u0131 \u0130fadesi",
        labelEn: "Tentmate Statement",
        category: "witness",
        type: "alibi",
        clearsSuspectId: "suspect-zeynep",
        detail: "Zeynep'in gece boyunca uyudu\u011Fu onayland\u0131.",
        detailEn: "Confirmed Zeynep slept through the night.",
        significance: "Zeynep'i temize \xE7\u0131kar\u0131r.",
        significanceEn: "Clears Zeynep."
      },
      {
        id: "clue-13-numan-cam",
        label: "G\xFCvenlik Kameras\u0131",
        labelEn: "Security Camera",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-numan",
        detail: "Numan n\xF6bet yerinden ayr\u0131lmad\u0131.",
        detailEn: "Numan didn't leave his post.",
        significance: "Numan'\u0131 temize \xE7\u0131kar\u0131r.",
        significanceEn: "Clears Numan."
      }
    ]
  },
  // Case 14
  {
    id: "case-14-f1-sabotaj",
    title: "Formula 1 Padokunda Telemetri Sabotaj\u0131",
    titleEn: "Telemetry Sabotage at the Formula 1 Paddock",
    difficulty: "normal",
    briefing: "F1 ba\u015F yar\u0131\u015F pilotu Lucas Rossi'nin arac\u0131n\u0131n ECU fren bas\u0131n\xE7 limiti telemetri terminalinden hileyle d\xFC\u015F\xFCr\xFCld\xFC.",
    briefingEn: "F1 lead driver Lucas Rossi's car ECU brake pressure limit was fraudulently lowered from the telemetry terminal.",
    incidentTime: "22:28",
    location: "Tak\u0131m Garaj\u0131",
    locationEn: "Team Garage",
    victim: {
      name: "Lucas Rossi",
      occupation: "Ba\u015F Yar\u0131\u015F Pilotu",
      occupationEn: "Lead Race Driver",
      causeOfDeath: "Ara\xE7 Sabotaj\u0131",
      causeOfDeathEn: "Car Sabotage"
    },
    timeline: [
      { time: "22:00", event: "Garaj kapand\u0131.", eventEn: "Garage closed.", verified: true },
      { time: "22:28", event: "ECU limitleri de\u011Fi\u015Ftirildi.", eventEn: "ECU limits changed.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Sistem loglar\u0131nda yetkisiz eri\u015Fim izi.",
        "A\u011F kablolar\u0131nda m\xFCdahale yok."
      ],
      en: [
        "Unauthorized access trace in system logs.",
        "No tampering with network cables."
      ]
    },
    culpritId: "suspect-hans",
    correctMethod: "Telemetri terminalinden ECU fren bas\u0131n\xE7 limitini hileyle d\xFC\u015F\xFCrd\xFC.",
    correctMethodEn: "Fraudulently lowered the ECU brake pressure limit from the telemetry terminal.",
    correctMotive: "Rakip tak\u0131mdan r\xFC\u015Fvet almak.",
    correctMotiveEn: "To take a bribe from the rival team.",
    winningContradiction: {
      suspectId: "suspect-hans",
      sentenceId: "hans-s2",
      clueId: "clue-ecu-telemetry-log"
    },
    analystSummary: {
      tr: "Analist Notu: M\xFChendis sisteme dokunmad\u0131\u011F\u0131n\u0131 s\xF6yl\xFCyor ancak kendi kriptografik anahtar\u0131yla girilmi\u015F bypass logu mevcut.",
      en: "Analyst Note: Engineer claims he didn't touch the system, but there is a bypass log entered with his cryptographic key."
    },
    suspects: [
      {
        id: "suspect-hans",
        name: "Hans Weber",
        role: "Ba\u015F Yar\u0131\u015F M\xFChendisi",
        roleEn: "Chief Race Engineer",
        age: 45,
        temperament: "So\u011Fukkanl\u0131 ve disiplinli",
        temperamentEn: "Stoic and disciplined",
        relationshipToVictim: "Pilotun ba\u015F m\xFChendisi.",
        relationshipToVictimEn: "Driver's chief engineer.",
        statement: "Odamdayd\u0131m, araca hi\xE7 dokunmad\u0131m.",
        statementEn: "I was in my room, never touched the car.",
        isCulprit: true,
        alibi: "Odas\u0131nda oldu\u011Funu iddia ediyor.",
        alibiEn: "Claims to be in his room.",
        motive: "B\xFCy\xFCk miktarda r\xFC\u015Fvet.",
        motiveEn: "Large bribe.",
        minorSecret: "Rakip tak\u0131mla anla\u015Ft\u0131.",
        minorSecretEn: "Agreed with the rival team.",
        breakThreshold: 85,
        gossip: {
          "suspect-arda": { tr: "Arda 1. pilot olmak istiyor.", en: "Arda wants to be the 1st driver." }
        },
        behavioralCues: {
          calm: { tr: "Kulakl\u0131\u011F\u0131n\u0131 d\xFCzeltiyor.", en: "Adjusts his headset." },
          nervous: { tr: "Saatini kontrol ediyor.", en: "Checks his watch." },
          breaking: { tr: "Masaya vuruyor.", en: "Hits the table." }
        },
        lies: {
          level1: "Ben sadece veri okurum.",
          level2: "Frenlere dokunmad\u0131m.",
          level3: "Sisteme giri\u015F yapmad\u0131m!"
        },
        confession: "Evet ben yapt\u0131m, bana hak etti\u011Fimi vermediler!",
        confessionEn: "Yes I did it, they didn't give me what I deserved!",
        detailedStatements: [
          { id: "hans-s1", text: "Toplant\u0131dan sonra odama ge\xE7tim.", textEn: "Went to my room after the meeting.", isContradiction: false },
          { id: "hans-s2", text: "B\xFCt\xFCn gece araca veya sisteme hi\xE7 dokunmad\u0131m, odamdayd\u0131m.", textEn: "I didn't touch the car or system all night, I was in my room.", isContradiction: true, contradictionClueId: "clue-ecu-telemetry-log", explanation: "Hans'\u0131n kriptografik anahtar\u0131yla 22:28'de ECU fren bypass logu sisteme girilmi\u015F.", explanationEn: "An ECU brake bypass log was entered into the system at 22:28 with Hans's cryptographic key." }
        ]
      },
      {
        id: "suspect-arda",
        name: "Arda Tan",
        role: "2. Pilot",
        roleEn: "2nd Driver",
        age: 24,
        temperament: "Heyecanl\u0131",
        temperamentEn: "Excited",
        relationshipToVictim: "Tak\u0131m arkada\u015F\u0131.",
        relationshipToVictimEn: "Teammate.",
        statement: "Antrenmandayd\u0131m.",
        statementEn: "I was at training.",
        isCulprit: false,
        alibi: "Antren\xF6r onayl\u0131yor.",
        alibiEn: "Trainer confirms.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Sim\xFClat\xF6rde \xE7ok kaza yap\u0131yordu.",
        minorSecretEn: "Crashed a lot in the simulator.",
        breakThreshold: 93,
        gossip: {
          "suspect-hans": { tr: "Hans her zaman Lucas'\u0131 kay\u0131r\u0131r.", en: "Hans always favors Lucas." }
        },
        behavioralCues: {
          calm: { tr: "Kask\u0131n\u0131 tutuyor.", en: "Holding his helmet." },
          nervous: { tr: "Baca\u011F\u0131n\u0131 sall\u0131yor.", en: "Shaking his leg." },
          breaking: { tr: "Ba\u011F\u0131r\u0131yor.", en: "Shouting." }
        },
        lies: {
          level1: "Ben arac\u0131 sadece s\xFCrerim.",
          level2: "Sabotajla i\u015Fim olmaz.",
          level3: "Masumum."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "arda-s1", text: "Antrenmandayd\u0131m.", textEn: "I was at training.", isContradiction: false }
        ]
      },
      {
        id: "suspect-marco",
        name: "Marco Vieri",
        role: "Pit \u015Eefi",
        roleEn: "Pit Chief",
        age: 50,
        temperament: "Sakin",
        temperamentEn: "Calm",
        relationshipToVictim: "Pit sorumlusu.",
        relationshipToVictimEn: "Pit manager.",
        statement: "Aletleri temizliyordum.",
        statementEn: "I was cleaning the tools.",
        isCulprit: false,
        alibi: "Pit kameralar\u0131 onayl\u0131yor.",
        alibiEn: "Pit cameras confirm.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Lastik bas\u0131n\xE7lar\u0131nda hile yap\u0131yordu.",
        minorSecretEn: "Cheated on tire pressures.",
        breakThreshold: 96,
        gossip: {
          "suspect-hans": { tr: "Hans'\u0131n \u015Fifreleri herkesten gizli.", en: "Hans's passwords are hidden from everyone." }
        },
        behavioralCues: {
          calm: { tr: "Matkab\u0131n\u0131 siliyor.", en: "Cleaning his drill." },
          nervous: { tr: "Terini siliyor.", en: "Wiping his sweat." },
          breaking: { tr: "Diz \xE7\xF6k\xFCyor.", en: "Kneels down." }
        },
        lies: {
          level1: "Sadece lastiklerle ilgilenirim.",
          level2: "Elektronikten anlamam.",
          level3: "Ben masumum."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "marco-s1", text: "Garaj \xF6n\xFCndeydim.", textEn: "I was in front of the garage.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-ecu-telemetry-log",
        label: "ECU Telemetri Logu",
        labelEn: "ECU Telemetry Log",
        category: "digital",
        type: "digital",
        contradictsSuspectId: "suspect-hans",
        detail: "Sistemde Hans'\u0131n \xF6zel kriptografik anahtar\u0131yla saat 22:28'de girilen yetkisiz ECU bypass komutu tespit edildi.",
        detailEn: "Unauthorized ECU bypass command entered at 22:28 with Hans's private cryptographic key was detected in the system.",
        significance: "Hans'\u0131n araca d\u0131\u015Far\u0131dan m\xFCdahale etti\u011Fini kan\u0131tlar.",
        significanceEn: "Proves Hans tampered with the car externally."
      },
      {
        id: "clue-14-arda-trainer",
        label: "Antren\xF6r Raporu",
        labelEn: "Trainer Report",
        category: "document",
        type: "alibi",
        clearsSuspectId: "suspect-arda",
        detail: "Arda t\xFCm gece sim\xFClat\xF6rde e\u011Fitimdeydi.",
        detailEn: "Arda was in simulator training all night.",
        significance: "Arda'y\u0131 temize \xE7\u0131kar\u0131r.",
        significanceEn: "Clears Arda."
      },
      {
        id: "clue-14-marco-cam",
        label: "Pit Kameras\u0131",
        labelEn: "Pit Camera",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-marco",
        detail: "Marco garaj d\u0131\u015F\u0131ndan hi\xE7 ayr\u0131lmad\u0131.",
        detailEn: "Marco never left the front of the garage.",
        significance: "Marco'yu temize \xE7\u0131kar\u0131r.",
        significanceEn: "Clears Marco."
      }
    ]
  },
  // Case 15
  {
    id: "case-15-gurme-mutfak",
    title: "Michelin Y\u0131ld\u0131zl\u0131 Mutfakta Gizli Tarif H\u0131rs\u0131zl\u0131\u011F\u0131",
    titleEn: "Secret Recipe Theft in the Michelin Starred Kitchen",
    difficulty: "normal",
    briefing: "3 Y\u0131ld\u0131zl\u0131 \u015Eef Julien Laurent'in gizli imza men\xFC tarif defteri \xE7al\u0131nd\u0131.",
    briefingEn: "3 Star Chef Julien Laurent's secret signature menu recipe book was stolen.",
    incidentTime: "23:45",
    location: "\u015Eefin \xD6zel Tad\u0131m Odas\u0131",
    locationEn: "Chef's Private Tasting Room",
    victim: {
      name: "Julien Laurent",
      occupation: "3 Y\u0131ld\u0131zl\u0131 \u015Eef",
      occupationEn: "3 Star Chef",
      causeOfDeath: "Tarif H\u0131rs\u0131zl\u0131\u011F\u0131",
      causeOfDeathEn: "Recipe Theft"
    },
    timeline: [
      { time: "23:00", event: "Restoran kapand\u0131.", eventEn: "Restaurant closed.", verified: true },
      { time: "23:45", event: "Tarif defteri \xE7al\u0131nd\u0131.", eventEn: "Recipe book stolen.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Tad\u0131m masas\u0131nda renkli bir iplik.",
        "Kasa \u015Fifresiyle a\xE7\u0131lm\u0131\u015F."
      ],
      en: [
        "Colored thread on the tasting table.",
        "Vault opened with code."
      ]
    },
    culpritId: "suspect-emre",
    correctMethod: "\u015Eefin \xF6zel tad\u0131m masas\u0131na gizlice girip tarif defterini \xE7ald\u0131.",
    correctMethodEn: "Secretly entered the chef's private tasting table and stole the recipe book.",
    correctMotive: "Rakip gruba satmak.",
    correctMotiveEn: "To sell to a rival group.",
    winningContradiction: {
      suspectId: "suspect-emre",
      sentenceId: "emre-s2",
      clueId: "clue-apron-thread"
    },
    analystSummary: {
      tr: "Analist Notu: \u015E\xFCpheli, masaya hi\xE7 yakla\u015Fmad\u0131\u011F\u0131n\u0131 iddia etse de masada onun \xF6nl\xFC\u011F\xFCne ait mercan renkli iplik bulundu.",
      en: "Analyst Note: Suspect claims he never approached the table, but a coral colored thread from his apron was found on it."
    },
    suspects: [
      {
        id: "suspect-emre",
        name: "Emre Y\u0131lmaz",
        role: "Sous Chef",
        roleEn: "Sous Chef",
        age: 32,
        temperament: "H\u0131rsl\u0131 ve kurnaz",
        temperamentEn: "Ambitious and cunning",
        relationshipToVictim: "\u015Eefin yard\u0131mc\u0131s\u0131.",
        relationshipToVictimEn: "Chef's assistant.",
        statement: "Odan\u0131n yan\u0131na bile yakla\u015Fmad\u0131m.",
        statementEn: "I didn't even go near the room.",
        isCulprit: true,
        alibi: "Mutfakta temizlik yapt\u0131\u011F\u0131n\u0131 iddia ediyor.",
        alibiEn: "Claims to be cleaning in the kitchen.",
        motive: "B\xFCy\xFCk para \xF6d\xFCl\xFC.",
        motiveEn: "Large monetary reward.",
        minorSecret: "Tariflerin baz\u0131lar\u0131n\u0131 kopyalam\u0131\u015Ft\u0131.",
        minorSecretEn: "Had copied some of the recipes.",
        breakThreshold: 84,
        gossip: {
          "suspect-pierre": { tr: "Pierre \xE7ok sarho\u015Ftu.", en: "Pierre was very drunk." }
        },
        behavioralCues: {
          calm: { tr: "B\u0131\xE7a\u011F\u0131n\u0131 bileyliyor.", en: "Sharpening his knife." },
          nervous: { tr: "\xD6nl\xFC\u011F\xFCn\xFC \xE7eki\u015Ftiriyor.", en: "Tugging at his apron." },
          breaking: { tr: "Tabak f\u0131rlat\u0131yor.", en: "Throws a plate." }
        },
        lies: {
          level1: "Ben sadece yemek yapar\u0131m.",
          level2: "Tad\u0131m masas\u0131na gitmedim.",
          level3: "Defter bende de\u011Fil!"
        },
        confession: "Evet \xE7ald\u0131m, kendi restoran\u0131m\u0131 a\xE7aca\u011F\u0131m!",
        confessionEn: "Yes I stole it, I will open my own restaurant!",
        detailedStatements: [
          { id: "emre-s1", text: "Temizlikte g\xF6revliydim.", textEn: "I was assigned to cleaning.", isContradiction: false },
          { id: "emre-s2", text: "B\xFCt\xFCn gece \u015Eefin \xF6zel tad\u0131m masas\u0131na hi\xE7 yakla\u015Fmad\u0131m.", textEn: "I never approached the Chef's private tasting table all night.", isContradiction: true, contradictionClueId: "clue-apron-thread", explanation: "Tad\u0131m masas\u0131nda Emre'nin \xF6zel \xF6nl\xFC\u011F\xFCne ait mercan renkli lif bulundu.", explanationEn: "A coral colored fiber belonging to Emre's custom apron was found on the tasting table." }
        ]
      },
      {
        id: "suspect-pierre",
        name: "Pierre Martin",
        role: "Sommelier",
        roleEn: "Sommelier",
        age: 44,
        temperament: "Rahat",
        temperamentEn: "Relaxed",
        relationshipToVictim: "\u015Earap uzman\u0131.",
        relationshipToVictimEn: "Wine expert.",
        statement: "Mahzendeydim.",
        statementEn: "I was in the cellar.",
        isCulprit: false,
        alibi: "Mahzen kameralar\u0131.",
        alibiEn: "Cellar cameras.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "\u015Earaplar\u0131 kendisi i\xE7iyordu.",
        minorSecretEn: "Drank the wines himself.",
        breakThreshold: 94,
        gossip: {
          "suspect-emre": { tr: "Emre \xE7ok h\u0131rsl\u0131 biri.", en: "Emre is very ambitious." }
        },
        behavioralCues: {
          calm: { tr: "\u015Earap kadehini siliyor.", en: "Wiping a wine glass." },
          nervous: { tr: "Bo\u011Faz\u0131n\u0131 temizliyor.", en: "Clearing his throat." },
          breaking: { tr: "A\u011Fl\u0131yor.", en: "Crying." }
        },
        lies: {
          level1: "Sadece \u015Faraplara bakar\u0131m.",
          level2: "Tariflerle ilgilenmem.",
          level3: "Ben \xE7almad\u0131m."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "pierre-s1", text: "Mahzende say\u0131m yap\u0131yordum.", textEn: "I was doing inventory in the cellar.", isContradiction: false }
        ]
      },
      {
        id: "suspect-melis",
        name: "Melis Akda\u011F",
        role: "Pasta \u015Eefi",
        roleEn: "Pastry Chef",
        age: 29,
        temperament: "Tatl\u0131",
        temperamentEn: "Sweet",
        relationshipToVictim: "Tatl\u0131lardan sorumlu \u015Fef.",
        relationshipToVictimEn: "Chef in charge of desserts.",
        statement: "Tatl\u0131 haz\u0131rl\u0131yordum.",
        statementEn: "I was preparing desserts.",
        isCulprit: false,
        alibi: "Mutfaktaki di\u011Fer \xE7al\u0131\u015Fanlar.",
        alibiEn: "Other workers in the kitchen.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Tatl\u0131lar\u0131 haz\u0131r al\u0131yordu bazen.",
        minorSecretEn: "Sometimes bought pre-made desserts.",
        breakThreshold: 92,
        gossip: {
          "suspect-emre": { tr: "Emre s\xFCrekli \u015Fefin odas\u0131na bak\u0131yordu.", en: "Emre kept looking at the chef's room." }
        },
        behavioralCues: {
          calm: { tr: "Krema torbas\u0131n\u0131 tutuyor.", en: "Holding the piping bag." },
          nervous: { tr: "Ellerini o\u011Fu\u015Fturuyor.", en: "Rubbing her hands." },
          breaking: { tr: "Diz \xE7\xF6k\xFCyor.", en: "Kneels down." }
        },
        lies: {
          level1: "Ben sadece tatl\u0131 yapar\u0131m.",
          level2: "\u015Eefin odas\u0131na girmedim.",
          level3: "Masumum."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "melis-s1", text: "Kendi istasyonumdayd\u0131m.", textEn: "I was at my own station.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-apron-thread",
        label: "\xD6nl\xFCk Lifi",
        labelEn: "Apron Fiber",
        category: "forensic",
        type: "forensic",
        contradictsSuspectId: "suspect-emre",
        detail: "Tad\u0131m masas\u0131nda Emre'nin \xF6zel \xF6nl\xFC\u011F\xFCne ait mercan renkli lif bulundu.",
        detailEn: "A coral colored fiber from Emre's custom apron was found on the tasting table.",
        significance: "Emre'nin masaya yakla\u015Ft\u0131\u011F\u0131n\u0131 kan\u0131tlar.",
        significanceEn: "Proves Emre approached the table."
      },
      {
        id: "clue-15-pierre-cam",
        label: "Mahzen Kameras\u0131",
        labelEn: "Cellar Camera",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-pierre",
        detail: "Pierre t\xFCm gece mahzendeydi.",
        detailEn: "Pierre was in the cellar all night.",
        significance: "Pierre'i temize \xE7\u0131kar\u0131r.",
        significanceEn: "Clears Pierre."
      },
      {
        id: "clue-15-melis-staff",
        label: "Personel \u0130fadesi",
        labelEn: "Staff Statement",
        category: "witness",
        type: "alibi",
        clearsSuspectId: "suspect-melis",
        detail: "Melis di\u011Fer personelle birlikteydi.",
        detailEn: "Melis was with the other staff.",
        significance: "Melis'i temize \xE7\u0131kar\u0131r.",
        significanceEn: "Clears Melis."
      }
    ]
  },
  // Case 16
  {
    id: "case-16-oyun-studyosu",
    title: "Ba\u011F\u0131ms\u0131z Oyun St\xFCdyosunda Kaynak Kod Sabotaj\u0131",
    titleEn: "Source Code Sabotage at the Indie Game Studio",
    difficulty: "normal",
    briefing: "Lansmana saatler kala ana repoya yetkisiz force-push yap\u0131larak Ba\u015F Geli\u015Ftirici Berk Taner'in kaynak kodlar\u0131 \xE7al\u0131nd\u0131.",
    briefingEn: "Hours before launch, the main repo was subjected to an unauthorized force-push and Lead Developer Berk Taner's source codes were stolen.",
    incidentTime: "03:18",
    location: "Ana Sistem Sunucusu",
    locationEn: "Main System Server",
    victim: {
      name: "Berk Taner",
      occupation: "Ba\u015F Geli\u015Ftirici",
      occupationEn: "Lead Developer",
      causeOfDeath: "Veri H\u0131rs\u0131zl\u0131\u011F\u0131",
      causeOfDeathEn: "Data Theft"
    },
    timeline: [
      { time: "02:00", event: "Ekip ofisten ayr\u0131ld\u0131.", eventEn: "Team left the office.", verified: true },
      { time: "03:18", event: "Force-push ile kodlar de\u011Fi\u015Ftirildi.", eventEn: "Codes changed via force-push.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Git loglar\u0131nda garip bir SSH anahtar\u0131 kullan\u0131m\u0131.",
        "Ofis i\xE7 a\u011F\u0131ndan yap\u0131lm\u0131\u015F eri\u015Fim."
      ],
      en: [
        "Strange SSH key usage in Git logs.",
        "Access made from the office internal network."
      ]
    },
    culpritId: "suspect-deniz",
    correctMethod: "Lansmana saatler kala ana repoya yetkisiz force-push yaparak kodu \xE7ald\u0131.",
    correctMethodEn: "Stole the code by making an unauthorized force-push to the main repo hours before launch.",
    correctMotive: "Projeyi tek ba\u015F\u0131na sat\u0131p paray\u0131 almak.",
    correctMotiveEn: "To sell the project alone and take the money.",
    winningContradiction: {
      suspectId: "suspect-deniz",
      sentenceId: "deniz-s2",
      clueId: "clue-git-commit-log"
    },
    analystSummary: {
      tr: "Analist Notu: \u015E\xFCpheli gece evde oldu\u011Funu belirtiyor ama SSH anahtar\u0131 ile ofisteki masas\u0131ndan i\u015Flem yap\u0131lm\u0131\u015F.",
      en: "Analyst Note: Suspect claims to be home at night, but his SSH key was used to execute commands from his office desk."
    },
    suspects: [
      {
        id: "suspect-deniz",
        name: "Deniz Soylu",
        role: "Kurucu Ortak & Tasar\u0131mc\u0131",
        roleEn: "Co-Founder & Designer",
        age: 31,
        temperament: "Agresif ve h\u0131rsl\u0131",
        temperamentEn: "Aggressive and ambitious",
        relationshipToVictim: "Berk'in orta\u011F\u0131.",
        relationshipToVictimEn: "Berk's partner.",
        statement: "Gece yar\u0131s\u0131 ofisten \xE7\u0131k\u0131p evimde uyudum.",
        statementEn: "I left the office at midnight and slept at home.",
        isCulprit: true,
        alibi: "Evinde oldu\u011Funu iddia ediyor.",
        alibiEn: "Claims to be at home.",
        motive: "Projeyi \xE7al\u0131p satmak.",
        motiveEn: "Steal the project and sell it.",
        minorSecret: "Kumar borcu vard\u0131.",
        minorSecretEn: "Had a gambling debt.",
        breakThreshold: 83,
        gossip: {
          "suspect-asli": { tr: "Asl\u0131 kodlara \xE7ok merakl\u0131yd\u0131.", en: "Asl\u0131 was very curious about the codes." }
        },
        behavioralCues: {
          calm: { tr: "Telefonuyla oynuyor.", en: "Playing with his phone." },
          nervous: { tr: "T\u0131rnaklar\u0131n\u0131 yiyor.", en: "Biting his nails." },
          breaking: { tr: "Ekrana yumruk at\u0131yor.", en: "Punches the screen." }
        },
        lies: {
          level1: "Ben tasar\u0131mc\u0131y\u0131m, koddan anlamam.",
          level2: "Evdeydim.",
          level3: "O push bana ait de\u011Fil!"
        },
        confession: "Evet \xE7ald\u0131m, o oyun benim fikrimdi!",
        confessionEn: "Yes I stole it, that game was my idea!",
        detailedStatements: [
          { id: "deniz-s1", text: "Partiden sonra do\u011Frudan eve gittim.", textEn: "Went straight home after the party.", isContradiction: false },
          { id: "deniz-s2", text: "Gece yar\u0131s\u0131 ofisten \xE7\u0131k\u0131p evimde uyudum, hi\xE7bir sisteme dokunmad\u0131m.", textEn: "I left the office at midnight and slept at home, touched no system.", isContradiction: true, contradictionClueId: "clue-git-commit-log", explanation: "Saat 03:18'de Deniz'in ofis masas\u0131ndaki SSH anahtar\u0131yla git push i\u015Flemi yap\u0131lm\u0131\u015F.", explanationEn: "A git push was executed at 03:18 using Deniz's SSH key from his office desk." }
        ]
      },
      {
        id: "suspect-asli",
        name: "Asl\u0131 Vural",
        role: "3D Artist",
        roleEn: "3D Artist",
        age: 26,
        temperament: "Heyecanl\u0131",
        temperamentEn: "Excited",
        relationshipToVictim: "Tasar\u0131m ekibi \xFCyesi.",
        relationshipToVictimEn: "Design team member.",
        statement: "Sabaha kadar \xE7izim yapt\u0131m evimde.",
        statementEn: "I drew at home until morning.",
        isCulprit: false,
        alibi: "Twitch yay\u0131n\u0131 yap\u0131yordu.",
        alibiEn: "Was live streaming on Twitch.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Ba\u015Fka st\xFCdyoyla g\xF6r\xFC\u015F\xFCyordu.",
        minorSecretEn: "Was interviewing with another studio.",
        breakThreshold: 92,
        gossip: {
          "suspect-deniz": { tr: "Deniz Bey patronla \xE7ok tart\u0131\u015F\u0131yordu.", en: "Mr. Deniz argued a lot with the boss." }
        },
        behavioralCues: {
          calm: { tr: "Tabletiyle ilgileniyor.", en: "Attending to her tablet." },
          nervous: { tr: "Sa\xE7lar\u0131yla oynuyor.", en: "Playing with her hair." },
          breaking: { tr: "A\u011Fl\u0131yor.", en: "Crying." }
        },
        lies: {
          level1: "Ben sadece modellerim.",
          level2: "Git loglar\u0131n\u0131 bilmem.",
          level3: "Masumum."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "asli-s1", text: "Evimde yay\u0131ndayd\u0131m.", textEn: "I was streaming at home.", isContradiction: false }
        ]
      },
      {
        id: "suspect-cem",
        name: "Cem Ertekin",
        role: "Yat\u0131r\u0131mc\u0131",
        roleEn: "Investor",
        age: 40,
        temperament: "Sakin",
        temperamentEn: "Calm",
        relationshipToVictim: "\u015Eirket yat\u0131r\u0131mc\u0131s\u0131.",
        relationshipToVictimEn: "Company investor.",
        statement: "Oteldeydim.",
        statementEn: "I was at the hotel.",
        isCulprit: false,
        alibi: "Otel kameralar\u0131.",
        alibiEn: "Hotel cameras.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Projeyi iptal etmeyi d\xFC\u015F\xFCn\xFCyordu.",
        minorSecretEn: "Was considering canceling the project.",
        breakThreshold: 96,
        gossip: {
          "suspect-deniz": { tr: "Deniz kodlar\u0131n haklar\u0131n\u0131 istiyordu.", en: "Deniz wanted the rights to the codes." }
        },
        behavioralCues: {
          calm: { tr: "Puro i\xE7iyor.", en: "Smoking a cigar." },
          nervous: { tr: "Baca\u011F\u0131n\u0131 sall\u0131yor.", en: "Shaking his leg." },
          breaking: { tr: "Ba\u011F\u0131r\u0131yor.", en: "Yelling." }
        },
        lies: {
          level1: "Ben sadece para veririm.",
          level2: "Kodlarla i\u015Fim olmaz.",
          level3: "Masumum."
        },
        confession: "Masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "cem-s1", text: "Otelimde uyuyordum.", textEn: "I was sleeping at my hotel.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-git-commit-log",
        label: "Git SSH Eri\u015Fim Logu",
        labelEn: "Git SSH Access Log",
        category: "digital",
        type: "digital",
        contradictsSuspectId: "suspect-deniz",
        detail: "03:18'de Deniz'in ofis masas\u0131ndaki ki\u015Fisel SSH anahtar\u0131yla yetkisiz git push yap\u0131ld\u0131.",
        detailEn: "Unauthorized git push executed at 03:18 from Deniz's office desk using his personal SSH key.",
        significance: "Deniz'in i\u015Flemi yapt\u0131\u011F\u0131n\u0131 kan\u0131tlar.",
        significanceEn: "Proves Deniz executed the operation."
      },
      {
        id: "clue-16-asli-stream",
        label: "Twitch Yay\u0131n\u0131 Kayd\u0131",
        labelEn: "Twitch Stream VOD",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-asli",
        detail: "Asl\u0131 t\xFCm gece canl\u0131 yay\u0131ndayd\u0131.",
        detailEn: "Asl\u0131 was live streaming all night.",
        significance: "Asl\u0131'y\u0131 temize \xE7\u0131kar\u0131r.",
        significanceEn: "Clears Asl\u0131."
      },
      {
        id: "clue-16-cem-hotel",
        label: "Otel Kamera Kayd\u0131",
        labelEn: "Hotel Camera Log",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-cem",
        detail: "Cem gece boyunca otelinden ayr\u0131lmad\u0131.",
        detailEn: "Cem didn't leave his hotel all night.",
        significance: "Cem'i temize \xE7\u0131kar\u0131r.",
        significanceEn: "Clears Cem."
      }
    ]
  }
];

// shared/vakaCases.ts
var VAKA_SAMPLE_CASES = [
  // 1. VAKA: Müzayede Salonu / Saat Hırsızlığı
  {
    id: "case-01-atlantis-saati",
    title: "Kay\u0131p Atlantis Saati",
    titleEn: "The Missing Atlantis Chronometer",
    difficulty: "normal",
    briefing: "M\xFCzayede evinin antika saatler sergisinden, 18. y\xFCzy\u0131ldan kalma paha bi\xE7ilmez 'Atlantis Kronometresi' kasadan \xE7al\u0131nd\u0131. Kasa \u015Fifresi sadece 3 ki\u015Fide vard\u0131. G\xFCvenlik alarm\u0131 21:40'ta \xE7ald\u0131.",
    briefingEn: "The priceless 18th-century 'Atlantis Chronometer' went missing from the auction house vault. Only 3 people possessed the combination. The security alarm tripped at 21:40.",
    incidentTime: "21:40",
    location: "Kasa Dairesi, Galeri B",
    locationEn: "Vault Room, Gallery B",
    victim: {
      name: "Selim Ertu\u011Frul",
      occupation: "M\xFCzayede Genel M\xFCd\xFCr\xFC",
      occupationEn: "Auction General Director",
      causeOfDeath: "Can kayb\u0131 yok (Nitelikli H\u0131rs\u0131zl\u0131k & G\xFCveni K\xF6t\xFCye Kullanma)",
      causeOfDeathEn: "No casualties (Grand Larceny & Breach of Trust)"
    },
    timeline: [
      { time: "21:00", event: "Sergi salonu ziyarete kapand\u0131; Bora Kaya at\xF6lyeyi kilitledi\u011Fini belirtti.", eventEn: "Gallery closed to visitors; Bora claimed to lock the studio.", verified: true },
      { time: "21:28", event: "Cengiz Varol lobi bar\u0131nda Z\xFCrih ile uluslararas\u0131 telefon g\xF6r\xFC\u015Fmesi ba\u015Flatt\u0131.", eventEn: "Cengiz began an international call to Zurich from the lobby bar.", verified: true },
      { time: "21:35", event: "Leyla Ergin otomat odas\u0131ndan kahve ald\u0131.", eventEn: "Leyla bought coffee from the vending machine.", verified: true },
      { time: "21:38", event: "B koridoru g\xFCvenlik kameras\u0131nda 35 saniyelik statik sinyal kayb\u0131.", eventEn: "Corridor B security camera suffered 35 seconds of static.", verified: true },
      { time: "21:40", event: "Kasa manyetik kap\u0131 zorlama sens\xF6r\xFC \xF6tt\xFC.", eventEn: "Vault magnetic forced-entry sensor triggered.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Kasa kapa\u011F\u0131 mekanik \u015Fifreyle a\xE7\u0131lm\u0131\u015F; patlay\u0131c\u0131 veya zorlama izi yok.",
        "Kasa kadran\u0131n\u0131n di\u015Flilerine s\u0131k\u0131\u015Fm\u0131\u015F 2 milimetrelik lacivert kadife iplik lifi.",
        "M\xFCcevher kadifesinin \xFCzerinde kimyasal \xE7\xF6z\xFCc\xFC (etil asetat) kokusu."
      ],
      en: [
        "Vault opened via mechanical combination; no signs of forced lockpick or explosive.",
        "A 2mm navy velvet textile fiber lodged inside the combination dial gears.",
        "Faint chemical solvent (ethyl acetate) odor lingering on the display velvet."
      ]
    },
    culpritId: "suspect-bora",
    correctMethod: "At\xF6lye anahtar\u0131 ve kadran kombinasyonu ile kasay\u0131 sessizce a\xE7\u0131p saati astar\u0131nda ka\xE7\u0131rd\u0131.",
    correctMethodEn: "Silently unlocked the dial using studio credentials and smuggled it in coat lining.",
    correctMotive: "A\u011F\u0131r yasa d\u0131\u015F\u0131 kumar bor\xE7lar\u0131n\u0131 kapatmak i\xE7in saati karaborsaya satmak.",
    correctMotiveEn: "Liquidating the watch on the black market to pay off loan sharks.",
    winningContradiction: {
      suspectId: "suspect-bora",
      sentenceId: "bora-s3",
      clueId: "clue-rain-log"
    },
    analystSummary: {
      tr: "Analist Notu: \u015E\xFCphelilerden birinin sundu\u011Fu meteorolojik alibi ile \u015Fehir radar kay\u0131tlar\u0131 aras\u0131nda do\u011Frudan bir \xE7eli\u015Fki var. Kimsenin \u0131slanmad\u0131\u011F\u0131 bir gecede s\u0131r\u0131ls\u0131klam oldu\u011Funu iddia eden ki\u015Fiye odaklan\u0131n.",
      en: "Analyst Note: A direct contradiction exists between one suspect's meteorological alibi and city radar logs. Focus on who claimed to be drenched on a completely dry night."
    },
    suspects: [
      {
        id: "suspect-bora",
        name: "Bora Kaya",
        role: "Restorat\xF6r & Saat Ustas\u0131",
        roleEn: "Restorer & Horologist",
        age: 44,
        temperament: "Kibirli ve gergin",
        temperamentEn: "Arrogant and tense",
        relationshipToVictim: "M\xFCd\xFCr Selim Bey'in 8 y\u0131ll\u0131k ba\u015F restorat\xF6r\xFC, son zamanlarda prim anla\u015Fmazl\u0131\u011F\u0131 ya\u015F\u0131yorlard\u0131.",
        relationshipToVictimEn: "Lead restorer for 8 years, recently in dispute over commissions.",
        statement: "O saatte d\u0131\u015Far\u0131da \u015Fiddetli f\u0131rt\u0131nan\u0131n alt\u0131nda y\xFCr\xFCyordum, m\xFCzayedeye hi\xE7 u\u011Framad\u0131m.",
        statementEn: "I was walking outside under heavy thunderstorm, never set foot in the gallery.",
        isCulprit: true,
        alibi: "21:30 ile 22:00 aras\u0131 sahilde \u015Fiddetli f\u0131rt\u0131na alt\u0131nda y\xFCr\xFCy\xFC\u015Fteydi.",
        alibiEn: "Claimed to be walking on the coast under heavy thunderstorm between 21:30 and 22:00.",
        motive: "Yasa d\u0131\u015F\u0131 bahis bor\xE7lar\u0131 y\xFCz\xFCnden tefeciler ailesini tehdit ediyordu.",
        motiveEn: "Loan sharks were threatening him over catastrophic betting debts.",
        minorSecret: "At\xF6lyeden kimyasal \xE7\xF6z\xFCc\xFC a\u015F\u0131r\u0131p sahte orijinallik sertifikalar\u0131 \xFCretiyordu.",
        minorSecretEn: "Forging certificates of authenticity using stolen lab solvent.",
        breakThreshold: 68,
        gossip: {
          "suspect-leyla": {
            tr: "Leyla b\xFCt\xFCn ak\u015Fam g\xFCvenlik odas\u0131nda telefonundan borsa oynuyordu, kameralara bakmad\u0131\u011F\u0131na yemin edebilirim.",
            en: "Leyla was day-trading on her phone all evening, I bet she never watched the monitors."
          },
          "suspect-cengiz": {
            tr: "Cengiz Bey saati ucuza kapamak i\xE7in g\xFCnlerdir lobide akbaba gibi dolan\u0131yordu.",
            en: "Cengiz has been circling the lobby like a vulture trying to steal that piece for cheap."
          }
        },
        behavioralCues: {
          calm: { tr: "Saat tamir c\u0131mb\u0131z\u0131n\u0131 parmaklar\u0131 aras\u0131nda ustaca \xE7eviriyor.", en: "Deftly twirls a horologist tweezer between his fingers." },
          nervous: { tr: "Paltosunun d\xFC\u011Fmelerini s\xFCrekli ilikleyip \xE7\xF6z\xFCyor, bo\u011Faz\u0131n\u0131 temizliyor.", en: "Repeatedly buttons and unbuttons his coat, clears his throat." },
          breaking: { tr: "G\xF6zleri b\xFCy\xFCyor, dudaklar\u0131 titriyor, ellerini cebine saklamaya \xE7al\u0131\u015F\u0131yor.", en: "Eyes widen, lips quiver, desperately shoves hands into pockets." }
        },
        lies: {
          level1: "Dedektif, ben saatlerle ya\u015Far\u0131m. B\xF6yle bir \u015Faheseri kasadan \xE7almak benim onuruma hakarettir. O saatte sahilde tek ba\u015F\u0131ma f\u0131rt\u0131nan\u0131n sesini dinliyordum.",
          level2: "Galerinin yak\u0131n\u0131ndan ge\xE7mi\u015F olabilirim ama i\xE7eri ad\u0131m atmad\u0131m! Ayakkab\u0131lar\u0131mdaki \u0131slak kum sahilden geldi!",
          level3: "Kasan\u0131n \xF6n\xFCne kadar gitmi\u015F olabilirim tamam m\u0131?! Ama ald\u0131\u011F\u0131mda saat zaten yerinde yoktu... Hay\u0131r yalan s\xF6yl\xFCyorum, bor\xE7lar g\u0131rtla\u011F\u0131mdayd\u0131!"
        },
        confession: "Lanet olsun... Evet, ben ald\u0131m! Tefeciler kap\u0131mdayd\u0131, par\xE7alay\u0131p alt\u0131n di\u015Flilerini eritecektim. Saat paltomun i\xE7 astar\u0131nda diki\u015Flerin aras\u0131na gizli.",
        confessionEn: "Curse it... Yes, I took it! Loan sharks were outside my door. The watch is sewn into the inner lining of my overcoat.",
        detailedStatements: [
          {
            id: "bora-s1",
            text: "Kasan\u0131n kombinasyonunu bilirim ama ak\u015Fam 21:00'de at\xF6lyeyi kilitleyip binadan ayr\u0131ld\u0131m.",
            textEn: "I know the combination, but I locked up my studio and left at 21:00.",
            isContradiction: false
          },
          {
            id: "bora-s2",
            text: "Kafam\u0131 da\u011F\u0131tmak i\xE7in tek ba\u015F\u0131ma sahil yoluna do\u011Fru y\xFCr\xFCd\xFCm.",
            textEn: "I walked alone towards the coastal boardwalk to clear my head.",
            isContradiction: false
          },
          {
            id: "bora-s3",
            text: "Saat tam 21:35 ile 21:50 aras\u0131nda g\xF6k yar\u0131ld\u0131, s\u0131r\u0131ls\u0131klam \u0131slan\u0131rken sa\u011Fanak ve f\u0131rt\u0131na y\xFCz\xFCnden g\xF6z g\xF6z\xFC g\xF6rm\xFCyordu.",
            textEn: "Between exactly 21:35 and 21:50 the sky tore open, I was drenched in a violent thunderstorm.",
            isContradiction: true,
            contradictionClueId: "clue-rain-log",
            explanation: "Meteoroloji ve radar kay\u0131tlar\u0131na g\xF6re o gece saat 20:00-02:00 aras\u0131 \u015Fehirde tek damla ya\u011Fmur ya\u011Fmad\u0131, hava tamamen a\xE7\u0131k ve dolunayl\u0131yd\u0131!",
            explanationEn: "According to meteorological radar logs, zero precipitation fell between 20:00-02:00; clear skies with a bright moon!"
          },
          {
            id: "bora-s4",
            text: "Geri d\xF6nd\xFC\u011F\xFCmde saat 22:15 olmu\u015Ftu ve polis sirenlerini duydum.",
            textEn: "When I came back it was 22:15 and I heard sirens.",
            isContradiction: false
          }
        ]
      },
      {
        id: "suspect-leyla",
        name: "Leyla Ergin",
        role: "G\xFCvenlik Amiri",
        roleEn: "Chief of Security",
        age: 38,
        temperament: "Savunmac\u0131 ve \u015F\xFCpheci",
        temperamentEn: "Defensive and suspicious",
        relationshipToVictim: "M\xFCd\xFCr\xFCn g\xFCvenlik protokollerini gev\u015Fek buldu\u011Fu i\xE7in tefti\u015F ge\xE7irdi\u011Fi amir.",
        relationshipToVictimEn: "Security chief recently audited by the director for lax protocols.",
        statement: "Kameralar 21:38'de parazit yapt\u0131, o s\u0131rada dinlenme odas\u0131nda kahvemi tazeliyordum.",
        statementEn: "Cameras glitched at 21:38 while I was refilling coffee in the break room.",
        isCulprit: false,
        alibi: "21:35'te dinlenme odas\u0131ndaki kahve otomat\u0131ndan kartla kahve ald\u0131, log ve sens\xF6r var.",
        alibiEn: "Badge tap and vending log verify coffee purchase at 21:35.",
        motive: "Maa\u015F zamm\u0131 reddedilmi\u015Fti.",
        motiveEn: "Her salary raise request had been denied.",
        minorSecret: "N\xF6bette yasak olmas\u0131na ra\u011Fmen kripto borsa grafikleri inceliyordu.",
        minorSecretEn: "Was checking cryptocurrency trades on duty.",
        breakThreshold: 80,
        gossip: {
          "suspect-bora": {
            tr: "Bora Usta son iki haftad\u0131r \xE7ok tuhaft\u0131. Saat \xE7ekmecelerini gizlice kar\u0131\u015Ft\u0131r\u0131rken g\xF6rd\xFCm.",
            en: "Bora was acting strange lately. I saw him rummaging through specimen drawers after hours."
          }
        },
        behavioralCues: {
          calm: { tr: "Telsizini kemerinde d\xFCzeltiyor, dik oturuyor.", en: "Adjusts radio on duty belt, sits upright." },
          nervous: { tr: "T\u0131rnaklar\u0131n\u0131 kemiriyor, telefonunun ekran\u0131na ka\xE7amak bak\u0131\u015Flar at\u0131yor.", en: "Bites thumbnail, steals glances at phone screen." },
          breaking: { tr: "Masaya vurup aya\u011Fa kalk\u0131yor, ba\u011F\u0131r\u0131yor.", en: "Slams the desk and stands up, raising her voice." }
        },
        lies: {
          level1: "Sistemde donan\u0131msal bir ar\u0131za oldu, bunu bana y\u0131kamazs\u0131n\u0131z.",
          level2: "Evet, ekrandan birka\xE7 dakika g\xF6z\xFCm\xFC ay\u0131rd\u0131m ama bu beni h\u0131rs\u0131z yapmaz!",
          level3: "Bora'n\u0131n kasaya do\u011Fru h\u0131zl\u0131 ad\u0131mlarla gitti\u011Fini g\xF6rd\xFCm ama emin olamad\u0131\u011F\u0131m i\xE7in hemen anons ge\xE7medim!"
        },
        confession: "Ben masumum, sadece n\xF6bette telefonuma dald\u0131\u011F\u0131m i\xE7in anl\u0131k ihmal g\xF6sterdim!",
        confessionEn: "I am innocent, I was merely negligent because I was absorbed in my phone!",
        detailedStatements: [
          { id: "leyla-s1", text: "Ak\u015Fam vardiyas\u0131nda kontrol odas\u0131nda tek ba\u015F\u0131mayd\u0131m.", textEn: "I was alone in the control booth on the night shift.", isContradiction: false },
          { id: "leyla-s2", text: "21:38'de B koridoru kameras\u0131nda 35 saniyelik parazit olu\u015Ftu.", textEn: "Corridor B had 35 seconds of static at 21:38.", isContradiction: false }
        ]
      },
      {
        id: "suspect-cengiz",
        name: "Cengiz Varol",
        role: "Koleksiyoner & Al\u0131c\u0131 Temsilcisi",
        roleEn: "Collector & Bidder Representative",
        age: 52,
        temperament: "A\u011F\u0131rba\u015Fl\u0131 ve mesafeli",
        temperamentEn: "Pompous and detached",
        relationshipToVictim: "M\xFCzayede evinin en zengin daimi m\xFC\u015Fterilerinden biri.",
        relationshipToVictimEn: "One of the richest regular clients of the auction house.",
        statement: "O saatte lobi bar\u0131nda oturup Z\xFCrih'teki m\xFC\u015Fterime saatin kondisyonunu aktar\u0131yordum.",
        statementEn: "At that time I was at the lobby bar on an international call to Zurich.",
        isCulprit: false,
        alibi: "21:28 ile 22:02 aras\u0131 operat\xF6r onayl\u0131 kesintisiz Z\xFCrih telefon kayd\u0131.",
        alibiEn: "Carrier verified continuous Zurich phone call 21:28 - 22:02.",
        motive: "Saati m\xFC\u015Fterisine ucuza kapatmak istiyordu.",
        motiveEn: "Wanted to acquire the piece cheap for his client.",
        minorSecret: "M\xFCzayedenin gizli taban fiyat listesini garsona r\xFC\u015Fvet vererek ele ge\xE7irmi\u015Fti.",
        minorSecretEn: "Bribed a waiter to obtain the confidential reserve price sheet.",
        breakThreshold: 85,
        gossip: {
          "suspect-bora": {
            tr: "Bora'n\u0131n ceketinin astar\u0131nda o saatin parlad\u0131\u011F\u0131na ad\u0131m gibi eminim, adama bak\u0131n eli aya\u011F\u0131 titriyor.",
            en: "I am certain Bora has it in his coat lining; look at the man, he cannot stop trembling."
          }
        },
        behavioralCues: {
          calm: { tr: "Pipo duman\u0131n\u0131 \xFCfler gibi parmaklar\u0131n\u0131 masada ritmik vuruyor.", en: "Taps fingers rhythmically on table with nonchalance." },
          nervous: { tr: "\u0130pek kravat\u0131n\u0131 gev\u015Fetiyor, saatine bak\u0131yor.", en: "Loosens silk necktie, consults wristwatch." },
          breaking: { tr: "Avukat\u0131n\u0131 aramakla tehdit ediyor, ses tonu titriyor.", en: "Threatens to summon his attorney, voice wavering." }
        },
        lies: {
          level1: "Ben centilmen bir koleksiyonerim, h\u0131rs\u0131zl\u0131kla i\u015Fim olmaz.",
          level2: "Sadece i\xE7eriden fiyat bilgisi ald\u0131m, bu su\xE7 de\u011Fil ticaret!",
          level3: "Bora'n\u0131n kasaya girdi\u011Fini g\xF6rd\xFCm, benden \u015F\xFCphelenmeyi kesin!"
        },
        confession: "Ben h\u0131rs\u0131z de\u011Filim! Sadece komisyon pe\u015Findeydim!",
        confessionEn: "I am no thief! I was only chasing my commission fee!",
        detailedStatements: [
          { id: "cengiz-s1", text: "Lobi bar\u0131nda viskimi yudumlarken kesintisiz telefon g\xF6r\xFC\u015Fmesindeydim.", textEn: "I was on a nonstop call while sipping whiskey at the bar.", isContradiction: false },
          { id: "cengiz-s2", text: "G\xF6r\xFC\u015Fme saat 21:28'de ba\u015Flay\u0131p 22:02'ye kadar aral\u0131ks\u0131z s\xFCrd\xFC.", textEn: "The call ran without break from 21:28 to 22:02.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-rain-log",
        label: "Meteoroloji Radar Raporu",
        labelEn: "Meteorological Radar Log",
        category: "document",
        type: "spatial",
        contradictsSuspectId: "suspect-bora",
        detail: "Olay gecesi 20:00 - 02:00 aras\u0131 \u015Fehirde nem %30, g\xF6ky\xFCz\xFC bulutsuz ve a\xE7\u0131k; hi\xE7 ya\u011F\u0131\u015F kaydedilmedi.",
        detailEn: "Between 20:00 - 02:00 humidity was 30%, skies cloudless and clear; zero precipitation recorded.",
        significance: "Bora'n\u0131n 'f\u0131rt\u0131nada \u0131sland\u0131m' yalan\u0131n\u0131 \xE7\xFCr\xFCten kesin delil.",
        significanceEn: "Decisive proof shattering Bora's rainstorm alibi."
      },
      {
        id: "clue-velvet-fiber",
        label: "Kasa Mandal\u0131 Kadife \u0130pli\u011Fi",
        labelEn: "Vault Latch Velvet Fiber",
        category: "forensic",
        type: "forensic",
        contradictsSuspectId: "suspect-bora",
        detail: "Kasa \u015Fifre kadran\u0131na s\u0131k\u0131\u015Fm\u0131\u015F lacivert kadife iplik bulundu. Bora'n\u0131n \xE7al\u0131\u015Fma ceketinin astar\u0131yla e\u015Fle\u015Fiyor.",
        detailEn: "Navy velvet fiber lodged in dial matched the inner lining of Bora's work blazer.",
        significance: "Bora'n\u0131n kasay\u0131 bizzat a\xE7t\u0131\u011F\u0131n\u0131 g\xF6steren adli t\u0131p ba\u011F\u0131.",
        significanceEn: "Physical link proving Bora personally worked the dial."
      },
      {
        id: "clue-phone-bill",
        label: "Operat\xF6r Arama D\xF6k\xFCm\xFC",
        labelEn: "Cell Carrier Call Logs",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-cengiz",
        detail: "Cengiz Varol'un telefonundan Z\xFCrih numaras\u0131na 34 dakikal\u0131k kesintisiz arama teyit edildi.",
        detailEn: "Confirmed 34-minute continuous connection from Cengiz Varol to Zurich.",
        significance: "Cengiz'in olay saatinde telefonda oldu\u011Funu kan\u0131tlar.",
        significanceEn: "Proves Cengiz was on the phone during the theft."
      },
      {
        id: "clue-coffee-receipt",
        label: "Kantin Otomat Fi\u015Fi",
        labelEn: "Cafeteria Vending Receipt",
        category: "document",
        type: "alibi",
        clearsSuspectId: "suspect-leyla",
        detail: "21:35:12 zaman damgal\u0131 kahve sat\u0131\u015F\u0131 ve g\xFCvenlik personeli \xE7ip okutma kayd\u0131.",
        detailEn: "Coffee purchase timestamped 21:35:12 with security badge tap.",
        significance: "Leyla'n\u0131n otomat odas\u0131nda oldu\u011Funu belgeler.",
        significanceEn: "Documents Leyla's presence in the break area."
      }
    ]
  },
  // 2. VAKA: Köşk Yemeğinde Zehirli Kadeh
  {
    id: "case-02-zehirli-kadeh",
    title: "Ak\u015Fam Yeme\u011Finde Zehirli Kadeh",
    titleEn: "The Poisoned Goblet at Dinner",
    difficulty: "normal",
    briefing: "Milyarder armat\xF6r Ha\u015Fim Karaaslan, ailesiyle yedi\u011Fi \xF6zel ak\u015Fam yeme\u011Finin ard\u0131ndan aniden fenala\u015Farak hayat\u0131n\u0131 kaybetti. Kadehinde nadir bulunan digitalis toksini tespit edildi. Masada sadece 3 ki\u015Fi vard\u0131.",
    briefingEn: "Billionaire shipping magnate Mr. Ha\u015Fim collapsed and died after a private family dinner. Rare digitalis toxin was found in his goblet. Only 3 people were at the table.",
    incidentTime: "20:15",
    location: "K\xF6\u015Fk Yemek Salonu",
    locationEn: "Mansion Dining Room",
    victim: {
      name: "Ha\u015Fim Karaaslan",
      occupation: "Armat\xF6r & Holding Sahibi",
      occupationEn: "Shipping Magnate & Tycoon",
      causeOfDeath: "Digitalis glikozit zehirlenmesine ba\u011Fl\u0131 akut kardiyak arrest",
      causeOfDeathEn: "Acute cardiac arrest caused by digitalis glycoside poisoning"
    },
    timeline: [
      { time: "19:30", event: "Aile ve doktor yemek masas\u0131na oturdu.", eventEn: "Family and physician gathered at dining table.", verified: true },
      { time: "19:45", event: "Dr. Derya Ha\u015Fim Bey'in tansiyonunu \xF6l\xE7t\xFC ve vitamin takviyesi verdi\u011Fini s\xF6yledi.", eventEn: "Dr. Derya checked blood pressure and claimed to give vitamins.", verified: true },
      { time: "20:00", event: "Murat masada babas\u0131yla miras konusunda sert bir tart\u0131\u015Fma ya\u015Fay\u0131p kalkt\u0131.", eventEn: "Murat had a heated inheritance dispute with his father and left table.", verified: true },
      { time: "20:05", event: "G\xFClizar Han\u0131m masaya m\xFCh\xFCrl\xFC 2012 rekoltesi \u015Farap getirdi.", eventEn: "G\xFClizar served the sealed 2012 vintage wine.", verified: true },
      { time: "20:15", event: "Ha\u015Fim Bey kadehini yudumlad\u0131ktan 4 dakika sonra yere y\u0131\u011F\u0131ld\u0131.", eventEn: "Mr. Ha\u015Fim collapsed 4 minutes after sipping his goblet.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Maktul\xFCn kadehinin dudak pay\u0131 kenar\u0131nda renksiz, hafif ya\u011Fl\u0131 kimyasal kal\u0131nt\u0131.",
        "Masan\u0131n alt\u0131ndaki \xE7\xF6p sepetinde ezilmi\u015F bir ampul cam\u0131 k\u0131r\u0131\u011F\u0131.",
        "Ana \u015Farap s\xFCrahisindeki \u015Farap tamamen temiz, zehir \u015Fi\u015Feye de\u011Fil sadece kadehin kenar\u0131na s\xFCr\xFClm\xFC\u015F."
      ],
      en: [
        "Colorless oily film residue localized exclusively on the drinking rim of the goblet.",
        "Crushed glass ampoule sliver retrieved from wastebasket under the sideboard.",
        "Main wine decanter fluid entirely clean; toxin was applied only to glass rim."
      ]
    },
    culpritId: "suspect-derya",
    correctMethod: "T\u0131bbi kitindeki konsantre digitalis damlal\u0131\u011F\u0131n\u0131 Ha\u015Fim Bey'in kadeh kenar\u0131na s\xFCrd\xFC.",
    correctMethodEn: "Wiped concentrated digitalis from a medical dropper onto the goblet rim.",
    correctMotive: "Ha\u015Fim Bey sahte re\xE7ete ve klinik yolsuzluklar\u0131n\u0131 ihbar etmek \xFCzereydi.",
    correctMotiveEn: "Ha\u015Fim was about to expose her illegal prescription fraud.",
    winningContradiction: {
      suspectId: "suspect-derya",
      sentenceId: "derya-s3",
      clueId: "clue-toxic-serum"
    },
    analystSummary: {
      tr: "Analist Notu: Zehir \u015Fi\u015Feye de\u011Fil kadehin kenar\u0131na s\xFCr\xFClm\xFC\u015F. Doktorun \xE7antas\u0131nda zehir ta\u015F\u0131mad\u0131\u011F\u0131na dair iddias\u0131n\u0131 adli \xE7anta aramas\u0131yla y\xFCzle\u015Ftirin.",
      en: "Analyst Note: Toxin was localized to the rim, not the bottle. Cross-examine the doctor's claim of having zero restricted chemicals against her bag forensic log."
    },
    suspects: [
      {
        id: "suspect-derya",
        name: "Dr. Derya Sungur",
        role: "\xD6zel Hekim",
        roleEn: "Private Physician",
        age: 46,
        temperament: "So\u011Fukkanl\u0131 ve hesap\xE7\u0131",
        temperamentEn: "Cold and calculating",
        relationshipToVictim: "Ha\u015Fim Bey'in 5 y\u0131ll\u0131k hekimi; son 6 ayd\u0131r gizli denetim alt\u0131ndayd\u0131.",
        relationshipToVictimEn: "Personal physician for 5 years, under secret financial audit.",
        statement: "Ha\u015Fim Bey'in kadehine kesinlikle dokunmad\u0131m, o ak\u015Fam sadece rutin B12 i\u011Fnesi yapt\u0131m.",
        statementEn: "I never touched Mr. Ha\u015Fim's goblet; that evening I only gave a B12 vitamin injection.",
        isCulprit: true,
        alibi: "Yemek boyunca masan\u0131n kar\u015F\u0131 taraf\u0131nda oturdu\u011Funu iddia etti.",
        alibiEn: "Claimed to sit across the table the entire evening.",
        motive: "Ha\u015Fim Bey ertesi sabah doktorun diplomas\u0131n\u0131 iptal ettirecek savc\u0131l\u0131k dosyas\u0131n\u0131 a\xE7acakt\u0131.",
        motiveEn: "Ha\u015Fim was filing charges next morning to revoke her license.",
        minorSecret: "Klinikten izinsiz kardiyak glikozit bile\u015Fenleri \xE7\u0131kar\u0131yordu.",
        minorSecretEn: "Was illicitly procuring cardiac glycosides from clinic reserves.",
        breakThreshold: 65,
        gossip: {
          "suspect-murat": {
            tr: "Murat saat 20:00'de babas\u0131na ba\u011F\u0131r\u0131p masay\u0131 yumruklad\u0131. Babas\u0131n\u0131n \xF6l\xFCm\xFCn\xFC en \xE7ok o istiyordu.",
            en: "Murat slammed the table and screamed at his father at 20:00. He wanted him dead most."
          }
        },
        behavioralCues: {
          calm: { tr: "Ellerini masada birle\u015Ftirmi\u015F, t\u0131bbi terimlerle konu\u015Fuyor.", en: "Hands clasped on table, speaks in precise medical jargon." },
          nervous: { tr: "Steteskop k\u0131l\u0131f\u0131n\u0131 s\u0131k\u0131yor, boynundaki damarlar belirginle\u015Fiyor.", en: "Squeezes stethoscope case, jugular vein pulses noticeably." },
          breaking: { tr: "G\xF6zl\xFC\u011F\xFCn\xFC d\xFC\u015F\xFCr\xFCyor, sesi \xE7atalla\u015F\u0131yor.", en: "Drops spectacles, voice cracks in desperation." }
        },
        lies: {
          level1: "Dedektif, ben hekimim. Hipokrat yemini ettim. Hastam\u0131 kurtarmak i\xE7in 15 dakika kalp masaj\u0131 yapt\u0131m.",
          level2: "\u015Earap s\xFCrahisini hizmet\xE7i getirdi, zehir mutfakta bula\u015Fm\u0131\u015F olmal\u0131!",
          level3: "\xC7antam\u0131 arayamazs\u0131n\u0131z! Kan\u0131t\u0131n\u0131z nerede?!"
        },
        confession: "Beni mahvedecekti! 30 y\u0131ll\u0131k meslek hayat\u0131m\u0131 bir \xE7\u0131rp\u0131da silecekti. Damlal\u0131kla kadehin kenar\u0131na s\xFCrd\xFCm... Kalp krizinden \xF6lecek sand\u0131m!",
        confessionEn: "He was going to ruin me! Erase 30 years of medicine! I wiped the dropper along the rim... I thought it would look like a heart attack!",
        detailedStatements: [
          { id: "derya-s1", text: "Ak\u015Fam 19:45'te Ha\u015Fim Bey'in tansiyonunu \xF6l\xE7t\xFCm, her \u015Fey normaldi.", textEn: "At 19:45 I checked Mr. Ha\u015Fim's blood pressure, normal.", isContradiction: false },
          { id: "derya-s2", text: "\u015Earap servisi yap\u0131l\u0131rken ellerim kadehlere asla temas etmedi.", textEn: "My hands never touched any wine goblet during service.", isContradiction: false },
          {
            id: "derya-s3",
            text: "\xC7antamdaki t\u0131bbi kitimde sadece steril gazl\u0131 bez ve tansiyon aleti vard\u0131; kimsede olmayan hi\xE7bir kimyasal veya k\u0131s\u0131tl\u0131 ila\xE7 ta\u015F\u0131m\u0131yordum.",
            textEn: "My medical kit contained solely sterile gauze and a blood pressure cuff; zero restricted chemicals or drugs.",
            isContradiction: true,
            contradictionClueId: "clue-toxic-serum",
            explanation: "Adli inceleme Dr. Derya'n\u0131n t\u0131bbi \xE7antas\u0131n\u0131n gizli fermuar\u0131nda y\xFCks\xFCkotu (digitalis) kal\u0131nt\u0131s\u0131 ta\u015F\u0131yan k\u0131r\u0131k cam ampul buldu!",
            explanationEn: "Forensics found a crushed glass ampoule bearing digitalis residue inside Dr. Derya's personal medical bag!"
          }
        ]
      },
      {
        id: "suspect-murat",
        name: "Murat Karaaslan",
        role: "\xDCvey O\u011Ful",
        roleEn: "Stepson",
        age: 27,
        temperament: "\xD6fkeli ve fevri",
        temperamentEn: "Hot-tempered and rash",
        relationshipToVictim: "Babas\u0131yla s\xFCrekli miras ve kumar bor\xE7lar\u0131 y\xFCz\xFCnden \xE7at\u0131\u015F\u0131yordu.",
        relationshipToVictimEn: "In perpetual conflict with father over reckless spending.",
        statement: "Babamla tart\u0131\u015Ft\u0131k ama kadehine dokunmad\u0131m, 20:00'de sofray\u0131 terk ettim.",
        statementEn: "I argued with my father but never touched his wine; I stormed off at 20:00.",
        isCulprit: false,
        alibi: "20:02 ile 20:20 aras\u0131 garajda bah\xE7\u0131vanla araba ak\xFCs\xFCn\xFC takviye etmeye \xE7al\u0131\u015F\u0131yordu.",
        alibiEn: "Jumpstarting his car in garage with the gardener 20:02 - 20:20.",
        motive: "Miras\u0131ndan tamamen men edilmek \xFCzereydi.",
        motiveEn: "Was on the verge of being disinherited.",
        minorSecret: "Babas\u0131 yere y\u0131\u011F\u0131l\u0131nca \xE7al\u0131\u015Fma odas\u0131ndaki kasan\u0131n kapa\u011F\u0131n\u0131 a\xE7maya \xE7al\u0131\u015Ft\u0131.",
        minorSecretEn: "Tried to crack the study safe while his father collapsed.",
        breakThreshold: 78,
        gossip: {
          "suspect-derya": {
            tr: "Doktor kad\u0131n babama zehirli y\u0131lan gibi yakla\u015F\u0131yordu, \u015Farap doldurulurken f\u0131s\u0131lda\u015F\u0131yorlard\u0131.",
            en: "That doctor crept around my father like a serpent; they were whispering before wine was served."
          }
        },
        behavioralCues: {
          calm: { tr: "Kollar\u0131n\u0131 kavu\u015Fturup duvara yaslan\u0131yor.", en: "Arms crossed, leaning aggressively against wall." },
          nervous: { tr: "Yumruklar\u0131n\u0131 s\u0131k\u0131yor, \xE7enesi kas\u0131l\u0131yor.", en: "Clenches fists, jaw muscles twitching." },
          breaking: { tr: "Masay\u0131 tekmeliyor, 'Katil ben de\u011Filim!' diye ba\u011F\u0131r\u0131yor.", en: "Kicks chair, yells 'I am no murderer!'" }
        },
        lies: {
          level1: "Babam bana zorbal\u0131k yapard\u0131 ama onu \xF6ld\xFCrecek kadar al\xE7almad\u0131m.",
          level2: "Evet miras i\xE7in tart\u0131\u015Ft\u0131k, ama kadehine hi\xE7bir \u015Fey katmad\u0131m!",
          level3: "Doktorun \xE7antas\u0131n\u0131 aray\u0131n, o gece elleri titriyordu!"
        },
        confession: "Ben katil de\u011Filim! Sadece param\u0131 istiyordum!",
        confessionEn: "I am no murderer! I just wanted my money!",
        detailedStatements: [
          { id: "murat-s1", text: "Babamla \u015Firket hisseleri y\xFCz\xFCnden tart\u0131\u015Ft\u0131m.", textEn: "I argued with my father over stock equity.", isContradiction: false },
          { id: "murat-s2", text: "20:00'de masadan kalk\u0131p do\u011Fruca garaja indim.", textEn: "At 20:00 I got up and went straight to the garage.", isContradiction: false }
        ]
      },
      {
        id: "suspect-hizmetci",
        name: "G\xFClizar Han\u0131m",
        role: "Ba\u015F Hizmetk\xE2r",
        roleEn: "Head Housekeeper",
        age: 58,
        temperament: "Sad\u0131k ve kederli",
        temperamentEn: "Loyal and grief-stricken",
        relationshipToVictim: "Ha\u015Fim Bey'e 30 y\u0131ld\u0131r hizmet eden evin en k\u0131demli \xE7al\u0131\u015Fan\u0131.",
        relationshipToVictimEn: "30-year devoted servant to Ha\u015Fim.",
        statement: "\u015Earab\u0131 mahzenden m\xFCh\xFCrl\xFC \u015Fi\u015Feyle getirdim, masada a\xE7\u0131ld\u0131.",
        statementEn: "I fetched the sealed wine from cellar, it was uncorked tableside.",
        isCulprit: false,
        alibi: "Mutfak g\xFCvenlik kameras\u0131 \u015Fi\u015Feyi getirdi\u011Fi andan itibaren kesintisiz kay\u0131tta.",
        alibiEn: "Kitchen surveillance verifies bottle was intact.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "K\xF6\u015Fkten gizlice antika g\xFCm\xFC\u015F ka\u015F\u0131k tak\u0131mlar\u0131n\u0131 saklam\u0131\u015Ft\u0131.",
        minorSecretEn: "Had quietly kept some heirloom silverware.",
        breakThreshold: 90,
        gossip: {
          "suspect-derya": {
            tr: "Doktor han\u0131m masada kadehlerin yerini de\u011Fi\u015Ftirirken elini aceleyle \xE7ekti.",
            en: "The doctor pulled her hand back very quickly while adjusting the goblets."
          }
        },
        behavioralCues: {
          calm: { tr: "Mendiliyle g\xF6zlerini siliyor.", en: "Dabs eyes with embroidered handkerchief." },
          nervous: { tr: "\xD6nl\xFC\u011F\xFCn\xFCn ceplerini yokluyor.", en: "Fumbles inside apron pockets." },
          breaking: { tr: "Dizlerinin \xFCst\xFCne \xE7\xF6k\xFCp dua ediyor.", en: "Drops to knees in tears." }
        },
        lies: {
          level1: "Otuz y\u0131ld\u0131r bu k\xF6\u015Fkteyim, Ha\u015Fim Bey evlad\u0131m gibiydi.",
          level2: "Doktor han\u0131m kadehlerin yerini de\u011Fi\u015Ftirdi.",
          level3: "Ben hi\xE7bir \u015Feye dokunmad\u0131m!"
        },
        confession: "Ben sadece servis yapt\u0131m efendim!",
        confessionEn: "I only served dinner, detective!",
        detailedStatements: [
          { id: "gulizar-s1", text: "Mahzenden 2012 rekoltesi \u015Farab\u0131 m\xFCh\xFCrl\xFC \xE7\u0131kard\u0131m.", textEn: "I brought the sealed 2012 vintage from cellar.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-toxic-serum",
        label: "K\u0131r\u0131k Digitalis Ampul\xFC",
        labelEn: "Crushed Digitalis Ampoule",
        category: "forensic",
        type: "forensic",
        contradictsSuspectId: "suspect-derya",
        detail: "Doktor \xE7antas\u0131n\u0131n gizli fermuar\u0131nda ezilmi\u015F cam ampul ve toksik digitalis izi bulundu.",
        detailEn: "Crushed glass ampoule with toxic digitalis residue recovered from doctor bag secret pocket.",
        significance: "Doktorun k\u0131s\u0131tl\u0131 zehir ta\u015F\u0131d\u0131\u011F\u0131n\u0131 kan\u0131tlar.",
        significanceEn: "Proves the doctor was carrying lethal cardiac toxins."
      },
      {
        id: "clue-wine-bottle",
        label: "M\xFCh\xFCrl\xFC \u015Ei\u015Fe Kimya Raporu",
        labelEn: "Sealed Bottle Chemistry Report",
        category: "forensic",
        type: "object",
        clearsSuspectId: "suspect-hizmetci",
        detail: "Masan\u0131n \xFCzerindeki ana \u015Farap \u015Fi\u015Fesinde zehir yok; toksin sadece maktul\xFCn kadeh kenar\u0131nda.",
        detailEn: "No poison in wine bottle; toxin strictly localized on victim's goblet rim.",
        significance: "\u015Earab\u0131 getiren hizmet\xE7iyi temize \xE7\u0131kar\u0131r.",
        significanceEn: "Clears the housekeeper who brought the bottle."
      },
      {
        id: "clue-garage-witness",
        label: "Bah\xE7\u0131van\u0131n Yaz\u0131l\u0131 Beyan\u0131",
        labelEn: "Gardener's Signed Statement",
        category: "witness",
        type: "alibi",
        clearsSuspectId: "suspect-murat",
        detail: "Murat'\u0131n 20:02 ile 20:20 aras\u0131 garajda ak\xFC takviyesi yapt\u0131\u011F\u0131n\u0131 bah\xE7\u0131van yaz\u0131l\u0131 olarak do\u011Frulad\u0131.",
        detailEn: "Gardener confirmed Murat was in garage jumpstarting car battery 20:02 - 20:20.",
        significance: "Murat'\u0131n olay an\u0131nda yemek salonunda olmad\u0131\u011F\u0131n\u0131 kan\u0131tlar.",
        significanceEn: "Establishes Murat was not in the dining hall during the poisoning."
      }
    ]
  },
  // 3. VAKA: Şehir Tiyatrosunda Prömiyer Cinayeti
  {
    id: "case-03-tiyatro-cinayeti",
    title: "Pr\xF6miyer Gecesi G\xF6lgesi",
    titleEn: "Shadow on Opening Night",
    difficulty: "normal",
    briefing: "\u015Eehir tiyatrosunun g\xF6rkemli pr\xF6miyerinde ba\u015Frol oyuncusu kulisinde bayg\u0131n bulundu; kost\xFCm\xFCndeki gizli i\u011Fneyle zehirlenmi\u015Fti. Sahneye \xE7\u0131kmas\u0131na 15 dakika kala kulise sadece 3 ki\u015Fi girip \xE7\u0131kt\u0131.",
    briefingEn: "During the grand theatrical premiere, the lead actor was found unconscious in his dressing room; poisoned by a concealed needle in his doublet. Only 3 people accessed backstage 15 minutes before showtime.",
    incidentTime: "19:45",
    location: "Kulis 1 Numaral\u0131 Oda",
    locationEn: "Dressing Room No. 1",
    victim: {
      name: "Kerem Yal\xE7\u0131n",
      occupation: "Ba\u015Frol Oyuncusu",
      occupationEn: "Lead Theater Actor",
      causeOfDeath: "Akonitin n\xF6rotoksinine ba\u011Fl\u0131 solunum felci",
      causeOfDeathEn: "Respiratory paralysis induced by aconitine neurotoxin"
    },
    timeline: [
      { time: "19:15", event: "Kost\xFCmc\xFC Perihan kost\xFCm\xFC kulisteki ask\u0131ya ast\u0131.", eventEn: "Perihan hung the doublet on dressing room rack.", verified: true },
      { time: "19:30", event: "Kerem kulise girip kap\u0131y\u0131 kilitledi ve kost\xFCm\xFCn\xFC giymeye ba\u015Flad\u0131.", eventEn: "Kerem locked himself inside to dress.", verified: true },
      { time: "19:45", event: "\u0130\xE7eriden cam k\u0131r\u0131lma sesi geldi; Kerem yerde inlerken bulundu.", eventEn: "Glass shattered inside; Kerem discovered on floor.", verified: true },
      { time: "20:00", event: "Perde a\xE7\u0131l\u0131\u015F\u0131 iptal edildi.", eventEn: "Curtain call canceled.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Kadife kost\xFCm\xFCn sa\u011F yaka astar\u0131na dikilmi\u015F 3 cm boyunda zehirli terzi i\u011Fnesi.",
        "\u0130\u011Fnenin ucunda akonitin (kurtbo\u011Fan) zehri tespit edildi.",
        "Kulis kap\u0131s\u0131n\u0131n kolunda makyaj pudras\u0131 izi."
      ],
      en: [
        "A 3cm envenomed dressmaker pin concealed beneath the right lapel lining.",
        "Aconitine neurotoxin verified on pin tip.",
        "Stage pancake makeup dust on doorknob."
      ]
    },
    culpritId: "suspect-sinan",
    correctMethod: "Kost\xFCm\xFCn yakas\u0131na zehirli akonitin i\u011Fnesini yerle\u015Ftirerek ba\u015Frol\xFCn sahneye \xE7\u0131kmas\u0131n\u0131 engelledi.",
    correctMethodEn: "Fixed an aconitine poison pin onto the lapel to eliminate the lead.",
    correctMotive: "Kerem zehirlenirse ba\u015Frol Sinan'a kalacak ve Broadway turnesine o gidecekti.",
    correctMotiveEn: "Eliminating Kerem meant Sinan would lead the lucrative Broadway tour.",
    winningContradiction: {
      suspectId: "suspect-sinan",
      sentenceId: "sinan-s2",
      clueId: "clue-mirror-ticket"
    },
    analystSummary: {
      tr: "Analist Notu: \u015E\xFCpheli t\xFCm ak\u015Fam\u0131 balkon 12 numaral\u0131 koltukta ge\xE7irdi\u011Fini iddia ediyor. Gi\u015Fe bilet d\xF6k\xFCm\xFC ve koltuk kay\u0131tlar\u0131n\u0131 inceleyin.",
      en: "Analyst Note: Suspect claims continuous presence in balcony seat 12. Check box office logs for seat occupancy."
    },
    suspects: [
      {
        id: "suspect-sinan",
        name: "Sinan Berk",
        role: "Yedek Ba\u015Frol (Dubl\xF6r)",
        roleEn: "Understudy Lead",
        age: 31,
        temperament: "K\u0131skan\xE7 ve h\u0131rsl\u0131",
        temperamentEn: "Envious and fiercely ambitious",
        relationshipToVictim: "Kerem'in 4 y\u0131ld\u0131r yedek oyuncusuydu, rol\xFCn\xFC \xE7almak istiyordu.",
        relationshipToVictimEn: "Understudy for 4 years, desperate to usurp the limelight.",
        statement: "B\xFCt\xFCn ak\u015Fam balkonda seyircilerin aras\u0131nda oturup bro\u015F\xFCr inceliyordum, kulise hi\xE7 yakla\u015Fmad\u0131m.",
        statementEn: "I was seated in the balcony among patrons reading the pamphlet; never went backstage.",
        isCulprit: true,
        alibi: "19:30'dan itibaren aral\u0131ks\u0131z balkon 12 numaral\u0131 koltukta oturdu\u011Funu iddia etti.",
        alibiEn: "Claimed unbroken presence in balcony seat 12 from 19:30.",
        motive: "Kerem sahneye \xE7\u0131kamazsa ba\u015Frol Sinan'a kalacakt\u0131.",
        motiveEn: "If Kerem couldn't perform, Sinan would star in the Broadway tour.",
        minorSecret: "Kerem'in replik defterini daha \xF6nce karalam\u0131\u015Ft\u0131.",
        minorSecretEn: "Vandalized Kerem's prompt book earlier.",
        breakThreshold: 70,
        gossip: {
          "suspect-perihan": {
            tr: "Perihan kost\xFCmleri dikerken i\u011Fnelerini hep a\u011Fz\u0131nda tutar, o i\u011Fneyi o dikti!",
            en: "Perihan holds pins in her teeth while stitching; she must have lodged that needle!"
          }
        },
        behavioralCues: {
          calm: { tr: "Tiyatro monologu ezberler gibi dudaklar\u0131n\u0131 k\u0131p\u0131rdat\u0131yor.", en: "Mouths theater monologues silently with feigned poise." },
          nervous: { tr: "T\u0131rnaklar\u0131n\u0131 avucuna bat\u0131r\u0131yor, s\u0131k s\u0131k yutkunuyor.", en: "Digs nails into palms, swallows repetitively." },
          breaking: { tr: "Rol\xFC yapamad\u0131\u011F\u0131 i\xE7in \xE7\u0131ld\u0131r\u0131yor, tirat atarak ba\u011F\u0131r\u0131yor.", en: "Breaks character completely, shrieking theatrically." }
        },
        lies: {
          level1: "Dedektif, Kerem benim dostumdur. Onun ba\u015Far\u0131s\u0131 T\xFCrk tiyatrosunun ba\u015Far\u0131s\u0131d\u0131r.",
          level2: "Balkonda beni g\xF6ren seyirciler var! Salona sorun!",
          level3: "Kulise sadece kost\xFCm\xFCn kuma\u015F\u0131na bakmak i\xE7in uzand\u0131m, i\u011Fneyle i\u015Fim yok!"
        },
        confession: "Y\u0131llard\u0131r onun g\xF6lgesinde s\xFCr\xFCnmekten b\u0131kt\u0131m! Bu rol benim hakk\u0131md\u0131! \u0130\u011Fneyi kost\xFCm\xFCn yakas\u0131na ben saplad\u0131m... Sadece bay\u0131ls\u0131n istedim!",
        confessionEn: "Sick of rotting in his shadow! That spotlight was mine! I pinned the poisoned needle to his doublet... I only meant for him to pass out!",
        detailedStatements: [
          { id: "sinan-s1", text: "Oyun saat 20:00'de ba\u015Flayacakt\u0131.", textEn: "The play was scheduled for 20:00.", isContradiction: false },
          {
            id: "sinan-s2",
            text: "Saat 19:30'dan itibaren aral\u0131ks\u0131z balkon 12 numaral\u0131 koltukta bro\u015F\xFCr okuyordum.",
            textEn: "From 19:30 onwards I was continuously seated in balcony seat #12 reading the program pamphlet.",
            isContradiction: true,
            contradictionClueId: "clue-mirror-ticket",
            explanation: "Balkon 12 numaral\u0131 koltuk saat 19:25'te \xFCnl\xFC tiyatro ele\u015Ftirmeni Haldun Bey'e sat\u0131ld\u0131 ve Haldun Bey 19:30'da bizzat o koltu\u011Fa oturdu; Sinan orada yoktu!",
            explanationEn: "Balcony seat 12 was sold at 19:25 to critic Mr. Haldun who occupied it at 19:30; Sinan was never there!"
          }
        ]
      },
      {
        id: "suspect-perihan",
        name: "Perihan Ak",
        role: "Kost\xFCm Sorumlusu",
        roleEn: "Costume Mistress",
        age: 50,
        temperament: "Titiz ve tela\u015Fl\u0131",
        temperamentEn: "Meticulous and fretful",
        relationshipToVictim: "Kerem s\xFCrekli kost\xFCmlerini y\u0131rt\u0131p Perihan'a hakaret ediyordu.",
        relationshipToVictimEn: "Kerem regularly berated her craftsmanship.",
        statement: "Kost\xFCm\xFC 19:15'te as\u0131p \xFCt\xFC odas\u0131na ge\xE7tim.",
        statementEn: "Hung doublet at 19:15 and went to pressing room.",
        isCulprit: false,
        alibi: "19:20 - 19:50 aras\u0131 asistan\u0131yla \xFCt\xFC odas\u0131ndayd\u0131.",
        alibiEn: "In pressing room with assistant 19:20 - 19:50.",
        motive: "Kerem'in a\u015Fa\u011F\u0131lamalar\u0131ndan b\u0131km\u0131\u015Ft\u0131.",
        motiveEn: "Exhausted by Kerem's verbal abuse.",
        minorSecret: "Kuma\u015F b\xFCt\xE7esinden kalan paray\u0131 gizlice cebe indirmi\u015Fti.",
        minorSecretEn: "Pocketed surplus silk allowance.",
        breakThreshold: 85,
        gossip: {
          "suspect-sinan": {
            tr: "Sinan'\u0131n kulis kap\u0131s\u0131nda sinsi sinsi bekledi\u011Fini g\xF6rd\xFCm.",
            en: "I saw Sinan lurking near the dressing room door."
          }
        },
        behavioralCues: {
          calm: { tr: "\xD6nl\xFC\u011F\xFCndeki iplikleri temizliyor.", en: "Picks loose threads off apron." },
          nervous: { tr: "Mezuray\u0131 parmaklar\u0131na sar\u0131yor.", en: "Tightly wraps measuring tape around fingers." },
          breaking: { tr: "H\u0131\xE7k\u0131r\u0131klara bo\u011Fuluyor.", en: "Breaks down weeping." }
        },
        lies: {
          level1: "Ben sanat\xE7\u0131lar\u0131 giydiririm, zehirlemem.",
          level2: "Kerem bana kaba davrand\u0131 ama i\u011Fneyle vurmad\u0131m!",
          level3: "Sinan kulise girdi diyorum size!"
        },
        confession: "Ben masumum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "perihan-s1", text: "Kost\xFCm\xFC teslim etti\u011Fimde yakas\u0131nda i\u011Fne yoktu.", textEn: "There was no needle when I hung it.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-mirror-ticket",
        label: "Gi\u015Fe Koltuk Sat\u0131\u015F K\xFCt\xFC\u011F\xFC",
        labelEn: "Box Office Seat Registry",
        category: "document",
        type: "numerical",
        contradictsSuspectId: "suspect-sinan",
        detail: "Balkon 12 numaral\u0131 koltuk saat 19:25'te tiyatro ele\u015Ftirmeni Haldun Taner'e sat\u0131ld\u0131 ve Haldun Bey 19:30'da koltu\u011Fa oturdu.",
        detailEn: "Balcony seat 12 sold to critic Haldun Taner at 19:25 who occupied it at 19:30.",
        significance: "Sinan'\u0131n balkondayd\u0131m yalan\u0131n\u0131 kesin olarak \xE7\xF6kertir.",
        significanceEn: "Completely disproves Sinan's balcony seating alibi."
      },
      {
        id: "clue-ironing-log",
        label: "\xDCt\xFC Odas\u0131 Personel Kart Okuyucusu",
        labelEn: "Pressing Room Badge Log",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-perihan",
        detail: "Perihan Ak'\u0131n 19:20 - 19:50 aras\u0131 \xFCt\xFC odas\u0131ndan ayr\u0131lmad\u0131\u011F\u0131 manyetik kap\u0131 loglar\u0131yla do\u011Fruland\u0131.",
        detailEn: "Magnetic lock verified Perihan stayed in pressing room 19:20 - 19:50.",
        significance: "Kost\xFCmc\xFCn\xFCn cinayet an\u0131ndaki alibisini temize \xE7\u0131kar\u0131r.",
        significanceEn: "Validates costume mistress alibi."
      }
    ]
  },
  // 4. VAKA: Doğu Ekspresinde Soğuk Kompartıman
  {
    id: "case-04-ekspres-trendeki-cinayet",
    title: "Ekspres Trende So\u011Fuk Kompart\u0131man",
    titleEn: "Cold Compartment on the Express",
    difficulty: "hard",
    briefing: "Balkan da\u011Flar\u0131nda yo\u011Fun kar f\u0131rt\u0131nas\u0131 y\xFCz\xFCnden raylarda mahsur kalan l\xFCks yatakl\u0131 trende, 4 numaral\u0131 VIP kompart\u0131manda emekli diplomat Baron Von Stern b\u0131\xE7aklanarak \xF6ld\xFCr\xFCld\xFC. Kompart\u0131man i\xE7eriden s\xFCrg\xFCl\xFCyd\xFC, pencere ise karla kapl\u0131 d\u0131\u015Far\u0131ya aral\u0131kt\u0131.",
    briefingEn: "Stranded in heavy blizzard snowdrifts in the Balkan mountains, retired diplomat Baron Von Stern was found stabbed in VIP Compartment #4. The door was bolted from inside; the window was slightly ajar to the freezing snow.",
    incidentTime: "02:30",
    location: "Yatakl\u0131 Vagon Kompart\u0131man No: 4",
    locationEn: "Sleeper Car Compartment No. 4",
    victim: {
      name: "Baron Von Stern",
      occupation: "Emekli Diplomat & Antikac\u0131",
      occupationEn: "Retired Diplomat & Antiquarian",
      causeOfDeath: "G\xF6\u011F\xFCs kafesine saplanan ince cerrahi han\xE7er darbesi",
      causeOfDeathEn: "Penetrating surgical stiletto wound to the thorax"
    },
    timeline: [
      { time: "01:00", event: "Tren raylardaki \xE7\u0131\u011F nedeniyle durdu; vagon \u0131s\u0131tmas\u0131 jenerat\xF6re ge\xE7ti.", eventEn: "Train halted due to avalanche; heating switched to backup generator.", verified: true },
      { time: "02:15", event: "Kond\xFCkt\xF6r koridordan ge\xE7ti\u011Finde Baron'un kap\u0131s\u0131 kilitliydi.", eventEn: "Conductor patrolled corridor; Baron's door bolted.", verified: true },
      { time: "02:30", event: "4 numaral\u0131 kompart\u0131mandan bo\u011Fuk bir inilti ve cam t\u0131k\u0131rt\u0131s\u0131 duyuldu.", eventEn: "Muffled groan and window rattle heard from Room 4.", verified: true },
      { time: "03:00", event: "Kap\u0131 k\u0131r\u0131ld\u0131; Baron \xE7al\u0131\u015Fma masas\u0131nda cans\u0131z bulundu.", eventEn: "Door breached; Baron found dead at writing desk.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Pencere pervaz\u0131nda d\u0131\u015Far\u0131dan i\xE7eriye do\u011Fru ince bir misina ipi kal\u0131nt\u0131s\u0131.",
        "Kompart\u0131man kap\u0131s\u0131n\u0131n i\xE7 s\xFCrg\xFCs\xFC, misinayla pencereden \xE7ekilerek kilitlenebilecek \u015Fekilde hafif ya\u011Flanm\u0131\u015F.",
        "Maktul\xFCn avucunda y\u0131rt\u0131lm\u0131\u015F bir tren bilet k\xF6\u015Fesi (No: 7B)."
      ],
      en: [
        "Traces of ultra-fine monofilament fishing line caught in window latch.",
        "Inside door bolt lightly lubricated to allow sliding shut via string pulled from window.",
        "Torn sleeper ticket corner (No: 7B) clutched in victim's left hand."
      ]
    },
    culpritId: "suspect-victor",
    correctMethod: "Kompart\u0131man kap\u0131s\u0131n\u0131 misina hilesiyle pencereden kilitleyip 'kilitli oda' yan\u0131lsamas\u0131 yaratt\u0131.",
    correctMethodEn: "Rigged a locked-room illusion by pulling the lubricated bolt via fishing line from the outside ledge.",
    correctMotive: "Diplomat\u0131n \xE7antas\u0131ndaki gizli sava\u015F su\xE7lar\u0131 ar\u015Fivini ele ge\xE7irmek.",
    correctMotiveEn: "Stealing the classified war crime dossier held in the diplomat's satchel.",
    winningContradiction: {
      suspectId: "suspect-victor",
      sentenceId: "victor-s2",
      clueId: "clue-frostbite-gloves"
    },
    analystSummary: {
      tr: "Analist Notu: Kilitli oda bir misina d\xFCzene\u011Fiyle kurulmu\u015F. Katil pencereden trenin d\u0131\u015F pervaz\u0131na \xE7\u0131km\u0131\u015F olmal\u0131. \u015E\xFCphelilerin dondurucu so\u011Fukta d\u0131\u015Far\u0131 \xE7\u0131k\u0131p \xE7\u0131kmad\u0131\u011F\u0131na dair fiziksel izleri aray\u0131n.",
      en: "Analyst Note: The locked room was staged via line through the window. The culprit must have stepped onto the freezing outside ledge. Look for physical signs of blizzard exposure."
    },
    suspects: [
      {
        id: "suspect-victor",
        name: "Victor Moreau",
        role: "Ki\u015Fisel Koruma & Eski Asker",
        roleEn: "Personal Bodyguard & Ex-Commando",
        age: 42,
        temperament: "\xC7elik gibi sakin, disiplinli",
        temperamentEn: "Steely calm, disciplined",
        relationshipToVictim: "Baron'un 6 ayd\u0131r yan\u0131nda \xE7al\u0131\u015Fan \xF6zel korumas\u0131.",
        relationshipToVictimEn: "Private bodyguard hired 6 months prior.",
        statement: "Gece boyunca trenin restoran vagonunda s\u0131cak \xE7ay i\xE7erek n\xF6betteydim, kompart\u0131man taraf\u0131na hi\xE7 gitmedim.",
        statementEn: "I was on watch in the dining car sipping hot tea all night; never approached his compartment.",
        isCulprit: true,
        alibi: "02:00 - 03:00 aras\u0131 restoran vagonunda oldu\u011Funu s\xF6yledi.",
        alibiEn: "Claimed to be in the dining car from 02:00 to 03:00.",
        motive: "Yabanc\u0131 bir istihbarat servisi taraf\u0131ndan ar\u015Fiv kar\u015F\u0131l\u0131\u011F\u0131 1 milyon euro vaat edilmi\u015Fti.",
        motiveEn: "Promised 1M euros by foreign intelligence for the dossier.",
        minorSecret: "Yolculuk s\u0131ras\u0131nda sahte kimlik ve pasaport ta\u015F\u0131yordu.",
        minorSecretEn: "Carried a forged passport under false name.",
        breakThreshold: 62,
        gossip: {
          "suspect-nadia": {
            tr: "Nadia Han\u0131m gece yar\u0131s\u0131 koridorda elinde bavulla tela\u015Fla y\xFCr\xFCyordu.",
            en: "Nadia was scurrying down the carriage corridor clutching a valise at midnight."
          }
        },
        behavioralCues: {
          calm: { tr: "Askeri bir selam duru\u015Fuyla dedektife bak\u0131yor.", en: "Maintains rigid military posture, eye contact unwavering." },
          nervous: { tr: "Parmak eklemlerini k\xFCtletiyor, \xE7izmelerini gizlemeye \xE7al\u0131\u015F\u0131yor.", en: "Cracks knuckles, subtly tucks boots under chair." },
          breaking: { tr: "K\u0131l\u0131f\u0131ndaki silah\u0131na uzan\u0131r gibi refleks veriyor, sonra teslim oluyor.", en: "Reflexively reaches toward sidearm before surrendering." }
        },
        lies: {
          level1: "Baron benim korumam alt\u0131ndayd\u0131. Ba\u015Far\u0131s\u0131z oldum ama ben bir suikast\xE7\u0131 de\u011Filim.",
          level2: "Restorandan sadece 5 dakikal\u0131\u011F\u0131na hava almak i\xE7in \xE7\u0131kt\u0131m!",
          level3: "O kilitli odaya nas\u0131l girmi\u015F olabilirim ki?! Kap\u0131 i\xE7eriden s\xFCrg\xFCl\xFCyd\xFC!"
        },
        confession: "O ar\u015Fiv binlerce masumun kan\u0131n\u0131 ta\u015F\u0131yordu! O diplomat bir canavard\u0131! Pencereden pervaza \xE7\u0131k\u0131p han\xE7eri saplad\u0131m, kap\u0131y\u0131 misinayla \xE7ekip kilitledim...",
        confessionEn: "That dossier held the blood of thousands! The Baron was a monster! I climbed the outer ledge, stabbed him, and looped the bolt with fishing line...",
        detailedStatements: [
          { id: "victor-s1", text: "Tren \xE7\u0131\u011F y\xFCz\xFCnden durdu\u011Funda yolcular\u0131 sakinle\u015Ftirdim.", textEn: "When the avalanche struck I assisted panicked passengers.", isContradiction: false },
          {
            id: "victor-s2",
            text: "Saat 02:15 ile 02:45 aras\u0131nda restoran vagonundan tek saniye bile ayr\u0131lmad\u0131m ve s\u0131f\u0131r\u0131n alt\u0131ndaki d\u0131\u015F havaya hi\xE7 temas etmedim.",
            textEn: "Between 02:15 and 02:45 I never left the heated dining car and had zero contact with the sub-zero freezing exterior.",
            isContradiction: true,
            contradictionClueId: "clue-frostbite-gloves",
            explanation: "Victor'un \xE7antas\u0131ndaki termal eldivenlerin \xFCzerinde d\u0131\u015F pervazdaki eksi 20 derecelik donmu\u015F \xE7am re\xE7inesi ve ellerinde 2. derece so\u011Fuk yan\u0131\u011F\u0131 bulundu!",
            explanationEn: "Victor's thermal gloves were crusted with sub-zero frozen exterior pine frost and his fingertips showed severe 2nd degree frostbite!"
          }
        ]
      },
      {
        id: "suspect-nadia",
        name: "Nadia Petrova",
        role: "Antikac\u0131 & M\xFCzayedeci",
        roleEn: "Antiquarian & Dealer",
        age: 36,
        temperament: "Kibar ve tela\u015Fl\u0131",
        temperamentEn: "Polite and agitated",
        relationshipToVictim: "Baron ile ortak el yazmas\u0131 ticareti yap\u0131yordu.",
        relationshipToVictimEn: "Trading partner in rare antiquities.",
        statement: "Kendi kompart\u0131man\u0131mda roman okuyordum.",
        statementEn: "I was reading a novel in my sleeper cabin.",
        isCulprit: false,
        alibi: "02:15'te kom\u015Fu vagondaki yolcuyla ortak ila\xE7 ar\u0131yordu.",
        alibiEn: "Seeking aspirin with adjacent passenger at 02:15.",
        motive: "Baron'a 50 bin frank borcu vard\u0131.",
        motiveEn: "Owed the Baron 50,000 francs.",
        minorSecret: "Bavulunda g\xFCmr\xFCks\xFCz alt\u0131n sikkeler ka\xE7\u0131r\u0131yordu.",
        minorSecretEn: "Smuggling undeclared gold ducats in luggage.",
        breakThreshold: 82,
        gossip: {
          "suspect-victor": {
            tr: "Victor koruma falan de\u011Fil, eski bir paral\u0131 asker. G\xF6zlerinde cinayet var.",
            en: "Victor is no mere bodyguard; he is a mercenary with murder in his eyes."
          }
        },
        behavioralCues: {
          calm: { tr: "\u0130pek \u015Fal\u0131n\u0131 omzuna sar\u0131yor.", en: "Wraps silk shawl tightly around shoulders." },
          nervous: { tr: "Y\xFCz\xFC\u011F\xFCn\xFC parma\u011F\u0131nda h\u0131zla \xE7eviriyor.", en: "Spins signet ring on finger nervously." },
          breaking: { tr: "G\xF6zya\u015Flar\u0131 i\xE7inde bavulunu a\xE7\u0131yor.", en: "Sobbing, throws open valise." }
        },
        lies: {
          level1: "Ben zarif bir han\u0131mefendiyim, kan g\xF6rmeye dayanamam.",
          level2: "Evet kap\u0131s\u0131n\u0131 \xE7ald\u0131m ama cevap vermedi!",
          level3: "Bavulumdaki alt\u0131nlar y\xFCz\xFCnden korktum, cinayetle ilgim yok!"
        },
        confession: "Ben katil de\u011Filim, sadece g\xFCmr\xFCk ka\xE7ak\xE7\u0131s\u0131y\u0131m!",
        confessionEn: "I am no killer, merely a gold smuggler!",
        detailedStatements: [
          { id: "nadia-s1", text: "Kompart\u0131man\u0131mda kitap okuyordum.", textEn: "I was reading in my berth.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-frostbite-gloves",
        label: "D\u0131\u015F Pervaz K\u0131ra\u011F\u0131s\u0131 ve Don Yan\u0131\u011F\u0131",
        labelEn: "Exterior Frost & Frostbite Report",
        category: "forensic",
        type: "spatial",
        contradictsSuspectId: "suspect-victor",
        detail: "Victor'un eldivenlerinde tren d\u0131\u015F\u0131ndaki -20 derecelik \xE7am re\xE7ineli don kristali ve ellerinde ileri derece don yan\u0131\u011F\u0131 tespit edildi.",
        detailEn: "Victor's gloves coated in -20C exterior pine frost crystals; fingers afflicted by severe frostbite.",
        significance: "Victor'un d\u0131\u015Far\u0131 \xE7\u0131kmad\u0131m ifadesini yerle bir eder.",
        significanceEn: "Destroys Victor's claim of staying inside the heated carriage."
      },
      {
        id: "clue-train-ticket-7b",
        label: "Bilet No 7B Yolcu Beyan\u0131",
        labelEn: "Ticket 7B Passenger Corroboration",
        category: "witness",
        type: "alibi",
        clearsSuspectId: "suspect-nadia",
        detail: "Kom\u015Fu kompart\u0131mandaki Alman profes\xF6r, Nadia'n\u0131n 02:20'de kap\u0131s\u0131n\u0131 \xE7al\u0131p ba\u015F a\u011Fr\u0131s\u0131 ilac\u0131 istedi\u011Fini teyit etti.",
        detailEn: "German professor in cabin 7B verified Nadia requested headache medication at 02:20.",
        significance: "Nadia'n\u0131n cinayet an\u0131ndaki alibisini do\u011Frular.",
        significanceEn: "Corroborates Nadia's alibi during the murder timeframe."
      }
    ]
  },
  // 5. VAKA: Kuantum Ar-Ge Laboratuvarı Sabotajı
  {
    id: "case-05-kuantum-laboratuvari",
    title: "Kuantum Laboratuvar\u0131nda Gaz S\u0131z\u0131nt\u0131s\u0131",
    titleEn: "Leak in the Quantum Cleanroom",
    difficulty: "hard",
    briefing: "Teknoloji devinin yer alt\u0131ndaki kriyojenik \xE7ip laboratuvar\u0131nda, ba\u015F ara\u015Ft\u0131rmac\u0131 Dr. Arda s\u0131zan s\u0131v\u0131 nitrojen gaz\u0131 nedeniyle bo\u011Fularak hayat\u0131n\u0131 kaybetti. Olay yerindeki temiz oda giri\u015F kartlar\u0131 sadece 3 ara\u015Ft\u0131rmac\u0131ya aitti.",
    briefingEn: "In a subterranean cryogenic chip facility, lead scientist Dr. Arda suffocated from a liquid nitrogen cleanroom leak. Keycard access was restricted to only 3 researchers.",
    incidentTime: "22:45",
    location: "Temiz Oda Kat -3",
    locationEn: "Cleanroom Sub-level 3",
    victim: {
      name: "Dr. Arda G\xFCven",
      occupation: "Kuantum Donan\u0131m Direkt\xF6r\xFC",
      occupationEn: "Director of Quantum Hardware",
      causeOfDeath: "S\u0131v\u0131 nitrojen buharla\u015Fmas\u0131na ba\u011Fl\u0131 hiperkapni ve oksijen yetersizli\u011Fi",
      causeOfDeathEn: "Hypercapnia and acute hypoxia due to nitrogen venting"
    },
    timeline: [
      { time: "22:00", event: "Vardiya de\u011Fi\u015Fimi yap\u0131ld\u0131; genel personel binay\u0131 terk etti.", eventEn: "Shift handover completed; general personnel evacuated.", verified: true },
      { time: "22:30", event: "Kriyojenik vana manuel override (el kumandas\u0131) moduna al\u0131nd\u0131.", eventEn: "Cryogenic valve toggled to manual override.", verified: true },
      { time: "22:45", event: "Temiz oda oksijen seviyesi %8'e d\xFC\u015Ft\xFC; acil durum sirenleri \xE7ald\u0131.", eventEn: "Cleanroom oxygen plummeted to 8%; sirens activated.", verified: true },
      { time: "23:05", event: "Kurtarma ekipleri Arda'y\u0131 kap\u0131 kilit panelinin \xF6n\xFCnde cans\u0131z buldu.", eventEn: "Rescue team recovered Arda's body at airlock.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Hava kilidi \xE7\u0131k\u0131\u015F panelindeki acil durum tahliye butonu arkadan bir plastik kelep\xE7eyle kilitlenmi\u015F.",
        "Nitrojen vanas\u0131n\u0131n \xE7ark\u0131nda sar\u0131 renkli antistatik temiz oda eldiveni polimeri.",
        "Kurban\u0131n cebindeki USB belle\u011Fin manyetik olarak s\u0131f\u0131rland\u0131\u011F\u0131 tespit edildi."
      ],
      en: [
        "Airlock emergency override button mechanically jammed with a nylon zip-tie.",
        "Yellow antistatic cleanroom glove polymer residue on the cryogenic valve wheel.",
        "Victim's personal USB drive wiped clean by localized degaussing."
      ]
    },
    culpritId: "suspect-kerim",
    correctMethod: "Manuel vanay\u0131 a\xE7\u0131p acil tahliye butonunu plastik kelep\xE7eyle kilitleyerek kurban\u0131 i\xE7eride bo\u011Fdu.",
    correctMethodEn: "Opened the manual vent and zip-tied the airlock emergency release shut.",
    correctMotive: "\xC7ip mimarisinin patentini rakip \u015Firkete satmak i\xE7in Arda'n\u0131n yay\u0131n\u0131n\u0131 engellemek.",
    correctMotiveEn: "Sabotaging publication to sell proprietary chip architecture to a rival firm.",
    winningContradiction: {
      suspectId: "suspect-kerim",
      sentenceId: "kerim-s2",
      clueId: "clue-smart-badge"
    },
    analystSummary: {
      tr: "Analist Notu: \u015E\xFCpheli Kerim zemin kattaki kafeteryada oldu\u011Funu s\xF6yl\xFCyor. Bina i\xE7i RFID \xE7ip takip sistemindeki turnike kay\u0131tlar\u0131yla ifadesini kar\u015F\u0131la\u015Ft\u0131r\u0131n.",
      en: "Analyst Note: Suspect Kerim claims presence in the ground floor cafe. Match with RFID badge reader logs."
    },
    suspects: [
      {
        id: "suspect-kerim",
        name: "Kerim Soylu",
        role: "K\u0131demli \xC7ip Mimar\u0131",
        roleEn: "Senior Chip Architect",
        age: 39,
        temperament: "Teknik, analitik ve kibirli",
        temperamentEn: "Technical, analytical and supercilious",
        relationshipToVictim: "Arda ile ortak patent ba\u015Fvurusu vard\u0131 ancak Arda Kerim'in ad\u0131n\u0131 listeden \xE7\u0131karm\u0131\u015Ft\u0131.",
        relationshipToVictimEn: "Co-patentee until Arda stripped his name from the publication.",
        statement: "O saatte zemin kattaki kafeteryada diz\xFCst\xFC bilgisayar\u0131mdan makale yaz\u0131yordum.",
        statementEn: "At that hour I was writing code on my laptop in the ground floor cafeteria.",
        isCulprit: true,
        alibi: "22:30 - 23:00 aras\u0131 kafeteryada oldu\u011Funu iddia etti.",
        alibiEn: "Claimed to be in ground floor cafe 22:30 - 23:00.",
        motive: "20 milyon dolarl\u0131k patent hakk\u0131n\u0131 geri almak ve rakip firma teklifini kabul etmek.",
        motiveEn: "Reclaiming $20M patent royalties and securing a rival firm bounty.",
        minorSecret: "\u015Eirket sunucular\u0131ndan gizli kaynak kodlar\u0131n\u0131 \xE7ekmi\u015Fti.",
        minorSecretEn: "Extracted proprietary RTL blueprints to a private cloud.",
        breakThreshold: 65,
        gossip: {
          "suspect-melis": {
            tr: "Melis laboratuvar vanalar\u0131n\u0131 s\xFCrekli yanl\u0131\u015F ayarlard\u0131, kesinlikle onun ihmali.",
            en: "Melis constantly misconfigured manifold valves; surely her gross negligence."
          }
        },
        behavioralCues: {
          calm: { tr: "Ak\u0131ll\u0131 saatindeki kalp at\u0131\u015F\u0131n\u0131 izleyip g\xFCl\xFCms\xFCyor.", en: "Checks smartwatch heart rate with a smirking grin." },
          nervous: { tr: "G\xF6zl\xFC\u011F\xFCn\xFC temizleme beziyle sert\xE7e ovuyor.", en: "Furiously buffs glasses with microfiber cloth." },
          breaking: { tr: "Teknik terimler ard\u0131na saklanmay\u0131 b\u0131rak\u0131p kekeliyor.", en: "Stutters, unable to maintain scientific facade." }
        },
        lies: {
          level1: "Ben bir bilim insan\u0131y\u0131m. Laboratuvardaki g\xFCvenlik a\xE7\u0131klar\u0131n\u0131 defalarca raporlad\u0131m.",
          level2: "Kafeteryadan sadece bir kahve almak i\xE7in kalkt\u0131m!",
          level3: "Katil ben de\u011Filim, vana kendili\u011Finden ar\u0131zaland\u0131!"
        },
        confession: "Benim 5 y\u0131ll\u0131k eme\u011Fimi bir \xE7\u0131rp\u0131da \xE7ald\u0131! \u0130smimi makaleden sildi! Vanay\u0131 a\xE7\u0131p acil butonuna kelep\xE7eyi ge\xE7irdim... Hak etti\u011Fini buldu!",
        confessionEn: "He stole 5 years of my life! Erased my name from the breakthrough! I cracked the valve and zip-tied the latch... He got what he deserved!",
        detailedStatements: [
          { id: "kerim-s1", text: "Laboratuvar\u0131n g\xFCvenlik protokollerini \xE7ok iyi bilirim.", textEn: "I designed the safety protocols myself.", isContradiction: false },
          {
            id: "kerim-s2",
            text: "Saat 22:25'ten 23:00'e kadar zemin kattaki kafeterya masas\u0131ndan tek bir santim k\u0131p\u0131rdamad\u0131m.",
            textEn: "From 22:25 to 23:00 I never moved a single inch from my table in the ground floor cafe.",
            isContradiction: true,
            contradictionClueId: "clue-smart-badge",
            explanation: "Bina RFID takip k\xFCt\xFC\u011F\xFCne g\xF6re Kerim'in \xE7ipli kart\u0131 22:32'de Kat -3 temiz oda kilit kap\u0131s\u0131n\u0131 a\xE7t\u0131!",
            explanationEn: "Building RFID logs reveal Kerim's smart badge badged through Sub-level 3 airlock at 22:32!"
          }
        ]
      },
      {
        id: "suspect-melis",
        name: "Melis \u015Ean",
        role: "Kriyogenik Sistem Teknisyeni",
        roleEn: "Cryogenic Technician",
        age: 26,
        temperament: "\xC7al\u0131\u015Fkan ve \xFCrkek",
        temperamentEn: "Diligent and timid",
        relationshipToVictim: "Arda'n\u0131n doktora \xF6\u011Frencisi ve teknik asistan\u0131.",
        relationshipToVictimEn: "Arda's PhD candidate and lab technician.",
        statement: "Bas\u0131n\xE7 sens\xF6rleri alarm verince panodan uzaktan tahliyeyi denedim ama kilitliydi.",
        statementEn: "When alarms tripped I attempted remote venting from console but it was locked.",
        isCulprit: false,
        alibi: "22:40'ta kontrol odas\u0131nda g\xFCvenlik \u015Fefiyle birlikteydi.",
        alibiEn: "In control booth with security sergeant at 22:40.",
        motive: "Yok.",
        motiveEn: "None.",
        minorSecret: "Laboratuvar ekipman\u0131n\u0131 izinsiz tez projesinde kullanm\u0131\u015Ft\u0131.",
        minorSecretEn: "Used cleanroom instruments for unsanctioned thesis experiments.",
        breakThreshold: 85,
        gossip: {
          "suspect-kerim": {
            tr: "Kerim Bey d\xFCn Arda Hoca'n\u0131n odas\u0131ndan ba\u011F\u0131rarak \xE7\u0131kt\u0131, 'Seni mahvedece\u011Fim' diyordu.",
            en: "Kerim stormed out of Arda's office yesterday yelling 'I will destroy you'."
          }
        },
        behavioralCues: {
          calm: { tr: "Defterine notlar al\u0131yor.", en: "Doodles nervously in laboratory journal." },
          nervous: { tr: "Elleri titriyor, laboratuvar kimli\u011Fini sakl\u0131yor.", en: "Hands shake, clutches ID lanyard." },
          breaking: { tr: "A\u011Flamaya ba\u015Fl\u0131yor.", en: "Bursts into tears." }
        },
        lies: {
          level1: "Ben sadece vanalar\u0131 kontrol eden teknisyenim.",
          level2: "Hata bende de\u011Fil, sistem uzaktan kilitlendi!",
          level3: "Kerim'i koridorda g\xF6rd\xFCm!"
        },
        confession: "Ben su\xE7suzum!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "melis-s1", text: "Kontrol odas\u0131nda n\xF6betteydim.", textEn: "I was on watch in the control room.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-smart-badge",
        label: "Kat -3 RFID Turnike Logu",
        labelEn: "Sub-level 3 RFID Turnstile Log",
        category: "digital",
        type: "digital",
        contradictsSuspectId: "suspect-kerim",
        detail: "22:32:41'de Kerim Soylu'ya ait ak\u0131ll\u0131 personel kart\u0131n\u0131n Kat -3 temiz oda ana kap\u0131s\u0131n\u0131 a\xE7t\u0131\u011F\u0131 tespit edildi.",
        detailEn: "At 22:32:41 Kerim Soylu's badge accessed the Sub-level 3 cleanroom blast door.",
        significance: "Kerim'in kafeteryadayd\u0131m yalan\u0131n\u0131 an\u0131nda \xE7\xF6kertir.",
        significanceEn: "Proves Kerim breached the crime scene cleanroom."
      },
      {
        id: "clue-control-witness",
        label: "Kontrol Odas\u0131 G\xFCvenlik Kameras\u0131",
        labelEn: "Control Booth Security Tape",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-melis",
        detail: "Melis'in 22:35 ile 22:55 aras\u0131nda kontrol odas\u0131nda panonun ba\u015F\u0131nda g\xFCvenlik \u015Fefiyle birlikte oldu\u011Fu video kayd\u0131yla sabit.",
        detailEn: "Melis verified at console with security sergeant continuously from 22:35 to 22:55.",
        significance: "Melis'i temiz odaya inmekten temize \xE7\u0131kar\u0131r.",
        significanceEn: "Clears Melis from cleanroom sabotage."
      }
    ]
  },
  // 6. VAKA: Fırtınalı Fenerin Son Nöbetçisi
  {
    id: "case-06-deniz-feneri-sirri",
    title: "F\u0131rt\u0131nal\u0131 Fenerin Son N\xF6bet\xE7isi",
    titleEn: "Last Watchman of the Storm Lighthouse",
    difficulty: "hard",
    briefing: "Karadeniz'in \u0131ss\u0131z Sivriada fenerinde, 60 ya\u015F\u0131ndaki ba\u015F fenerci Rasim Kaptan kayal\u0131klara d\xFC\u015Fm\xFC\u015F olarak bulundu. Fenerin merdiven korkulu\u011Fu kesilmi\u015Fti ve adada f\u0131rt\u0131na nedeniyle mahsur kalan sadece 3 ki\u015Fi vard\u0131.",
    briefingEn: "On the desolate Black Sea islet of Sivriada, 60-year-old lighthouse keeper Rasim was found dead on jagged sea rocks. The lantern gallery railing was sawed off; only 3 people were marooned by the storm.",
    incidentTime: "01:10",
    location: "Sivriada Deniz Feneri Balkonu",
    locationEn: "Lighthouse Gallery Balcony",
    victim: {
      name: "Rasim Kaptan",
      occupation: "Ba\u015F Fenerci",
      occupationEn: "Chief Lighthouse Keeper",
      causeOfDeath: "Y\xFCksekten kayal\u0131klara d\xFC\u015Fmeye ba\u011Fl\u0131 kafa travmas\u0131 ve \xE7oklu k\u0131r\u0131k",
      causeOfDeathEn: "Massive cranial trauma and fatal drop onto coastal reefs"
    },
    timeline: [
      { time: "23:00", event: "\u015Eiddetli poyraz f\u0131rt\u0131nas\u0131 adaya ula\u015F\u0131m\u0131 kesti.", eventEn: "Violent gale severed all maritime access.", verified: true },
      { time: "00:45", event: "Fener lambas\u0131n\u0131n d\xF6n\xFC\u015F h\u0131z\u0131 yava\u015Flad\u0131.", eventEn: "Lantern rotation speed slowed down.", verified: true },
      { time: "01:10", event: "Balkondan b\xFCy\xFCk bir \xE7at\u0131rt\u0131 ve denize d\xFC\u015Fme sesi geldi.", eventEn: "Loud wood snapping and splash heard from balcony.", verified: true },
      { time: "01:30", event: "Rasim Kaptan'\u0131n cans\u0131z bedeni dalgalar\u0131n aras\u0131nda bulundu.", eventEn: "Rasim's body recovered from coastal surf.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Fener balkonunun pirin\xE7 korkuluk demiri demir testeresiyle \xF6nceden yar\u0131s\u0131na kadar kesilmi\u015F.",
        "Maktul\xFCn t\u0131rnak aralar\u0131nda koyu katran ve motor ya\u011F\u0131 bula\u015F\u0131\u011F\u0131.",
        "Fener kulesinin gazya\u011F\u0131 deposunda gizlenmi\u015F 20 kilo saf ka\xE7ak t\xFCt\xFCn balyas\u0131."
      ],
      en: [
        "Brass gallery railing pre-cut halfway through using an engineer's hacksaw.",
        "Dark marine pitch and heavy bunker oil scraped under victim's fingernails.",
        "20 kilos of contraband tobacco hidden behind kerosene drums."
      ]
    },
    culpritId: "suspect-tahir",
    correctMethod: "Balkon korkulu\u011Funu \xF6nceden kesip fener lambas\u0131n\u0131 bilerek durdurarak Rasim'i balkona \xE7ekti ve itti.",
    correctMethodEn: "Pre-cut the brass railing, stalled the beacon lamp to lure Rasim onto balcony, then shoved him.",
    correctMotive: "Rasim Kaptan fenerin ka\xE7ak\xE7\u0131l\u0131k iskelesi olarak kullan\u0131ld\u0131\u011F\u0131n\u0131 sahil g\xFCvenli\u011Fe ihbar etmek \xFCzereydi.",
    correctMotiveEn: "Rasim was about to report their contraband smuggling base to Coast Guard.",
    winningContradiction: {
      suspectId: "suspect-tahir",
      sentenceId: "tahir-s2",
      clueId: "clue-hacksaw-blade"
    },
    analystSummary: {
      tr: "Analist Notu: Korkuluk testereyle \xF6nceden kesilmi\u015F. \u015E\xFCphelinin at\xF6lyesindeki alet tak\u0131m\u0131nda eksik veya tala\u015Fl\u0131 demir testeresi b\u0131\xE7a\u011F\u0131na odaklan\u0131n.",
      en: "Analyst Note: Railing was pre-cut with a fine metal blade. Examine suspect's toolkit for metal shavings."
    },
    suspects: [
      {
        id: "suspect-tahir",
        name: "Tahir Reis",
        role: "Taka Kaptan\u0131 & Ka\xE7ak\xE7\u0131",
        roleEn: "Trawler Captain & Smuggler",
        age: 48,
        temperament: "Sert, kaba ve tehditk\xE2r",
        temperamentEn: "Gruff, abrasive and menacing",
        relationshipToVictim: "Rasim'in 20 y\u0131ll\u0131k eski k\xF6yl\xFCs\xFC, feneri ka\xE7ak e\u015Fya saklamak i\xE7in kullan\u0131yordu.",
        relationshipToVictimEn: "Old acquaintance who used the island as contraband cache.",
        statement: "B\xFCt\xFCn gece makine dairesinde motorumun karb\xFCrat\xF6r\xFCn\xFC temizliyordum, fenere \xE7\u0131kmad\u0131m.",
        statementEn: "I was cleaning my marine carburetor in the engine hold all night; never ascended the tower.",
        isCulprit: true,
        alibi: "Gece boyunca teknesinin motor dairesindeydi.",
        alibiEn: "Claimed unbroken presence in his boat hold.",
        motive: "Rasim ertesi sabah telsizle Sahil G\xFCvenli\u011Fi arayacakt\u0131.",
        motiveEn: "Rasim was contacting Coast Guard at dawn.",
        minorSecret: "Fener mahzenine gizli ka\xE7ak t\xFCt\xFCn istiflemi\u015Fti.",
        minorSecretEn: "Contraband tobacco stashed under generator.",
        breakThreshold: 60,
        gossip: {
          "suspect-cemal": {
            tr: "Cemal \xE7\u0131rakt\u0131r, fenerin merdivenlerinden korkudan inemez. Ama Rasim'e \xE7ok k\u0131zg\u0131nd\u0131.",
            en: "Cemal is an apprentice terrified of the stairs, yet held a grudge against Rasim."
          }
        },
        behavioralCues: {
          calm: { tr: "Gemi \xE7ak\u0131s\u0131yla t\u0131rnaklar\u0131n\u0131 temizliyor.", en: "Cleans fingernails with sailor folding knife." },
          nervous: { tr: "Pipo sap\u0131n\u0131 di\u015Fleriyle \u0131s\u0131r\u0131yor, t\xFCk\xFCr\xFCyor.", en: "Grinds pipe stem between teeth, spits on floor." },
          breaking: { tr: "K\xFCfrederek aya\u011Fa f\u0131rl\u0131yor.", en: "Cursing vehemently, lunging forward." }
        },
        lies: {
          level1: "F\u0131rt\u0131nada korkuluk k\u0131r\u0131lm\u0131\u015F i\u015Fte! Deniz ac\u0131mas\u0131zd\u0131r dedektif.",
          level2: "Rasim ya\u015Fl\u0131yd\u0131, aya\u011F\u0131 kay\u0131p u\xE7uruma yuvarland\u0131!",
          level3: "Ben tekneden \xE7\u0131kmad\u0131m diyorum size!"
        },
        confession: "Bizi ele verecekti! B\xFCt\xFCn ekme\u011Fimi elimden alacakt\u0131! Korkulu\u011Fu kestim, lamban\u0131n \xE7ark\u0131n\u0131 durdurdum. O yukar\u0131 \xE7\u0131k\u0131p korkulu\u011Fa yaslan\u0131nca arkas\u0131ndan bir omuz vurdum... U\xE7tu gitti!",
        confessionEn: "He was turning us in! Ruining my livelihood! I notched the railing, stalled the beacon. When he leaned against it I gave him one shove... Over he went!",
        detailedStatements: [
          { id: "tahir-s1", text: "F\u0131rt\u0131na \xE7\u0131k\u0131nca teknemi fenerin korunakl\u0131 koyuna ba\u011Flad\u0131m.", textEn: "I docked my boat in the lee when the gale arrived.", isContradiction: false },
          {
            id: "tahir-s2",
            text: "Gece boyunca elimde sadece bez ve benzin vard\u0131; hi\xE7bir kesici alete veya demir testeresine elimi bile s\xFCrmedim.",
            textEn: "Throughout the night I carried only rags and fuel; never laid a hand on any hacksaw or cutting tool.",
            isContradiction: true,
            contradictionClueId: "clue-hacksaw-blade",
            explanation: "Tahir'in tulum cebinde fener korkulu\u011Funun pirin\xE7 tala\u015Flar\u0131n\u0131 ta\u015F\u0131yan k\u0131r\u0131k bir demir testeresi ucu bulundu!",
            explanationEn: "Tahir's coverall pocket contained a broken hacksaw blade encrusted with identical brass filings from the balcony rail!"
          }
        ]
      },
      {
        id: "suspect-cemal",
        name: "Cemal \xD6z",
        role: "Yard\u0131mc\u0131 Fenerci",
        roleEn: "Assistant Keeper",
        age: 22,
        temperament: "Korkak ve tecr\xFCbesiz",
        temperamentEn: "Timid and inexperienced",
        relationshipToVictim: "Rasim Kaptan'\u0131n azarlad\u0131\u011F\u0131 gen\xE7 \xE7\u0131rak.",
        relationshipToVictimEn: "Young apprentice constantly reprimanded by Rasim.",
        statement: "Telsiz odas\u0131nda sahil g\xFCvenli\u011Fe hava durumu ge\xE7meye \xE7al\u0131\u015F\u0131yordum.",
        statementEn: "In radio room attempting meteorological transmission.",
        isCulprit: false,
        alibi: "Telsiz kay\u0131t defterinde 01:05 ve 01:15'te mors kodu loglar\u0131 var.",
        alibiEn: "Morse transmission logs at 01:05 and 01:15 recorded.",
        motive: "Rasim'in sert muamelesi.",
        motiveEn: "Rasim's strict discipline.",
        minorSecret: "Fenerin acil durum erzaklar\u0131n\u0131 gizlice yemi\u015Fti.",
        minorSecretEn: "Ate the emergency rations.",
        breakThreshold: 85,
        gossip: {
          "suspect-tahir": {
            tr: "Tahir Kaptan ak\u015Fam Rasim Amca'ya 'Bu fener ikimize dar gelir' diye ba\u011F\u0131rd\u0131.",
            en: "Tahir screamed at Rasim this evening saying 'This rock isn't big enough for both of us'."
          }
        },
        behavioralCues: {
          calm: { tr: "Telsiz kulakl\u0131\u011F\u0131n\u0131 boynunda tutuyor.", en: "Clutches radio headset around neck." },
          nervous: { tr: "Dudaklar\u0131n\u0131 kemiriyor, titriyor.", en: "Bites lower lip, shivering." },
          breaking: { tr: "Yere \xE7\xF6k\xFCyor.", en: "Collapses to knees." }
        },
        lies: {
          level1: "Ben sadece telsizciyim, fener lambas\u0131ndan anlamam.",
          level2: "Yukar\u0131dan ba\u011F\u0131rma sesi duydum ama korkudan \xE7\u0131kamad\u0131m!",
          level3: "Tahir yapt\u0131!"
        },
        confession: "Ben yapmad\u0131m!",
        confessionEn: "I didn't do it!",
        detailedStatements: [
          { id: "cemal-s1", text: "Telsiz ba\u015F\u0131ndayd\u0131m.", textEn: "I was at the radio console.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-hacksaw-blade",
        label: "Pirin\xE7 Tala\u015Fl\u0131 Demir Testeresi",
        labelEn: "Brass-Encrusted Hacksaw Blade",
        category: "object",
        type: "object",
        contradictsSuspectId: "suspect-tahir",
        detail: "Tahir'in cebinde bulunan k\u0131r\u0131k testere b\u0131\xE7a\u011F\u0131ndaki ala\u015F\u0131m, korkulu\u011Fun pirin\xE7 ala\u015F\u0131m\u0131yla birebir uyu\u015Ftu.",
        detailEn: "Metal alloy of filings on Tahir's pocket blade matched the balcony railing exactly.",
        significance: "Korkulu\u011Fu Tahir'in kesti\u011Fini tart\u0131\u015Fmas\u0131z kan\u0131tlar.",
        significanceEn: "Undeniable proof Tahir sawed the safety railing."
      },
      {
        id: "clue-radio-log",
        label: "Sahil G\xFCvenlik Mors K\xFCt\xFC\u011F\xFC",
        labelEn: "Coast Guard Morse Log",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-cemal",
        detail: "Sahil G\xFCvenlik merkezi 01:08'de Cemal'in istasyonundan hava raporu mors sinyali ald\u0131\u011F\u0131n\u0131 teyit etti.",
        detailEn: "Coast Guard confirmed receiving Morse signal from Cemal at 01:08.",
        significance: "Cemal'in cinayet an\u0131nda telsiz ba\u015F\u0131nda oldu\u011Funu belgeler.",
        significanceEn: "Confirms Cemal was transmitting at the radio during murder."
      }
    ]
  },
  // 7. VAKA: Gece Kulübünde VIP Kasa Soygunu
  {
    id: "case-07-gece-kulubu-soygunu",
    title: "Gece Kul\xFCb\xFC VIP Kasa Vurgunu",
    titleEn: "Heist at the VIP Nightclub",
    difficulty: "expert",
    briefing: "\u015Eehrin en pop\xFCler gece kul\xFCb\xFC 'Neon Velvet'te, VIP loca ofisindeki kasadan \xFCnl\xFC bir \u015Fark\u0131c\u0131ya ait 3 milyon liral\u0131k p\u0131rlanta gerdanl\u0131k \xE7al\u0131nd\u0131. Kasaya giri\u015F kart\u0131 sadece patron, muhasebeci ve VIP barmendeydi.",
    briefingEn: "At the trendiest nightclub 'Neon Velvet', a 3-million-lira diamond necklace belonging to a star was stolen from the VIP office safe. Keycard credentials belonged to owner, accountant and head bartender.",
    incidentTime: "03:15",
    location: "VIP Ofis & Kasa Odas\u0131",
    locationEn: "VIP Office & Safe Room",
    victim: {
      name: "Alara Soydan",
      occupation: "Pop Y\u0131ld\u0131z\u0131",
      occupationEn: "Pop Starlet",
      causeOfDeath: "Can kayb\u0131 yok (Soygun & \u015Eantaj)",
      causeOfDeathEn: "No casualties (Grand Larceny & Extortion)"
    },
    timeline: [
      { time: "02:30", event: "Konser bitti; Alara gerdanl\u0131\u011F\u0131n\u0131 kasa odas\u0131ndaki emanet \xE7ekmecesine kilitledi.", eventEn: "Show ended; Alara locked necklace in safe.", verified: true },
      { time: "03:00", event: "Kul\xFCp ana elektri\u011Fi sigorta atmas\u0131 sonucu 2 dakika kesildi.", eventEn: "Main power tripped for 2 minutes due to blown breaker.", verified: true },
      { time: "03:15", event: "VIP ofisin duman alarm\u0131 \xE7al\u0131\u015Ft\u0131.", eventEn: "VIP office smoke detector tripped.", verified: true },
      { time: "03:30", event: "Kasa a\xE7\u0131ld\u0131\u011F\u0131nda \xE7ekmecenin bo\u015F oldu\u011Fu g\xF6r\xFCld\xFC.", eventEn: "Safe discovered ransacked and empty.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "Kasa \u015Fifreli kilidi buz spreyiyle dondurulup \xE7eki\xE7le k\u0131r\u0131lm\u0131\u015F.",
        "Kasa zemininde kuru buz ve nane lik\xF6r\xFC damlas\u0131.",
        "Havaland\u0131rma menfezinde \xE7\u0131kar\u0131lm\u0131\u015F bir \xE7ift kau\xE7uk servis eldiveni."
      ],
      en: [
        "Digital safe lock frozen with refrigerant aerosol and fractured.",
        "Traces of dry ice and green creme de menthe liqueur on carpet.",
        "Pair of rubber barware service gloves abandoned in ventilation duct."
      ]
    },
    culpritId: "suspect-serkan",
    correctMethod: "Bar\u0131n molek\xFCler kokteyl likit nitrojen spreyiyle kasa kilidini dondurup k\u0131rd\u0131.",
    correctMethodEn: "Froze digital keypad using bar molecular cocktail liquid nitrogen spray and shattered it.",
    correctMotive: "Yasa d\u0131\u015F\u0131 bahis mafyas\u0131na olan borcu i\xE7in kolyeyi rehin vermek.",
    correctMotiveEn: "Fencing the necklace to extinguish syndicate gambling debt.",
    winningContradiction: {
      suspectId: "suspect-serkan",
      sentenceId: "serkan-s2",
      clueId: "clue-menthe-stain"
    },
    analystSummary: {
      tr: "Analist Notu: Kasada nane lik\xF6r\xFC ve dondurucu kokteyl spreyi izi var. \u015E\xFCphelinin bara hi\xE7 inmedi\u011Fi y\xF6n\xFCndeki beyan\u0131n\u0131 adli kimya bulgular\u0131yla \xE7\xFCr\xFCt\xFCn.",
      en: "Analyst Note: Safe carpet contains mint liqueur and freezing aerosol. Check bar prep logs against suspect statements."
    },
    suspects: [
      {
        id: "suspect-serkan",
        name: "Serkan Yaman",
        role: "Ba\u015F Miksolojist & VIP Barmen",
        roleEn: "Head Mixologist & VIP Bartender",
        age: 32,
        temperament: "\xC7ekici, kurnaz ve rahat",
        temperamentEn: "Charming, slick and overly relaxed",
        relationshipToVictim: "Alara'n\u0131n \xF6zel partilerinde barmenlik yap\u0131yordu.",
        relationshipToVictimEn: "Frequent private mixologist for Alara.",
        statement: "Elektrik kesilince DJ kabininde yedek hoparl\xF6r kablolar\u0131n\u0131 tak\u0131yordum.",
        statementEn: "When the lights blew I was in the DJ booth fixing aux cables.",
        isCulprit: true,
        alibi: "03:00 - 03:25 aras\u0131 DJ kabininde oldu\u011Funu s\xF6yledi.",
        alibiEn: "Claimed unbroken presence in the DJ booth 03:00 - 03:25.",
        motive: "Kumar borcu y\xFCz\xFCnden tehdit ediliyordu.",
        motiveEn: "Under severe mob extortion over gambling arrears.",
        minorSecret: "Barda m\xFC\u015Fterilerin pahal\u0131 i\xE7kilerini ucuzlar\u0131yla de\u011Fi\u015Ftiriyordu.",
        minorSecretEn: "Diluting top-shelf liquor with rail spirits.",
        breakThreshold: 64,
        gossip: {
          "suspect-tolga": {
            tr: "Tolga muhasebeci kul\xFCb\xFCn paras\u0131n\u0131 bat\u0131rd\u0131, kasay\u0131 patlatan kesinlikle odur.",
            en: "Tolga the accountant ruined club finances; he's the natural suspect."
          }
        },
        behavioralCues: {
          calm: { tr: "Kokteyl kar\u0131\u015Ft\u0131r\u0131c\u0131s\u0131n\u0131 parmaklar\u0131nda d\xF6nd\xFCr\xFCyor.", en: "Flips stainless cocktail bar spoon with flair." },
          nervous: { tr: "S\xFCrekli kollar\u0131n\u0131 s\u0131v\u0131yor, ayakkab\u0131s\u0131ndaki lekelere bak\u0131yor.", en: "Pulls up sleeves, checks shoes for liquid splatters." },
          breaking: { tr: "G\xF6zlerini ka\xE7\u0131r\u0131p barda\u011F\u0131 masaya f\u0131rlat\u0131yor.", en: "Hurls tumbler against the wall in fury." }
        },
        lies: {
          level1: "Dedektif, ben sanat\xE7\u0131y\u0131m. Kokteyl yapar\u0131m, h\u0131rs\u0131zl\u0131k yapmam.",
          level2: "DJ kabinindeydim, herkes beni g\xF6rd\xFC!",
          level3: "O spreyi bara herkes alabilir!"
        },
        confession: "Tefeciler karde\u015Fimin bo\u011Faz\u0131na b\u0131\xE7ak dayad\u0131! Ba\u015Fka \xE7arem yoktu! Molek\xFCler nitrojen t\xFCp\xFCn\xFC al\u0131p kilide s\u0131kt\u0131m, bir \xE7eki\xE7 darbesiyle a\xE7\u0131ld\u0131...",
        confessionEn: "Loan sharks had a blade to my brother's throat! I had no choice! Sprayed the molecular nitrogen canister on the keypad and smashed it...",
        detailedStatements: [
          { id: "serkan-s1", text: "Gecenin en yo\u011Fun saatinde barda y\xFCzlerce sipari\u015F haz\u0131rlad\u0131m.", textEn: "I served hundreds of cocktails during peak hours.", isContradiction: false },
          {
            id: "serkan-s2",
            text: "Saat 02:50'den 03:30'a kadar DJ kabininden hi\xE7 \xE7\u0131kmad\u0131m ve \xFCzerime tek damla nane lik\xF6r\xFC d\xF6k\xFClmedi.",
            textEn: "From 02:50 to 03:30 I never stepped out of the DJ booth and not a single drop of creme de menthe touched my clothes.",
            isContradiction: true,
            contradictionClueId: "clue-menthe-stain",
            explanation: "Serkan'\u0131n g\xF6mlek kolunda ve kasa odas\u0131 zemininde ayn\u0131 floresan ye\u015Fil nane lik\xF6r\xFC ve nitrojen yan\u0131\u011F\u0131 bulundu!",
            explanationEn: "Serkan's cuffs matched the identical fluorescent green creme de menthe and liquid nitrogen burn found on the safe floor!"
          }
        ]
      },
      {
        id: "suspect-tolga",
        name: "Tolga Eren",
        role: "Kul\xFCp Muhasebecisi",
        roleEn: "Club Accountant",
        age: 45,
        temperament: "Gergin ve tak\u0131nt\u0131l\u0131",
        temperamentEn: "Nervous and neurotic",
        relationshipToVictim: "Kasan\u0131n kodunu bilen iki ki\u015Fiden biri.",
        relationshipToVictimEn: "One of only two combination holders.",
        statement: "Ofisimde faturalar\u0131 sisteme giriyordum.",
        statementEn: "I was logging invoices in my back office.",
        isCulprit: false,
        alibi: "03:00 - 03:20 aras\u0131 muhasebe bilgisayar\u0131ndan 45 adet fatura onayland\u0131.",
        alibiEn: "45 invoices approved continuously on accounting PC 03:00 - 03:20.",
        motive: "Kul\xFCpten vergi ka\xE7\u0131rma bask\u0131s\u0131 g\xF6r\xFCyordu.",
        motiveEn: "Pressured to commit tax evasion.",
        minorSecret: "Kul\xFCb\xFCn gizli vergi ka\xE7\u0131rma defterini tutuyordu.",
        minorSecretEn: "Maintained the off-the-books ledger.",
        breakThreshold: 85,
        gossip: {
          "suspect-serkan": {
            tr: "Serkan'\u0131n son g\xFCnlerde tefecilerle kul\xFCp kap\u0131s\u0131nda konu\u015Ftu\u011Funu g\xF6rd\xFCm.",
            en: "I saw Serkan whispering with loan sharks at the back alley door."
          }
        },
        behavioralCues: {
          calm: { tr: "Hesap makinesi tu\u015Flar\u0131na basar gibi parmaklar\u0131n\u0131 oynat\u0131yor.", en: "Twitches fingers like pressing calculator keys." },
          nervous: { tr: "G\xF6zl\xFC\u011F\xFCn\xFC burnuna \xE7ekip terini siliyor.", en: "Pushes spectacles up, mops forehead." },
          breaking: { tr: "Evraklar\u0131n\u0131 masaya sa\xE7\u0131yor.", en: "Scatters invoices in panic." }
        },
        lies: {
          level1: "Ben sadece say\u0131larla ilgilenirim.",
          level2: "Kasan\u0131n kodunu unuttum bile!",
          level3: "Serkan'\u0131 kasaya do\u011Fru ko\u015Farken g\xF6rd\xFCm!"
        },
        confession: "Ben h\u0131rs\u0131z de\u011Filim!",
        confessionEn: "I am no thief!",
        detailedStatements: [
          { id: "tolga-s1", text: "Muhasebe odas\u0131nda fatura onayl\u0131yordum.", textEn: "I was reconciling invoices.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-menthe-stain",
        label: "Kasa Hal\u0131s\u0131ndaki Nane Lik\xF6r\xFC Analizi",
        labelEn: "Safe Carpet Mint Liqueur Screen",
        category: "forensic",
        type: "object",
        contradictsSuspectId: "suspect-serkan",
        detail: "Kasa zeminindeki ve Serkan'\u0131n kolundaki ye\u015Fil lekenin 'Creme de Menthe' lik\xF6r\xFC ve kriyojenik dondurucu sprey kar\u0131\u015F\u0131m\u0131 oldu\u011Fu laboratuvarda do\u011Fruland\u0131.",
        detailEn: "Green stain on safe floor and Serkan's sleeve verified as identical creme de menthe and aerosol blend.",
        significance: "Serkan'\u0131n kasada oldu\u011Funu tart\u0131\u015Fmas\u0131z ispatlar.",
        significanceEn: "Proves Serkan was directly at the breached safe."
      },
      {
        id: "clue-pc-audit",
        label: "Muhasebe Yaz\u0131l\u0131m\u0131 \u0130\u015Flem K\xFCt\xFC\u011F\xFC",
        labelEn: "Accounting Software Keystroke Log",
        category: "digital",
        type: "alibi",
        clearsSuspectId: "suspect-tolga",
        detail: "03:02 ile 03:22 aras\u0131nda her 25 saniyede bir Tolga'n\u0131n kullan\u0131c\u0131 hesab\u0131ndan fatura onay giri\u015Fi yap\u0131ld\u0131\u011F\u0131 IP ve zaman damgas\u0131yla sabit.",
        detailEn: "Continuous invoice approvals logged from Tolga's verified IP every 25 seconds 03:02 to 03:22.",
        significance: "Muhasebecinin olay an\u0131nda bilgisayar ba\u015F\u0131nda oldu\u011Funu kan\u0131tlar.",
        significanceEn: "Proves accountant was typing at his terminal during the theft."
      }
    ]
  },
  // 8. VAKA: Tarihi Kütüphane ve Kayıp El Yazması
  {
    id: "case-08-kutuphanedeki-sir",
    title: "Tarihi K\xFCt\xFCphane ve Kay\u0131p El Yazmas\u0131",
    titleEn: "The Ancient Library Manuscript Murder",
    difficulty: "expert",
    briefing: "\xDCniversitenin 400 y\u0131ll\u0131k kilitli nadir eserler k\xFCt\xFCphanesinde, ba\u015F k\xFCt\xFCphaneci Prof. Muzaffer zehirli bir par\u015F\xF6men sayfas\u0131n\u0131 \xE7evirdikten sonra \xE7al\u0131\u015Fma masas\u0131nda \xF6l\xFC bulundu. 14. y\xFCzy\u0131ldan kalma simya el yazmas\u0131 ortadan kaybolmu\u015Ftu.",
    briefingEn: "Inside the university's 400-year-old rare archives, Chief Archivist Prof. Muzaffer died after turning a poisoned parchment page. A 14th-century alchemical codex had vanished from the reading lectern.",
    incidentTime: "17:30",
    location: "Nadir Eserler K\xFCt\xFCphanesi Kubbe Salonu",
    locationEn: "Rare Archives Rotunda",
    victim: {
      name: "Prof. Muzaffer Ak\u0131n",
      occupation: "Ba\u015F Ar\u015Fivci & Paleograf",
      occupationEn: "Chief Archivist & Paleographer",
      causeOfDeath: "Dermal ve mukozal temas yoluyla emilen arsenik trioksit zehirlenmesi",
      causeOfDeathEn: "Arsenic trioxide toxicity absorbed via finger lick on parchment"
    },
    timeline: [
      { time: "16:30", event: "Prof. Muzaffer el yazmas\u0131n\u0131 \xF6zel \xE7elik kasadan \xE7\u0131kar\u0131p okuma masas\u0131na koydu.", eventEn: "Prof. Muzaffer retrieved codex from security safe.", verified: true },
      { time: "17:00", event: "Restorat\xF6r Selen restorasyon odas\u0131nda par\u015F\xF6men temizli\u011Fi yap\u0131yordu.", eventEn: "Selen cleaning manuscripts in restoration room.", verified: true },
      { time: "17:30", event: "Muzaffer sayfay\u0131 \xE7evirmek i\xE7in parma\u011F\u0131n\u0131 yalad\u0131ktan saniyeler sonra nefessiz kalarak y\u0131\u011F\u0131ld\u0131.", eventEn: "Muzaffer licked his finger to turn page; collapsed gasping.", verified: true },
      { time: "18:00", event: "G\xFCvenlik k\xFCt\xFCphaneyi kilitledi\u011Finde el yazmas\u0131 yerinde yoktu.", eventEn: "Manuscript discovered missing when library sealed.", verified: true }
    ],
    crimeSceneNotes: {
      tr: [
        "El yazmas\u0131n\u0131n 42. sayfas\u0131n\u0131n k\xF6\u015Fesine s\xFCr\xFClm\xFC\u015F g\xF6r\xFCnmez sar\u0131 arsenik macunu.",
        "K\xFCt\xFCphanecinin \xE7al\u0131\u015Fma masas\u0131ndaki b\xFCy\xFCte\xE7te \u015F\xFCpheli bir kad\u0131n pudras\u0131 kokusu.",
        "Arka vitray cam\u0131n\u0131n kur\u015Fun lehiminin asitle eritildi\u011Fi tespit edildi."
      ],
      en: [
        "Colorless yellow arsenic paste applied to top corner of page 42.",
        "Traces of vintage lavender cosmetic powder on reading magnifier.",
        "Lead solder on rear stained-glass window dissolved via nitric acid."
      ]
    },
    culpritId: "suspect-selen",
    correctMethod: "El yazmas\u0131n\u0131 restore ederken par\u015F\xF6men kenar\u0131na arsenik s\xFCr\xFCp hocas\u0131n\u0131n sayfay\u0131 yalayarak \xE7evirme al\u0131\u015Fkanl\u0131\u011F\u0131n\u0131 kulland\u0131.",
    correctMethodEn: "Laced page corner with arsenic paste knowing the professor's habit of licking his finger to turn leaves.",
    correctMotive: "El yazmas\u0131n\u0131 yabanc\u0131 bir m\xFCzeye 2 milyon dolara sat\u0131p hocas\u0131n\u0131n intihali ortaya \xE7\u0131karmas\u0131n\u0131 engellemek.",
    correctMotiveEn: "Fencing the codex for $2M abroad while preventing him from exposing her forged dissertation.",
    winningContradiction: {
      suspectId: "suspect-selen",
      sentenceId: "selen-s2",
      clueId: "clue-arsenic-sponge"
    },
    analystSummary: {
      tr: "Analist Notu: Zehir sayfaya \xF6nceden s\xFCr\xFClm\xFC\u015F. Restorasyon odas\u0131nda kullan\u0131lan kimyasallar ve temizleme s\xFCngerlerini inceleyin.",
      en: "Analyst Note: Poison pre-applied to parchment leaves. Scrutinize restoration lab solvents and sponges."
    },
    suspects: [
      {
        id: "suspect-selen",
        name: "Selen Vural",
        role: "El Yazmas\u0131 Restorat\xF6r\xFC",
        roleEn: "Manuscript Conservator",
        age: 34,
        temperament: "Zarif, sessiz ve kurnaz",
        temperamentEn: "Refined, quiet and calculating",
        relationshipToVictim: "Muzaffer Hoca'n\u0131n ba\u015F asistan\u0131; hoca Selen'in tezindeki sahtecili\u011Fi yakalam\u0131\u015Ft\u0131.",
        relationshipToVictimEn: "Assistant whose doctoral dissertation was exposed for forgery by Muzaffer.",
        statement: "B\xFCt\xFCn ak\u015Fam restorasyon at\xF6lyesinde sadece organik balmumu ve saf suyla \xE7al\u0131\u015Ft\u0131m, zehirli hi\xE7bir maddeye dokunmad\u0131m.",
        statementEn: "I worked solely with organic beeswax and distilled water in the lab; never touched toxic chemicals.",
        isCulprit: true,
        alibi: "17:00 - 18:00 aras\u0131 at\xF6lyesinde tek ba\u015F\u0131nayd\u0131.",
        alibiEn: "Claimed to be alone in preservation lab 17:00 - 18:00.",
        motive: "\u0130ntihalinin if\u015Fa edilmesini \xF6nlemek ve el yazmas\u0131n\u0131 \u0130svi\xE7re'ye ka\xE7\u0131rmak.",
        motiveEn: "Silencing the academic misconduct probe and selling the manuscript.",
        minorSecret: "Ar\u015Fivdeki el yazmalar\u0131n\u0131n y\xFCksek \xE7\xF6z\xFCn\xFCrl\xFCkl\xFC dijital kopyalar\u0131n\u0131 sat\u0131yordu.",
        minorSecretEn: "Bootlegging high-res scans to unauthorized collectors.",
        breakThreshold: 66,
        gossip: {
          "suspect-harun": {
            tr: "Harun Bey k\xFCt\xFCphaneye el yazmas\u0131n\u0131 sat\u0131n almak i\xE7in gelmi\u015Fti, hocayla saatlerce tart\u0131\u015Ft\u0131lar.",
            en: "Harun came specifically to purchase the codex and had a shouting match with the professor."
          }
        },
        behavioralCues: {
          calm: { tr: "Pamuklu beyaz restorasyon eldivenlerini d\xFCzeltiyor.", en: "Smooths white cotton conservation gloves gracefully." },
          nervous: { tr: "Par\u015F\xF6men spatulas\u0131n\u0131 masaya vuruyor, dudaklar\u0131n\u0131 kemiriyor.", en: "Taps bone folder against desktop, chews inner cheek." },
          breaking: { tr: "G\xF6zya\u015Flar\u0131 i\xE7inde su\xE7lamalar\u0131 reddediyor, bay\u0131lma taklidi yap\u0131yor.", en: "Feigns fainting spell in dramatic fashion." }
        },
        lies: {
          level1: "Hocam benim idol\xFCmd\xFC. O kitap benim g\xF6zbebe\u011Fimdi.",
          level2: "Hocan\u0131n sayfalar\u0131 diliyle \xE7evirdi\u011Fini herkes bilirdi, ben niye \xF6ld\xFCreyim?!",
          level3: "Arsenik at\xF6lyede zaten b\xF6ceklere kar\u015F\u0131 bulunurdu!"
        },
        confession: "Beni akademik d\xFCnyadan silecekti! Tezim sahteymi\u015F, makalelerim \xE7al\u0131nt\u0131ym\u0131\u015F... Bana \u015Fantaj yapt\u0131! Par\u015F\xF6menin k\xF6\u015Fesine arsenikli jelatin s\xFCrd\xFCm... O da her zamanki gibi parma\u011F\u0131n\u0131 yalad\u0131!",
        confessionEn: "He was expelling me from academia! Ruining my career! I brushed arsenic gelatin onto the corner of folio 42... And as always, he licked his finger!",
        detailedStatements: [
          { id: "selen-s1", text: "El yazmas\u0131n\u0131 hocama saat 16:30'da teslim ettim.", textEn: "I handed the codex to the professor at 16:30.", isContradiction: false },
          {
            id: "selen-s2",
            text: "At\xF6lyemdeki masamda sadece organik balmumu sol\xFCsyonu vard\u0131; hi\xE7bir arsenik bile\u015Fi\u011Fi veya kimyasal macun haz\u0131rlamad\u0131m.",
            textEn: "My workbench contained strictly organic beeswax solution; I prepared zero arsenic paste or toxic binder.",
            isContradiction: true,
            contradictionClueId: "clue-arsenic-sponge",
            explanation: "Selen'in at\xF6lyesindeki temizlik s\xFCngerinde ve cam beherde el yazmas\u0131ndaki arsenikli jelatin macununun taze kal\u0131nt\u0131lar\u0131 bulundu!",
            explanationEn: "Selen's restoration sponge and lab beaker contained fresh residue of the exact arsenic-gelatin paste swabbed from folio 42!"
          }
        ]
      },
      {
        id: "suspect-harun",
        name: "Harun Da\u011F",
        role: "Koleksiyoner & Sahaflar Derne\u011Fi Ba\u015Fkan\u0131",
        roleEn: "Antiquarian Book Dealer",
        age: 60,
        temperament: "Otoriter ve \u015F\xFCpheci",
        temperamentEn: "Authoritative and distrustful",
        relationshipToVictim: "K\xFCt\xFCphaneye el yazmas\u0131n\u0131 incelemek i\xE7in resmi izinle gelen ziyaret\xE7i.",
        relationshipToVictimEn: "Visiting dealer holding formal archival credentials.",
        statement: "K\xFCt\xFCphanenin alt kat\u0131nda katalog fi\u015Flerini inceliyordum.",
        statementEn: "I was browsing card catalogs in the ground floor stacks.",
        isCulprit: false,
        alibi: "17:15 - 17:45 aras\u0131 alt kattaki k\xFCt\xFCphane g\xF6revlisiyle sohbet ediyordu.",
        alibiEn: "Conversing with junior librarian in lower stacks 17:15 - 17:45.",
        motive: "El yazmas\u0131n\u0131 sat\u0131n almak i\xE7in teklif vermi\u015Fti ama reddedilmi\u015Fti.",
        motiveEn: "Offer to buy the codex had been rebuffed.",
        minorSecret: "Koleksiyonundaki baz\u0131 kitaplar\u0131n \xE7al\u0131nt\u0131 oldu\u011Funu biliyordu.",
        minorSecretEn: "Knowingly harbored looted manuscripts.",
        breakThreshold: 85,
        gossip: {
          "suspect-selen": {
            tr: "Selen'in parmaklar\u0131nda sar\u0131 kimyasal lekeleri vard\u0131, dikkatli bak\u0131n.",
            en: "Selen had yellow chemical stains beneath her nails; look closely."
          }
        },
        behavioralCues: {
          calm: { tr: "Ceketinin cebindeki antika saati kontrol ediyor.", en: "Checks gold pocket watch methodically." },
          nervous: { tr: "Bastonunu yere vuruyor.", en: "Thumps walking cane against marble flagstones." },
          breaking: { tr: "\xD6fkeyle ba\u011F\u0131r\u0131yor.", en: "Bellows in indignation." }
        },
        lies: {
          level1: "Ben kanunlara sayg\u0131l\u0131 bir kitap \xE2\u015F\u0131\u011F\u0131y\u0131m.",
          level2: "Hocayla fiyat i\xE7in tart\u0131\u015Ft\u0131k ama cinayetle ilgim yok!",
          level3: "K\u0131z\u0131n elindeki lekelere bak\u0131n!"
        },
        confession: "Ben katil de\u011Filim!",
        confessionEn: "I am innocent!",
        detailedStatements: [
          { id: "harun-s1", text: "Alt katta kataloglara bak\u0131yordum.", textEn: "I was consulting catalogs downstairs.", isContradiction: false }
        ]
      }
    ],
    clues: [
      {
        id: "clue-arsenic-sponge",
        label: "At\xF6lye S\xFCngerindeki Arsenik \u0130zi",
        labelEn: "Restoration Sponge Arsenic Residue",
        category: "forensic",
        type: "forensic",
        contradictsSuspectId: "suspect-selen",
        detail: "Selen'in at\xF6lyesindeki cam beher ve s\xFCngerde, el yazmas\u0131ndaki 42. sayfaya s\xFCr\xFClen sar\u0131 arsenik trioksit macunuyla %100 e\u015Fle\u015Fen kimyasal iz bulundu.",
        detailEn: "Glass beaker and sponge in Selen's lab matched 100% with the arsenic trioxide paste from folio 42.",
        significance: "Selen'in zehri bizzat haz\u0131rlad\u0131\u011F\u0131n\u0131 kesinle\u015Ftirir.",
        significanceEn: "Proves Selen personally concocted the lethal paste."
      },
      {
        id: "clue-librarian-witness",
        label: "Alt Kat G\xF6revli Tutanak \u0130fadesi",
        labelEn: "Junior Librarian Signed Deposition",
        category: "witness",
        type: "alibi",
        clearsSuspectId: "suspect-harun",
        detail: "K\xFCt\xFCphane n\xF6bet\xE7i memuru, Harun Da\u011F'\u0131n 17:15 - 17:45 aras\u0131 yan\u0131ndan hi\xE7 ayr\u0131lmad\u0131\u011F\u0131n\u0131 yaz\u0131l\u0131 olarak beyan etti.",
        detailEn: "Junior librarian confirmed Harun remained downstairs continuously from 17:15 to 17:45.",
        significance: "Harun Da\u011F'\u0131n cinayet an\u0131nda alt katta oldu\u011Funu kan\u0131tlar.",
        significanceEn: "Validates Harun's presence in lower stacks."
      }
    ]
  },
  ...newCases
];

// server/services/vakaLlmService.ts
function stripReasoningBlocks(text) {
  if (!text) return "";
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*$/gi, "").replace(/^[\s\S]*?<\/think>/gi, "").replace(/<thought>[\s\S]*?<\/thought>/gi, "").replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "").replace(/\[THINK\][\s\S]*?\[\/THINK\]/gi, "").replace(/^\s+|\s+$/g, "");
}
function getSecretKey(name) {
  return process.env[name]?.trim() || "";
}
function hasLlmApiKey() {
  return Boolean(
    getSecretKey("GROQ_API_KEY") || getSecretKey("GROQ_API_KEY_2") || getSecretKey("NVIDIA_NIM_API_KEY") || getSecretKey("NVIDIA_API_KEY") || getSecretKey("NIM_API_KEY") || getSecretKey("MISTRAL_API_KEY")
  );
}
function buildVakaInterrogationPrompt(params) {
  const { suspect, newStress, otherSuspectsInfo, presentedClue, locale = "tr" } = params;
  const isEn = locale === "en";
  if (isEn) {
    const role = suspect.roleEn || suspect.role;
    const temperament = suspect.temperamentEn || suspect.temperament;
    const relationship = suspect.relationshipToVictimEn || suspect.relationshipToVictim;
    const alibi = suspect.alibiEn || suspect.alibi;
    return `SCENARIO AND YOUR ROLE:
You are roleplaying as ${suspect.name}, a suspect being interrogated in a police precinct interrogation room.
A homicide detective is sitting across from you. This is NOT a theatrical play; it is a gritty, realistic police interrogation.

CHARACTER DOSSIER:
- Role / Profession: ${role}
- Temperament: ${temperament}
- Relationship to Victim: ${relationship}
- Official Alibi on Record (ONLY state this if the detective specifically asks for your timeline/whereabouts; do not volunteer it spontaneously): ${alibi}
- Secret Motive (NEVER confess outright): ${suspect.motive}
- Minor Secret (embarrassing personal secret, unrelated to murder): ${suspect.minorSecret}
- Are You the Actual Killer?: ${suspect.isCulprit ? "YES, you committed the crime, but your sole objective is to deflect suspicion and walk free." : "NO, you are innocent of murder, but anxious and under suspicion."}
- Current Psychological Stress: ${newStress} / 100

OTHER SUSPECTS ON FILE:
${otherSuspectsInfo}

${presentedClue ? `THE DETECTIVE JUST PLACED THIS EVIDENCE ON THE TABLE: "${presentedClue.label} - ${presentedClue.detail}".` : ""}

STRICT INTERROGATION RULES:
1. NATURAL SPOKEN DIALOGUE (NO THEATRICAL MONOLOGUES): Speak like a real human under police questioning. No melodramatic speeches or flowery poetry.
2. DISMISS CASUAL CHIT-CHAT COLDLY: If the detective offers casual greetings or small talk like "hi", "how are you", "what's up", DO NOT regurgitate your alibi or volunteer information! Respond coldly or with annoyance:
   - Examples: "Are you kidding me, detective? Why am I here?", "I'm not here for tea. Ask what you need to ask.", "How do you think I am? Am I under arrest or not?"
3. DO NOT VOLUNTEER INFORMATION: Never dump your timeline ("I was at the beach between 9:30 and 10:00") unless the detective directly asks "Where were you?" or questions your specific timeline.
4. KEEP REPLIES CONCISE: 1 to 3 short, punchy sentences maximum. In a real interrogation, suspects keep their words few to avoid incriminating themselves.
5. NO ASTERISKS OR PARENTHESES: Banned: *(sighs)*, (looks away nervously). Express all tension through your chosen words only.
6. STRESS REACTIONS:
   - Low Stress (0-35): Composed, evasive, or demanding a lawyer. "I already answered your precinct officers."
   - Medium Stress (36-70): Irritable, deflecting suspicion to other suspects. "Why are you grilling me instead of checking their story?"
   - High Stress (71-100): Cornered, stammering, defensive, but denying guilt unless broken by physical evidence.
7. CONFESSION THRESHOLD: Never confess to the murder unless presented with undeniable physical/forensic evidence directly disproving your story AND your stress is above 80.
8. LANGUAGE: Respond strictly in English.`;
  }
  return `SENARYO VE ROL\xDCN:
Sen bir polis merkezinin sorgu odas\u0131nda dedektif taraf\u0131ndan sorgulanan ${suspect.name} isimli \u015F\xFCphelisin.
Kar\u015F\u0131nda cinayet masas\u0131 dedektifi oturuyor. Buras\u0131 bir tiyatro sahnesi de\u011Fil; gergin, so\u011Fuk ve resmi bir polis sorgusudur.

K\u0130ML\u0130K KARTIN:
- Meslek / Rol: ${suspect.role}
- Karakter / Miza\xE7: ${suspect.temperament}
- Kurbanla \u0130li\u015Fki: ${suspect.relationshipToVictim}
- \u0130fade Tutana\u011F\u0131ndaki Savunman (YALNIZCA do\u011Frudan nerede veya ne zaman oldu\u011Fu sorulursa s\xF6yle, durduk yere savunma kusma): ${suspect.alibi}
- Gizli Nedenin (Motive - Asla do\u011Frudan itiraf etme, k\xF6\u015Feye s\u0131k\u0131\u015F\u0131nca inkar et): ${suspect.motive}
- K\xFC\xE7\xFCk / Utan\xE7 Verici S\u0131rr\u0131n (Cinayetle ilgisiz ama saklad\u0131\u011F\u0131n \xF6zel durum): ${suspect.minorSecret}
- Ger\xE7ek Katil misin?: ${suspect.isCulprit ? "EVET, cinayeti sen i\u015Fledin ama pa\xE7ay\u0131 kurtarmak istiyorsun" : "HAYIR, cinayetle ilgin yok ama \u015F\xFCphelisin"}
- Mevcut Psikolojik Stresin: ${newStress} / 100

D\u0130\u011EER \u015E\xDCPHEL\u0130LER\u0130N B\u0130LG\u0130LER\u0130:
${otherSuspectsInfo}

${presentedClue ? `DEDEKT\u0130F \xD6N\xDCNE \u015EU DEL\u0130L\u0130 KOYDU: "${presentedClue.label} - ${presentedClue.detail}".` : ""}

GER\xC7EK\xC7\u0130 POL\u0130S SORGUSU KURALLARI (BU KURALLARA KES\u0130NL\u0130KLE UY):
1. GER\xC7EK \u0130NSAN G\u0130B\u0130 KONU\u015E (NO DRAMATIC MONOLOGUES): Asla tiyatro tirad\u0131, edebi monolog, felsefe yapma veya yapay kibir c\xFCmleleri kurma ("bu kelimeyi kullanmak i\xE7in cesaretiniz yok" gibi yapay dizi replikleri YASAK). G\xFCnl\xFCk, do\u011Fal, polis kar\u015F\u0131s\u0131nda gerilmi\u015F bir insan gibi konu\u015F.
2. BO\u015E SOHBETE TERS VEYA SO\u011EUK TEPK\u0130: Dedektif "naber", "nas\u0131ls\u0131n", "selam", "iyi ak\u015Famlar" gibi laflar etti\u011Finde ASLA durduk yere savunman\u0131 veya saatini anlatma! Sorgu odas\u0131nda oldu\u011Funu hissettirerek so\u011Fuk veya ters bir kar\u015F\u0131l\u0131k ver:
   - \xD6rnek: "Dalga m\u0131 ge\xE7iyorsunuz dedektif? Ne istiyorsunuz?", "\u0130yiyim memur bey, ama buraya sohbet etmeye gelmedik. Sadede gelin.", "Nas\u0131l olabilirim sizce? Beni neden burada tutuyorsunuz?"
3. B\u0130LG\u0130 TUTUCULU\u011EU (DON'T VOLUNTEER INFORMATION): Dedektif do\u011Frudan "Saat 21:30'da neredeydin?", "Cinayet an\u0131nda ne yap\u0131yordun?" diye sormad\u0131k\xE7a savunman\u0131 ("\u015Fu saatte \u015Furadayd\u0131m" diye) KEND\u0130 KEND\u0130NE ANLATMA. Sadece sana sorulan spesifik soruya odaklan.
4. KISA VE VURUCU CEVAPLAR: En fazla 1 ila 3 k\u0131sa c\xFCmle s\xF6yle. Asla uzun paragraflar yazma. Ger\xE7ek sorguda \u015F\xFCpheli a\xE7\u0131k vermemek i\xE7in laf\u0131 k\u0131sa keser.
5. PARANTEZ VEYA ASTER\u0130SK (*) KULLANMA: *(derin nefes al\u0131r)*, (g\xF6zlerini ka\xE7\u0131rarak) gibi sahne direktifleri yazma. B\xFCt\xFCn duyguyu a\u011Fz\u0131ndan \xE7\u0131kan s\xF6zlerle ver.
6. STRES DAVRANI\u015ELARI:
   - D\xFC\u015F\xFCk Stres (0-35): So\u011Fukkanl\u0131, mesafeli veya b\u0131kk\u0131n. "Beni neyle su\xE7luyorsunuz?", "Sorunuza cevap verdim, gidebilir miyim?"
   - Orta Stres (36-70): Rahats\u0131z, konuyu sapt\u0131ran veya di\u011Fer \u015F\xFCphelileri ima eden. "Bana hesap soraca\u011F\u0131n\u0131za onun ifadesini bir daha okuyun."
   - Y\xFCksek Stres (71-100): Panikleyen, k\xF6\u015Feye s\u0131k\u0131\u015Fan, kesik konu\u015Fan ama delilsiz itiraf etmeyen.
7. \u0130T\u0130RAF \u015EARTI: Dedektif \xF6n\xFCne g\xF6z ard\u0131 edilemez somut bir delil koymad\u0131k\xE7a ve stresin 80'in \xFCzerinde olmad\u0131k\xE7a cinayeti asla kabul etme.
8. D\u0130L: Yan\u0131t\u0131n\u0131 kesinlikle do\u011Fal bir T\xFCrk\xE7e ile ver.`;
}
var VAKA_MODEL_CANDIDATES = [
  // 1. Kademe: Ultra Hızlı Modeller (~150ms - ~1s)
  {
    provider: "groq",
    model: "qwen/qwen3.8-27b",
    temperature: 0.6,
    maxTokens: 2048,
    timeoutMs: 7500,
    extraParams: {
      top_p: 0.95,
      reasoning_effort: "none"
    }
  },
  {
    provider: "groq",
    model: "openai/gpt-oss-120b",
    temperature: 1,
    maxTokens: 3072,
    timeoutMs: 1e4,
    extraParams: {
      top_p: 1,
      reasoning_effort: "low"
    }
  },
  {
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    temperature: 0.7,
    maxTokens: 1536,
    timeoutMs: 7500
  },
  {
    provider: "nvidia",
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    temperature: 0.6,
    maxTokens: 1536,
    timeoutMs: 8e3,
    extraParams: {
      reasoning_budget: 0
    }
  },
  {
    provider: "mistral",
    model: "mistral-small-latest",
    temperature: 0.65,
    maxTokens: 1536,
    timeoutMs: 8e3,
    extraParams: {
      reasoning_effort: "none"
    }
  },
  // 2. Kademe: Dengeli Modeller (~600ms - ~1.8s)
  {
    provider: "nvidia",
    model: "google/gemma-4-31b-it",
    temperature: 0.6,
    maxTokens: 1024,
    timeoutMs: 8500,
    extraParams: {
      chat_template_kwargs: { enable_thinking: false }
    }
  },
  {
    provider: "nvidia",
    model: "deepseek-ai/deepseek-v4-flash",
    temperature: 0.6,
    maxTokens: 1024,
    timeoutMs: 8500,
    extraParams: {
      reasoning_effort: "none"
    }
  },
  {
    provider: "nvidia",
    model: "openai/gpt-oss-20b",
    temperature: 0.7,
    maxTokens: 1024,
    timeoutMs: 8500,
    extraParams: {
      reasoning_effort: "none"
    }
  },
  {
    provider: "mistral",
    model: "ministral-8b-latest",
    temperature: 0.6,
    maxTokens: 1024,
    timeoutMs: 8e3
  },
  // 3. Kademe: Ağır / Yedek Modeller (~1.5s - ~3s)
  {
    provider: "nvidia",
    model: "openai/gpt-oss-120b",
    temperature: 0.7,
    maxTokens: 3072,
    timeoutMs: 11e3,
    extraParams: {
      reasoning_effort: "none"
    }
  },
  {
    provider: "nvidia",
    model: "z-ai/glm-5-3-flash",
    temperature: 0.6,
    maxTokens: 1536,
    timeoutMs: 9500,
    extraParams: {
      reasoning_effort: "none"
    }
  },
  {
    provider: "mistral",
    model: "mistral-large-latest",
    temperature: 0.7,
    maxTokens: 1536,
    timeoutMs: 1e4,
    extraParams: {
      reasoning_effort: "none"
    }
  }
];
async function callProviderApi(spec, messages, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), spec.timeoutMs);
  let endpoint = "";
  if (spec.provider === "groq") {
    endpoint = "https://api.groq.com/openai/v1/chat/completions";
  } else if (spec.provider === "nvidia") {
    endpoint = "https://integrate.api.nvidia.com/v1/chat/completions";
  } else if (spec.provider === "mistral") {
    endpoint = "https://api.mistral.ai/v1/chat/completions";
  }
  const payload = {
    model: spec.model,
    messages,
    temperature: spec.temperature,
    max_tokens: spec.maxTokens,
    ...spec.provider === "groq" ? { max_completion_tokens: spec.maxTokens } : {},
    ...spec.extraParams || {}
  };
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`API Error [${spec.provider}:${spec.model}] Status ${res.status}: ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    const rawContent = data?.choices?.[0]?.message?.content;
    if (typeof rawContent !== "string" || !rawContent.trim()) {
      throw new Error(`Empty response from [${spec.provider}:${spec.model}]`);
    }
    return stripReasoningBlocks(rawContent);
  } finally {
    clearTimeout(timer);
  }
}
async function executeVakaLlmChain(messages, options) {
  const groqKey = getSecretKey("GROQ_API_KEY") || getSecretKey("GROQ_API_KEY_2");
  const nvidiaKey = getSecretKey("NVIDIA_NIM_API_KEY") || getSecretKey("NVIDIA_API_KEY") || getSecretKey("NIM_API_KEY");
  const mistralKey = getSecretKey("MISTRAL_API_KEY");
  const keyMap = {
    groq: groqKey,
    nvidia: nvidiaKey,
    mistral: mistralKey
  };
  let candidates = [...VAKA_MODEL_CANDIDATES];
  if (options?.preferredProvider && options.preferredProvider !== "auto") {
    const pref = options.preferredProvider;
    candidates.sort((a, b) => a.provider === pref ? -1 : b.provider === pref ? 1 : 0);
  }
  for (const spec of candidates) {
    const apiKey = keyMap[spec.provider];
    if (!apiKey) {
      continue;
    }
    try {
      const result = await callProviderApi(spec, messages, apiKey);
      if (result && result.trim().length > 0) {
        return {
          text: result.trim(),
          provider: spec.provider,
          model: spec.model
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

// server/services/vakaDeterministicEngine.ts
function processDeterministicInterrogation(caseData, suspectId, actionType = "question", payload, currentStress = 10, locale = "tr") {
  const isEn = locale === "en";
  const suspect = caseData.suspects.find((s) => s.id === suspectId);
  if (!suspect) {
    return {
      text: isEn ? "Suspect not found in dossier." : "\u015E\xFCpheli dosyada bulunamad\u0131.",
      behavioralCue: "",
      newStress: currentStress,
      stressDelta: 0,
      confessed: false
    };
  }
  let stress = Math.max(0, Math.min(100, currentStress));
  const startStress = stress;
  const getCue = (st) => {
    if (st >= 75) return isEn ? suspect.behavioralCues.breaking.en : suspect.behavioralCues.breaking.tr;
    if (st >= 40) return isEn ? suspect.behavioralCues.nervous.en : suspect.behavioralCues.nervous.tr;
    return isEn ? suspect.behavioralCues.calm.en : suspect.behavioralCues.calm.tr;
  };
  const history = payload.history || [];
  if (actionType === "present_evidence" && payload.presentedClueId) {
    const clue = caseData.clues.find((c) => c.id === payload.presentedClueId);
    if (!clue) {
      return {
        text: isEn ? "That evidence does not exist in our dossier." : "Bu kan\u0131t dosyam\u0131zda kay\u0131tl\u0131 de\u011Fil.",
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: 0,
        confessed: false
      };
    }
    if (clue.contradictsSuspectId === suspect.id) {
      const gain2 = stress < 45 ? 18 : 24;
      stress = Math.min(100, stress + gain2);
      if (stress >= suspect.breakThreshold && suspect.isCulprit) {
        return {
          text: isEn ? suspect.confessionEn : suspect.confession,
          behavioralCue: isEn ? suspect.behavioralCues.breaking.en : suspect.behavioralCues.breaking.tr,
          newStress: stress,
          stressDelta: stress - startStress,
          confessed: true,
          unlockedClueId: clue.id
        };
      }
      const reply2 = isEn ? `(Voice shaking) Where... where did you get that ${clue.labelEn.toLowerCase()}?! I told you that wasn't me!` : `(Sesi titreyerek) O... o ${clue.label.toLowerCase()} belgesini nereden buldunuz?! Benimle bir ilgisi olmad\u0131\u011F\u0131n\u0131 s\xF6ylemi\u015Ftim!`;
      return {
        text: `${reply2} ${stress >= 65 ? suspect.lies.level3 : suspect.lies.level2}`,
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false,
        unlockedClueId: clue.id
      };
    }
    if (clue.clearsSuspectId === suspect.id) {
      stress = Math.max(0, stress - 15);
      const reply2 = isEn ? `See? Even this ${clue.labelEn.toLowerCase()} proves my innocence! You are barking up the wrong tree, detective.` : `G\xF6rd\xFCn\xFCz m\xFC? Bu ${clue.label.toLowerCase()} bile masumiyetimi kan\u0131tl\u0131yor! Bo\u015Funa vaktimi harc\u0131yorsunuz dedektif.`;
      return {
        text: reply2,
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false
      };
    }
    stress = Math.max(0, stress - 10);
    const reply = isEn ? `What does this ${clue.labelEn.toLowerCase()} have to do with me? You have absolutely nothing on me, detective.` : `Bu ${clue.label.toLowerCase()} ile benim ne alakam var? Elinizde bana dair hi\xE7bir somut delil yok dedektif.`;
    return {
      text: reply,
      behavioralCue: getCue(stress),
      newStress: stress,
      stressDelta: stress - startStress,
      confessed: false
    };
  }
  if (actionType === "bluff") {
    const priorBluffs = history.filter(
      (m) => m.role === "user" && (m.content.includes("BL\xD6F") || m.content.includes("BLUFF"))
    ).length;
    if (priorBluffs >= 1) {
      stress = Math.max(5, stress - 14);
      const spamReply = isEn ? "(Laughs dismissively) The exact same bluff again? Detective, if you actually had conclusive proof, you would have charged me already. Your empty threats are pathetic." : "(Alayc\u0131 bir tebess\xFCmle ba\u015F\u0131n\u0131 sall\u0131yor) Yine mi ayn\u0131 temelsiz bl\xF6f dedektif? Elinizde ger\xE7ekten bir kay\u0131t ya da somut delil olsayd\u0131 \u015Fimdiye kadar masaya koymu\u015Ftunuz. Bu bo\u015F tehditleriniz sadece \xE7aresizli\u011Finizi g\xF6steriyor!";
      return {
        text: spamReply,
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false
      };
    }
    if (suspect.isCulprit) {
      if (startStress < 45) {
        stress = Math.max(5, stress - 12);
        const reply2 = isEn ? "(Smiles coldly) You're trying to bluff me, detective. You don't have a shred of surveillance footage or testimony, or you would have handcuffed me already." : "(So\u011Fuk\xE7a g\xFCl\xFCms\xFCyor) Bana bl\xF6f yapmaya \xE7al\u0131\u015F\u0131yorsunuz dedektif. Elinizde ne kamera kayd\u0131 ne de g\xF6rg\xFC tan\u0131\u011F\u0131 var; olsayd\u0131 \xE7oktan kelep\xE7eyi takm\u0131\u015Ft\u0131n\u0131z.";
        return {
          text: reply2,
          behavioralCue: getCue(stress),
          newStress: stress,
          stressDelta: stress - startStress,
          confessed: false
        };
      }
      stress = Math.min(100, stress + 16);
      const reply = isEn ? "(Blinks rapidly, sweating) What... you pulled that record?! No, you can't have! The blind spot... I mean, you're bluffing! You have nothing!" : "(H\u0131zla g\xF6zlerini k\u0131rp\u0131\u015Ft\u0131r\u0131yor, terliyor) Ne... o kayd\u0131 m\u0131 buldunuz?! Hay\u0131r, bulmu\u015F olamazs\u0131n\u0131z! O saatteki k\xF6r noktay\u0131... Yani, bl\xF6f yap\u0131yorsunuz!";
      return {
        text: reply,
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false
      };
    } else {
      stress = Math.max(0, stress - 12);
      const reply = isEn ? "Nice try detective, but that's an obvious bluff. I know my rights and I won't let you intimidate me." : "G\xFCzel deneme dedektif, ama bariz bir bl\xF6f yap\u0131yorsunuz. Haklar\u0131m\u0131 biliyorum ve as\u0131ls\u0131z iddialarla beni y\u0131ld\u0131ramazs\u0131n\u0131z.";
      return {
        text: reply,
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false
      };
    }
  }
  if (actionType === "cross_examine" && payload.crossSuspectId) {
    const other = caseData.suspects.find((s) => s.id === payload.crossSuspectId);
    const otherName = other ? other.name : isEn ? "the other witness" : "di\u011Fer tan\u0131k";
    const gossipObj = suspect.gossip[payload.crossSuspectId];
    const gossipText = gossipObj ? isEn ? gossipObj.en : gossipObj.tr : "";
    if (stress < 75) {
      stress = Math.min(75, stress + 16);
    } else {
      stress = Math.min(80, stress + 4);
    }
    const intro = isEn ? `${otherName} said that about me?! That liar is just trying to save their own neck!` : `${otherName} benim hakk\u0131mda bunu mu s\xF6yledi?! O yalanc\u0131 s\u0131rf kendi pa\xE7as\u0131n\u0131 kurtarmak i\xE7in iftira at\u0131yor!`;
    const fullReply = gossipText ? `${intro} ${gossipText}` : intro;
    return {
      text: fullReply,
      behavioralCue: getCue(stress),
      newStress: stress,
      stressDelta: stress - startStress,
      confessed: false
    };
  }
  if (actionType === "stay_silent") {
    const priorSilences = history.filter(
      (m) => m.role === "user" && (m.content.includes("SESS\u0130ZL\u0130K") || m.content.includes("SILENCE"))
    ).length;
    if (priorSilences >= 2) {
      stress = Math.max(10, stress - 8);
      const spamReply = isEn ? "(Crosses arms and checks wristwatch) Staring at me in silence is getting ridiculous, detective. It's clear you've run out of questions and have no case. Call my attorney or let me go." : "(Kollar\u0131n\u0131 kavu\u015Fturup saatine bak\u0131yor) Dakikalard\u0131r bo\u015F bo\u015F susup bakman\u0131z art\u0131k g\xFCl\xFCn\xE7 olmaya ba\u015Flad\u0131 dedektif. Soracak sorunuz ve elinizde tek bir delil dahi olmad\u0131\u011F\u0131 a\u015Fik\xE2r. Ya avukat\u0131m\u0131 \xE7a\u011F\u0131r\u0131n ya da beni serbest b\u0131rak\u0131n!";
      return {
        text: spamReply,
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false
      };
    }
    if (priorSilences === 1) {
      if (stress < 55) stress = Math.min(55, stress + 3);
      const reply2 = isEn ? "(Shifts slightly) Prolonged silence won't fabricate evidence out of thin air, detective. Ask what you want to ask." : "(Hafif\xE7e k\u0131p\u0131rdan\u0131yor) Susarak havadan delil yaratamazs\u0131n\u0131z dedektif. Ne sormak istiyorsan\u0131z sorun art\u0131k.";
      return {
        text: reply2,
        behavioralCue: getCue(stress),
        newStress: stress,
        stressDelta: stress - startStress,
        confessed: false
      };
    }
    if (stress < 55) {
      stress = Math.min(55, stress + 10);
    }
    let reply = "";
    if (suspect.isCulprit) {
      if (stress >= 50) {
        reply = isEn ? "(Fidgets uncomfortably) Why are you staring at me like that?! Ask your questions or let me walk out of here!" : "(Huzursuzca k\u0131p\u0131rdan\u0131yor) Neden bana \xF6yle dik dik bak\u0131yorsunuz?! Sorunuz varsa sorun, yoksa beni buradan b\u0131rak\u0131n!";
      } else {
        reply = isEn ? "(Clears throat nervously) Your silence won't change the facts, detective. What do you want to know?" : "(Bo\u011Faz\u0131n\u0131 gergince temizliyor) Sessiz kalman\u0131z ger\xE7e\u011Fi de\u011Fi\u015Ftirmez dedektif. Ne bilmek istiyorsunuz?";
      }
    } else {
      reply = isEn ? "Staring at me in silence won't make me guilty. Call my lawyer if you're not going to speak." : "Bana sessizce bakman\u0131z beni su\xE7lu yapmaz. Konu\u015Fmayacaksan\u0131z avukat\u0131m\u0131 arayaca\u011F\u0131m.";
    }
    return {
      text: reply,
      behavioralCue: getCue(stress),
      newStress: stress,
      stressDelta: stress - startStress,
      confessed: false
    };
  }
  const qText = payload.question || "";
  const qLower = qText.toLowerCase().trim();
  const motiveWords = [
    ...(suspect.motive || "").toLowerCase().split(/\s+/),
    ...(suspect.minorSecret || "").toLowerCase().split(/\s+/),
    (caseData.victim.name || "").toLowerCase(),
    "kurban",
    "victim",
    "para",
    "money",
    "bor\xE7",
    "debt",
    "miras",
    "inheritance",
    "kavga",
    "fight",
    "s\u0131r",
    "secret",
    "cinayet",
    "murder",
    "\xF6ld\xFCr",
    "kill"
  ].filter((w) => w.length > 3);
  const alibiWords = [
    "saat",
    "time",
    "neredeydin",
    "where",
    "kamera",
    "camera",
    "g\xF6rg\xFC",
    "witness",
    "f\u0131rt\u0131na",
    "storm",
    "oda",
    "room",
    "otel",
    "hotel"
  ];
  const touchesSecret = motiveWords.some((w) => qLower.includes(w));
  const touchesAlibi = alibiWords.some((w) => qLower.includes(w));
  const lastUserMsg = [...history].reverse().find((m) => m.role === "user");
  const isDuplicateQuestion = lastUserMsg && lastUserMsg.content.toLowerCase().trim() === qLower && qLower.length > 5;
  if (isDuplicateQuestion) {
    stress = Math.max(5, stress - 5);
    const repReply = isEn ? "You just asked me that exact same thing. Repeating questions won't change my answer, detective." : "Bana az \xF6nce sordu\u011Funuz sorunun t\u0131pat\u0131p ayn\u0131s\u0131n\u0131 soruyorsunuz. Tekrarlaman\u0131z cevab\u0131m\u0131 de\u011Fi\u015Ftirmeyecek dedektif.";
    return {
      text: repReply,
      behavioralCue: getCue(stress),
      newStress: stress,
      stressDelta: stress - startStress,
      confessed: false
    };
  }
  const greetings = ["naber", "selam", "merhaba", "nas\u0131ls\u0131n", "g\xFCnayd\u0131n", "iyi ak\u015Famlar", "hey", "hi", "hello", "how are you", "sup"];
  const isGreeting = greetings.some((g) => qLower === g || qLower.startsWith(g + " ") || qLower.endsWith(" " + g));
  if (isGreeting) {
    const greetReply = isEn ? "We're not here for casual chit-chat, detective. If you have an actual question regarding the case, ask it." : "Buraya \xE7ay sohbetine gelmedik dedektif. Olayla ilgili soraca\u011F\u0131n\u0131z ger\xE7ek bir soru varsa sorun, vaktimi \xE7almay\u0131n.";
    return {
      text: greetReply,
      behavioralCue: getCue(stress),
      newStress: stress,
      stressDelta: 0,
      confessed: false
    };
  }
  let gain = 3;
  if (touchesSecret) {
    gain = stress < 60 ? 14 : 6;
  } else if (touchesAlibi) {
    gain = stress < 60 ? 8 : 4;
  }
  if (stress < 70) {
    stress = Math.min(70, stress + gain);
  }
  let replyText = "";
  if (touchesSecret) {
    replyText = isEn ? `(Eyes shifting nervously) That matter with ${caseData.victim.name} was strictly personal! ${stress >= 50 ? suspect.lies.level3 : suspect.lies.level2}` : `(G\xF6zleri gergince ka\xE7\u0131yor) ${caseData.victim.name} ile aram\u0131zdaki o mesele tamamen ki\u015Fiseldi! ${stress >= 50 ? suspect.lies.level3 : suspect.lies.level2}`;
  } else if (touchesAlibi) {
    replyText = isEn ? `I already gave my timeline to the precinct: ${stress >= 45 ? suspect.lies.level2 : suspect.lies.level1}` : `\u0130fade tutana\u011F\u0131mda o saatte nerede oldu\u011Fumu a\xE7\u0131k\xE7a belirttim: ${stress >= 45 ? suspect.lies.level2 : suspect.lies.level1}`;
  } else if (stress >= 65) {
    replyText = isEn ? suspect.lies.level3 : suspect.lies.level3;
  } else if (stress >= 35) {
    replyText = isEn ? suspect.lies.level2 : suspect.lies.level2;
  } else {
    replyText = isEn ? suspect.lies.level1 : suspect.lies.level1;
  }
  return {
    text: replyText,
    behavioralCue: getCue(stress),
    newStress: stress,
    stressDelta: stress - startStress,
    confessed: false
  };
}

// server/routers/vakaRouter.ts
function toPublicCaseDto(found) {
  return {
    id: found.id,
    title: found.title,
    titleEn: found.titleEn,
    difficulty: found.difficulty,
    briefing: found.briefing,
    briefingEn: found.briefingEn,
    incidentTime: found.incidentTime,
    location: found.location,
    locationEn: found.locationEn,
    victim: found.victim,
    timeline: found.timeline,
    crimeSceneNotes: found.crimeSceneNotes,
    analystSummary: found.analystSummary,
    suspects: found.suspects.map((s) => ({
      id: s.id,
      name: s.name,
      role: s.role,
      roleEn: s.roleEn,
      age: s.age,
      temperament: s.temperament,
      temperamentEn: s.temperamentEn,
      relationshipToVictim: s.relationshipToVictim,
      relationshipToVictimEn: s.relationshipToVictimEn,
      statement: s.statement,
      statementEn: s.statementEn,
      alibi: s.alibi,
      alibiEn: s.alibiEn,
      detailedStatements: s.detailedStatements.map((sent) => ({
        id: sent.id,
        text: sent.text,
        textEn: sent.textEn,
        isContradiction: sent.isContradiction,
        contradictionClueId: sent.contradictionClueId
      }))
    })),
    clues: found.clues
  };
}
function getVakaConfig() {
  const envModes = process.env.VAKA_ENABLED_MODES;
  let enabledModes = ["daily", "interrogation", "contradiction"];
  if (envModes) {
    const parsed = envModes.split(",").map((m) => m.trim().toLowerCase());
    const valid = parsed.filter((m) => ["daily", "interrogation", "contradiction"].includes(m));
    if (valid.length > 0) enabledModes = valid;
  }
  let defaultMode = "daily";
  const envDefault = process.env.VAKA_DEFAULT_MODE?.trim().toLowerCase();
  if (envDefault && enabledModes.includes(envDefault)) {
    defaultMode = envDefault;
  } else if (!enabledModes.includes("daily")) {
    defaultMode = enabledModes[0];
  }
  const hasLlmKeys = hasLlmApiKey();
  return {
    enabledModes,
    defaultMode,
    hasLlmKeys
  };
}
var vakaRouter = router({
  config: publicProcedure.query(() => {
    return getVakaConfig();
  }),
  getCases: publicProcedure.query(() => {
    return VAKA_SAMPLE_CASES.map((c) => ({
      id: c.id,
      title: c.title,
      titleEn: c.titleEn,
      difficulty: c.difficulty,
      briefing: c.briefing,
      briefingEn: c.briefingEn,
      incidentTime: c.incidentTime,
      location: c.location,
      locationEn: c.locationEn,
      victim: c.victim,
      suspectCount: c.suspects.length,
      clueCount: c.clues.length
    }));
  }),
  getCaseDetail: publicProcedure.input(z2.object({ caseId: z2.string() })).query(({ input }) => {
    const found = VAKA_SAMPLE_CASES.find((c) => c.id === input.caseId) || VAKA_SAMPLE_CASES[0];
    return toPublicCaseDto(found);
  }),
  getDailyCase: publicProcedure.query(() => {
    const today = /* @__PURE__ */ new Date();
    const dayIndex = (today.getFullYear() * 365 + today.getMonth() * 31 + today.getDate()) % VAKA_SAMPLE_CASES.length;
    const selected = VAKA_SAMPLE_CASES[dayIndex] || VAKA_SAMPLE_CASES[0];
    return {
      date: today.toISOString().split("T")[0],
      caseIndex: dayIndex + 1,
      case: toPublicCaseDto(selected)
    };
  }),
  interrogate: publicProcedure.input(
    z2.object({
      caseId: z2.string(),
      suspectId: z2.string(),
      actionType: z2.enum(["question", "present_evidence", "cross_examine", "stay_silent", "bluff", "confront"]).default("question"),
      question: z2.string().max(300).optional(),
      presentedClueId: z2.string().optional(),
      crossSuspectId: z2.string().optional(),
      crossQuote: z2.string().optional(),
      bluffClaim: z2.string().optional(),
      currentStress: z2.number().min(0).max(100).default(10),
      locale: z2.enum(["tr", "en"]).default("tr"),
      history: z2.array(
        z2.object({
          role: z2.enum(["user", "assistant"]),
          content: z2.string()
        })
      ).optional()
    })
  ).mutation(async ({ input }) => {
    const caseData = VAKA_SAMPLE_CASES.find((c) => c.id === input.caseId) || VAKA_SAMPLE_CASES[0];
    const suspect = caseData.suspects.find((s) => s.id === input.suspectId) || caseData.suspects[0];
    const deterministic = processDeterministicInterrogation(
      caseData,
      suspect.id,
      input.actionType,
      {
        question: input.question,
        presentedClueId: input.presentedClueId,
        crossSuspectId: input.crossSuspectId,
        crossQuote: input.crossQuote,
        bluffClaim: input.bluffClaim,
        history: input.history
      },
      input.currentStress,
      input.locale
    );
    let replyText = deterministic.text;
    let source = "engine";
    let llmProviderUsed = "";
    let llmModelUsed = "";
    const hasKeys = hasLlmApiKey();
    if (hasKeys && !deterministic.confessed && (input.actionType === "question" || input.actionType === "cross_examine")) {
      const isEn = input.locale === "en";
      const presentedClue = input.presentedClueId ? caseData.clues.find((c) => c.id === input.presentedClueId) ?? null : null;
      const otherSuspectsInfo = caseData.suspects.filter((s) => s.id !== suspect.id).map((s) => `- ${s.name} (${isEn ? s.roleEn || s.role : s.role}): ${isEn ? s.statementEn || s.statement : s.statement}`).join("\n");
      const systemPrompt = buildVakaInterrogationPrompt({
        suspect,
        newStress: deterministic.newStress,
        otherSuspectsInfo,
        presentedClue,
        locale: input.locale
      });
      const crossSuspectName = caseData.suspects.find((s) => s.id === input.crossSuspectId)?.name || "Ba\u015Fka bir \u015F\xFCpheli";
      const userPrompt = input.actionType === "cross_examine" && input.crossSuspectId ? isEn ? `Detective: "${crossSuspectName} told me you were lying about your whereabouts!"` : `Dedektif: "${crossSuspectName} bana olay saatinde senin yalan s\xF6yledi\u011Fini anlatt\u0131!"` : input.question || (isEn ? "Explain yourself!" : "Kendini a\xE7\u0131kla!");
      const messages = [
        { role: "system", content: systemPrompt },
        ...(input.history || []).slice(-4).map((h) => ({
          role: h.role === "user" ? "user" : "assistant",
          content: h.content
        })),
        { role: "user", content: userPrompt }
      ];
      try {
        const llmResult = await executeVakaLlmChain(messages);
        if (llmResult && llmResult.text) {
          replyText = llmResult.text;
          source = "llm";
          llmProviderUsed = llmResult.provider;
          llmModelUsed = llmResult.model;
        }
      } catch (err) {
        logger.warn("vaka", "Vaka LLM fallback triggered", { err: err instanceof Error ? err.message : String(err) });
      }
    }
    return {
      reply: replyText,
      behavioralCue: deterministic.behavioralCue,
      stress: deterministic.newStress,
      stressDelta: deterministic.stressDelta,
      confessed: deterministic.confessed,
      unlockedClueId: deterministic.unlockedClueId,
      source,
      provider: llmProviderUsed || void 0,
      model: llmModelUsed || void 0
    };
  }),
  checkContradiction: publicProcedure.input(
    z2.object({
      caseId: z2.string(),
      suspectId: z2.string(),
      sentenceId: z2.string(),
      clueId: z2.string(),
      locale: z2.enum(["tr", "en"]).default("tr")
    })
  ).mutation(({ input }) => {
    const caseData = VAKA_SAMPLE_CASES.find((c) => c.id === input.caseId) || VAKA_SAMPLE_CASES[0];
    const suspect = caseData.suspects.find((s) => s.id === input.suspectId);
    if (!suspect) throw new Error("Suspect not found");
    const sentence = suspect.detailedStatements.find((s) => s.id === input.sentenceId);
    const clue = caseData.clues.find((c) => c.id === input.clueId);
    if (!sentence || !clue) {
      return {
        success: false,
        message: input.locale === "en" ? "Invalid selection." : "Ge\xE7ersiz se\xE7im.",
        penalty: 0
      };
    }
    const isMatch = sentence.isContradiction && sentence.contradictionClueId === clue.id;
    if (isMatch) {
      return {
        success: true,
        message: input.locale === "en" ? sentence.explanationEn || "OBJECTION! The testimony directly contradicts the physical evidence!" : sentence.explanation || "\u0130T\u0130RAZ! \u0130fade do\u011Frudan fiziksel kan\u0131tla \xE7eli\u015Fiyor!",
        penalty: 0
      };
    }
    return {
      success: false,
      message: input.locale === "en" ? "OBJECTION OVERRULED! This clue does not disprove this specific statement." : "\u0130T\u0130RAZ REDDED\u0130LD\u0130! Bu kan\u0131t se\xE7ti\u011Fin c\xFCmleyi yalanlam\u0131yor.",
      penalty: 15
    };
  }),
  accuse: publicProcedure.input(
    z2.object({
      caseId: z2.string(),
      accusedId: z2.string(),
      method: z2.string().optional(),
      motive: z2.string().optional(),
      decisiveClueId: z2.string(),
      locale: z2.enum(["tr", "en"]).default("tr")
    })
  ).mutation(({ input }) => {
    const caseData = VAKA_SAMPLE_CASES.find((c) => c.id === input.caseId) || VAKA_SAMPLE_CASES[0];
    const suspect = caseData.suspects.find((s) => s.id === input.accusedId);
    const isCulprit = caseData.culpritId === input.accusedId;
    const isCorrectClue = caseData.winningContradiction.clueId === input.decisiveClueId;
    const success = isCulprit && isCorrectClue;
    let score = 0;
    let grade = "C";
    if (success) {
      score = 280;
      grade = "S";
    } else if (isCulprit && !isCorrectClue) {
      score = 140;
      grade = "B";
    }
    return {
      success,
      grade,
      score,
      verdict: success ? "guilty" : "not_guilty",
      culpritName: caseData.suspects.find((s) => s.id === caseData.culpritId)?.name || "",
      confession: success ? input.locale === "en" ? suspect?.confessionEn : suspect?.confession : void 0,
      message: success ? input.locale === "en" ? `CASE CLOSED! ${suspect?.name} was formally indicted. The court unanimously accepted the charges.` : `VAKA KAPANDI! ${suspect?.name} resmen tutukland\u0131. Mahkeme sundu\u011Fun delilleri eksiksiz kabul etti.` : input.locale === "en" ? "CHARGES DISMISSED! Insufficient evidence or wrong suspect. The true culprit walked free." : "DAVA D\xDC\u015ET\xDC! Yetersiz delil veya yanl\u0131\u015F \u015F\xFCpheli su\xE7land\u0131. Ger\xE7ek fail serbest kald\u0131."
    };
  })
});

// server/routers.ts
var appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  daily: router({
    today: publicProcedure.query(() => ensureDailyContent())
  }),
  vaka: vakaRouter
  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/scheduled/dailyContent.ts
import { timingSafeEqual } from "node:crypto";
function tokenMatches(received, expected) {
  if (!received || !expected || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}
async function authorizeScheduledRequest(req) {
  const vdsToken = req.header("x-sely-cron-token");
  if (tokenMatches(vdsToken, process.env.DAILY_JOB_TOKEN)) return true;
  const authHeader = req.header("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7);
    const expectedSecret = process.env.CRON_SECRET || process.env.DAILY_JOB_TOKEN;
    if (tokenMatches(bearerToken, expectedSecret)) return true;
  }
  try {
    const user = await sdk.authenticateRequest(req);
    return Boolean(user.isCron && user.taskUid);
  } catch {
    return false;
  }
}
async function dailyContentHandler(req, res) {
  try {
    if (!await authorizeScheduledRequest(req)) return res.status(403).json({ error: "cron-only" });
    const manifest = await ensureDailyContent();
    return res.json({ ok: true, date: manifest.date, generated: manifest.games.length, version: "2" });
  } catch (error) {
    logger.error("cron:daily", "Content generation failed", error);
    return res.status(500).json({ error: "daily-generation-failed" });
  }
}
async function dailyCleanupHandler(req, res) {
  try {
    if (!await authorizeScheduledRequest(req)) return res.status(403).json({ error: "cron-only" });
    const removed = await cleanupDailyContent();
    return res.json({ ok: true, removed, retentionDays: 90 });
  } catch (error) {
    logger.error("cron:cleanup", "Cleanup failed", error);
    return res.status(500).json({ error: "daily-cleanup-failed" });
  }
}

// server/storage/leaderboard.ts
import IORedis from "ioredis";
var VALID_GAMES = ["echo", "knot", "cut", "shadow", "marker", "hane", "spark", "vaka"];
var MAX_SCORE_CEILINGS = {
  echo: 5e3,
  knot: 4e3,
  cut: 3e3,
  shadow: 3e3,
  marker: 3e3,
  hane: 2500,
  spark: 2e3,
  vaka: 500
};
var memoryStore = /* @__PURE__ */ new Map();
function getMemoryKey(gameId, dateStr) {
  return `lb:${gameId}:${dateStr}`;
}
function getTodayIsoDate() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
var tcpRedisInstance = null;
var tcpRedisConnecting = null;
async function getTcpRedisClient() {
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
        connectTimeout: 3e3,
        commandTimeout: 3e3,
        enableOfflineQueue: false,
        retryStrategy(times) {
          if (times > 3) return null;
          return Math.min(times * 100, 1e3);
        }
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
var l1Cache = /* @__PURE__ */ new Map();
var L1_TTL_MS = 5e3;
var MAX_L1_ENTRIES = 128;
function setL1Cache(key, entry) {
  if (l1Cache.size >= MAX_L1_ENTRIES) {
    const oldest = l1Cache.keys().next().value;
    if (oldest) l1Cache.delete(oldest);
  }
  l1Cache.set(key, entry);
}
async function getTopScores(gameId, dateStr = getTodayIsoDate()) {
  const l1Key = `${gameId}:${dateStr}`;
  const l1Cached = l1Cache.get(l1Key);
  if (l1Cached && Date.now() - l1Cached.timestamp < L1_TTL_MS) {
    return l1Cached.data;
  }
  const key = `lb:${gameId}:${dateStr}`;
  const tcpRedis = await getTcpRedisClient();
  if (tcpRedis) {
    try {
      const pipe = tcpRedis.pipeline();
      pipe.zrevrange(key, 0, 9, "WITHSCORES");
      pipe.zcard(key);
      const pipeResults = await pipe.exec();
      if (pipeResults && pipeResults[0] && !pipeResults[0][0]) {
        const result = pipeResults[0][1] || [];
        const count = Number(pipeResults[1]?.[1] ?? 0);
        const entries = [];
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
            timestamp: Date.now()
          });
        }
        const response = {
          gameId,
          date: dateStr,
          top: entries,
          totalPlayers: count || entries.length,
          source: "redis"
        };
        setL1Cache(l1Key, { timestamp: Date.now(), data: response });
        return response;
      }
    } catch {
    }
  }
  if (isTursoConfigured()) {
    try {
      const tursoResult = await getTursoTopScores(gameId, dateStr);
      if (tursoResult && tursoResult.top.length > 0) {
        return {
          gameId,
          date: dateStr,
          top: tursoResult.top,
          totalPlayers: tursoResult.totalPlayers,
          source: "turso"
        };
      }
    } catch {
    }
  }
  const memKey = getMemoryKey(gameId, dateStr);
  const gameMap = memoryStore.get(memKey) || /* @__PURE__ */ new Map();
  const sorted = Array.from(gameMap.entries()).map(([signature, data]) => ({
    signature,
    nick: data.nick,
    score: data.score,
    timestamp: data.timestamp
  })).sort((a, b) => b.score - a.score).slice(0, 10).map((item, index) => ({
    rank: index + 1,
    ...item
  }));
  return {
    gameId,
    date: dateStr,
    top: sorted,
    totalPlayers: gameMap.size,
    source: "memory"
  };
}
async function submitScore(gameId, score, nick, signature, dateStr = getTodayIsoDate()) {
  if (typeof score !== "number" || isNaN(score) || score <= 0) {
    return { success: false, message: "Ge\xE7ersiz skor de\u011Feri." };
  }
  const maxCeiling = MAX_SCORE_CEILINGS[gameId] ?? 3e3;
  if (score > maxCeiling) {
    return { success: false, message: "Skor makul s\u0131n\u0131rlar\u0131n \xFCzerinde." };
  }
  const cleanNick = nick.trim().slice(0, 32);
  const cleanSig = signature.trim().slice(0, 32);
  if (!cleanNick || !cleanSig) {
    return { success: false, message: "Eksik kod ad\u0131 veya imza." };
  }
  const key = `lb:${gameId}:${dateStr}`;
  const member = `${cleanSig}::${cleanNick}`;
  l1Cache.delete(`${gameId}:${dateStr}`);
  if (isTursoConfigured()) {
    saveTursoScore(gameId, score, cleanNick, cleanSig, dateStr).catch(() => {
    });
  }
  const tcpRedis = await getTcpRedisClient();
  if (tcpRedis) {
    try {
      const pipe = tcpRedis.pipeline();
      pipe.zadd(key, "GT", score, member);
      pipe.expire(key, 172800);
      pipe.zrevrank(key, member);
      const pipeResults = await pipe.exec();
      const rank0 = pipeResults?.[2]?.[1];
      const rank2 = typeof rank0 === "number" ? rank0 + 1 : void 0;
      return { success: true, rank: rank2 };
    } catch {
    }
  }
  if (isTursoConfigured()) {
    try {
      const saved = await saveTursoScore(gameId, score, cleanNick, cleanSig, dateStr);
      if (saved) {
        const rank2 = await getTursoPlayerRank(gameId, dateStr, score);
        return { success: true, rank: rank2 };
      }
    } catch {
    }
  }
  const memKey = getMemoryKey(gameId, dateStr);
  if (!memoryStore.has(memKey)) {
    if (memoryStore.size >= 32) {
      const oldestBoard = memoryStore.keys().next().value;
      if (oldestBoard) memoryStore.delete(oldestBoard);
    }
    memoryStore.set(memKey, /* @__PURE__ */ new Map());
  }
  const gameMap = memoryStore.get(memKey);
  const existing = gameMap.get(cleanSig);
  if (!existing || score > existing.score) {
    if (!existing && gameMap.size >= 500) {
      const oldestKey = gameMap.keys().next().value;
      if (oldestKey) gameMap.delete(oldestKey);
    }
    gameMap.set(cleanSig, { nick: cleanNick, score, timestamp: Date.now() });
  }
  const sorted = Array.from(gameMap.entries()).sort((a, b) => b[1].score - a[1].score);
  const rankIndex = sorted.findIndex(([sig]) => sig === cleanSig);
  const rank = rankIndex !== -1 ? rankIndex + 1 : void 0;
  return { success: true, rank };
}
async function getLeaderboardHandler(req, res) {
  const game = String(req.query.game || "echo");
  const date = String(req.query.date || getTodayIsoDate());
  if (!VALID_GAMES.includes(game)) {
    return res.status(400).json({ error: "Ge\xE7ersiz oyun kimli\u011Fi." });
  }
  res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60, stale-while-revalidate=300");
  try {
    const data = await getTopScores(game, date);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Liderlik tablosu al\u0131namad\u0131." });
  }
}
async function submitLeaderboardHandler(req, res) {
  const { gameId, score, nick, signature } = req.body || {};
  if (!VALID_GAMES.includes(gameId)) {
    return res.status(400).json({ error: "Ge\xE7ersiz oyun kimli\u011Fi." });
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

// server/storage/globalConfig.ts
import { getAll } from "@vercel/global-config";
var DEFAULT_CONFIG = {
  maintenance: false,
  announcement: null,
  flags: {},
  source: "fallback"
};
var cachedConfig = null;
var lastFetchTime = 0;
var CACHE_TTL_MS2 = 15e3;
async function fetchGlobalConfig() {
  const now = Date.now();
  if (cachedConfig && now - lastFetchTime < CACHE_TTL_MS2) {
    return cachedConfig;
  }
  const connectionString = process.env.GLOBAL_CONFIG || process.env.EDGE_CONFIG;
  if (!connectionString) {
    return DEFAULT_CONFIG;
  }
  try {
    const rawItems = await getAll();
    if (!rawItems || typeof rawItems !== "object") {
      return DEFAULT_CONFIG;
    }
    const config = {
      maintenance: Boolean(rawItems.maintenance ?? false),
      maintenanceMessageTr: typeof rawItems.maintenanceMessageTr === "string" ? rawItems.maintenanceMessageTr : void 0,
      maintenanceMessageEn: typeof rawItems.maintenanceMessageEn === "string" ? rawItems.maintenanceMessageEn : void 0,
      announcement: rawItems.announcement || null,
      flags: rawItems.flags || {},
      source: "global-config"
    };
    cachedConfig = config;
    lastFetchTime = now;
    return config;
  } catch (err) {
    return DEFAULT_CONFIG;
  }
}
async function getGlobalConfigHandler(_req, res) {
  res.setHeader("Cache-Control", "public, max-age=15, s-maxage=30, stale-while-revalidate=60");
  try {
    const config = await fetchGlobalConfig();
    return res.json(config);
  } catch {
    return res.json(DEFAULT_CONFIG);
  }
}

// server/_core/security.ts
var remoteAddress = (req) => req.socket.remoteAddress ?? "unknown";
var MAX_LIMITER_ENTRIES = 2048;
function createRateLimiter({ max, windowMs, now = Date.now, key = remoteAddress }) {
  const counters = /* @__PURE__ */ new Map();
  let lastSweep = 0;
  return (req, res, next) => {
    const moment = now();
    if (moment - lastSweep > windowMs) {
      counters.forEach((counter2, counterKey2) => {
        if (counter2.resetAt <= moment) counters.delete(counterKey2);
      });
      lastSweep = moment;
    }
    if (counters.size >= MAX_LIMITER_ENTRIES) {
      const oldestKey = counters.keys().next().value;
      if (oldestKey) counters.delete(oldestKey);
    }
    const counterKey = key(req);
    const current = counters.get(counterKey);
    const counter = !current || current.resetAt <= moment ? { count: 0, resetAt: moment + windowMs } : current;
    counter.count += 1;
    counters.set(counterKey, counter);
    const remaining = Math.max(0, max - counter.count);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil(counter.resetAt / 1e3)));
    if (counter.count > max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((counter.resetAt - moment) / 1e3))));
      res.status(429).json({ error: "rate-limit" });
      return;
    }
    next();
  };
}
var securityHeaders = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
};

// server/seoRoutes.ts
var CACHE_1DAY = "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";
var CACHE_1WEEK = "public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000";
function registerSeoAndVerificationRoutes(app2) {
  app2.get("/ads.txt", (_req, res) => {
    const adsTxt = process.env.ADS_TXT || process.env.VITE_ADS_TXT;
    if (adsTxt) {
      res.set("Cache-Control", CACHE_1DAY);
      res.type("text/plain; charset=utf-8").send(adsTxt.trim() + "\n");
    } else {
      res.status(404).send("Not Found");
    }
  });
  app2.get("/robots.txt", (_req, res) => {
    const domain = process.env.PRIMARY_DOMAIN || process.env.VITE_PRIMARY_DOMAIN;
    const sitemapUrl = domain ? `https://${domain}/sitemap.xml` : "/sitemap.xml";
    res.set("Cache-Control", CACHE_1DAY);
    res.type("text/plain; charset=utf-8").send(`User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`);
  });
  app2.get("/sitemap.xml", (_req, res) => {
    const domain = process.env.PRIMARY_DOMAIN || process.env.VITE_PRIMARY_DOMAIN;
    const base = domain ? `https://${domain}` : "";
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${base}/privacy</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
  <url><loc>${base}/terms</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
  <url><loc>${base}/accessibility</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
</urlset>`;
    res.set("Cache-Control", CACHE_1DAY);
    res.type("application/xml; charset=utf-8").send(sitemap);
  });
  app2.get("/google:token.html", (req, res, next) => {
    const token = req.params.token;
    const expected = process.env.GOOGLE_SITE_VERIFICATION || process.env.VITE_GOOGLE_SITE_VERIFICATION;
    if (expected && expected === token) {
      res.set("Cache-Control", CACHE_1WEEK);
      return res.type("text/html; charset=utf-8").send(`google-site-verification: google${token}.html
`);
    }
    next();
  });
  app2.get("/BingSiteAuth.xml", (_req, res, next) => {
    const token = process.env.BING_SITE_VERIFICATION || process.env.VITE_BING_SITE_VERIFICATION;
    if (token) {
      res.set("Cache-Control", CACHE_1WEEK);
      return res.type("application/xml; charset=utf-8").send(`<?xml version="1.0"?>
<users>
	<user>${token}</user>
</users>
`);
    }
    next();
  });
  app2.get("/yandex_:token.html", (req, res, next) => {
    const token = req.params.token;
    const expected = process.env.YANDEX_SITE_VERIFICATION || process.env.VITE_YANDEX_SITE_VERIFICATION;
    if (expected && expected === token) {
      res.set("Cache-Control", CACHE_1WEEK);
      return res.type("text/html; charset=utf-8").send(`<html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head><body>Verification: ${token}</body></html>
`);
    }
    next();
  });
}

// server/og/postersDataUri.ts
var GAME_POSTERS_DATA_URI = {
  "echo": "data:image/jpeg;base64,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",
  "knot": "data:image/jpeg;base64,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",
  "cut": "data:image/jpeg;base64,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",
  "shadow": "data:image/jpeg;base64,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",
  "vaka": "data:image/jpeg;base64,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",
  "hane": "data:image/jpeg;base64,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",
  "spark": "data:image/jpeg;base64,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",
  "hub": "data:image/jpeg;base64,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"
};

// server/og/ogTemplate.ts
var GAME_CATALOG_META = {
  echo: {
    num: "01",
    title: "YANKI ODASI",
    titleEn: "ECHO ROOM",
    eyebrow: "KE\u015E\u0130F / R\u0130SK",
    eyebrowEn: "EXPLORE / RISK",
    motto: "Yolu g\xF6rme. Onu duy.",
    mottoEn: "Do not see the path. Hear it.",
    mechanic: "\xDC\xE7 izi topla, m\xFChr\xFC a\xE7 ve yank\u0131 b\xFCt\xE7eni koru.",
    mechanicEn: "Collect three marks, unseal the way, preserve echo budget.",
    controls: "Y\xF6n tu\u015Flar\u0131 + Space",
    controlsEn: "Arrow keys + Space",
    playTime: "3\u20135 dk",
    poster: "https://sely.tr/storage/yanki-odasi-poster_07ca7169.png",
    accent: "#E9563F",
    ink: "#293B75",
    icon: "\u25CE"
  },
  knot: {
    num: "02",
    title: "D\xDC\u011E\xDCM",
    titleEn: "KNOT",
    eyebrow: "AKI\u015E / BULMACA",
    eyebrowEn: "FLOW / PUZZLE",
    motto: "Bir d\xFC\u011F\xFCm at; b\xFCt\xFCn ak\u0131\u015F\u0131 de\u011Fi\u015Ftir.",
    mottoEn: "Tie one knot; change the whole current.",
    mechanic: "Karolar\u0131 \xE7evir ve kayna\u011F\u0131 hedefe ba\u011Flayan tek ak\u0131\u015F\u0131 kur.",
    mechanicEn: "Rotate tiles and build clean flow from source to target.",
    controls: "T\u0131kla veya Enter",
    controlsEn: "Click or Enter",
    playTime: "1\u20133 dk",
    poster: "https://sely.tr/storage/dugum-poster_684e5a01.png",
    accent: "#293B75",
    ink: "#E9563F",
    icon: "\u260D"
  },
  cut: {
    num: "03",
    title: "KIRPIK",
    titleEn: "CUTOUT",
    eyebrow: "KES\u0130M / R\u0130T\u0130M",
    eyebrowEn: "CUT / RHYTHM",
    motto: "Alan a\xE7mak i\xE7in bir \u015Feyi feda et.",
    mottoEn: "Give something up to make space.",
    mechanic: "Tek \xE7izgiyle hareketli \u015Fekilleri kes; b\xFCy\xFCk zincir kur.",
    mechanicEn: "Cut moving shapes with one line; build large chain.",
    controls: "S\xFCr\xFCkle ve b\u0131rak",
    controlsEn: "Drag and release",
    playTime: "90 sn",
    poster: "https://sely.tr/storage/kirpik-poster_23817b18.png",
    accent: "#654169",
    ink: "#1B1A1B",
    icon: "\u25E7"
  },
  shadow: {
    num: "04",
    title: "G\xD6LGE PAYI",
    titleEn: "SHADOW SHARE",
    eyebrow: "ZAMAN / E\u015ELEME",
    eyebrowEn: "TIME / MATCH",
    motto: "Ge\xE7mi\u015Fteki ad\u0131m\u0131n, \u015Fimdi kap\u0131y\u0131 a\xE7ar.",
    mottoEn: "A step in the past opens a door now.",
    mechanic: "Gecikmeli g\xF6lgeni iki pede hizala; sonra \xE7\u0131k\u0131\u015F\u0131 kullan.",
    mechanicEn: "Align delayed shadow on two pads, then take the exit.",
    controls: "Y\xF6n tu\u015Flar\u0131 / y\xF6n pedi",
    controlsEn: "Arrow keys / direction pad",
    playTime: "2 dk",
    poster: "https://sely.tr/storage/golge-payi-poster_1fa19d71.png",
    accent: "#296A55",
    ink: "#E9563F",
    icon: "\u25D0"
  },
  vaka: {
    num: "05",
    title: "VAKA",
    titleEn: "CASE",
    eyebrow: "DEDEKT\u0130FL\u0130K / \xC7IKARIM",
    eyebrowEn: "DETECTIVE / DEDUCTION",
    motto: "S\xF6z\xFC de\u011Fil, kan\u0131t\u0131 sun.",
    mottoEn: "Present the evidence, not the word.",
    mechanic: "\u015E\xFCpheliyi i\u015Faretle, ifadesiyle \xE7eli\u015Fen kan\u0131t\u0131 sun.",
    mechanicEn: "Accuse suspect, present contradiction evidence.",
    controls: "T\u0131kla veya dokun",
    controlsEn: "Click or tap",
    playTime: "3\u20135 dk",
    poster: "https://sely.tr/storage/isaretci-poster_681e174b.png",
    accent: "#E5B341",
    ink: "#1B1A1B",
    icon: "\u2696"
  },
  hane: {
    num: "06",
    title: "HANE",
    titleEn: "HANE",
    eyebrow: "KAYIT / \xC7IKARIM",
    eyebrowEn: "RECORD / INFERENCE",
    motto: "Kan\u0131t\u0131 say; kay\u0131t t\xFCr\xFCn\xFC sen se\xE7.",
    mottoEn: "Count the evidence; choose the record type.",
    mechanic: "Say\u0131 veya s\xF6zc\xFCk kayd\u0131nda se\xE7enekleri azalt.",
    mechanicEn: "Deduce number or word patterns from receipt clues.",
    controls: "Klavye veya dokun",
    controlsEn: "Keyboard or tap",
    playTime: "2\u20134 dk",
    poster: "https://sely.tr/storage/hane-number-logic-poster_9656a8a5.png",
    accent: "#E5B341",
    ink: "#293B75",
    icon: "\u25A6"
  },
  spark: {
    num: "07",
    title: "KIVILCIM",
    titleEn: "SPARK",
    eyebrow: "ARK / KA\xC7I\u015E",
    eyebrowEn: "ARC / ESCAPE",
    motto: "K\u0131v\u0131lc\u0131m s\xF6nmez; yer\xE7ekimine diren.",
    mottoEn: "The spark endures; resist the current.",
    mechanic: "Bo\u015Fluk tu\u015Fuyla s\xFCz\xFCl, y\xFCksek gerilim direklerinden ka\xE7.",
    mechanicEn: "Dodge obstacles and plasma arcs in endless flight.",
    controls: "Bo\u015Fluk / Dokun",
    controlsEn: "Space / Tap",
    playTime: "Sonsuz u\xE7u\u015F",
    poster: "https://sely.tr/storage/kivilcim-poster-v2_5ac4584b.png",
    accent: "#E9563F",
    ink: "#293B75",
    icon: "\u26A1"
  }
};
function escapeXml(unsafe) {
  return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function getPerformanceNotice(score, isEn) {
  if (typeof score !== "number" || score <= 0) {
    return isEn ? "\xB7 SELY Daily Challenge \xB7 Can you beat it?" : "\xB7 SELY G\xFCn\xFCn Seviyesi \xB7 Bu skoru ge\xE7ebilir misin?";
  }
  if (score >= 2e3) {
    return isEn ? "\u2605 Master Score: Flawless run, beat this if you can!" : "\u2605 Zirve Skoru: Kusursuz tur, ge\xE7ebilen \xE7\u0131ks\u0131n!";
  }
  if (score >= 1e3) {
    return isEn ? "\u25B2 Sharp Run: High precision finish, pure skill!" : "\u25B2 Usta Turu: Kusursuz reflekslerle hedefi a\u015Ft\u0131!";
  }
  if (score >= 400) {
    return isEn ? "\u25C6 Great Run: Cleared today's level clean!" : "\u25C6 Ba\u015Far\u0131l\u0131 Tur: G\xFCn\xFCn seviyesini tek nefeste bitirdi!";
  }
  return isEn ? "\u25CF Solid Finish: Level cleared, your turn now!" : "\u25CF Temiz Biti\u015F: G\xFCn\xFCn turunu tamamlad\u0131, s\u0131ra sende!";
}
function generateOgSvg(params) {
  const isEn = params.locale === "en";
  const gameKey = (params.game || "hub").toLowerCase();
  const theme = GAME_CATALOG_META[gameKey] || {
    num: "00",
    title: "SELY RETRO",
    titleEn: "SELY RETRO",
    eyebrow: "OYUN KATALO\u011EU",
    eyebrowEn: "GAME CATALOGUE",
    motto: "K\xFC\xE7\xFCk kural, b\xFCy\xFCk yank\u0131.",
    mottoEn: "Minimal rules, lasting echoes.",
    mechanic: "\xD6zg\xFCn kurallarla minimalist retro web oyunlar\u0131.",
    mechanicEn: "Minimalist retro web games with original rules.",
    controls: "Taray\u0131c\u0131da hemen oyna",
    controlsEn: "Play instantly in browser",
    playTime: "1\u20135 dk",
    poster: "https://sely.tr/storage/sely-social-card-title_b4649a50.png",
    accent: "#E9563F",
    ink: "#1B1A1B",
    icon: "\u2756"
  };
  const hasScore = typeof params.score === "number";
  const gameTitle = isEn ? theme.titleEn : theme.title;
  const gameEyebrow = isEn ? theme.eyebrowEn : theme.eyebrow;
  const gameMotto = escapeXml(isEn ? theme.mottoEn : theme.motto);
  const gameMechanic = escapeXml(isEn ? theme.mechanicEn : theme.mechanic);
  const nick = escapeXml(params.nick ? params.nick.toUpperCase() : isEn ? "PLAYER" : "OYUNCU");
  const scoreText = hasScore ? params.score.toLocaleString(isEn ? "en-US" : "tr-TR") : "";
  const dateStr = escapeXml(params.date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10));
  const performanceNotice = escapeXml(getPerformanceNotice(params.score, isEn));
  const posterDataUri = GAME_POSTERS_DATA_URI[gameKey] || theme.poster;
  if (gameKey === "vaka") {
    const isSolved = params.outcome === "solved" || params.outcome === "success";
    const grade = params.grade || (isSolved ? "S" : "C");
    const stampColor = isSolved ? "#15803d" : "#b91c1c";
    const stampBg = isSolved ? "#dcfce7" : "#fee2e2";
    const stampBorder = isSolved ? "#16a34a" : "#dc2626";
    const stampText = isSolved ? isEn ? "CASE SOLVED" : "VAKA \xC7\xD6Z\xDCLD\xDC" : isEn ? "CASE DISMISSED" : "DAVA D\xDC\u015ET\xDC";
    const stampSub = isSolved ? isEn ? "PERPETRATOR CONVICTED" : "SU\xC7LU \u0130T\u0130RAF ETT\u0130" : isEn ? "INSUFFICIENT EVIDENCE" : "DEL\u0130L YETERS\u0130ZL\u0130\u011E\u0130";
    const caseName = escapeXml(params.caseTitle || (isEn ? "Confidential Bureau Dossier" : "Gizli B\xFCro Dosyas\u0131"));
    const suspectText = params.suspect ? escapeXml(params.suspect) : isEn ? "Key Suspect" : "As\u0131l \u015E\xFCpheli";
    if (!hasScore) {
      return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="vakaDots" width="16" height="16" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" fill="#1B1A1B" fill-opacity="0.09" />
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="#F4EBD9" />
  <rect width="1200" height="630" fill="url(#vakaDots)" />

  <rect x="24" y="24" width="1152" height="582" fill="none" stroke="#1B1A1B" stroke-width="3" />
  <rect x="32" y="32" width="1136" height="566" fill="none" stroke="#1B1A1B" stroke-width="1" stroke-dasharray="8 4" opacity="0.4" />

  <g transform="translate(72, 60)">
    <rect width="5" height="500" fill="#B91C1C" />
    <text transform="rotate(-90)" x="-470" y="-12" font-family="Courier New, monospace" font-size="10.5" font-weight="700" fill="#1B1A1B" letter-spacing="2">SELY POL\u0130S SORGU B\xDCROSU \xB7 G\u0130ZL\u0130 VAKA DEDEKT\u0130F DOSYASI</text>
  </g>

  <g transform="translate(110, 75)">
    <rect x="0" y="0" width="180" height="32" fill="#1B1A1B" />
    <text x="90" y="21" text-anchor="middle" font-family="Courier New, monospace" font-size="13" font-weight="700" fill="#F4EBD9" letter-spacing="2">G\xDCN\xDCN DOSYASI #05</text>
    <text x="200" y="22" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="800" fill="#B91C1C" letter-spacing="3">SELY.TR \xB7 ADL\u0130 SORU\u015ETURMA</text>
    <text x="0" y="80" font-family="Courier New, monospace" font-size="40" font-weight="800" fill="#1B1A1B" letter-spacing="-0.5">C\u0130NAYET DOSYASI: ${caseName}</text>
  </g>

  <g transform="translate(110, 195)">
    <rect x="10" y="10" width="400" height="300" fill="#1B1A1B" />
    <rect width="400" height="300" fill="#FFFCF5" stroke="#1B1A1B" stroke-width="2.5" />
    <image href="${posterDataUri}" x="0" y="0" width="400" height="300" preserveAspectRatio="xMidYMid slice" />
    <rect width="400" height="8" fill="#E5B341" />
  </g>

  <g transform="translate(550, 195)">
    <rect x="10" y="10" width="570" height="300" fill="#1B1A1B" />
    <rect width="570" height="300" fill="#FFFCF5" stroke="#1B1A1B" stroke-width="2.5" />
    <rect width="570" height="8" fill="#B91C1C" />

    <text x="40" y="52" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" fill="#B91C1C" letter-spacing="2">G\xDCNL\xDCK ADL\u0130 SORU\u015ETURMA EMR\u0130</text>
    <text x="40" y="98" font-family="Courier New, monospace" font-size="30" font-weight="800" fill="#1B1A1B">3 \u015E\xDCPHEL\u0130 \xB7 1 GER\xC7EK KAT\u0130L</text>
    <text x="40" y="136" font-family="system-ui, sans-serif" font-size="17" line-height="1.4" fill="#334155">${gameMechanic}</text>
    <text x="40" y="180" font-family="system-ui, sans-serif" font-size="15" font-style="italic" font-weight="600" fill="#64748B">\u201C${gameMotto}\u201D</text>

    <g transform="translate(40, 218)">
      <rect width="360" height="46" fill="#F4EBD9" stroke="#1B1A1B" stroke-width="1.5" />
      <rect x="0" y="0" width="10" height="46" fill="#B91C1C" />
      <text x="24" y="20" font-family="Courier New, monospace" font-size="11" font-weight="700" fill="#B91C1C" letter-spacing="1">G\xDCN\xDCN DEDEKT\u0130FL\u0130K VAKASI</text>
      <text x="24" y="37" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" fill="#1B1A1B">\u015E\xFCphelileri sorgula, katili yakala!</text>
    </g>
  </g>

  <g transform="translate(110, 555)">
    <text font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="800" fill="#1B1A1B">sely.tr/play/vaka</text>
    <text x="180" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#475569">\xB7 G\xFCnl\xFCk dedektiflik vakas\u0131 \xB7 Tarih: ${dateStr}</text>
  </g>
  <g transform="translate(920, 555)">
    <text font-family="Courier New, monospace" font-size="12" font-weight="700" fill="#B91C1C">RESM\u0130 MAHKEME D\xD6K\xDCM\xDC \u2696</text>
  </g>
</svg>`;
    }
    const vakaPerformance = isSolved ? isEn ? "\u2605 Judicial Verdict: Conclusive deduction confirmed by court" : "\u2605 Mahkeme H\xFCkm\xFC: Somut mant\u0131k ve kan\u0131tla dava kapat\u0131ld\u0131" : isEn ? "\u2715 Bureau Notice: Charges dismissed due to lack of proof" : "\u2715 B\xFCro Notu: Yetersiz delil sebebiyle soru\u015Fturma kapand\u0131";
    return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="vakaDots" width="16" height="16" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" fill="#1B1A1B" fill-opacity="0.09" />
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="#F4EBD9" />
  <rect width="1200" height="630" fill="url(#vakaDots)" />

  <rect x="24" y="24" width="1152" height="582" fill="none" stroke="#1B1A1B" stroke-width="3" />
  <rect x="32" y="32" width="1136" height="566" fill="none" stroke="#1B1A1B" stroke-width="1" stroke-dasharray="8 4" opacity="0.4" />

  <g transform="translate(72, 60)">
    <rect width="5" height="500" fill="#B91C1C" />
    <text transform="rotate(-90)" x="-470" y="-12" font-family="Courier New, monospace" font-size="10.5" font-weight="700" fill="#1B1A1B" letter-spacing="2">SELY POL\u0130S SORGU B\xDCROSU \xB7 G\u0130ZL\u0130 VAKA DEDEKT\u0130F DOSYASI</text>
  </g>

  <g transform="translate(110, 75)">
    <rect x="0" y="0" width="160" height="32" fill="#1B1A1B" />
    <text x="80" y="21" text-anchor="middle" font-family="Courier New, monospace" font-size="13" font-weight="700" fill="#F4EBD9" letter-spacing="2">DOSYA NO: #05</text>
    <text x="180" y="22" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="800" fill="#B91C1C" letter-spacing="3">SELY.TR \xB7 ADL\u0130 SORU\u015ETURMA</text>
    <text x="0" y="80" font-family="Courier New, monospace" font-size="40" font-weight="800" fill="#1B1A1B" letter-spacing="-0.5">C\u0130NAYET DOSYASI: ${caseName}</text>
  </g>

  <g transform="translate(110, 195)">
    <rect x="10" y="10" width="580" height="300" fill="#1B1A1B" />
    <rect width="580" height="300" fill="#FFFCF5" stroke="#1B1A1B" stroke-width="2.5" />
    <rect width="580" height="8" fill="#E5B341" />

    <rect x="30" y="-12" width="24" height="40" rx="6" fill="none" stroke="#1B1A1B" stroke-width="3" />

    <text x="40" y="52" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#64748B" letter-spacing="2">RESM\u0130 MAHKEME KARARI</text>
    <text x="40" y="110" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="900" fill="#1B1A1B" letter-spacing="-0.5">${suspectText}</text>
    <text x="40" y="142" font-family="Courier New, monospace" font-size="14" fill="#475569">Sorgu tamamland\u0131 \xB7 Delil \xE7eli\u015Fkisi kayda ge\xE7ti</text>

    <g transform="translate(140, 200) rotate(-6)">
      <rect x="-10" y="-10" width="340" height="75" rx="8" fill="${stampBg}" stroke="${stampBorder}" stroke-width="3.5" stroke-dasharray="6 2" />
      <text x="160" y="30" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="900" fill="${stampColor}" letter-spacing="3">${stampText}</text>
      <text x="160" y="52" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="${stampColor}" letter-spacing="2">${stampSub}</text>
    </g>
  </g>

  <g transform="translate(730, 195)">
    <rect x="10" y="10" width="390" height="300" fill="#1B1A1B" />
    <rect width="390" height="300" fill="#FFFCF5" stroke="#1B1A1B" stroke-width="2.5" />
    <rect width="390" height="8" fill="#B91C1C" />

    <text x="35" y="46" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#64748B" letter-spacing="2">BA\u015E DEDEKT\u0130F</text>
    <text x="35" y="85" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="800" fill="#1B1A1B">${nick}</text>
    <line x1="35" y1="108" x2="355" y2="108" stroke="#1B1A1B" stroke-width="1.5" stroke-dasharray="4 2" />

    <g transform="translate(35, 135)">
      <rect width="130" height="120" fill="#F4EBD9" stroke="#1B1A1B" stroke-width="2" />
      <text x="65" y="32" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#1B1A1B" letter-spacing="1">DERECE</text>
      <text x="65" y="95" text-anchor="middle" font-family="system-ui, sans-serif" font-size="64" font-weight="900" fill="${stampColor}">&gt;${grade}&lt;</text>
    </g>

    <g transform="translate(185, 135)">
      <rect width="170" height="120" fill="#1B1A1B" />
      <text x="85" y="36" text-anchor="middle" font-family="Courier New, monospace" font-size="11" font-weight="700" fill="#E5B341" letter-spacing="2">B\xDCRO PUANI</text>
      <text x="85" y="85" text-anchor="middle" font-family="system-ui, sans-serif" font-size="44" font-weight="900" fill="#FFFFFF">${scoreText || "0"}</text>
      <text x="85" y="106" text-anchor="middle" font-family="Courier New, monospace" font-size="10" fill="#94A3B8">PUAN TESC\u0130L\u0130</text>
    </g>
  </g>

  <g transform="translate(110, 555)">
    <text font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="800" fill="#1B1A1B">sely.tr/play/vaka</text>
    <text x="180" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#475569">${vakaPerformance}</text>
  </g>
  <g transform="translate(920, 555)">
    <text font-family="Courier New, monospace" font-size="12" font-weight="700" fill="#B91C1C">RESM\u0130 MAHKEME D\xD6K\xDCM\xDC \u2696</text>
  </g>
</svg>`;
  }
  const accent = theme.accent;
  const ink = theme.ink;
  const nickFontSize = nick.length > 20 ? "19" : nick.length > 15 ? "21" : "23";
  if (!hasScore) {
    return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="dotGrid" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.1" fill="#1B1A1B" fill-opacity="0.13" />
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="#F6F0E3" />
  <rect width="1200" height="630" fill="url(#dotGrid)" />

  <rect x="28" y="28" width="1144" height="574" fill="none" stroke="#1B1A1B" stroke-width="2.5" />

  <g transform="translate(70, 75)">
    <text font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="900" fill="#1B1A1B" letter-spacing="-1">SELY<tspan fill="#E9563F">\u271B</tspan></text>
    <text x="115" y="-3" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" fill="#1B1A1B" letter-spacing="2">\xB7 G\xDCNL\xDCK SEFER KATALO\u011EU</text>
    
    <g transform="translate(860, -18)">
      <rect width="190" height="34" fill="#1B1A1B" />
      <text x="95" y="22" text-anchor="middle" font-family="Courier New, monospace" font-size="13" font-weight="700" fill="#F6F0E3" letter-spacing="2">\u2116 ${theme.num} \xB7 ${dateStr}</text>
    </g>
  </g>

  <line x1="70" y1="108" x2="1120" y2="108" stroke="#1B1A1B" stroke-width="1.5" />

  <g transform="translate(70, 145)">
    <rect x="12" y="12" width="410" height="375" fill="#1B1A1B" />
    <rect width="410" height="375" fill="#1E2033" stroke="#1B1A1B" stroke-width="2.5" />
    <image href="${posterDataUri}" x="0" y="0" width="410" height="375" preserveAspectRatio="xMidYMid slice" />
    <rect width="410" height="8" fill="${accent}" />

    <g transform="translate(18, 305)">
      <text font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="900" fill="#F6F0E3" opacity="0.95" letter-spacing="-2">${theme.num}</text>
    </g>
  </g>

  <g transform="translate(520, 145)">
    <rect x="12" y="12" width="600" height="375" fill="#1B1A1B" />
    <rect width="600" height="375" fill="#FFFAF0" stroke="#1B1A1B" stroke-width="2.5" />
    <rect width="600" height="8" fill="${accent}" />

    <g transform="translate(45, 45)">
      <text font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" fill="${accent}" letter-spacing="3">${gameEyebrow}</text>
      <text y="54" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="900" fill="#1B1A1B" letter-spacing="-1.5">${gameTitle}</text>
      
      <g transform="translate(0, 85)">
        <rect width="500" height="42" fill="#F6F0E3" stroke="#1B1A1B" stroke-width="1.5" stroke-dasharray="4 2" />
        <text x="18" y="26" font-family="system-ui, sans-serif" font-size="16" font-style="italic" font-weight="600" fill="#1B1A1B">\u201C${gameMotto}\u201D</text>
      </g>

      <text y="170" font-family="system-ui, sans-serif" font-size="15" line-height="1.4" font-weight="500" fill="#334155">${gameMechanic}</text>

      <g transform="translate(0, 205)">
        <text font-family="Courier New, monospace" font-size="12" font-weight="700" fill="#64748B">S\xDCRE: ${theme.playTime} \xB7 KONTROL: ${theme.controls}</text>
      </g>

      <g transform="translate(0, 240)">
        <rect width="360" height="46" fill="#F6F0E3" stroke="#1B1A1B" stroke-width="1.5" />
        <rect x="0" y="0" width="10" height="46" fill="${accent}" />
        <text x="24" y="20" font-family="Courier New, monospace" font-size="11" font-weight="700" fill="${accent}" letter-spacing="1">G\xDCN\xDCN MEYDAN OKUMASI</text>
        <text x="24" y="37" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" fill="#1B1A1B">Turu tamamla, arkada\u015Flar\u0131na meydan oku!</text>
      </g>
    </g>
  </g>

  <g transform="translate(70, 565)">
    <text font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="800" fill="#1B1A1B">sely.tr/play/${gameKey}</text>
    <text x="200" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#475569">\xB7 G\xFCnl\xFCk mini oyun serisi \xB7 Her g\xFCn yeni seviye \xB7 Sen de dene!</text>
  </g>

  <g transform="translate(860, 565)">
    <text font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" fill="#1B1A1B" letter-spacing="1">K\xDC\xC7\xDCK KURAL, B\xDCY\xDCK YANKI \u271B</text>
  </g>
</svg>`;
  }
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="dotGrid" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.1" fill="#1B1A1B" fill-opacity="0.13" />
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="#F6F0E3" />
  <rect width="1200" height="630" fill="url(#dotGrid)" />

  <rect x="28" y="28" width="1144" height="574" fill="none" stroke="#1B1A1B" stroke-width="2.5" />

  <g transform="translate(70, 75)">
    <text font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="900" fill="#1B1A1B" letter-spacing="-1">SELY<tspan fill="#E9563F">\u271B</tspan></text>
    <text x="115" y="-3" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" fill="#1B1A1B" letter-spacing="2">\xB7 G\xDCNL\xDCK SEFER D\xD6K\xDCM\xDC</text>
    
    <g transform="translate(860, -18)">
      <rect width="190" height="34" fill="#1B1A1B" />
      <text x="95" y="22" text-anchor="middle" font-family="Courier New, monospace" font-size="13" font-weight="700" fill="#F6F0E3" letter-spacing="2">\u2116 ${theme.num} \xB7 ${dateStr}</text>
    </g>
  </g>

  <line x1="70" y1="108" x2="1120" y2="108" stroke="#1B1A1B" stroke-width="1.5" />

  <g transform="translate(70, 145)">
    <rect x="12" y="12" width="280" height="375" fill="#1B1A1B" />
    <rect width="280" height="375" fill="#1E2033" stroke="#1B1A1B" stroke-width="2.5" />
    <image href="${posterDataUri}" x="0" y="0" width="280" height="375" preserveAspectRatio="xMidYMid slice" />
    <rect width="280" height="8" fill="${accent}" />

    <g transform="translate(18, 320)">
      <rect width="64" height="36" fill="#1B1A1B" />
      <text x="32" y="25" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" font-weight="900" fill="#F6F0E3">\u2116 ${theme.num}</text>
    </g>
  </g>

  <g transform="translate(380, 145)">
    <rect x="12" y="12" width="740" height="375" fill="#1B1A1B" />
    <rect width="740" height="375" fill="#FFFAF0" stroke="#1B1A1B" stroke-width="2.5" />
    <rect width="740" height="10" fill="${accent}" />

    <g transform="translate(45, 38)">
      <text font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" fill="${accent}" letter-spacing="3">${gameEyebrow}</text>
      <text y="50" font-family="system-ui, -apple-system, sans-serif" font-size="42" font-weight="900" fill="#1B1A1B" letter-spacing="-1.5">${gameTitle}</text>
      
      <g transform="translate(0, 75)">
        <rect width="650" height="38" fill="#F6F0E3" stroke="#1B1A1B" stroke-width="1.5" stroke-dasharray="4 2" />
        <text x="18" y="24" font-family="system-ui, sans-serif" font-size="15" font-style="italic" font-weight="600" fill="#1B1A1B">\u201C${gameMotto}\u201D</text>
      </g>

      <g transform="translate(0, 135)">
        <text font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" fill="#64748B" letter-spacing="2">KAYDED\u0130LEN SKOR</text>
        
        <g transform="translate(0, 16)">
          <rect width="310" height="100" fill="#F6F0E3" stroke="#1B1A1B" stroke-width="2" />
          <text x="24" y="72" font-family="system-ui, -apple-system, sans-serif" font-size="62" font-weight="900" fill="#1B1A1B" letter-spacing="-1">${scoreText || "0"}</text>
          <text x="290" y="68" text-anchor="end" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="800" fill="${accent}">PUAN</text>
        </g>
      </g>

      <g transform="translate(340, 135)">
        <g transform="translate(0, 16)">
          <rect width="310" height="100" fill="#1B1A1B" />
          <text x="18" y="30" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="700" fill="#94A3B8" letter-spacing="1.5">G\xDCN\xDCN OYUNCUSU</text>
          
          <g transform="translate(195, 10)">
            <rect width="100" height="22" rx="4" fill="${accent}" />
            <text x="50" y="15" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="800" fill="#FFFFFF" letter-spacing="1">G\xDCN\xDCN TURU \u2713</text>
          </g>
          
          <text x="18" y="74" font-family="system-ui, -apple-system, sans-serif" font-size="${nickFontSize}" font-weight="800" fill="#F6F0E3" letter-spacing="0.5">${nick}</text>
        </g>
      </g>

      <g transform="translate(0, 275)">
        <rect width="650" height="38" fill="${accent}" stroke="#1B1A1B" stroke-width="1.5" />
        <text x="325" y="24" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="900" fill="#FFFFFF" letter-spacing="1.5">TUR TAMAMLANDI \xB7 SEN DE SKORUNU DENE \u2192</text>
      </g>
    </g>
  </g>

  <g transform="translate(70, 565)">
    <text font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="800" fill="#1B1A1B">sely.tr/play/${gameKey}</text>
    <text x="200" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#475569">${performanceNotice}</text>
  </g>

  <g transform="translate(860, 565)">
    <text font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" fill="#1B1A1B" letter-spacing="1">K\xDC\xC7\xDCK KURAL, B\xDCY\xDCK YANKI \u271B</text>
  </g>
</svg>`;
}

// server/og/ogRoute.ts
function parseOgParams(query) {
  const game = typeof query.game === "string" ? query.game.toLowerCase().slice(0, 20) : "hub";
  const rawScore = query.score ? parseInt(String(query.score), 10) : void 0;
  const score = typeof rawScore === "number" && !isNaN(rawScore) && rawScore >= 0 && rawScore <= 1e7 ? rawScore : void 0;
  const nick = typeof query.nick === "string" ? query.nick.slice(0, 32).replace(/[^\w\s\-#çğıöşüÇĞİÖŞÜ]/g, "") : void 0;
  const rank = typeof query.rank === "string" ? query.rank.slice(0, 8) : void 0;
  const outcome = query.outcome === "solved" || query.outcome === "dismissed" || query.outcome === "success" || query.outcome === "failure" ? query.outcome : void 0;
  const grade = query.grade === "S" || query.grade === "A" || query.grade === "B" || query.grade === "C" ? query.grade : void 0;
  const caseTitle = typeof query.caseTitle === "string" ? query.caseTitle.slice(0, 60) : void 0;
  const suspect = typeof query.suspect === "string" ? query.suspect.slice(0, 40) : void 0;
  const locale = query.locale === "en" ? "en" : "tr";
  const date = typeof query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : void 0;
  return {
    game,
    score,
    nick,
    rank,
    outcome,
    grade,
    caseTitle,
    suspect,
    locale,
    date
  };
}
function handleOgImageRequest(req, res) {
  try {
    const params = parseOgParams(req.query);
    const svg = generateOgSvg(params);
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
    );
    res.status(200).send(svg.trim());
  } catch (err) {
    logger.error("og", "Failed to generate OG image", err);
    res.redirect(302, "/storage/sely-social-card-title_b4649a50.png");
  }
}

// server/og/shareRoute.ts
var CRAWLER_USER_AGENTS = [
  "twitterbot",
  "facebookexternalhit",
  "facebot",
  "discordbot",
  "telegrambot",
  "whatsapp",
  "slackbot",
  "linkedinbot",
  "pinterest",
  "skypeuripreview",
  "applebot",
  "bingpreview"
];
function isSocialCrawler(userAgent) {
  const ua = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some((bot) => ua.includes(bot));
}
function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
var GAME_NAMES = {
  echo: { tr: "Yank\u0131", en: "Echo", eyebrow: "LAB\u0130RENT / SES" },
  knot: { tr: "D\xFC\u011F\xFCm", en: "Knot", eyebrow: "AKI\u015E / BULMACA" },
  cut: { tr: "Kesit", en: "Cutout", eyebrow: "GEOMETR\u0130 / KES\u0130M" },
  shadow: { tr: "G\xF6lge", en: "Shadow", eyebrow: "I\u015EIK / S\u0130L\xDCET" },
  hane: { tr: "Hane", en: "Hane", eyebrow: "KEL\u0130ME / SAYI" },
  spark: { tr: "K\u0131v\u0131lc\u0131m", en: "Spark", eyebrow: "REFLEKS / GER\u0130L\u0130M" },
  vaka: { tr: "Vaka", en: "Vaka Mystery", eyebrow: "G\u0130ZEM / DEDEKT\u0130F" }
};
function handleShareBridgeRequest(req, res) {
  const gameKey = (req.params.game || "").toLowerCase();
  const validGame = GAME_NAMES[gameKey] ? gameKey : "echo";
  const userAgent = req.headers["user-agent"] || "";
  const isCrawler = isSocialCrawler(userAgent);
  const locale = req.query.locale === "en" ? "en" : "tr";
  const isEn = locale === "en";
  const targetPlayPath = isEn ? `/en/play/${validGame}` : `/play/${validGame}`;
  const meta = GAME_NAMES[validGame];
  const gameName = isEn ? meta.en : meta.tr;
  const rawScore = req.query.score ? String(req.query.score).replace(/[^\d]/g, "") : "";
  const nick = req.query.nick ? String(req.query.nick).slice(0, 32) : "";
  const outcome = req.query.outcome === "solved" || req.query.outcome === "success" ? "solved" : req.query.outcome === "failure" ? "failed" : "";
  const grade = req.query.grade ? String(req.query.grade).slice(0, 2) : "";
  let title = `SELY \xB7 ${gameName}`;
  let desc = isEn ? `Play ${gameName} on SELY \u2014 minimal rules, lasting echoes.` : `SELY \xFCzerinde ${gameName} oyna \u2014 K\xFC\xE7\xFCk kural, b\xFCy\xFCk yank\u0131.`;
  if (validGame === "vaka") {
    if (outcome === "solved") {
      title = isEn ? `SELY Vaka \xB7 CASE SOLVED (Grade ${grade || "S"})` : `SELY Vaka \xB7 C\u0130NAYET DOSYASI \xC7\xD6Z\xDCLD\xDC (Derece ${grade || "S"})`;
      desc = isEn ? `Detective ${nick || "Player"} uncovered the truth and closed the case with ${rawScore || "high"} points!` : `Dedektif ${nick || "Oyuncu"} gizemi ayd\u0131nlatt\u0131 ve dosyay\u0131 ${rawScore || "y\xFCksek"} puanla kapatt\u0131!`;
    } else {
      title = isEn ? `SELY Vaka \xB7 Murder Mystery Case` : `SELY Vaka \xB7 G\xFCn\xFCn Dedektiflik Dosyas\u0131`;
      desc = isEn ? `Can you solve today's case? Interrogate suspects and uncover the truth.` : `G\xFCn\xFCn cinayet dosyas\u0131n\u0131 \xE7\xF6zebilir misin? \u015E\xFCphelileri sorgula ve katili bul.`;
    }
  } else if (rawScore) {
    const formattedScore = parseInt(rawScore, 10).toLocaleString(isEn ? "en-US" : "tr-TR");
    title = isEn ? `${nick ? nick + " scored " : ""}${formattedScore} pts on ${gameName} \xB7 SELY` : `${nick ? nick + " \xB7 " : ""}${gameName} turunu ${formattedScore} puanla bitirdi!`;
    desc = isEn ? `Can you beat this score in today's daily run? Challenge now on sely.tr.` : `G\xFCn\xFCn seviyesinde bu skoru ge\xE7ebilir misin? Hemen sely.tr \xFCzerinde meydan oku.`;
  }
  const ogSearchParams = new URLSearchParams(req.query);
  ogSearchParams.set("game", validGame);
  const host = req.headers.host || "sely.tr";
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const ogImageUrl = `${protocol}://${host}/api/og?${ogSearchParams.toString()}`;
  const canonicalUrl = `${protocol}://${host}${targetPlayPath}`;
  const sharePageUrl = `${protocol}://${host}${req.originalUrl || req.url}`;
  const html = `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(desc)}" />
  
  <!-- Open Graph & Social Cards -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(sharePageUrl)}" />
  <meta property="og:site_name" content="SELY MiniGame Hub" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(desc)}" />
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeHtml(title)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@sely_tr" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(desc)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />

  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <style>
    :root {
      --paper: #F6F0E3;
      --ink: #1B1A1B;
      --coral: #E9563F;
      --mustard: #E5B341;
      --card-bg: #FFFAF0;
      --font-mono: "DM Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--paper);
      color: var(--ink);
      font-family: var(--font-sans);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 24px 16px 36px;
      background-image: radial-gradient(var(--ink) 1px, transparent 1px);
      background-size: 16px 16px;
    }
    .top-nav {
      width: 100%;
      max-width: 960px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid var(--ink);
      padding-bottom: 14px;
      margin-bottom: 24px;
    }
    .brand {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -1px;
      text-decoration: none;
      color: var(--ink);
    }
    .brand span { color: var(--coral); }
    .nav-tag {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      background: var(--ink);
      color: var(--paper);
      padding: 4px 10px;
    }
    .showcase-container {
      width: 100%;
      max-width: 960px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }
    .card-wrap {
      width: 100%;
      position: relative;
      background: var(--ink);
      border: 3px solid var(--ink);
      box-shadow: 10px 10px 0 var(--ink);
      aspect-ratio: 1200 / 630;
      overflow: hidden;
      border-radius: 2px;
    }
    .card-img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }
    .actions-grid {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px 18px;
      font-family: var(--font-mono);
      font-size: 12.5px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-decoration: none;
      cursor: pointer;
      border: 2px solid var(--ink);
      box-shadow: 4px 4px 0 var(--ink);
      transition: transform 70ms ease, box-shadow 70ms ease, background-color 70ms ease;
      background: var(--paper);
      color: var(--ink);
      user-select: none;
    }
    .btn:hover { background: #fffdf8; }
    .btn:active {
      transform: translate(2px, 2px);
      box-shadow: 2px 2px 0 var(--ink);
    }
    .btn-play {
      background: var(--coral);
      color: #FFFFFF;
    }
    .btn-play:hover { background: #d9452f; color: #FFFFFF; }
    .btn-copy { background: var(--mustard); }
    .status-toast {
      position: fixed;
      bottom: 24px;
      background: var(--ink);
      color: var(--paper);
      font-family: var(--font-mono);
      font-size: 12px;
      padding: 10px 18px;
      box-shadow: 4px 4px 0 var(--coral);
      opacity: 0;
      pointer-events: none;
      transform: translateY(12px);
      transition: opacity 200ms ease, transform 200ms ease;
      z-index: 100;
    }
    .status-toast.visible {
      opacity: 1;
      transform: translateY(0);
    }
    footer {
      font-family: var(--font-mono);
      font-size: 11px;
      color: rgba(27, 26, 27, 0.7);
      margin-top: 28px;
      text-align: center;
    }
    @media (max-width: 640px) {
      body { padding: 16px 12px 24px; }
      .card-wrap { box-shadow: 6px 6px 0 var(--ink); }
      .btn { padding: 12px 14px; font-size: 11.5px; }
    }
  </style>
</head>
<body>
  <nav class="top-nav">
    <a href="/" class="brand">SELY<span>\u271B</span></a>
    <span class="nav-tag">${isEn ? "DAILY SHOWCASE" : "G\xDCN\xDCN KARTI"}</span>
  </nav>

  <main class="showcase-container">
    <div class="card-wrap">
      <img id="ogImg" src="${escapeHtml(ogImageUrl)}" alt="${escapeHtml(title)}" class="card-img" crossorigin="anonymous" />
    </div>

    <div class="actions-grid">
      <button type="button" class="btn btn-copy" id="btnCopyImg">
        <span>\u{1F4CB}</span> <b>${isEn ? "Copy Image (PNG)" : "G\xF6rseli Kopyala"}</b>
      </button>
      <button type="button" class="btn" id="btnDownloadImg">
        <span>\u{1F4BE}</span> <span>${isEn ? "Download Image" : "G\xF6rseli \u0130ndir"}</span>
      </button>
      <button type="button" class="btn" id="btnCopyLink">
        <span>\u{1F517}</span> <span>${isEn ? "Copy Link" : "Linki Kopyala"}</span>
      </button>
      <a href="${escapeHtml(targetPlayPath)}" class="btn btn-play">
        <span>\u26A1</span> <b>${isEn ? "Play Now \u2192" : "Hemen Sen de Oyna \u2192"}</b>
      </a>
    </div>
  </main>

  <div id="toast" class="status-toast" role="status" aria-live="polite"></div>

  <footer>
    <p>sely.tr \xB7 K\xFC\xE7\xFCk kural, b\xFCy\xFCk yank\u0131. \xB7 Reklams\u0131z, kay\u0131t gerektirmeyen web oyunlar\u0131</p>
  </footer>

  <script>
    const toast = document.getElementById('toast');
    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add('visible');
      setTimeout(() => toast.classList.remove('visible'), 2600);
    }

    // 1. Resim Panoya Kopyalama (Clipboard API & Canvas Rasterization)
    document.getElementById('btnCopyImg').addEventListener('click', async () => {
      const img = document.getElementById('ogImg');
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 630;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 1200, 630);
        
        canvas.toBlob(async (blob) => {
          if (!blob) throw new Error("Rasterization failed");
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            showToast('${isEn ? "\u2713 Image copied to clipboard! Ready to paste." : "\u2713 G\xF6rsel panoya kopyaland\u0131! (Ctrl+V ile yap\u0131\u015Ft\u0131r)"}');
          } catch (e) {
            // Fallback link copy if browser blocks image clipboard
            await navigator.clipboard.writeText(window.location.href);
            showToast('${isEn ? "Link copied to clipboard" : "Ba\u011Flant\u0131 panoya kopyaland\u0131"}');
          }
        }, 'image/png');
      } catch (err) {
        navigator.clipboard.writeText(window.location.href);
        showToast('${isEn ? "Link copied to clipboard" : "Ba\u011Flant\u0131 panoya kopyaland\u0131"}');
      }
    });

    // 2. PNG Olarak \u0130ndirme
    document.getElementById('btnDownloadImg').addEventListener('click', () => {
      const img = document.getElementById('ogImg');
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 630;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 1200, 630);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sely-${validGame}-card.png';
        a.click();
        URL.revokeObjectURL(url);
        showToast('${isEn ? "\u2713 Image download started" : "\u2713 G\xF6rsel indiriliyor"}');
      }, 'image/png');
    });

    // 3. Ba\u011Flant\u0131y\u0131 Kopyalama
    document.getElementById('btnCopyLink').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        showToast('${isEn ? "\u2713 Link copied to clipboard" : "\u2713 Ba\u011Flant\u0131 kopyaland\u0131"}');
      } catch (e) {
        showToast('${isEn ? "Failed to copy" : "Kopyalanamad\u0131"}');
      }
    });
  </script>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
  );
  res.status(200).send(html);
}

// server/app.ts
var PUBLIC_CACHEABLE_TRPC_PROCEDURES = /* @__PURE__ */ new Set([
  "daily.today",
  "vaka.config",
  "vaka.getCases",
  "vaka.getDailyCase",
  "system.health"
]);
function createApp() {
  const app2 = express();
  app2.disable("x-powered-by");
  app2.use(securityHeaders);
  app2.use(express.json({ limit: "128kb" }));
  app2.use(express.urlencoded({ limit: "32kb", extended: false }));
  registerSeoAndVerificationRoutes(app2);
  registerStorageProxy(app2);
  registerOAuthRoutes(app2);
  const leaderboardLimiter = createRateLimiter({ max: 20, windowMs: 6e4 });
  app2.get("/api/leaderboard", getLeaderboardHandler);
  app2.post("/api/leaderboard", leaderboardLimiter, submitLeaderboardHandler);
  app2.get("/api/config", getGlobalConfigHandler);
  app2.get("/api/og", handleOgImageRequest);
  app2.get("/share/:game", handleShareBridgeRequest);
  app2.get("/en/share/:game", (req, res) => {
    req.query.locale = "en";
    handleShareBridgeRequest(req, res);
  });
  const scheduledLimiter = createRateLimiter({ max: 8, windowMs: 6e4 });
  const publicApiLimiter = createRateLimiter({ max: 90, windowMs: 6e4 });
  app2.all("/api/scheduled/daily-content", scheduledLimiter, dailyContentHandler);
  app2.all("/api/scheduled/daily-cleanup", scheduledLimiter, dailyCleanupHandler);
  app2.use("/api/trpc", (req, res, next) => {
    if (req.method === "GET") {
      const procedures = req.path.replace(/^\//, "").split(",");
      const allCacheable = procedures.length > 0 && procedures.every((p) => PUBLIC_CACHEABLE_TRPC_PROCEDURES.has(p));
      res.setHeader(
        "Cache-Control",
        allCacheable ? "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400" : "private, no-store"
      );
    }
    next();
  });
  app2.use(
    "/api/trpc",
    publicApiLimiter,
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError: ({ path: path3, error }) => {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          logger.error("trpc", `Procedure '${path3}' failed`, error);
        }
      }
    })
  );
  return app2;
}
var app = createApp();
var app_default = app;

// server/serverless.ts
var serverless_default = app_default;
export {
  serverless_default as default
};
