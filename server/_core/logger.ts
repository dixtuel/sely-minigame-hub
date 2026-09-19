/**
 * Lightweight, privacy-safe, high-signal logger for SELY MiniGame Hub.
 *
 * Designed for:
 * 1. Zero Noise / Free Tier Quota Preservation:
 *    - Suppresses routine/anonymous debug noise in production (e.g. unauthenticated visitors).
 *    - Avoids multi-line spam; produces clean, single-line structured outputs.
 * 2. Privacy & Anonymity by Design (GDPR / KVKK):
 *    - Automatically masks connection string credentials (Postgres, Redis, Turso).
 *    - Masks sensitive tokens, secrets, session cookies, and IP addresses.
 * 3. Consistent Namespacing:
 *    - Uniform `[sely:<scope>] <message>` tagging across all server subsystems.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_WEIGHTS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const isDev = process.env.NODE_ENV === "development";
const isDebugEnabled =
  Boolean(process.env.DEBUG) &&
  process.env.DEBUG !== "false" &&
  process.env.DEBUG !== "0";

// In production / Vercel Serverless, default threshold is 'info'.
// 'debug' logs are only emitted when explicitly enabled via DEBUG or development environment.
const currentLevelThreshold: LogLevel =
  isDebugEnabled || isDev ? "debug" : "info";

/**
 * Sanitizes strings to strip passwords from connection URLs or sensitive tokens.
 */
export function sanitizeLogText(input: string): string {
  if (!input) return "";

  return input
    // Mask password in URLs: protocol://user:password@host
    .replace(/(:\/\/[\w%.-]+:)([^@]+)(@)/g, "$1***$3")
    // Mask authorization bearer tokens
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]{8,}/gi, "$1***")
    // Mask session tokens or jwt-like structures
    .replace(/(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,})/g, "jwt:***")
    // Mask IPv4 addresses for privacy (preserves subnet for rough diagnostics)
    .replace(/\b(\d{1,3}\.\d{1,3})\.\d{1,3}\.\d{1,3}\b/g, "$1.*.*");
}

/**
 * Formats error objects cleanly without bloating serverless logs with massive traces
 * unless running in explicit debug mode.
 */
function formatError(err: unknown): string {
  if (!err) return "";
  if (err instanceof Error) {
    if (isDebugEnabled || isDev) {
      return sanitizeLogText(err.stack || err.message);
    }
    return sanitizeLogText(err.message);
  }
  return sanitizeLogText(String(err));
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_WEIGHTS[level] >= LOG_LEVEL_WEIGHTS[currentLevelThreshold];
}

export const logger = {
  /**
   * Debug level: only active when DEBUG=true/1 or NODE_ENV=development.
   * Suppressed in normal production to protect Vercel log limits.
   */
  debug(scope: string, message: string, ...args: unknown[]): void {
    if (!shouldLog("debug")) return;
    const sanitizedMsg = sanitizeLogText(message);
    console.debug(`[sely:${scope}] ${sanitizedMsg}`, ...args);
  },

  /**
   * Info level: key lifecycle events (server boot, cron jobs, schema migrations).
   */
  info(scope: string, message: string, ...args: unknown[]): void {
    if (!shouldLog("info")) return;
    const sanitizedMsg = sanitizeLogText(message);
    console.info(`[sely:${scope}] ${sanitizedMsg}`, ...args);
  },

  /**
   * Warn level: actionable system warnings (fallbacks engaged, config discrepancies).
   * Routine unauthenticated visitor events should NOT be logged as warnings.
   */
  warn(scope: string, message: string, ...args: unknown[]): void {
    if (!shouldLog("warn")) return;
    const sanitizedMsg = sanitizeLogText(message);
    console.warn(`[sely:${scope}] ${sanitizedMsg}`, ...args);
  },

  /**
   * Error level: unexpected exceptions or storage failures.
   */
  error(scope: string, message: string, err?: unknown): void {
    if (!shouldLog("error")) return;
    const sanitizedMsg = sanitizeLogText(message);
    const errText = err ? ` — ${formatError(err)}` : "";
    console.error(`[sely:${scope}] ${sanitizedMsg}${errText}`);
  },
};
