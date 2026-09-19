import type { Request, Response } from "express";
import { getAll } from "@vercel/global-config";

export interface AppAnnouncement {
  enabled: boolean;
  textTr: string;
  textEn: string;
  link?: string;
  badgeTr?: string;
  badgeEn?: string;
}

export interface AppGlobalConfig {
  maintenance?: boolean;
  maintenanceMessageTr?: string;
  maintenanceMessageEn?: string;
  announcement?: AppAnnouncement | null;
  flags?: Record<string, boolean>;
  source: "global-config" | "fallback";
}

const DEFAULT_CONFIG: AppGlobalConfig = {
  maintenance: false,
  announcement: null,
  flags: {},
  source: "fallback",
};

// 15-second micro in-memory cache to save Global Config read quota
let cachedConfig: AppGlobalConfig | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 15_000;

export async function fetchGlobalConfig(): Promise<AppGlobalConfig> {
  const now = Date.now();
  if (cachedConfig && now - lastFetchTime < CACHE_TTL_MS) {
    return cachedConfig;
  }

  const connectionString = process.env.GLOBAL_CONFIG || process.env.EDGE_CONFIG;
  if (!connectionString) {
    return DEFAULT_CONFIG;
  }

  try {
    const rawItems = (await getAll()) as Record<string, unknown>;
    if (!rawItems || typeof rawItems !== "object") {
      return DEFAULT_CONFIG;
    }

    const config: AppGlobalConfig = {
      maintenance: Boolean(rawItems.maintenance ?? false),
      maintenanceMessageTr: typeof rawItems.maintenanceMessageTr === "string" ? rawItems.maintenanceMessageTr : undefined,
      maintenanceMessageEn: typeof rawItems.maintenanceMessageEn === "string" ? rawItems.maintenanceMessageEn : undefined,
      announcement: (rawItems.announcement as AppAnnouncement) || null,
      flags: (rawItems.flags as Record<string, boolean>) || {},
      source: "global-config",
    };

    cachedConfig = config;
    lastFetchTime = now;
    return config;
  } catch (err) {
    // Graceful fallback on network or parse error
    return DEFAULT_CONFIG;
  }
}

/**
 * Express handler for GET /api/config
 */
export async function getGlobalConfigHandler(_req: Request, res: Response) {
  // Edge CDN cache: 5m browser, 10m Edge CDN, 30m stale-while-revalidate
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600, stale-while-revalidate=1800");

  try {
    const config = await fetchGlobalConfig();
    return res.json(config);
  } catch {
    return res.json(DEFAULT_CONFIG);
  }
}
