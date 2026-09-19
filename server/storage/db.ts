import pg from "pg";
import { ENV } from "../_core/env";
import { isTursoConfigured, getTursoUserByOpenId, upsertTursoUser } from "./turso";
import { isCloudPostgresUrl, warnIfDatabaseUrlSchemeMismatch } from "./dbUrl";
import { logger } from "../_core/logger";

const { Pool } = pg;

export type UserRole = "user" | "admin";

export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

export type InsertUser = {
  openId: string;
  name?: string | null;
  email?: string | null;
  loginMethod?: string | null;
  role?: UserRole;
  lastSignedIn?: Date;
};

let _pgPool: pg.Pool | null = null;
let _pgSchemaInitialized = false;

function getPostgresUrl(): string | null {
  const url =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.CONTENT_DB_URL ||
    null;

  if (url && (url.startsWith("postgres://") || url.startsWith("postgresql://"))) {
    return url;
  }
  warnIfDatabaseUrlSchemeMismatch("db.ts:getPostgresUrl", ["postgres://", "postgresql://"]);
  return null;
}

function getPgPool(): pg.Pool | null {
  const url = getPostgresUrl();
  if (!url) return null;

  if (!_pgPool) {
    try {
      const isCloud = isCloudPostgresUrl(url);

      const isServerless =
        process.env.VERCEL === "1" ||
        Boolean(process.env.VERCEL_ENV) ||
        Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

      _pgPool = new Pool({
        connectionString: url,
        // On Vercel serverless functions, limit to 2 connections per lambda to prevent exhausting Neon connection limits.
        // On long-running environments, allow up to 10 connections.
        max: isServerless ? 2 : 10,
        // 10s idle timeout allows idle connections to close, enabling Neon compute to cleanly scale to zero after 5 minutes.
        idleTimeoutMillis: isCloud ? 10000 : 30000,
        connectionTimeoutMillis: 5000,
        ssl: isCloud ? { rejectUnauthorized: false } : undefined,
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

async function ensurePgSchema(pool: pg.Pool): Promise<boolean> {
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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  // Strategy A: PostgreSQL / Neon (Serverless or Local Postgres 16)
  const pgPool = getPgPool();
  if (pgPool) {
    try {
      await ensurePgSchema(pgPool);

      const assignedRole =
        user.role !== undefined
          ? user.role
          : user.openId === ENV.ownerOpenId
            ? "admin"
            : "user";

      const signedInDate = user.lastSignedIn || new Date();

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
          signedInDate,
        ]
      );
      return;
    } catch (err) {
      logger.error("db:postgres", "Failed to upsert user", err);
      throw err;
    }
  }

  // Strategy B: Turso / libSQL (Serverless SQLite / Local file / Zero sleep)
  if (isTursoConfigured()) {
    return upsertTursoUser({
      openId: user.openId,
      name: user.name,
      email: user.email,
      loginMethod: user.loginMethod,
      role: user.role,
      lastSignedIn: user.lastSignedIn,
    });
  }

  logger.debug("db", "Cannot upsert user: database not available (running in memory mode)");
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  // Strategy A: PostgreSQL / Neon
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
      return res.rows.length > 0 ? (res.rows[0] as User) : undefined;
    } catch (err) {
      logger.error("db:postgres", "Failed to get user", err);
      return undefined;
    }
  }

  // Strategy B: Turso / libSQL
  if (isTursoConfigured()) {
    return (await getTursoUserByOpenId(openId)) as User | undefined;
  }

  logger.debug("db", "Cannot get user: database not available (running in memory mode)");
  return undefined;
}
