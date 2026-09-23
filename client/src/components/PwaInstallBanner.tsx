import { useEffect, useState, useCallback } from "react";
import { Download, Share, X, Smartphone, Monitor, Globe } from "lucide-react";
import { type SiteLocale } from "@/lib/i18n";
import { trackEvent } from "@/lib/analytics";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISS_KEY = "sely-pwa-dismissed-v2";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type PwaTarget =
  | "chromium-desktop"   // Chrome, Edge, Brave, Opera, Vivaldi on Windows/Linux/macOS
  | "chromium-android"   // Chrome/Edge on Android
  | "ios-safari"         // iOS Safari
  | "firefox-desktop"    // Firefox on Linux/Windows/macOS
  | "none";

function detectPwaTarget(): PwaTarget {
  if (typeof window === "undefined") return "none";

  const ua = navigator.userAgent.toLowerCase();
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  if (isStandalone) return "none";

  // iOS Safari
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/crios|fxios|chrome/.test(ua);
  if (isIos && isSafari) return "ios-safari";

  // Firefox desktop (not mobile Firefox)
  const isFirefox = /firefox/.test(ua) && !/fxios/.test(ua);
  const isMobile = /android|mobile|tablet/.test(ua);
  if (isFirefox && !isMobile) return "firefox-desktop";

  // Android Chromium
  const isAndroid = /android/.test(ua);
  const isChromium = /chrome|chromium|edg|opr|brave|vivaldi/.test(ua);
  if (isAndroid && isChromium) return "chromium-android";

  // Desktop Chromium (Windows, Linux, macOS)
  if (isChromium && !isMobile) return "chromium-desktop";

  return "none";
}

function detectOS(): "windows" | "linux" | "macos" | "unknown" {
  if (typeof navigator === "undefined") return "unknown";
  const platform = (navigator.platform || "").toLowerCase();
  const ua = navigator.userAgent.toLowerCase();
  if (platform.startsWith("win") || ua.includes("windows")) return "windows";
  if (platform.startsWith("linux") || ua.includes("linux")) return "linux";
  if (platform.startsWith("mac") || ua.includes("macintosh")) return "macos";
  return "unknown";
}

export default function PwaInstallBanner({ locale = "tr", enabled = false }: { locale?: SiteLocale; enabled?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [target, setTarget] = useState<PwaTarget>("none");
  const [showGuide, setShowGuide] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [os, setOs] = useState<"windows" | "linux" | "macos" | "unknown">("unknown");

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const detected = detectPwaTarget();
    if (detected === "none") return;

    setTarget(detected);
    setOs(detectOS());

    // Check if user dismissed recently
    try {
      const dismissedTime = localStorage.getItem(DISMISS_KEY);
      if (dismissedTime && Date.now() - Number(dismissedTime) < DISMISS_DURATION_MS) {
        return;
      }
    } catch {
      // ignore storage error
    }

    // iOS Safari & Firefox desktop: show after a brief delay
    if (detected === "ios-safari" || detected === "firefox-desktop") {
      const timer = setTimeout(() => setIsVisible(true), 3500);
      return () => clearTimeout(timer);
    }

    // Chromium-based: capture beforeinstallprompt
    if (detected === "chromium-desktop" || detected === "chromium-android") {
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setIsVisible(true);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      };
    }
  }, [enabled]);

  const handleInstallClick = useCallback(async () => {
    if (target === "ios-safari") {
      setShowGuide(true);
      trackEvent("pwa_ios_guide_open");
      return;
    }

    if (target === "firefox-desktop") {
      setShowGuide(true);
      trackEvent("pwa_firefox_guide_open", { os });
      return;
    }

    if (!deferredPrompt) return;

    trackEvent("pwa_install_prompt_click", { target, os });
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    trackEvent("pwa_install_outcome", { outcome, target, os });

    if (outcome === "accepted") {
      setIsVisible(false);
      setDeferredPrompt(null);
    }
  }, [target, deferredPrompt, os]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {
      // ignore
    }
    trackEvent("pwa_install_dismissed", { target, os });
  }, [target, os]);

  if (!enabled || !isVisible) return null;

  const isTr = locale === "tr";

  return (
    <aside
      className="pwa-install-banner"
      role="region"
      aria-label={isTr ? "Uygulama yükleme bildirimi" : "App install notification"}
    >
      <div className="pwa-banner-main">
        <div className="pwa-banner-icon-wrap">
          <img
            src="/icons/icon-192x192.png"
            alt="SELY"
            width="40"
            height="40"
            className="pwa-banner-icon"
          />
        </div>
        <div className="pwa-banner-text">
          <strong>SELY — MiniGame Hub</strong>
          <p>
            {target === "chromium-desktop"
              ? (isTr
                ? "Masaüstü uygulaması olarak yükleyin — tarayıcı çubuğu olmadan, bağımsız pencerede oynayın."
                : "Install as a desktop app — play in a standalone window without the browser toolbar.")
              : target === "firefox-desktop"
              ? (isTr
                ? "Firefox'ta masaüstü uygulaması olarak yükleyebilirsiniz."
                : "You can install this as a desktop app in Firefox.")
              : target === "ios-safari"
              ? (isTr
                ? "Uygulama olarak yükleyin, ana ekranınızdan doğrudan oynayın."
                : "Install as an app to launch directly from your home screen.")
              : (isTr
                ? "Uygulama olarak yükleyin, sıfır internet gecikmesiyle doğrudan ana ekranınızdan oynayın."
                : "Install as an app to launch instantly and play offline from your home screen.")}
          </p>

          {/* iOS Safari Guide */}
          {showGuide && target === "ios-safari" && (
            <div className="pwa-ios-guide-box">
              <span>
                {isTr ? (
                  <>
                    Safari alt çubuğundaki <Share size={13} style={{ display: "inline", verticalAlign: "middle" }} /> <strong>Paylaş</strong> butonuna dokunun, ardından <strong>"Ana Ekrana Ekle"</strong>yi seçin.
                  </>
                ) : (
                  <>
                    Tap the <Share size={13} style={{ display: "inline", verticalAlign: "middle" }} /> <strong>Share</strong> button in Safari, then select <strong>"Add to Home Screen"</strong>.
                  </>
                )}
              </span>
            </div>
          )}

          {/* Firefox Desktop Guide — OS-specific */}
          {showGuide && target === "firefox-desktop" && (
            <div className="pwa-firefox-guide-box">
              {os === "windows" ? (
                <div className="pwa-guide-steps">
                  <span className="pwa-guide-step-title">
                    {isTr ? "Windows — Firefox Web Apps" : "Windows — Firefox Web Apps"}
                  </span>
                  <ol className="pwa-guide-list">
                    <li>
                      {isTr
                        ? "Firefox menüsünden (☰) → \"Siteyi uygulama olarak kur\" veya adres çubuğundaki 📥 simgesini kullanın."
                        : "From the Firefox menu (☰) → \"Install site as app\" or use the 📥 icon in the address bar."}
                    </li>
                    <li>
                      {isTr ? (
                        <>
                          Bu seçenek görünmüyorsa <a href="https://addons.mozilla.org/firefox/addon/pwas-for-firefox/" target="_blank" rel="noopener noreferrer">PWAs for Firefox</a> eklentisini kurup, <a href="https://github.com/filips123/PWAsForFirefox/releases" target="_blank" rel="noopener noreferrer">native aracı</a> (MSI) indirin.
                        </>
                      ) : (
                        <>
                          If not visible, install <a href="https://addons.mozilla.org/firefox/addon/pwas-for-firefox/" target="_blank" rel="noopener noreferrer">PWAs for Firefox</a> extension + <a href="https://github.com/filips123/PWAsForFirefox/releases" target="_blank" rel="noopener noreferrer">native connector</a> (MSI).
                        </>
                      )}
                    </li>
                  </ol>
                </div>
              ) : os === "linux" ? (
                <div className="pwa-guide-steps">
                  <span className="pwa-guide-step-title">
                    {isTr ? "Linux — PWAs for Firefox" : "Linux — PWAs for Firefox"}
                  </span>
                  <ol className="pwa-guide-list">
                    <li>
                      {isTr ? (
                        <>
                          <a href="https://addons.mozilla.org/firefox/addon/pwas-for-firefox/" target="_blank" rel="noopener noreferrer">PWAs for Firefox</a> eklentisini Firefox'a ekleyin.
                        </>
                      ) : (
                        <>
                          Add the <a href="https://addons.mozilla.org/firefox/addon/pwas-for-firefox/" target="_blank" rel="noopener noreferrer">PWAs for Firefox</a> extension.
                        </>
                      )}
                    </li>
                    <li>
                      {isTr ? (
                        <>Native aracı kurun: <code>sudo apt install firefoxpwa</code> veya <code>yay -S AUR/firefoxpwa-bin</code></>
                      ) : (
                        <>Install native tool: <code>sudo apt install firefoxpwa</code> or <code>yay -S AUR/firefoxpwa-bin</code></>
                      )}
                    </li>
                    <li>
                      {isTr
                        ? "Adres çubuğundaki 📥 simgesine tıklayarak SELY'yi uygulama olarak yükleyin."
                        : "Click the 📥 icon in the address bar to install SELY as an app."}
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="pwa-guide-steps">
                  <span className="pwa-guide-step-title">
                    {isTr ? "Firefox — PWA Desteği" : "Firefox — PWA Support"}
                  </span>
                  <span>
                    {isTr ? (
                      <>
                        <a href="https://addons.mozilla.org/firefox/addon/pwas-for-firefox/" target="_blank" rel="noopener noreferrer">PWAs for Firefox</a> eklentisi + native aracıyla SELY'yi masaüstü uygulaması olarak kullanabilirsiniz.
                      </>
                    ) : (
                      <>
                        Use <a href="https://addons.mozilla.org/firefox/addon/pwas-for-firefox/" target="_blank" rel="noopener noreferrer">PWAs for Firefox</a> extension + native connector to install SELY as a desktop app.
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="pwa-banner-actions">
        <button
          type="button"
          className="pwa-install-btn"
          onClick={handleInstallClick}
        >
          {target === "ios-safari" ? (
            <>
              <Smartphone size={14} />
              <span>{isTr ? "Nasıl Yüklenir?" : "How to Install?"}</span>
            </>
          ) : target === "firefox-desktop" ? (
            <>
              <Globe size={14} />
              <span>{isTr ? "Nasıl Yüklenir?" : "How to Install?"}</span>
            </>
          ) : target === "chromium-desktop" ? (
            <>
              <Monitor size={14} />
              <span>{isTr ? "Uygulamayı Yükle" : "Install App"}</span>
            </>
          ) : (
            <>
              <Download size={14} />
              <span>{isTr ? "Yükle" : "Install"}</span>
            </>
          )}
        </button>
        <button
          type="button"
          className="pwa-dismiss-btn"
          onClick={handleDismiss}
          aria-label={isTr ? "Kapat" : "Dismiss"}
          title={isTr ? "Kapat" : "Dismiss"}
        >
          <X size={16} />
        </button>
      </div>
    </aside>
  );
}
