import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type CookieConsentStatus = "accepted" | "rejected" | null;

const STORAGE_KEY = "sely-cookie-consent";

function readStoredConsent(): CookieConsentStatus {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "accepted" || value === "rejected" ? value : null;
}

function syncGoogleConsent(status: "accepted" | "rejected") {
  if (typeof window === "undefined") return;
  const w = window as any;
  const granted = status === "accepted";
  if (w.gtag) {
    w.gtag("consent", "update", {
      ad_storage: granted ? "granted" : "denied",
      ad_user_data: granted ? "granted" : "denied",
      ad_personalization: granted ? "granted" : "denied",
      analytics_storage: granted ? "granted" : "denied",
    });
  }
  w.adsbygoogle = w.adsbygoogle || [];
  w.adsbygoogle.requestNonPersonalizedAds = granted ? 0 : 1;
}

type CookieConsentContextValue = {
  status: CookieConsentStatus;
  isBannerOpen: boolean;
  openBanner: () => void;
  closeBanner: () => void;
  accept: () => void;
  reject: () => void;
};

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CookieConsentStatus>(() => readStoredConsent());
  const [isBannerOpen, setIsBannerOpen] = useState<boolean>(() => readStoredConsent() === null);

  useEffect(() => {
    const current = readStoredConsent();
    setStatus(current);
    if (current === null) {
      setIsBannerOpen(true);
    } else {
      syncGoogleConsent(current);
    }
  }, []);

  const accept = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, "accepted");
    setStatus("accepted");
    setIsBannerOpen(false);
    syncGoogleConsent("accepted");
  }, []);

  const reject = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, "rejected");
    setStatus("rejected");
    setIsBannerOpen(false);
    syncGoogleConsent("rejected");
  }, []);

  const openBanner = useCallback(() => {
    setIsBannerOpen(true);
  }, []);

  const closeBanner = useCallback(() => {
    setIsBannerOpen(false);
  }, []);

  return (
    <CookieConsentContext.Provider
      value={{ status, isBannerOpen, openBanner, closeBanner, accept, reject }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error("useCookieConsent must be used within CookieConsentProvider");
  return ctx;
}
