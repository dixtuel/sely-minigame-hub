import { describe, it, expect, vi } from "vitest";
import { logger, sanitizeLogText } from "./logger";

describe("logger", () => {
  it("sanitizes passwords, tokens, IPs and prefixes log outputs consistently", () => {
    // 1. Password sanitization in URLs
    const rawUrl = "postgres://sely_user:superSecretPassword123@neon.tech:5432/sely_db";
    const sanitizedUrl = sanitizeLogText(rawUrl);
    expect(sanitizedUrl).not.toContain("superSecretPassword123");
    expect(sanitizedUrl).toContain("postgres://sely_user:***@neon.tech:5432/sely_db");

    // 2. Bearer authorization token sanitization
    const rawToken = "Authorization: Bearer mySecretToken123456789";
    const sanitizedToken = sanitizeLogText(rawToken);
    expect(sanitizedToken).not.toContain("mySecretToken123456789");
    expect(sanitizedToken).toContain("Bearer ***");

    // 3. IPv4 address masking
    const rawIp = "Request from 192.168.1.105";
    expect(sanitizeLogText(rawIp)).toBe("Request from 192.168.*.*");

    // 4. Uniform format prefix
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logger.info("test", "Hello world");
    expect(spy).toHaveBeenCalledWith("[sely:test] Hello world");
    spy.mockRestore();
  });
});
