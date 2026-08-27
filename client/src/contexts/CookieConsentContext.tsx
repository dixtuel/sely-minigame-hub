import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type CookieConsentStatus = "accepted" | "rejected" | null;

const STORAGE_KEY = "sely-cookie-consent";

function readStoredConsent(): CookieConsentStatus {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "accepted" || value === "rejected" ? value : null;
}

type CookieConsentContextValue = {
  status: CookieConsentStatus;
  accept: () => void;
  reject: () => void;
};

const CookieConsentContext = createContext<CookieConsentContextValue | null>(null);

export function CookieConsentProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CookieConsentStatus>(() => readStoredConsent());

  useEffect(() => {
    setStatus(readStoredConsent());
  }, []);

  const accept = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, "accepted");
    setStatus("accepted");
  }, []);

  const reject = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, "rejected");
    setStatus("rejected");
  }, []);

  return (
    <CookieConsentContext.Provider value={{ status, accept, reject }}>
      {children}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const ctx = useContext(CookieConsentContext);
  if (!ctx) throw new Error("useCookieConsent must be used within CookieConsentProvider");
  return ctx;
}
