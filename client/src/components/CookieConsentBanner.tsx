import { useCookieConsent } from "@/contexts/CookieConsentContext";
import { browserLocale } from "@/lib/i18n";
import { Cookie, X } from "lucide-react";

export default function CookieConsentBanner() {
  const { isBannerOpen, status, accept, reject, closeBanner } = useCookieConsent();
  const locale = browserLocale();
  const isEn = locale === "en";

  if (!isBannerOpen) return null;

  return (
    <div
      className="cookie-banner"
      role="dialog"
      aria-modal="false"
      aria-label={isEn ? "Cookie and Advertising Consent" : "Çerez ve Reklam İzni"}
    >
      <div className="cookie-banner-header">
        <div className="cookie-banner-title">
          <Cookie size={16} aria-hidden="true" />
          <span>{isEn ? "COOKIE & AD SETTINGS" : "ÇEREZ VE REKLAM AYARLARI"}</span>
        </div>
        {status !== null && (
          <button
            type="button"
            className="cookie-banner-close"
            onClick={closeBanner}
            aria-label={isEn ? "Close" : "Kapat"}
          >
            <X size={15} />
          </button>
        )}
      </div>

      <p className="cookie-banner-copy">
        {isEn
          ? "SELY.TR stores game scores and settings locally in your browser. Additionally, Google AdSense uses cookies and device identifiers to deliver and measure advertisements. You can accept advertising cookies or reject them to continue with strictly essential local storage."
          : "SELY.TR; oyun puanlarınızı ve ilerlemenizi tarayıcınızda yerel olarak saklar. Ayrıca sitede Google AdSense aracılığıyla sunulan reklamlar için kişiselleştirme ve ölçümleme çerezleri kullanılmaktadır. Reklam çerezlerini kabul edebilir veya yalnızca zorunlu yerel depolama ile devam etmek için reddedebilirsiniz."}
        {" "}
        <a href={isEn ? "/en/privacy" : "/privacy"}>
          {isEn ? "Privacy & KVKK Policy" : "Gizlilik ve KVKK Politikası"}
        </a>
      </p>

      <div className="cookie-banner-actions">
        <button type="button" className="cookie-banner-reject" onClick={reject}>
          {isEn ? "Reject (Essential Only)" : "Yalnızca Zorunlular (Reddet)"}
        </button>
        <button type="button" className="cookie-banner-accept" onClick={accept}>
          {isEn ? "Accept All" : "Tümünü Kabul Et"}
        </button>
      </div>
    </div>
  );
}
