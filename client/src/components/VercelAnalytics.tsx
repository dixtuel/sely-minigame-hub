import { Analytics, type BeforeSendEvent } from "@vercel/analytics/react";
import { isAnalyticsEnabled } from "@/lib/analytics";
import { useCookieConsent } from "@/contexts/CookieConsentContext";
import { useLocation } from "wouter";
import { useMemo, useRef } from "react";

/**
 * Computes canonical route and path for Vercel Web Analytics in SPA environments.
 * Groups parameterized game routes under /play/[game] and /en/play/[game]
 * so mobile and desktop dashboards aggregate clean route analytics without fragmentation.
 */
function getCanonicalRoute(pathname: string): { route: string; path: string } {
  const path = pathname || "/";
  if (/^\/play\/[^/]+$/.test(path)) {
    return { route: "/play/[game]", path };
  }
  if (/^\/en\/play\/[^/]+$/.test(path)) {
    return { route: "/en/play/[game]", path };
  }
  return { route: path, path };
}

/**
 * VercelAnalytics component:
 * - Fully opt-in via VITE_ENABLE_VERCEL_ANALYTICS environment variable.
 * - Zero hardcoding: Uses Vercel's native origin-scoped endpoints without storing IDs.
 * - Mobile & SPA Compatible: Synchronizes dynamic pageviews on mobile navigations and route changes.
 * - Respects Cookie Consent: If the user explicitly rejects cookies/tracking, events are dropped via beforeSend.
 * - Self-hosted / local / cloned repos: Safe no-op, injects nothing if not enabled.
 */
export default function VercelAnalytics() {
  const { status } = useCookieConsent();
  const [pathname] = useLocation();
  const { route, path } = useMemo(() => getCanonicalRoute(pathname), [pathname]);
  const lastPathRef = useRef<string | null>(null);

  if (!isAnalyticsEnabled()) {
    return null;
  }

  return (
    <Analytics
      route={route}
      path={path}
      beforeSend={(event: BeforeSendEvent) => {
        if (status === "rejected") {
          return null;
        }
        // Deduplicate rapid mobile re-renders on the exact same path
        if (event.type === "pageview" && event.url === lastPathRef.current) {
          return null;
        }
        if (event.type === "pageview") {
          lastPathRef.current = event.url;
        }
        return event;
      }}
    />
  );
}

