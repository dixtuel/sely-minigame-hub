import "dotenv/config";
import { createServer } from "http";
import net from "net";
import app from "../app";
import { ensureDailyContent } from "../dailyContent";
import { logger } from "./logger";
import { serveStatic } from "./staticServe";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const server = createServer(app);

  // development mode uses Vite, production mode uses static files.
  // setupVite is dynamically imported here (never statically from the top of
  // this file) so the "vite" devDependency is never touched in a production
  // build/runtime, where `pnpm prune --prod` has removed it.
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.info("server", `Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    logger.info("server", `Standalone server running on http://localhost:${port}/`);
    // Pre-warm today's daily game content on standalone server startup
    ensureDailyContent().catch(err => {
      logger.warn("startup", "Failed to pre-warm daily content", err);
    });
  });
}

startServer().catch(err => {
  logger.error("server", "Fatal startup failure", err);
});
