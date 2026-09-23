/**
 * Small shared helpers for the Postgres-URL-based storage strategies in
 * db.ts and dailyContentStore.ts. Kept intentionally minimal — only what's
 * duplicated between those two call sites today.
 */

const CLOUD_POSTGRES_HOST_SUFFIXES = [".neon.tech", ".vercel-storage.com", ".aws.connect"];

/** Detects whether a Postgres connection string points at a managed/cloud host that needs TLS. */
export function isCloudPostgresUrl(url: string): boolean {
  if (url.includes("sslmode=require")) return true;
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return false;
  }
  return CLOUD_POSTGRES_HOST_SUFFIXES.some(
    suffix => hostname === suffix.slice(1) || hostname.endsWith(suffix)
  );
}

/**
 * DATABASE_URL is read by multiple storage strategies expecting different
 * schemes (Postgres in db.ts/dailyContentStore.ts). If it's set but doesn't
 * match what the calling strategy expects, it silently falls through to the
 * next fallback with no error — warn once so this is visible in prod logs
 * without changing which provider actually gets picked.
 */
import { logger } from "../_core/logger";

const warnedCallers = new Set<string>();
export function warnIfDatabaseUrlSchemeMismatch(callerLabel: string, expectedSchemes: readonly string[]): void {
  const url = process.env.DATABASE_URL;
  if (!url || warnedCallers.has(callerLabel)) return;
  const matches = expectedSchemes.some(scheme => url.startsWith(scheme));
  if (!matches) {
    warnedCallers.add(callerLabel);
    logger.warn(
      `storage:${callerLabel}`,
      `DATABASE_URL is set but doesn't match the expected scheme(s) (${expectedSchemes.join(", ")}) — falling through to next storage strategy.`
    );
  }
}
