import { useState } from "react";
import type { VakaDetailedCase } from "@shared/vakaTypes";
import type { SiteLocale } from "@/lib/i18n";

type Props = {
  vakaCase: VakaDetailedCase;
  locale: SiteLocale;
};

export default function VakaDossier({ vakaCase, locale }: Props) {
  const isEn = locale === "en";

  const [unlockedMap] = useState<Record<string, boolean>>(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(`sely_vaka_unlocked_${vakaCase.id}`);
        if (saved) return JSON.parse(saved);
      }
    } catch {}
    return {};
  });

  const isSuspectUnlocked = (suspect: any) => {
    if (!suspect.isInitiallyLocked) return true;
    return Boolean(unlockedMap[suspect.id]);
  };

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

      {/* Şüpheliler & İlgili Kişiler Tablosu */}
      <div className="vaka-dossier-card vaka-suspects-card">
        <div className="vaka-card-badge">{isEn ? "PERSONS OF INTEREST & SUSPECTS" : "ŞÜPHELİLER & İLGİLİ KİŞİLER"}</div>
        <div className="vaka-dossier-suspect-grid">
          {vakaCase.suspects.map((s) => {
            const unlocked = isSuspectUnlocked(s);
            if (!unlocked) {
              return (
                <div key={s.id} className="vaka-dossier-suspect-item is-locked">
                  <div className="vaka-dossier-avatar locked-avatar">🔒</div>
                  <div className="vaka-dossier-suspect-info">
                    <div className="vaka-dossier-name-row">
                      <span className="vaka-locked-title">??? {isEn ? "UNKNOWN PERSON OF INTEREST" : "GİZLİ / KİLİTLİ ŞÜPHELİ"}</span>
                      <span className="vaka-locked-badge">{isEn ? "LOCKED" : "KİLİTLİ"}</span>
                    </div>
                    <p className="vaka-locked-hint">
                      💡 {isEn ? s.unlockCondition?.hintEn || "Discovered through interrogation or testimony." : s.unlockCondition?.hintTr || "Sorgularda veya ifadelerde adı geçtiğinde açılır."}
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div key={s.id} className="vaka-dossier-suspect-item">
                <div className="vaka-dossier-avatar">{s.name.charAt(0)}</div>
                <div className="vaka-dossier-suspect-info">
                  <div className="vaka-dossier-name-row">
                    <b>{s.name}</b>
                    <span className="vaka-dossier-role-tag">{isEn ? s.roleEn || s.role : s.role}</span>
                  </div>
                  <small className="vaka-dossier-relation">{isEn ? s.relationshipToVictimEn || s.relationshipToVictim : s.relationshipToVictim}</small>
                  <p className="vaka-dossier-statement-preview">"{isEn ? s.statementEn || s.statement : s.statement}"</p>
                </div>
              </div>
            );
          })}
        </div>
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
