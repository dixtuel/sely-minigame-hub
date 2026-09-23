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
    const CONFIG_CACHE_KEY = "sely_global_config_cache";
    const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    const applyAnnouncement = (data: any) => {
      if (!active || !data?.announcement?.enabled) return;
      const ann = data.announcement as AppAnnouncement;
      const dismissKey = `sely-dismissed-announcement-${ann.textEn || ann.textTr}`;
      try {
        if (sessionStorage.getItem(dismissKey)) return;
      } catch {}
      setAnnouncement(ann);
    };

    try {
      const cached = sessionStorage.getItem(CONFIG_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CONFIG_CACHE_TTL) {
          applyAnnouncement(parsed.data);
          return;
        }
      }
    } catch {}

    fetch("/api/config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          try {
            sessionStorage.setItem(
              CONFIG_CACHE_KEY,
              JSON.stringify({ data, timestamp: Date.now() })
            );
          } catch {}
          applyAnnouncement(data);
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
