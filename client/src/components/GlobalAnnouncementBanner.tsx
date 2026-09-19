import { useEffect, useState } from "react";
import { Megaphone, X, ArrowUpRight } from "lucide-react";
import type { SiteLocale } from "@/lib/i18n";

export interface AppAnnouncement {
  enabled: boolean;
  textTr: string;
  textEn: string;
  link?: string;
  badgeTr?: string;
  badgeEn?: string;
}

interface GlobalAnnouncementBannerProps {
  locale: SiteLocale;
}

export default function GlobalAnnouncementBanner({ locale }: GlobalAnnouncementBannerProps) {
  const [announcement, setAnnouncement] = useState<AppAnnouncement | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data?.announcement?.enabled) {
          const ann = data.announcement as AppAnnouncement;
          // Check if user previously dismissed this exact message
          const dismissKey = `sely-dismissed-announcement-${ann.textEn || ann.textTr}`;
          try {
            if (sessionStorage.getItem(dismissKey)) {
              return;
            }
          } catch {
            // SessionStorage may be disabled
          }
          setAnnouncement(ann);
        }
      })
      .catch(() => {
        // Silently ignore config fetch errors
      });

    return () => {
      active = false;
    };
  }, []);

  if (!announcement || dismissed) return null;

  const isEn = locale === "en";
  const message = isEn ? announcement.textEn || announcement.textTr : announcement.textTr || announcement.textEn;
  const badge = isEn ? announcement.badgeEn || "ANNOUNCEMENT" : announcement.badgeTr || "DUYURU";

  const handleDismiss = () => {
    setDismissed(true);
    try {
      const dismissKey = `sely-dismissed-announcement-${announcement.textEn || announcement.textTr}`;
      sessionStorage.setItem(dismissKey, "1");
    } catch {
      // Ignore
    }
  };

  return (
    <aside className="global-announcement-bar" role="alert" aria-live="polite">
      <div className="announcement-content">
        <span className="announcement-badge">
          <Megaphone size={12} className="announcement-icon" />
          {badge}
        </span>
        <span className="announcement-text">{message}</span>
        {announcement.link && (
          <a href={announcement.link} className="announcement-link">
            {isEn ? "Details" : "Detaylar"} <ArrowUpRight size={13} />
          </a>
        )}
      </div>
      <button
        type="button"
        className="announcement-close-btn"
        onClick={handleDismiss}
        aria-label={isEn ? "Dismiss announcement" : "Duyuruyu kapat"}
      >
        <X size={15} />
      </button>
    </aside>
  );
}
