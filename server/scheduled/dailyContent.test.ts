import { describe, expect, it } from "vitest";
import { dailyCleanupHandler, dailyContentHandler } from "./dailyContent";

describe("daily content schedule endpoint", () => {
  it("accepts the configured daily-job token and generates the compact manifest", async () => {
    const token = process.env.DAILY_JOB_TOKEN || "test-cron-token";
    process.env.DAILY_JOB_TOKEN = token;
    const response: { statusCode: number; body?: unknown } = { statusCode: 200 };
    const req = {
      header: (name: string) => name === "x-sely-cron-token" ? token : undefined,
      headers: {},
    } as any;
    const res = {
      status: (code: number) => { response.statusCode = code; return res; },
      json: (body: unknown) => { response.body = body; return res; },
    } as any;

    await dailyContentHandler(req, res);

    expect(token).toBeTruthy();
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ ok: true, generated: 7 });
  });

  it("accepts the configured daily-job token for the bounded monthly cleanup", async () => {
    const token = process.env.DAILY_JOB_TOKEN || "test-cron-token";
    process.env.DAILY_JOB_TOKEN = token;
    const response: { statusCode: number; body?: unknown } = { statusCode: 200 };
    const req = { header: (name: string) => name === "x-sely-cron-token" ? token : undefined, headers: {} } as any;
    const res = { status: (code: number) => { response.statusCode = code; return res; }, json: (body: unknown) => { response.body = body; return res; } } as any;

    await dailyCleanupHandler(req, res);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ ok: true, retentionDays: 90 });
  });

  it("accepts Vercel Cron Authorization Bearer header", async () => {
    const secret = "test-vercel-cron-secret";
    process.env.CRON_SECRET = secret;
    const response: { statusCode: number; body?: unknown } = { statusCode: 200 };
    const req = {
      header: (name: string) => name === "authorization" ? `Bearer ${secret}` : undefined,
      headers: {},
    } as any;
    const res = {
      status: (code: number) => { response.statusCode = code; return res; },
      json: (body: unknown) => { response.body = body; return res; },
    } as any;

    await dailyContentHandler(req, res);
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ ok: true, generated: 7 });
  });

  it("rejects unauthorized cron requests with 403", async () => {
    const response: { statusCode: number; body?: unknown } = { statusCode: 200 };
    const req = {
      header: () => undefined,
      headers: {},
    } as any;
    const res = {
      status: (code: number) => { response.statusCode = code; return res; },
      json: (body: unknown) => { response.body = body; return res; },
    } as any;

    await dailyContentHandler(req, res);
    expect(response.statusCode).toBe(403);
    expect(response.body).toMatchObject({ error: "cron-only" });
  });
});
