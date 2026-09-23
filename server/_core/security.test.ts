import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./security";

function response() {
  const headers = new Map<string, string>();
  const result = { code: 200, payload: undefined as unknown };
  const res = {
    setHeader: (name: string, value: string) => headers.set(name, value),
    status: (code: number) => { result.code = code; return res; },
    json: (payload: unknown) => { result.payload = payload; return res; },
  };
  return { res, headers, result };
}

describe("memory rate limiter", () => {
  it("allows requests inside the budget, then returns a generic 429 response", () => {
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000, now: () => 1_000, key: req => req.socket.remoteAddress ?? "test" });
    const req = { socket: { remoteAddress: "127.0.0.1" } } as never;
    const first = response(); const second = response(); const third = response();
    let nextCalls = 0;
    limiter(req, first.res as never, () => { nextCalls += 1; });
    limiter(req, second.res as never, () => { nextCalls += 1; });
    limiter(req, third.res as never, () => { nextCalls += 1; });
    expect(nextCalls).toBe(2);
    expect(third.result).toEqual({ code: 429, payload: { error: "rate-limit" } });
    expect(third.headers.get("Retry-After")).toBe("60");
  });
});
