import { describe, expect, it } from "vitest";
import { dailyCleanupHandler, dailyContentHandler } from "./dailyContent";
import { DAILY_GAMES } from "../storage/dailyContentStore";

describe("daily content schedule endpoint", () => {
  it("authenticates cron requests via header or bearer token and enforces 403 on invalid credentials", async () => {
    const token = "test-cron-token";
    process.env.DAILY_JOB_TOKEN = token;
    const secret = "test-vercel-cron-secret";
    process.env.CRON_SECRET = secret;

    // Helper for mock req/res
    const mockHttp = (headerFn: (name: string) => string | undefined) => {
      const resData = { statusCode: 200, body: null as any };
      const req = { header: headerFn, headers: {} } as any;
      const res = {
        status: (code: number) => { resData.statusCode = code; return res; },
        json: (body: unknown) => { resData.body = body; return res; },
      } as any;
      return { req, res, resData };
    };

    // 1. VDS cron token authorized
    const { req: req1, res: res1, resData: resData1 } = mockHttp(h => h === "x-sely-cron-token" ? token : undefined);
    await dailyContentHandler(req1, res1);
    expect(resData1.statusCode).toBe(200);
    expect(resData1.body).toMatchObject({ ok: true, generated: DAILY_GAMES.length });

    // 2. Vercel Bearer token authorized
    const { req: req2, res: res2, resData: resData2 } = mockHttp(h => h === "authorization" ? `Bearer ${secret}` : undefined);
    await dailyContentHandler(req2, res2);
    expect(resData2.statusCode).toBe(200);
    expect(resData2.body).toMatchObject({ ok: true, generated: DAILY_GAMES.length });

    // 3. Cleanup handler authorized
    const { req: req3, res: res3, resData: resData3 } = mockHttp(h => h === "x-sely-cron-token" ? token : undefined);
    await dailyCleanupHandler(req3, res3);
    expect(resData3.statusCode).toBe(200);
    expect(resData3.body).toMatchObject({ ok: true, retentionDays: 90 });

    // 4. Unauthorized request rejected with 403
    const { req: req4, res: res4, resData: resData4 } = mockHttp(() => undefined);
    await dailyContentHandler(req4, res4);
    expect(resData4.statusCode).toBe(403);
    expect(resData4.body).toEqual({ error: "cron-only" });
  });
});
