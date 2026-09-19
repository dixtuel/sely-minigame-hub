import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { logger } from "./logger";

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const candidatePaths = [
    path.resolve(import.meta.dirname, "public"), // dist/index.js running in standalone production
    path.resolve(import.meta.dirname, "../..", "dist", "public"), // running from source (tsx server/_core/index.ts)
    path.resolve(process.cwd(), "dist", "public"), // running from repo root (npm start / docker)
    path.resolve(process.cwd(), "client", "dist"),
  ];

  const distPath = candidatePaths.find(candidate => fs.existsSync(candidate)) || candidatePaths[0];

  if (!fs.existsSync(distPath)) {
    logger.warn("static", `Build directory not found: ${distPath}. Make sure to build client first.`);
  } else {
    logger.info("static", `Serving static assets from: ${distPath}`);
  }

  app.use(express.static(distPath));

  // Fall through to index.html for client-side SPA routing
  app.use("*", (_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(503).type("text/plain").send("Service Unavailable: Application build is in progress or missing. Please run build first.");
    }
  });
}
