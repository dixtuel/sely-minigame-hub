import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { dailyCleanupHandler, dailyContentHandler } from "./scheduled/dailyContent";
import { createRateLimiter, securityHeaders } from "./_core/security";
import { registerSeoAndVerificationRoutes } from "./seoRoutes";

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

  // Scheduled endpoints
  const scheduledLimiter = createRateLimiter({ max: 8, windowMs: 60_000 });
  const publicApiLimiter = createRateLimiter({ max: 90, windowMs: 60_000 });
  app.post("/api/scheduled/daily-content", scheduledLimiter, dailyContentHandler);
  app.post("/api/scheduled/daily-cleanup", scheduledLimiter, dailyCleanupHandler);

  // Edge Caching Hook for read-only tRPC requests to minimize Function Invocations & compute units
  app.use("/api/trpc", (req, res, next) => {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400");
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
    })
  );

  return app;
}

const app = createApp();
export default app;
