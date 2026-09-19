import { Analytics, type BeforeSendEvent } from "@vercel/analytics/react";
import { isAnalyticsEnabled } from "@/lib/analytics";
import { useCookieConsent } from "@/contexts/CookieConsentContext";

/**
 * VercelAnalytics component:
 * - Fully opt-in via VITE_ENABLE_VERCEL_ANALYTICS environment variable.
 * - Zero hardcoding: Uses Vercel's native origin-scoped endpoints without storing IDs.
 * - Respects Cookie Consent: If the user explicitly rejects cookies/tracking, events are dropped via beforeSend.
 * - Self-hosted / local / cloned repos: Safe no-op, injects nothing if not enabled.
 */
export default function VercelAnalytics() {
  const { status } = useCookieConsent();

  if (!isAnalyticsEnabled()) {
    return null;
  }

  return (
    <Analytics
      beforeSend={(event: BeforeSendEvent) => {
        if (status === "rejected") {
          return null;
        }
        return event;
      }}
    />
  );
}
