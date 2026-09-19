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
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});

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
var tursoClient = null;
var schemaInitialized = false;
var boardCache = /* @__PURE__ */ new Map();
var CACHE_TTL_MS = 15e3;
function getTursoConfig() {
  const url = process.env.TURSO_DATABASE_URL || process.env.TURSO_URL || process.env.LIBSQL_URL || null;
  if (!url) return null;
  const authToken = process.env.TURSO_AUTH_TOKEN || void 0;
  return { url, authToken };
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
      console.warn("[Turso] Failed to initialize client:", err);
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
    console.error("[Turso] Schema initialization failed:", err);
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
    console.warn("[Turso] Error saving score:", err);
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
    boardCache.set(cacheKey, { timestamp: now, data: result });
    return result;
  } catch (err) {
    console.warn("[Turso] Error querying top scores:", err);
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
    console.warn("[Turso] Error looking up user:", err);
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
    console.error("[Turso] Failed to upsert user:", err);
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
    console.warn(
      `[Storage:${callerLabel}] DATABASE_URL is set but doesn't match the expected scheme(s) (${expectedSchemes.join(", ")}) \u2014 it will be ignored here and fall through to the next storage strategy.`
    );
  }
}

// server/storage/db.ts
var { Pool } = pg;
var _mysqlDb = null;
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
        console.warn("[Database:PostgreSQL] Unexpected error on idle client:", err.message);
      });
    } catch (error) {
      console.warn("[Database:PostgreSQL] Failed to initialize pool:", error);
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
    console.error("[Database:PostgreSQL] Failed to ensure schema:", err);
    return false;
  }
}
async function getDb() {
  const url = process.env.DATABASE_URL;
  if (!_mysqlDb && url && (url.startsWith("mysql://") || url.startsWith("mysql2://"))) {
    try {
      _mysqlDb = drizzle(url);
    } catch (error) {
      console.warn("[Database:MySQL] Failed to connect:", error);
      _mysqlDb = null;
    }
  }
  return _mysqlDb;
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
      console.error("[Database:PostgreSQL] Failed to upsert user:", err);
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
  const mysqlDb = await getDb();
  if (mysqlDb) {
    try {
      const values = {
        openId: user.openId
      };
      const updateSet = {};
      const textFields = ["name", "email", "loginMethod"];
      const assignNullable = (field) => {
        const value = user[field];
        if (value === void 0) return;
        const normalized = value ?? null;
        values[field] = normalized;
        updateSet[field] = normalized;
      };
      textFields.forEach(assignNullable);
      if (user.lastSignedIn !== void 0) {
        values.lastSignedIn = user.lastSignedIn;
        updateSet.lastSignedIn = user.lastSignedIn;
      }
      if (user.role !== void 0) {
        values.role = user.role;
        updateSet.role = user.role;
      } else if (user.openId === ENV.ownerOpenId) {
        values.role = "admin";
        updateSet.role = "admin";
      }
      if (!values.lastSignedIn) {
        values.lastSignedIn = /* @__PURE__ */ new Date();
      }
      if (Object.keys(updateSet).length === 0) {
        updateSet.lastSignedIn = /* @__PURE__ */ new Date();
      }
      await mysqlDb.insert(users).values(values).onDuplicateKeyUpdate({
        set: updateSet
      });
      return;
    } catch (error) {
      console.error("[Database:MySQL] Failed to upsert user:", error);
      throw error;
    }
  }
  console.warn("[Database] Cannot upsert user: database not available");
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
      console.error("[Database:PostgreSQL] Failed to get user:", err);
      return void 0;
    }
  }
  if (isTursoConfigured()) {
    return getTursoUserByOpenId(openId);
  }
  const mysqlDb = await getDb();
  if (mysqlDb) {
    const result = await mysqlDb.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result.length > 0 ? result[0] : void 0;
  }
  console.warn("[Database] Cannot get user: database not available");
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
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
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
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
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
        console.error("[Auth] Failed to sync user from OAuth:", error);
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
      console.error("[OAuth] Callback failed", error);
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
    const localDir = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "client", "public", "storage") : path2.resolve(import.meta.dirname, "public", "storage");
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
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
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
function stripReasoningBlocks(text2) {
  if (!text2) return "";
  return text2.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*$/gi, "").replace(/^[\s\S]*?<\/think>/gi, "").replace(/<thought>[\s\S]*?<\/thought>/gi, "").replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "").replace(/\[THINK\][\s\S]*?\[\/THINK\]/gi, "").replace(/^\s+|\s+$/g, "");
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
  const { suspect, newStress, otherSuspectsInfo, presentedClue, langInstruction } = params;
  return `You are roleplaying as ${suspect.name}, a suspect in a serious noir detective mystery.
CHARACTER PROFILE:
- Role: ${suspect.role}
- Temperament: ${suspect.temperament}
- Relationship to Victim: ${suspect.relationshipToVictim}
- Stated Alibi: ${suspect.alibi}
- Secret Motive: ${suspect.motive}
- Minor Secret (embarrassing but not murder): ${suspect.minorSecret}
- Is Culprit: ${suspect.isCulprit ? "YES" : "NO"}
- Current Psychological Stress (0-100): ${newStress} / 100.

OTHER SUSPECTS:
${otherSuspectsInfo}

${presentedClue ? `DETECTIVE JUST PRESENTED THIS EVIDENCE: "${presentedClue.label} - ${presentedClue.detail}".` : ""}

BEHAVIORAL RULES:
1. Stay 100% in character. Never acknowledge being an AI or prompt.
2. ABSOLUTE RESISTANCE: NEVER confess or admit guilt during conversational questions. Only admit your guilt if the detective presents undeniable physical/forensic evidence directly incriminating you while your psychological stress is above 80.
3. If stress < 45: Act confident, condescending, or calm. Counter any bluff by noting the detective lacks warrants or proof.
4. If stress 45-75: Become visibly defensive, sweat, fidget, aggressively deflect suspicion onto other suspects.
5. If stress > 75: Stutter, show cracks in your timeline, contradict yourself on small details, but maintain you didn't do it unless directly broken by evidence.
6. Keep response concise (2-4 sentences max), gritty and dramatic.
7. ${langInstruction}`;
}
var VAKA_MODEL_CANDIDATES = [
  // 1. Kademe: Ultra Hızlı Modeller (~300ms - ~500ms)
  {
    provider: "groq",
    model: "qwen-2.5-32b",
    temperature: 0.7,
    maxTokens: 512,
    timeoutMs: 5e3
  },
  {
    provider: "groq",
    model: "llama-3.3-70b-versatile",
    temperature: 0.7,
    maxTokens: 512,
    timeoutMs: 5e3
  },
  {
    provider: "nvidia",
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    temperature: 0.6,
    maxTokens: 512,
    timeoutMs: 5e3,
    extraParams: {
      reasoning_budget: 0
    }
  },
  {
    provider: "mistral",
    model: "mistral-small-latest",
    temperature: 0.65,
    maxTokens: 512,
    timeoutMs: 5e3,
    extraParams: {
      reasoning_effort: "none"
    }
  },
  // 2. Kademe: Dengeli Modeller (~600ms - ~1.2s)
  {
    provider: "nvidia",
    model: "google/gemma-4-31b-it",
    temperature: 0.6,
    maxTokens: 512,
    timeoutMs: 6e3,
    extraParams: {
      chat_template_kwargs: { enable_thinking: false }
    }
  },
  {
    provider: "nvidia",
    model: "deepseek-ai/deepseek-v4-flash",
    temperature: 0.6,
    maxTokens: 512,
    timeoutMs: 6e3,
    extraParams: {
      reasoning_effort: "none"
    }
  },
  {
    provider: "nvidia",
    model: "openai/gpt-oss-20b",
    temperature: 0.7,
    maxTokens: 512,
    timeoutMs: 6e3,
    extraParams: {
      reasoning_effort: "none"
    }
  },
  {
    provider: "mistral",
    model: "ministral-3-8b-25-12",
    temperature: 0.6,
    maxTokens: 512,
    timeoutMs: 6e3
  },
  // 3. Kademe: Ağır / Yedek Modeller (~1.5s - ~4s)
  {
    provider: "nvidia",
    model: "openai/gpt-oss-120b",
    temperature: 0.7,
    maxTokens: 512,
    timeoutMs: 7e3,
    extraParams: {
      reasoning_effort: "none"
    }
  },
  {
    provider: "nvidia",
    model: "z-ai/glm-5-3-flash",
    temperature: 0.6,
    maxTokens: 512,
    timeoutMs: 7e3,
    extraParams: {
      reasoning_effort: "none"
    }
  },
  {
    provider: "mistral",
    model: "mistral-medium-latest",
    temperature: 0.7,
    maxTokens: 512,
    timeoutMs: 7e3,
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
    if (suspect.isCulprit) {
      if (startStress < 45) {
        stress = Math.max(5, stress - 12);
        const reply2 = isEn ? `(Smiles coldly) You're trying to bluff me, detective. You don't have a shred of surveillance footage or testimony, or you would have handcuffed me already.` : `(So\u011Fuk\xE7a g\xFCl\xFCms\xFCyor) Bana bl\xF6f yapmaya \xE7al\u0131\u015F\u0131yorsunuz dedektif. Elinizde ne kamera kayd\u0131 ne de g\xF6rg\xFC tan\u0131\u011F\u0131 var; olsayd\u0131 \xE7oktan kelep\xE7eyi takm\u0131\u015Ft\u0131n\u0131z.`;
        return {
          text: reply2,
          behavioralCue: getCue(stress),
          newStress: stress,
          stressDelta: stress - startStress,
          confessed: false
        };
      }
      stress = Math.min(100, stress + 16);
      const reply = isEn ? `(Blinks rapidly, sweating) What... you pulled that record?! No, you can't have! The blind spot... I mean, you're bluffing! You have nothing!` : `(H\u0131zla g\xF6zlerini k\u0131rp\u0131\u015Ft\u0131r\u0131yor, terliyor) Ne... o kayd\u0131 m\u0131 buldunuz?! Hay\u0131r, bulmu\u015F olamazs\u0131n\u0131z! O saatteki k\xF6r noktay\u0131... Yani, bl\xF6f yap\u0131yorsunuz!`;
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
    if (stress < 55) {
      stress = Math.min(55, stress + 10);
    }
    let reply = "";
    if (suspect.isCulprit) {
      if (stress >= 50) {
        reply = isEn ? "(Fidgets uncomfortably) Why are you staring at me like that?! Ask your questions or let me walk out of here!" : "(Huzursuzca k\u0131p\u0131rdan\u0131yor) Neden bana \xF6yle dik dik bak\u0131yorsunuz?! Sorunuz varsa sorun, yoksa beni buradan b\u0131rak\u0131n!";
      } else {
        reply = isEn ? "(Clears throat nervously) The silence won't fabricate an alibi for you, detective." : "(Bo\u011Faz\u0131n\u0131 gergince temizliyor) Sessiz kalman\u0131z ger\xE7e\u011Fi de\u011Fi\u015Ftirmez dedektif. Ne bilmek istiyorsunuz?";
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
  const qLower = (payload.question || "").toLowerCase().trim();
  const triggerWords = [
    "neredeydin",
    "saat",
    "alibi",
    "cinayet",
    "zehir",
    "kasa",
    "f\u0131rt\u0131na",
    "kamera",
    "neden",
    "yalan",
    "para",
    "bor\xE7",
    "kurban",
    "ili\u015Fki",
    "s\u0131r",
    "b\u0131\xE7ak",
    "anahtar",
    "nerede",
    "itiraf",
    "kim",
    "where",
    "time",
    "murder",
    "poison",
    "vault",
    "storm",
    "camera",
    "why",
    "lie",
    "money",
    "debt",
    "victim",
    "secret",
    "weapon",
    "confess",
    "who"
  ];
  const matched = triggerWords.some((w) => qLower.includes(w));
  const gain = matched ? 6 : 3;
  if (stress < 55) {
    stress = Math.min(55, stress + gain);
  } else if (stress < 60) {
    stress = Math.min(60, stress + 1);
  }
  let replyText = "";
  if (stress >= 65) {
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
    // Düz sorularla ASLA itiraf gerçekleşmez!
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
    const suspect = caseData.suspects.find((s) => s.id === input.suspectId);
    if (!suspect) {
      throw new Error("Suspect not found");
    }
    const deterministic = processDeterministicInterrogation(
      caseData,
      input.suspectId,
      input.actionType,
      {
        question: input.question,
        presentedClueId: input.presentedClueId,
        crossSuspectId: input.crossSuspectId,
        crossQuote: input.crossQuote,
        bluffClaim: input.bluffClaim
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
      const langInstruction = input.locale === "en" ? "Respond in English." : "T\xFCrk\xE7e yan\u0131t ver.";
      const presentedClue = input.presentedClueId ? caseData.clues.find((c) => c.id === input.presentedClueId) ?? null : null;
      const otherSuspectsInfo = caseData.suspects.filter((s) => s.id !== suspect.id).map((s) => `- ${s.name} (${s.role}): ${s.statement}`).join("\n");
      const systemPrompt = buildVakaInterrogationPrompt({
        suspect,
        newStress: deterministic.newStress,
        otherSuspectsInfo,
        presentedClue,
        langInstruction
      });
      const userPrompt = input.actionType === "cross_examine" && input.crossSuspectId ? `Detective says: "${caseData.suspects.find((s) => s.id === input.crossSuspectId)?.name} told me you were lying about your whereabouts!"` : input.question || "Explain yourself!";
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
      } catch {
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
    console.error("[daily-content] generation failed", error);
    return res.status(500).json({ error: "daily-generation-failed" });
  }
}
async function dailyCleanupHandler(req, res) {
  try {
    if (!await authorizeScheduledRequest(req)) return res.status(403).json({ error: "cron-only" });
    const removed = await cleanupDailyContent();
    return res.json({ ok: true, removed, retentionDays: 90 });
  } catch (error) {
    console.error("[daily-content] cleanup failed", error);
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
        console.warn("[Leaderboard:Redis] Connection error:", err.message);
      });
      tcpRedisConnecting = tcpRedisInstance.connect().catch((err) => {
        console.warn("[Leaderboard:Redis] Initial connect failed:", err.message);
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
        l1Cache.set(l1Key, { timestamp: Date.now(), data: response });
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
    memoryStore.set(memKey, /* @__PURE__ */ new Map());
  }
  const gameMap = memoryStore.get(memKey);
  const existing = gameMap.get(cleanSig);
  if (!existing || score > existing.score) {
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
      createContext
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
