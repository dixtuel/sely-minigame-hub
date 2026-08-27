import { useCookieConsent } from "@/contexts/CookieConsentContext";
import { browserLocale } from "@/lib/i18n";

export default function CookieConsentBanner() {
  const { status, accept, reject } = useCookieConsent();
  const locale = browserLocale();

  if (status !== null) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label={locale === "en" ? "Cookie consent" : "Çerez izni"}>
      <p className="cookie-banner-copy">
        {locale === "en"
          ? "We use cookies for ads and to keep the site running smoothly. You can accept or reject non-essential cookies."
          : "Reklam ve sitenin düzgün çalışması için çerez kullanıyoruz. Zorunlu olmayan çerezleri kabul edebilir ya da reddedebilirsiniz."}
        {" "}
        <a href={locale === "en" ? "/en/privacy" : "/privacy"}>{locale === "en" ? "Privacy Policy" : "Gizlilik Politikası"}</a>
      </p>
      <div className="cookie-banner-actions">
        <button type="button" className="cookie-banner-reject" onClick={reject}>
          {locale === "en" ? "Reject" : "Reddet"}
        </button>
        <button type="button" className="cookie-banner-accept" onClick={accept}>
          {locale === "en" ? "Accept" : "Kabul Et"}
        </button>
      </div>
    </div>
  );
}
