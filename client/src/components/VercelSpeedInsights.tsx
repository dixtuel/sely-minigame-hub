import { SpeedInsights } from "@vercel/speed-insights/react";
import { useCookieConsent } from "@/contexts/CookieConsentContext";
import { useLocation } from "wouter";
import { useMemo } from "react";

/**
 * Checks whether Vercel Speed Insights is explicitly enabled via environment variable.
 * Opt-in only and zero hardcoded IDs: clones and local environments emit no performance beacons.
 */
export function isSpeedInsightsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    import.meta.env.VITE_ENABLE_VERCEL_SPEED_INSIGHTS === "true" ||
    import.meta.env.VITE_ENABLE_VERCEL_SPEED_INSIGHTS === "1"
  );
}

/**
 * Computes canonical route template for Speed Insights.
 * Maps dynamic game paths (/play/:game) to /play/[game]
 * so Vercel Speed Insights clusters metrics by route cleanly on mobile and desktop.
 */
function getCanonicalRoute(pathname: string): string {
  const path = pathname || "/";
  if (/^\/play\/[^/]+$/.test(path)) {
    return "/play/[game]";
  }
  if (/^\/en\/play\/[^/]+$/.test(path)) {
    return "/en/play/[game]";
  }
  return path;
}

/**
 * Optional sample rate (0.0 to 1.0) to manage free tier event quota (10,000 events / 30 days).
 * Defaults to undefined (100% full sampling as per Vercel defaults) unless configured via env.
 */
function getSampleRate(): number | undefined {
  const envVal = import.meta.env.VITE_VERCEL_SPEED_INSIGHTS_SAMPLE_RATE;
  if (!envVal) return undefined;
  const parsed = parseFloat(envVal);
  return !isNaN(parsed) && parsed >= 0 && parsed <= 1 ? parsed : undefined;
}

/**
 * VercelSpeedInsights component:
 * - Monitors Core Web Vitals (LCP, INP, CLS) across desktop and mobile devices.
 * - Dynamic route tracking for mobile and desktop SPA navigations (/play/[game]).
 * - Configurable sampleRate for Free tier / Hobby plan quota management without hardcoded numbers.
 * - Respects Cookie Consent preferences: drops vitals if cookies/tracking rejected.
 * - Safely no-ops when not explicitly enabled via VITE_ENABLE_VERCEL_SPEED_INSIGHTS.
 */
export default function VercelSpeedInsights() {
  const { status } = useCookieConsent();
  const [pathname] = useLocation();
  const route = useMemo(() => getCanonicalRoute(pathname), [pathname]);
  const sampleRate = useMemo(() => getSampleRate(), []);

  if (!isSpeedInsightsEnabled()) {
    return null;
  }

  return (
    <SpeedInsights
      route={route}
      sampleRate={sampleRate}
      beforeSend={(event) => {
        if (status === "rejected") {
          return null;
        }
        // Filter non-user-facing or API endpoints from metrics
        if (event.url && (event.url.includes("/api/") || event.url.includes("/admin"))) {
          return null;
        }
        return event;
      }}
    />
  );
}

