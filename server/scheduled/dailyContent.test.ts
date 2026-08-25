import { describe, expect, it } from "vitest";
import { dailyCleanupHandler, dailyContentHandler } from "./dailyContent";

describe("daily content schedule endpoint", () => {
  it("accepts the configured daily-job token and generates the compact manifest", async () => {
    const token = process.env.DAILY_JOB_TOKEN;
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
    const token = process.env.DAILY_JOB_TOKEN;
    const response: { statusCode: number; body?: unknown } = { statusCode: 200 };
    const req = { header: (name: string) => name === "x-sely-cron-token" ? token : undefined, headers: {} } as any;
    const res = { status: (code: number) => { response.statusCode = code; return res; }, json: (body: unknown) => { response.body = body; return res; } } as any;

    await dailyCleanupHandler(req, res);

    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ ok: true, retentionDays: 90 });
  });
});
