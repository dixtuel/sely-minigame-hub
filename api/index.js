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

// server/db.ts
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

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
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
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
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
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
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
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
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
import fs from "fs";
import path from "path";
function registerStorageProxy(app2) {
  app2.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    const localDir = process.env.NODE_ENV === "development" ? path.resolve(import.meta.dirname, "../..", "client", "public", "manus-storage") : path.resolve(import.meta.dirname, "public", "manus-storage");
    const localPath = path.resolve(localDir, key);
    if (localPath.startsWith(localDir) && fs.existsSync(localPath)) {
      res.sendFile(localPath);
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
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
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
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

// server/dailyContent.ts
import { createHash } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { createClient } from "@libsql/client";
import { Pool } from "pg";
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
  async schema() {
    const result = await this.pool.query("SELECT to_regclass('public.sely_daily_content') AS relation_name");
    if (!result.rows[0]?.relation_name) throw new Error("Daily content migration is missing");
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
  async schema() {
    await this.client.execute(`CREATE TABLE IF NOT EXISTS sely_daily_content (
      content_date TEXT NOT NULL, game_id TEXT NOT NULL, seed INTEGER NOT NULL, difficulty INTEGER NOT NULL,
      ruleset_version TEXT NOT NULL, payload_codec TEXT NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL,
      created_at TEXT NOT NULL, PRIMARY KEY (content_date, game_id)
    )`);
    await this.client.execute("CREATE INDEX IF NOT EXISTS sely_daily_content_date_idx ON sely_daily_content (content_date DESC)");
  }
  async ensure(manifest) {
    await this.schema();
    const existing = await this.client.execute({ sql: "SELECT * FROM sely_daily_content WHERE content_date = ? ORDER BY game_id", args: [manifest.date] });
    if (existing.rows.length === DAILY_GAMES.length) return fromRows(manifest.date, existing.rows);
    const createdAt = (/* @__PURE__ */ new Date()).toISOString();
    for (const game of manifest.games) {
      const packed = encodePayload(game.params);
      await this.client.execute({
        sql: `INSERT OR IGNORE INTO sely_daily_content
        (content_date, game_id, seed, difficulty, ruleset_version, payload_codec, payload, checksum, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
        args: [manifest.date, game.gameId, game.seed, game.difficulty, game.rulesetVersion, packed.codec, packed.payload, game.checksum, createdAt]
      });
    }
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
  const postgresUrl = process.env.CONTENT_DB_URL;
  const tursoUrl = process.env.TURSO_URL;
  if (provider === "postgres" && postgresUrl && /^(postgres|postgresql):\/\//.test(postgresUrl)) {
    store = new PostgresStore(new Pool({ connectionString: postgresUrl, max: 2, idleTimeoutMillis: 1e4 }));
    return store;
  }
  if (provider === "turso" && tursoUrl && /^libsql:\/\//.test(tursoUrl) && process.env.TURSO_AUTH_TOKEN) {
    store = new TursoStore(createClient({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN }));
    return store;
  }
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
  })
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
  const user = await sdk.authenticateRequest(req);
  return Boolean(user.isCron && user.taskUid);
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
function createApp() {
  const app2 = express();
  app2.disable("x-powered-by");
  app2.use(securityHeaders);
  app2.use(express.json({ limit: "128kb" }));
  app2.use(express.urlencoded({ limit: "32kb", extended: false }));
  registerSeoAndVerificationRoutes(app2);
  registerStorageProxy(app2);
  registerOAuthRoutes(app2);
  const scheduledLimiter = createRateLimiter({ max: 8, windowMs: 6e4 });
  const publicApiLimiter = createRateLimiter({ max: 90, windowMs: 6e4 });
  app2.post("/api/scheduled/daily-content", scheduledLimiter, dailyContentHandler);
  app2.post("/api/scheduled/daily-cleanup", scheduledLimiter, dailyCleanupHandler);
  app2.use("/api/trpc", (req, res, next) => {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400");
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
