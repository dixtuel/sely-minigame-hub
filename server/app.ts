import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { dailyCleanupHandler, dailyContentHandler } from "./scheduled/dailyContent";
import { getLeaderboardHandler, submitLeaderboardHandler } from "./leaderboard";
import { getGlobalConfigHandler } from "./globalConfig";
import { createRateLimiter, securityHeaders } from "./_core/security";
import { registerSeoAndVerificationRoutes } from "./seoRoutes";
import { logger } from "./_core/logger";

// tRPC procedures that never depend on session/cookie state and are therefore safe to cache
// publicly at the Vercel Edge CDN. Anything not listed here (e.g. auth.me) stays private/no-store.
const PUBLIC_CACHEABLE_TRPC_PROCEDURES = new Set([
  "daily.today",
  "vaka.config",
  "vaka.getCases",
  "vaka.getDailyCase",
  "system.health",
]);

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(securityHeaders);
  app.use(express.json({ limit: "128kb" }));
  app.use(express.urlencoded({ limit: "32kb", extended: false }));

  // SEO & Verification
  registerSeoAndVerificationRoutes(app);

  // Storage & OAuth
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // Leaderboard API (Redis with Turso/In-Memory fallback & Edge caching)
  const leaderboardLimiter = createRateLimiter({ max: 20, windowMs: 60_000 });
  app.get("/api/leaderboard", getLeaderboardHandler);
  app.post("/api/leaderboard", leaderboardLimiter, submitLeaderboardHandler);
  app.get("/api/config", getGlobalConfigHandler);

  // Scheduled endpoints (supports GET for Vercel Cron and POST for VDS crontab)
  const scheduledLimiter = createRateLimiter({ max: 8, windowMs: 60_000 });
  const publicApiLimiter = createRateLimiter({ max: 90, windowMs: 60_000 });
  app.all("/api/scheduled/daily-content", scheduledLimiter, dailyContentHandler);
  app.all("/api/scheduled/daily-cleanup", scheduledLimiter, dailyCleanupHandler);

  // Edge Caching Hook for read-only tRPC requests to minimize Function Invocations & compute units.
  // tRPC's httpBatchLink batches multiple queries into a single GET (e.g. "/api/trpc/auth.me,daily.today"),
  // so this must only cache when EVERY procedure in the batch is known to be session-independent.
  // Anything else (auth.me, future protectedProcedure calls, unknown paths) must stay private/no-store,
  // otherwise the Edge CDN could serve one user's session data to another user for up to an hour.
  app.use("/api/trpc", (req, res, next) => {
    if (req.method === "GET") {
      const procedures = req.path.replace(/^\//, "").split(",");
      const allCacheable = procedures.length > 0 && procedures.every(p => PUBLIC_CACHEABLE_TRPC_PROCEDURES.has(p));
      res.setHeader(
        "Cache-Control",
        allCacheable
          ? "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400"
          : "private, no-store"
      );
    }
    next();
  });

  // tRPC API
  app.use(
    "/api/trpc",
    publicApiLimiter,
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError: ({ path, error }) => {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          logger.error("trpc", `Procedure '${path}' failed`, error);
        }
      },
    })
  );

  return app;
}

const app = createApp();
export default app;
