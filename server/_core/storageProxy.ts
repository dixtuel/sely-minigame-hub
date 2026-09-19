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

    const localDir =
      process.env.NODE_ENV === "development"
        ? path.resolve(import.meta.dirname, "../..", "client", "public", "storage")
        : path.resolve(import.meta.dirname, "public", "storage");
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
