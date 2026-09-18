import { useState, useEffect } from "react";
import type { SiteLocale } from "@/lib/i18n";
import type { VakaGameMode, VakaDetailedCase } from "@shared/vakaTypes";
import { VAKA_SAMPLE_CASES } from "@shared/vakaCases";
import { trpc } from "@/lib/trpc";
import { getSavedVakaMode, saveVakaMode } from "@/lib/vakaEngine";
import VakaDossier from "./vaka/VakaDossier";
import VakaInterrogation from "./vaka/VakaInterrogation";
import VakaContradiction from "./vaka/VakaContradiction";
import VakaDailyBoard from "./vaka/VakaDailyBoard";
import VakaVerdictModal from "./vaka/VakaVerdictModal";

type Props = {
  locale: SiteLocale;
  soundOn: boolean;
  onSolved?: (score: number) => void;
};

export default function VakaHub({ locale, soundOn, onSolved }: Props) {
  const isEn = locale === "en";

  // tRPC Konfigürasyon ve Vaka sorguları
  const configQuery = trpc.vaka.config.useQuery(undefined, { staleTime: 60_000 });
  const dailyQuery = trpc.vaka.getDailyCase.useQuery(undefined, { staleTime: 60_000 });

  const allowedModes = configQuery.data?.enabledModes || ["daily", "interrogation", "contradiction"];
  const defaultMode = configQuery.data?.defaultMode || "daily";

  const [activeMode, setActiveMode] = useState<VakaGameMode | "dossier">(() =>
    getSavedVakaMode(allowedModes, defaultMode)
  );

  const [selectedCaseId, setSelectedCaseId] = useState<string>(VAKA_SAMPLE_CASES[0].id);
  const [indictSuspectId, setIndictSuspectId] = useState<string | undefined>(undefined);
  const [showVerdictModal, setShowVerdictModal] = useState(false);

  // Aktif vaka verisi
  const activeCase: VakaDetailedCase =
    VAKA_SAMPLE_CASES.find((c) => c.id === selectedCaseId) || VAKA_SAMPLE_CASES[0];

  const handleModeChange = (mode: VakaGameMode | "dossier") => {
    setActiveMode(mode);
    if (mode !== "dossier") {
      saveVakaMode(mode);
    }
  };

  const handleOpenVerdict = (suspectId?: string) => {
    setIndictSuspectId(suspectId);
    setShowVerdictModal(true);
  };

  return (
    <div className="vaka-hub-container">
      {/* Vaka Merkezi Üst Çubuğu & Vaka Seçici */}
      <div className="vaka-hub-topbar">
        <div className="vaka-hub-title-block">
          <span className="vaka-hub-badge">SELY INVESTIGATION BUREAU</span>
          <h2>{isEn ? activeCase.titleEn : activeCase.title}</h2>
          <p className="vaka-hub-meta">
            📍 {isEn ? activeCase.locationEn : activeCase.location} • ⏰ {activeCase.incidentTime} • 🎯 {activeCase.difficulty.toUpperCase()}
          </p>
        </div>

        {/* 8 Zengin Vaka Arasında Geçiş Seçicisi */}
        <div className="vaka-case-picker">
          <label>{isEn ? "Select Case File:" : "Vaka Dosyası Seç:"}</label>
          <select
            className="vaka-case-select"
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
          >
            {VAKA_SAMPLE_CASES.map((c, index) => (
              <option key={c.id} value={c.id}>
                #{index + 1}: {isEn ? c.titleEn : c.title} ({c.difficulty})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Ana Sekme Çubuğu */}
      <div className="vaka-hub-nav-tabs">
        <button
          type="button"
          className={`vaka-nav-tab ${activeMode === "dossier" ? "is-active" : ""}`}
          onClick={() => handleModeChange("dossier")}
        >
          📂 {isEn ? "Case Dossier & Timeline" : "Vaka Dosyası & Olay Yeri"}
        </button>

        {allowedModes.includes("interrogation") && (
          <button
            type="button"
            className={`vaka-nav-tab ${activeMode === "interrogation" ? "is-active" : ""}`}
            onClick={() => handleModeChange("interrogation")}
          >
            🎙️ {isEn ? "Interrogation Room" : "Sorgu Odası (Canlı AI)"}
          </button>
        )}

        {allowedModes.includes("contradiction") && (
          <button
            type="button"
            className={`vaka-nav-tab ${activeMode === "contradiction" ? "is-active" : ""}`}
            onClick={() => handleModeChange("contradiction")}
          >
            ⚖️ {isEn ? "Contradiction Hunt" : "Çelişki Avı (Phoenix)"}
          </button>
        )}

        {allowedModes.includes("daily") && (
          <button
            type="button"
            className={`vaka-nav-tab ${activeMode === "daily" ? "is-active" : ""}`}
            onClick={() => handleModeChange("daily")}
          >
            📅 {isEn ? "Daily Mystery" : "Günün Vakası"}
          </button>
        )}

        <button
          type="button"
          className="vaka-nav-tab vaka-indict-tab"
          onClick={() => handleOpenVerdict()}
        >
          🏛️ {isEn ? "Formal Indictment" : "Mahkemede Suçla"}
        </button>
      </div>

      {/* Aktif Mod Ekranı */}
      <div className="vaka-hub-content-area">
        {activeMode === "dossier" && (
          <VakaDossier vakaCase={activeCase} locale={locale} />
        )}

        {activeMode === "interrogation" && (
          <VakaInterrogation
            vakaCase={activeCase}
            locale={locale}
            soundOn={soundOn}
            onOpenVerdict={handleOpenVerdict}
            onSolved={onSolved}
          />
        )}

        {activeMode === "contradiction" && (
          <VakaContradiction
            vakaCase={activeCase}
            locale={locale}
            soundOn={soundOn}
            onSolved={onSolved}
          />
        )}

        {activeMode === "daily" && (
          <VakaDailyBoard
            vakaCase={dailyQuery.data?.case as any || activeCase}
            caseIndex={dailyQuery.data?.caseIndex || 1}
            dateStr={dailyQuery.data?.date || new Date().toISOString().split("T")[0]}
            locale={locale}
            soundOn={soundOn}
            onSolved={onSolved}
          />
        )}
      </div>

      {/* Mahkeme & Duruşma Modali */}
      {showVerdictModal && (
        <VakaVerdictModal
          vakaCase={activeCase}
          locale={locale}
          soundOn={soundOn}
          defaultSuspectId={indictSuspectId}
          onClose={() => setShowVerdictModal(false)}
          onSolved={onSolved}
        />
      )}
    </div>
  );
}
