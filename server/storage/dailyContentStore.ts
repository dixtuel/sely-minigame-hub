import { createHash } from "node:crypto";
import { deflateRawSync, inflateRawSync } from "node:zlib";
import { createClient, type Client } from "@libsql/client";
import { Pool } from "pg";

export const DAILY_GAMES = ["echo", "knot", "cut", "shadow", "vaka", "hane", "spark"] as const;
export type DailyGameId = (typeof DAILY_GAMES)[number];
const RULESET_VERSION = "5";

export type DailyGamePack = {
  gameId: DailyGameId;
  seed: number;
  difficulty: number;
  rulesetVersion: string;
  params: Record<string, number>;
  checksum: string;
};

export type DailyManifest = { date: string; games: DailyGamePack[]; generatedAt: string };
type StoredRow = DailyGamePack & { date: string; payloadCodec: "json" | "deflate-base64url"; payload: string; createdAt: string };

const dayKey = (value = new Date()) => value.toISOString().slice(0, 10);
const seedFor = (value: string) => {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) % 2_147_483_647;
};
const checksum = (payload: unknown) => createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);

function encodePayload(value: Record<string, number>) {
  const raw = JSON.stringify(value);
  if (raw.length < 96) return { codec: "json" as const, payload: raw };
  return { codec: "deflate-base64url" as const, payload: deflateRawSync(Buffer.from(raw)).toString("base64url") };
}

function decodePayload(codec: StoredRow["payloadCodec"], payload: string) {
  const raw = codec === "json" ? payload : inflateRawSync(Buffer.from(payload, "base64url")).toString("utf8");
  return JSON.parse(raw) as Record<string, number>;
}

export function createDailyManifest(date = dayKey()): DailyManifest {
  const games = DAILY_GAMES.map((gameId, index) => {
    const seed = seedFor(`${date}:${gameId}:v${RULESET_VERSION}`);
    const difficulty = 1 + ((seed + index) % 4);
    const params = {
      v: Number(RULESET_VERSION),
      band: difficulty,
      variant: (seed >>> 5) % 5,
      objective: (seed >>> 11) % 4,
      pace: 2 + ((seed >>> 17) % 4),
    };
    return { gameId, seed, difficulty, rulesetVersion: RULESET_VERSION, params, checksum: checksum({ date, gameId, seed, difficulty, params }) };
  });
  return { date, games, generatedAt: new Date().toISOString() };
}

interface DailyStore { ensure(manifest: DailyManifest): Promise<DailyManifest>; cleanup(beforeDate: string): Promise<number>; }

class MemoryStore implements DailyStore {
  private rows = new Map<string, DailyManifest>();
  async ensure(manifest: DailyManifest) { const current = this.rows.get(manifest.date); if (current) return current; this.rows.set(manifest.date, manifest); return manifest; }
  async cleanup(beforeDate: string) { const expired = Array.from(this.rows.keys()).filter(date => date < beforeDate); expired.forEach(date => this.rows.delete(date)); return expired.length; }
}

class PostgresStore implements DailyStore {
  constructor(private pool: Pool) {}
  private async schema() {
    const result = await this.pool.query("SELECT to_regclass('public.sely_daily_content') AS relation_name");
    if (!result.rows[0]?.relation_name) throw new Error("Daily content migration is missing");
  }
  async ensure(manifest: DailyManifest) {
    await this.schema();
    const rows = await this.pool.query("SELECT * FROM sely_daily_content WHERE content_date = $1 ORDER BY game_id", [manifest.date]);
    if (rows.rowCount === DAILY_GAMES.length) return fromRows(manifest.date, rows.rows as Array<Record<string, unknown>>);
    for (const game of manifest.games) {
      const packed = encodePayload(game.params);
      await this.pool.query(`INSERT INTO sely_daily_content (content_date, game_id, seed, difficulty, ruleset_version, payload_codec, payload, checksum)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (content_date, game_id) DO NOTHING`, [manifest.date, game.gameId, game.seed, game.difficulty, game.rulesetVersion, packed.codec, packed.payload, game.checksum]);
    }
    const stored = await this.pool.query("SELECT * FROM sely_daily_content WHERE content_date = $1 ORDER BY game_id", [manifest.date]);
    return fromRows(manifest.date, stored.rows as Array<Record<string, unknown>>);
  }
  async cleanup(beforeDate: string) { await this.schema(); const result = await this.pool.query("DELETE FROM sely_daily_content WHERE content_date < $1", [beforeDate]); return result.rowCount ?? 0; }
}

class TursoStore implements DailyStore {
  constructor(private client: Client) {}
  private async schema() {
    await this.client.execute(`CREATE TABLE IF NOT EXISTS sely_daily_content (
      content_date TEXT NOT NULL, game_id TEXT NOT NULL, seed INTEGER NOT NULL, difficulty INTEGER NOT NULL,
      ruleset_version TEXT NOT NULL, payload_codec TEXT NOT NULL, payload TEXT NOT NULL, checksum TEXT NOT NULL,
      created_at TEXT NOT NULL, PRIMARY KEY (content_date, game_id)
    )`);
    await this.client.execute("CREATE INDEX IF NOT EXISTS sely_daily_content_date_idx ON sely_daily_content (content_date DESC)");
  }
  async ensure(manifest: DailyManifest) {
    await this.schema();
    const existing = await this.client.execute({ sql: "SELECT * FROM sely_daily_content WHERE content_date = ? ORDER BY game_id", args: [manifest.date] });
    if (existing.rows.length === DAILY_GAMES.length) return fromRows(manifest.date, existing.rows as Array<Record<string, unknown>>);
    const createdAt = new Date().toISOString();
    for (const game of manifest.games) {
      const packed = encodePayload(game.params);
      await this.client.execute({ sql: `INSERT OR IGNORE INTO sely_daily_content
        (content_date, game_id, seed, difficulty, ruleset_version, payload_codec, payload, checksum, created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
        args: [manifest.date, game.gameId, game.seed, game.difficulty, game.rulesetVersion, packed.codec, packed.payload, game.checksum, createdAt] });
    }
    const stored = await this.client.execute({ sql: "SELECT * FROM sely_daily_content WHERE content_date = ? ORDER BY game_id", args: [manifest.date] });
    return fromRows(manifest.date, stored.rows as Array<Record<string, unknown>>);
  }
  async cleanup(beforeDate: string) { await this.schema(); const result = await this.client.execute({ sql: "DELETE FROM sely_daily_content WHERE content_date < ?", args: [beforeDate] }); return result.rowsAffected; }
}

function fromRows(date: string, rows: Array<Record<string, unknown>>): DailyManifest {
  const games = rows.map(row => ({ gameId: String(row.game_id) as DailyGameId, seed: Number(row.seed), difficulty: Number(row.difficulty), rulesetVersion: String(row.ruleset_version), params: decodePayload(String(row.payload_codec) as StoredRow["payloadCodec"], String(row.payload)), checksum: String(row.checksum) }));
  return { date, games, generatedAt: new Date().toISOString() };
}

let store: DailyStore | null = null;
export function getDailyStore(): DailyStore {
  if (store) return store;
  const provider = process.env.CONTENT_DB_PROVIDER?.toLowerCase();
  const postgresUrl = process.env.CONTENT_DB_URL;
  const tursoUrl = process.env.TURSO_URL;
  if (provider === "postgres" && postgresUrl && /^(postgres|postgresql):\/\//.test(postgresUrl)) {
    store = new PostgresStore(new Pool({ connectionString: postgresUrl, max: 2, idleTimeoutMillis: 10_000 }));
    return store;
  }
  if (provider === "turso" && tursoUrl && /^libsql:\/\//.test(tursoUrl) && process.env.TURSO_AUTH_TOKEN) {
    store = new TursoStore(createClient({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN }));
    return store;
  }
  store = new MemoryStore();
  return store;
}

export async function ensureDailyContent(date = dayKey()) { return getDailyStore().ensure(createDailyManifest(date)); }
export async function cleanupDailyContent(retentionDays = 90, referenceDate = dayKey()) {
  const reference = new Date(`${referenceDate}T00:00:00.000Z`);
  reference.setUTCDate(reference.getUTCDate() - retentionDays);
  return getDailyStore().cleanup(reference.toISOString().slice(0, 10));
}
export { dayKey };
