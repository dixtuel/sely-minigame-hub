import { useEffect, useRef } from "react";
import { useCookieConsent } from "@/contexts/CookieConsentContext";

type AdSenseResultUnitProps = {
  locale?: string;
};

export default function AdSenseResultUnit({ locale = "tr" }: AdSenseResultUnitProps) {
  const adRef = useRef<HTMLModElement | null>(null);
  const pushedRef = useRef(false);
  const { status } = useCookieConsent();

  const clientId =
    import.meta.env.VITE_ADSENSE_CLIENT_ID ||
    import.meta.env.ADSENSE_CLIENT_ID;

  const slotId =
    import.meta.env.VITE_ADSENSE_RESULT_SLOT_ID ||
    import.meta.env.VITE_ADSENSE_SLOT_ID ||
    import.meta.env.ADSENSE_RESULT_SLOT_ID ||
    import.meta.env.ADSENSE_SLOT_ID;

  const formattedClientId =
    clientId && !clientId.startsWith("ca-") ? `ca-${clientId}` : clientId;

  useEffect(() => {
    if (!slotId || !formattedClientId || status !== "accepted" || pushedRef.current) return;

    try {
      if (typeof window !== "undefined") {
        const w = window as any;
        w.adsbygoogle = w.adsbygoogle || [];
        w.adsbygoogle.push({});
        pushedRef.current = true;
      }
    } catch {
      // Gracefully ignore ad blocker errors
    }
  }, [slotId, formattedClientId, status]);

  if (!slotId || !formattedClientId || status !== "accepted") {
    return null;
  }

  return (
    <div
      className="result-ad-wrap"
      aria-label={locale === "en" ? "Sponsored content" : "Sponsorlu içerik"}
    >
      <div className="result-ad-header">
        <span>{locale === "en" ? "SPONSORED" : "SPONSORLU ALAN"}</span>
        <span className="result-ad-badge">{locale === "en" ? "AD" : "REKLAM"}</span>
      </div>
      <div className="result-ad-slot">
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: "block", minHeight: "60px", width: "100%" }}
          data-ad-client={formattedClientId}
          data-ad-slot={slotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
}
