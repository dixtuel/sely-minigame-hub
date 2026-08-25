import type { NextFunction, Request, RequestHandler, Response } from "express";

type LimiterOptions = {
  max: number;
  windowMs: number;
  now?: () => number;
  key?: (req: Request) => string;
};

type Counter = { count: number; resetAt: number };

const remoteAddress = (req: Request) => req.socket.remoteAddress ?? "unknown";

export function createRateLimiter({ max, windowMs, now = Date.now, key = remoteAddress }: LimiterOptions): RequestHandler {
  const counters = new Map<string, Counter>();
  let lastSweep = 0;

  return (req: Request, res: Response, next: NextFunction) => {
    const moment = now();
    if (moment - lastSweep > windowMs) {
      counters.forEach((counter, counterKey) => { if (counter.resetAt <= moment) counters.delete(counterKey); });
      lastSweep = moment;
    }

    const counterKey = key(req);
    const current = counters.get(counterKey);
    const counter = !current || current.resetAt <= moment ? { count: 0, resetAt: moment + windowMs } : current;
    counter.count += 1;
    counters.set(counterKey, counter);

    const remaining = Math.max(0, max - counter.count);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil(counter.resetAt / 1000)));
    if (counter.count > max) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((counter.resetAt - moment) / 1000))));
      res.status(429).json({ error: "rate-limit" });
      return;
    }
    next();
  };
}

export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  next();
};
