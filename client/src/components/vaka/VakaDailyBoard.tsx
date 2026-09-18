import { useState } from "react";
import type { VakaDetailedCase } from "@shared/vakaTypes";
import type { SiteLocale } from "@/lib/i18n";
import VakaDossier from "./VakaDossier";
import VakaContradiction from "./VakaContradiction";
import VakaVerdictModal from "./VakaVerdictModal";

type Props = {
  vakaCase: VakaDetailedCase;
  caseIndex: number;
  dateStr: string;
  locale: SiteLocale;
  soundOn: boolean;
  onSolved?: (score: number) => void;
};

export default function VakaDailyBoard({
  vakaCase,
  caseIndex,
  dateStr,
  locale,
  soundOn,
  onSolved,
}: Props) {
  const isEn = locale === "en";
  const [subTab, setSubTab] = useState<"dossier" | "hunt" | "indict">("dossier");
  const [showVerdictModal, setShowVerdictModal] = useState(false);

  return (
    <div className="vaka-daily-desk">
      {/* Günün Vakası Özel Başlığı */}
      <div className="vaka-daily-header-card">
        <div className="vaka-daily-meta">
          <span className="vaka-daily-tag">📅 {isEn ? "GLOBAL DAILY MYSTERY" : "GÜNÜN ORTAK VAKASI"} #{caseIndex}</span>
          <span className="vaka-daily-date">{dateStr}</span>
        </div>
        <h2>{isEn ? vakaCase.titleEn : vakaCase.title}</h2>
        <p>{isEn ? vakaCase.briefingEn : vakaCase.briefing}</p>

        {/* Alt Adım Seçici */}
        <div className="vaka-daily-subnav">
          <button
            type="button"
            className={`vaka-subnav-btn ${subTab === "dossier" ? "is-active" : ""}`}
            onClick={() => setSubTab("dossier")}
          >
            📂 {isEn ? "1. Case File & Timeline" : "1. Vaka Dosyası & Kronoloji"}
          </button>
          <button
            type="button"
            className={`vaka-subnav-btn ${subTab === "hunt" ? "is-active" : ""}`}
            onClick={() => setSubTab("hunt")}
          >
            ⚖️ {isEn ? "2. Expose Contradiction" : "2. Çelişkiyi Çökert"}
          </button>
          <button
            type="button"
            className="vaka-subnav-btn vaka-subnav-indict"
            onClick={() => setShowVerdictModal(true)}
          >
            🏛️ {isEn ? "3. Court Indictment" : "3. Mahkemede Suçla"}
          </button>
        </div>
      </div>

      {/* Alt Ekranlar */}
      {subTab === "dossier" && <VakaDossier vakaCase={vakaCase} locale={locale} />}
      {subTab === "hunt" && (
        <VakaContradiction
          vakaCase={vakaCase}
          locale={locale}
          soundOn={soundOn}
          onSolved={onSolved}
        />
      )}

      {showVerdictModal && (
        <VakaVerdictModal
          vakaCase={vakaCase}
          locale={locale}
          soundOn={soundOn}
          onClose={() => setShowVerdictModal(false)}
          onSolved={onSolved}
        />
      )}
    </div>
  );
}
