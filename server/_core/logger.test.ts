import { describe, it, expect, vi } from "vitest";
import { logger, sanitizeLogText } from "./logger";

describe("logger", () => {
  it("sanitizes passwords in connection strings", () => {
    const raw = "postgres://sely_user:superSecretPassword123@neon.tech:5432/sely_db";
    const sanitized = sanitizeLogText(raw);
    expect(sanitized).not.toContain("superSecretPassword123");
    expect(sanitized).toContain("postgres://sely_user:***@neon.tech:5432/sely_db");
  });

  it("sanitizes Bearer authorization tokens", () => {
    const raw = "Authorization: Bearer mySecretToken123456789";
    const sanitized = sanitizeLogText(raw);
    expect(sanitized).not.toContain("mySecretToken123456789");
    expect(sanitized).toContain("Bearer ***");
  });

  it("masks IPv4 addresses for anonymity", () => {
    const raw = "Request from 192.168.1.105";
    const sanitized = sanitizeLogText(raw);
    expect(sanitized).toBe("Request from 192.168.*.*");
  });

  it("formats and prefixes info messages consistently", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logger.info("test", "Hello world");
    expect(spy).toHaveBeenCalledWith("[sely:test] Hello world");
    spy.mockRestore();
  });
});
