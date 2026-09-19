import { SpeedInsights } from "@vercel/speed-insights/react";
import { useLocation } from "wouter";
import { useMemo } from "react";

/**
 * Checks whether Vercel Speed Insights is enabled.
 * Enabled if explicitly set via env or running in Vercel production deployment.
 */
export function isSpeedInsightsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env.VITE_ENABLE_VERCEL_SPEED_INSIGHTS === "false") return false;
  return (
    import.meta.env.VITE_ENABLE_VERCEL_SPEED_INSIGHTS === "true" ||
    import.meta.env.VITE_ENABLE_VERCEL_SPEED_INSIGHTS === "1" ||
    window.location.hostname === "sely.tr" ||
    window.location.hostname.endsWith(".vercel.app")
  );
}

/**
 * Computes canonical route template for Speed Insights.
 * Maps dynamic game paths (/play/:game and /en/play/:game) to /play/[game]
 * so Vercel Speed Insights clusters metrics by route cleanly on mobile and desktop devices.
 */
function getCanonicalRoute(pathname: string): string {
  const cleanPath = (pathname || "/").split("?")[0].split("#")[0] || "/";
  if (/^\/play\/[^/]+$/.test(cleanPath)) {
    return "/play/[game]";
  }
  if (/^\/en\/play\/[^/]+$/.test(cleanPath)) {
    return "/en/play/[game]";
  }
  return cleanPath;
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
 * - Real User Monitoring (RUM) for Core Web Vitals (LCP, INP, CLS, FCP, FID, TTFB).
 * - Fully compatible with both Mobile and Desktop viewports.
 * - Dynamic route clustering for SPA navigations (/play/[game], /en/play/[game]).
 * - Privacy-compliant by design: Does NOT use cookies or collect personal data,
 *   hence operates independently from advertising cookie consent.
 * - Excludes non-user-facing and API routes via beforeSend.
 */
export default function VercelSpeedInsights() {
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
      debug={import.meta.env.DEV}
      beforeSend={(event) => {
        // Exclude internal endpoints or non-user pages
        if (event.url && (event.url.includes("/api/") || event.url.includes("/admin") || event.url.includes("/health"))) {
          return null;
        }
        return event;
      }}
    />
  );
}

