import { track } from "@vercel/analytics";

/**
 * Checks whether Vercel Web Analytics is explicitly enabled via environment variable.
 * Kept strictly opt-in and configurable so public clones / self-hosted instances
 * do not emit unwanted analytics beacons or generate 404 errors.
 */
export function isAnalyticsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return import.meta.env.VITE_ENABLE_VERCEL_ANALYTICS === "true" || import.meta.env.VITE_ENABLE_VERCEL_ANALYTICS === "1";
}

/**
 * Safe wrapper for custom event tracking.
 * - No-op when analytics is not enabled (local dev, self-hosted, or disabled by env).
 * - Catches any exceptions to prevent runtime UI interruption.
 * - Note: Hobby plan includes 2,500 events/month. Custom events are typically Pro plan,
 *   so this wrapper protects quota and avoids throwing errors.
 */
export function trackEvent(
  name: string,
  properties?: Record<string, string | number | boolean | null>
): void {
  if (!isAnalyticsEnabled()) return;
  try {
    track(name, properties);
  } catch {
    // Silent fail to prevent any disruption to gameplay or UI
  }
}
