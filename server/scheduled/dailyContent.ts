import type { Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { cleanupDailyContent, ensureDailyContent } from "../dailyContent";
import { logger } from "../_core/logger";
import { sdk } from "../_core/sdk";

function tokenMatches(received: string | undefined, expected: string | undefined) {
  if (!received || !expected || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

async function authorizeScheduledRequest(req: Request) {
  // 1. VDS crontab header check
  const vdsToken = req.header("x-sely-cron-token");
  if (tokenMatches(vdsToken, process.env.DAILY_JOB_TOKEN)) return true;

  // 2. Vercel Cron job authorization (Authorization: Bearer <CRON_SECRET>)
  const authHeader = req.header("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const bearerToken = authHeader.slice(7);
    const expectedSecret = process.env.CRON_SECRET || process.env.DAILY_JOB_TOKEN;
    if (tokenMatches(bearerToken, expectedSecret)) return true;
  }

  // 3. Authenticated internal cron user check
  try {
    const user = await sdk.authenticateRequest(req);
    return Boolean(user.isCron && user.taskUid);
  } catch {
    return false;
  }
}

export async function dailyContentHandler(req: Request, res: Response) {
  try {
    if (!await authorizeScheduledRequest(req)) return res.status(403).json({ error: "cron-only" });
    const manifest = await ensureDailyContent();
    return res.json({ ok: true, date: manifest.date, generated: manifest.games.length, version: "2" });
  } catch (error) {
    logger.error("cron:daily", "Content generation failed", error);
    return res.status(500).json({ error: "daily-generation-failed" });
  }
}

export async function dailyCleanupHandler(req: Request, res: Response) {
  try {
    if (!await authorizeScheduledRequest(req)) return res.status(403).json({ error: "cron-only" });
    const removed = await cleanupDailyContent();
    return res.json({ ok: true, removed, retentionDays: 90 });
  } catch (error) {
    logger.error("cron:cleanup", "Cleanup failed", error);
    return res.status(500).json({ error: "daily-cleanup-failed" });
  }
}
