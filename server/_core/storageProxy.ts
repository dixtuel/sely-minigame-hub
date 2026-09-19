import type { Express, Request, Response } from "express";
import fs from "fs";
import path from "path";

/**
 * Serves stored game assets and social cards from client/public/storage.
 * Maintains backwards-compatible support for /manus-storage/*.
 */
export function registerStorageProxy(app: Express) {
  const handleStorageRequest = (req: Request, res: Response) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    const candidateDirs = [
      path.resolve(import.meta.dirname, "public", "storage"), // dist/index.js running in production
      path.resolve(import.meta.dirname, "../..", "client", "public", "storage"), // development or tsx from source
      path.resolve(process.cwd(), "dist", "public", "storage"), // production from project root
      path.resolve(process.cwd(), "client", "public", "storage"), // source fallback
    ];
    const localDir = candidateDirs.find(dir => fs.existsSync(dir)) || candidateDirs[0];
    const localPath = path.resolve(localDir, key);

    if (localPath.startsWith(localDir) && fs.existsSync(localPath)) {
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
      res.sendFile(localPath);
      return;
    }

    res.status(404).send("File not found");
  };

  app.get("/storage/*", handleStorageRequest);
  app.get("/manus-storage/*", handleStorageRequest);
}
