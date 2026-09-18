import type { VakaDetailedCase } from "@shared/vakaTypes";
import type { SiteLocale } from "@/lib/i18n";

type Props = {
  vakaCase: VakaDetailedCase;
  locale: SiteLocale;
};

export default function VakaDossier({ vakaCase, locale }: Props) {
  const isEn = locale === "en";

  return (
    <div className="vaka-dossier-layout">
      {/* Kurban & Olay Yeri Kartı */}
      <div className="vaka-dossier-card vaka-victim-card">
        <div className="vaka-card-badge">{isEn ? "VICTIM & INCIDENT" : "KURBAN & OLAY BİLGİSİ"}</div>
        <div className="vaka-victim-header">
          <div className="vaka-victim-avatar">⚖️</div>
          <div>
            <h3>{vakaCase.victim.name}</h3>
            <p className="vaka-victim-sub">
              {isEn ? vakaCase.victim.occupationEn : vakaCase.victim.occupation} • {isEn ? vakaCase.locationEn : vakaCase.location}
            </p>
          </div>
        </div>
        <div className="vaka-victim-cause">
          <b>{isEn ? "Cause of Death / Crime:" : "Ölüm Nedeni / Suç:"}</b>
          <p>{isEn ? vakaCase.victim.causeOfDeathEn : vakaCase.victim.causeOfDeath}</p>
        </div>
        <p className="vaka-dossier-briefing">{isEn ? vakaCase.briefingEn : vakaCase.briefing}</p>
      </div>

      {/* Olay Yeri İnceleme & Adli Tıp Bulguları */}
      <div className="vaka-dossier-card">
        <div className="vaka-card-badge">{isEn ? "FORENSIC CRIME SCENE" : "OLAY YERİ ADLİ TIP RAPORU"}</div>
        <ul className="vaka-crime-scene-list">
          {(isEn ? vakaCase.crimeSceneNotes.en : vakaCase.crimeSceneNotes.tr).map((note, idx) => (
            <li key={idx} className="vaka-crime-scene-item">
              <span className="vaka-bullet">🔍</span>
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Dakika Dakika Olay Zaman Çizelgesi (Timeline) */}
      <div className="vaka-dossier-card">
        <div className="vaka-card-badge">{isEn ? "CRITICAL TIMELINE" : "ZAMAN ÇİZELGESİ (KRONOLOJİ)"}</div>
        <div className="vaka-timeline-list">
          {vakaCase.timeline.map((event, idx) => (
            <div key={idx} className="vaka-timeline-row">
              <div className="vaka-timeline-time">{event.time}</div>
              <div className="vaka-timeline-content">
                <span className="vaka-timeline-text">{isEn ? event.eventEn : event.event}</span>
                {event.verified && (
                  <span className="vaka-verified-tag">{isEn ? "VERIFIED" : "ONAYLI"}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Adli Analist Notu */}
      <div className="vaka-dossier-card vaka-analyst-card">
        <div className="vaka-card-badge">{isEn ? "LEAD FORENSIC ANALYST" : "BAŞ ADLİ ANALİST DEĞERLENDİRMESİ"}</div>
        <div className="vaka-analyst-quote">
          <p>"{isEn ? vakaCase.analystSummary.en : vakaCase.analystSummary.tr}"</p>
        </div>
      </div>
    </div>
  );
}
