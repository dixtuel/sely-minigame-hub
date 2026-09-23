import { useState, useEffect } from "react";
import type { SiteLocale } from "@/lib/i18n";
import type { VakaGameMode, VakaDetailedCase } from "@shared/vakaTypes";
import { trpc } from "@/lib/trpc";
import { getSavedVakaMode, saveVakaMode } from "@/lib/vakaEngine";
import { secureStorage } from "@/lib/secureStorage";
import VakaDossier from "./vaka/VakaDossier";
import VakaInterrogation from "./vaka/VakaInterrogation";
import VakaContradiction from "./vaka/VakaContradiction";
import VakaDailyBoard from "./vaka/VakaDailyBoard";
import VakaVerdictModal from "./vaka/VakaVerdictModal";

type Props = {
  locale: SiteLocale;
  soundOn: boolean;
  onSolved?: (score: number) => void;
  isGameFinished?: boolean;
};

export default function VakaHub({ locale, soundOn, onSolved, isGameFinished }: Props) {
  const isEn = locale === "en";

  // tRPC Konfigürasyon ve Vaka sorguları (Ağ verisi tasarrufu için yüksek TTL)
  const configQuery = trpc.vaka.config.useQuery(undefined, { staleTime: Infinity, refetchOnWindowFocus: false });
  // Rust vaka_cases.json is the live canonical source. The old shared TS case array remains only
  // for archived Node tooling/tests and is no longer used to render the production hub.
  const casesQuery = trpc.vaka.getCases.useQuery(undefined, { staleTime: Infinity, refetchOnWindowFocus: false });
  const dailyQuery = trpc.vaka.getDailyCase.useQuery(undefined, { staleTime: 24 * 60 * 60 * 1000, refetchOnWindowFocus: false });

  const allowedModes = configQuery.data?.enabledModes || ["daily", "interrogation", "contradiction"];
  const defaultMode = configQuery.data?.defaultMode || "daily";

  const [activeMode, setActiveMode] = useState<VakaGameMode | "dossier">(() =>
    getSavedVakaMode(allowedModes, defaultMode)
  );

  const [selectedCaseId, setSelectedCaseId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = secureStorage.getItem("sely_vaka_active_case");
      if (saved) return saved;
    }
    return "case-01-atlantis-saati";
  });

  const [completedCases, setCompletedCases] = useState<Record<string, number>>(() => {
    if (typeof window !== "undefined") {
      try {
        return secureStorage.getJSON("sely_vaka_completed_cases", {});
      } catch {}
    }
    return {};
  });

  const [indictSuspectId, setIndictSuspectId] = useState<string | undefined>(undefined);
  const [showVerdictModal, setShowVerdictModal] = useState(false);

  const caseCatalog = casesQuery.data || [];
  const activeCaseIndex = Math.max(0, caseCatalog.findIndex((c) => c.id === selectedCaseId));
  const activeCaseQuery = trpc.vaka.getCaseDetail.useQuery(
    { caseId: selectedCaseId },
    { staleTime: Infinity, refetchOnWindowFocus: false, enabled: Boolean(selectedCaseId) }
  );

  // Aktif vaka ve sonraki vaka verisi artık Rust API'den gelir; böylece UI ve backend farklı
  // vaka gerçekleriyle çalışamaz.
  const currentCaseIndex = Math.max(
    0,
    activeCaseIndex
  );
  const activeCase = activeCaseQuery.data as unknown as VakaDetailedCase | undefined;
  const nextCaseIndex = currentCaseIndex + 1;
  const nextCase = caseCatalog[nextCaseIndex] as unknown as VakaDetailedCase | undefined;

  useEffect(() => {
    if (caseCatalog.length && !caseCatalog.some((c) => c.id === selectedCaseId)) {
      const nextId = caseCatalog[0].id;
      setSelectedCaseId(nextId);
      setIndictSuspectId(undefined);
      setShowVerdictModal(false);
      if (typeof window !== "undefined") secureStorage.setItem("sely_vaka_active_case", nextId);
    }
  // The catalog is server data; selectedCaseId is intentionally the only state dependency.
  }, [caseCatalog.length, selectedCaseId]);

  if (casesQuery.isLoading || activeCaseQuery.isLoading || !activeCase) {
    return <div className="vaka-hub-container vaka-hub-loading">{isEn ? "Loading case files…" : "Vaka dosyaları yükleniyor…"}</div>;
  }
  if (casesQuery.isError || activeCaseQuery.isError) {
    return <div className="vaka-hub-container vaka-hub-loading">{isEn ? "Case files could not be loaded." : "Vaka dosyaları yüklenemedi."}</div>;
  }
  const isCaseSolved = Boolean(completedCases[activeCase.id]) || Boolean(isGameFinished);
  const completedCaseCount = Object.keys(completedCases).length + (completedCases[activeCase.id] ? 0 : (isCaseSolved ? 1 : 0));
  const isBureauComplete = caseCatalog.length > 0 && completedCaseCount >= caseCatalog.length;

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setIndictSuspectId(undefined);
    setShowVerdictModal(false);
    if (typeof window !== "undefined") {
      secureStorage.setItem("sely_vaka_active_case", caseId);
    }
  };

  const handleCaseCompleted = (caseId: string, score: number) => {
    setCompletedCases((prev) => {
      const next = { ...prev, [caseId]: Math.max(prev[caseId] || 0, score) };
      if (typeof window !== "undefined") {
        try {
          secureStorage.setJSON("sely_vaka_completed_cases", next);
        } catch {}
      }
      return next;
    });
  };

  const handleNextCase = (nextId: string) => {
    handleSelectCase(nextId);
    setShowVerdictModal(false);
  };

  const handleFinishBureau = (lastScore?: number) => {
    const persistedOtherScores = Object.entries(completedCases)
      .filter(([caseId]) => caseId !== activeCase.id)
      .map(([, score]) => score);
    const currentScore = Math.max(completedCases[activeCase.id] || 0, lastScore || 0);
    const totalScore = persistedOtherScores.reduce((a, b) => a + b, 0) + currentScore || 260;
    setShowVerdictModal(false);
    onSolved?.(totalScore);
  };

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
          <div className="vaka-top-badge-row">
            <span className="vaka-hub-badge">SELY INVESTIGATION BUREAU</span>
            {isCaseSolved && (
              <span className="vaka-solved-tag">
                ✓ {isEn ? "CASE CLOSED" : "VAKA KAPANDI"} {completedCases[activeCase.id] ? `(${completedCases[activeCase.id]} pts)` : ""}
              </span>
            )}
            {isCaseSolved && nextCase && (
              <button
                type="button"
                className="vaka-advance-case-btn"
                onClick={() => handleNextCase(nextCase.id)}
                title={isEn ? `Advance to Case #${nextCaseIndex + 1}: ${nextCase.titleEn}` : `Sonraki Vaka #${nextCaseIndex + 1}: ${nextCase.title}'e Geç`}
              >
                ⏩ {isEn ? "Next Case File →" : "Sonraki Vakaya Geç →"}
              </button>
            )}
          </div>
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
            onChange={(e) => handleSelectCase(e.target.value)}
          >
            {caseCatalog.map((c, index) => {
              const isDone = Boolean(completedCases[c.id]);
              const pts = completedCases[c.id];
              return (
                <option key={c.id} value={c.id}>
                  {isDone ? "✓ " : ""}#{index + 1}: {isEn ? c.titleEn : c.title} ({c.difficulty})
                  {isDone ? ` • [${pts} pts]` : ""}
                </option>
              );
            })}
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
          📂 {isEn ? "Dossier" : "Vaka Dosyası"}
        </button>

        {allowedModes.includes("interrogation") && (
          <button
            type="button"
            className={`vaka-nav-tab ${activeMode === "interrogation" ? "is-active" : ""}`}
            onClick={() => handleModeChange("interrogation")}
          >
            🎙️ {isEn ? "Interrogation" : "Sorgu Odası"}
          </button>
        )}

        {allowedModes.includes("contradiction") && (
          <button
            type="button"
            className={`vaka-nav-tab ${activeMode === "contradiction" ? "is-active" : ""}`}
            onClick={() => handleModeChange("contradiction")}
          >
            ⚖️ {isEn ? "Contradictions" : "Çelişki Avı"}
          </button>
        )}

        {allowedModes.includes("daily") && (
          <button
            type="button"
            className={`vaka-nav-tab ${activeMode === "daily" ? "is-active" : ""}`}
            onClick={() => handleModeChange("daily")}
          >
            📅 {isEn ? "Daily Case" : "Günün Vakası"}
          </button>
        )}

        <button
          type="button"
          className={`vaka-nav-tab vaka-indict-tab ${isCaseSolved ? "is-disabled" : ""}`}
          disabled={isCaseSolved}
          onClick={() => !isCaseSolved && handleOpenVerdict()}
          title={isCaseSolved ? (isEn ? "Verdict delivered. Case is archived." : "Hüküm bağlandı. Vaka arşive kaldırıldı.") : undefined}
        >
          🏛️ {isCaseSolved ? (isEn ? "Verdict Delivered" : "Hüküm Verildi (Kapandı)") : (isEn ? "Indictment" : "Mahkemede Suçla")}
        </button>
      </div>

      {/* Dedektif Akış Kılavuzu: Oyuncunun hedefini net gösterir */}
      <div className="vaka-flow-indicator">
        <span className={`vaka-step-chip ${activeMode === "dossier" ? "is-current" : ""}`}>
          1. {isEn ? "Review Dossier & Clues" : "Dosyayı & Delilleri İncele"}
        </span>
        <span className="vaka-step-arrow">→</span>
        <span className={`vaka-step-chip ${activeMode === "interrogation" || activeMode === "contradiction" ? "is-current" : ""}`}>
          2. {isEn ? "Interrogate or Catch Lies" : "Sorgula ya da Çelişkiyi Yakala"}
        </span>
        <span className="vaka-step-arrow">→</span>
        <span className={`vaka-step-chip ${showVerdictModal ? "is-current" : ""}`}>
          3. {isEn ? "Deliver Court Verdict" : "Mahkemede Suçla & Davayı Kazan"}
        </span>
      </div>

      {/* Aktif Mod Ekranı */}
      <div className="vaka-hub-content-area">
        {activeMode === "dossier" && (
          <VakaDossier key={activeCase.id} vakaCase={activeCase} locale={locale} />
        )}

        {activeMode === "interrogation" && (
          <VakaInterrogation
            key={activeCase.id}
            vakaCase={activeCase}
            locale={locale}
            soundOn={soundOn}
            isCaseSolved={isCaseSolved}
            onOpenVerdict={handleOpenVerdict}
            onOpenDossier={() => handleModeChange("dossier")}
            onSolved={(score) => handleCaseCompleted(activeCase.id, score)}
          />
        )}

        {activeMode === "contradiction" && (
          <VakaContradiction
            key={activeCase.id}
            vakaCase={activeCase}
            locale={locale}
            soundOn={soundOn}
            isCaseSolved={isCaseSolved}
            onOpenVerdict={handleOpenVerdict}
            onCaseCompleted={handleCaseCompleted}
            onSolved={(score) => handleCaseCompleted(activeCase.id, score)}
          />
        )}

        {activeMode === "daily" && (
          <VakaDailyBoard
            key={dailyQuery.data?.case?.id || activeCase.id}
            vakaCase={dailyQuery.data?.case as any || activeCase}
            caseIndex={dailyQuery.data?.caseIndex || 1}
            dateStr={dailyQuery.data?.date || new Date().toISOString().split("T")[0]}
            locale={locale}
            soundOn={soundOn}
            onSolved={(score) => handleCaseCompleted(activeCase.id, score)}
          />
        )}
      </div>

      {/* Mahkeme & Duruşma Modali */}
      {showVerdictModal && (
        <VakaVerdictModal
          key={`${activeCase.id}-${indictSuspectId || "default"}`}
          vakaCase={activeCase}
          locale={locale}
          soundOn={soundOn}
          defaultSuspectId={indictSuspectId}
          onClose={() => setShowVerdictModal(false)}
          onCaseCompleted={handleCaseCompleted}
          nextCase={nextCase}
          nextCaseIndex={nextCaseIndex + 1}
          onNextCase={handleNextCase}
          onFinishBureau={handleFinishBureau}
          onSolved={onSolved}
          completedCount={completedCaseCount}
          totalCases={caseCatalog.length}
          isBureauComplete={isBureauComplete}
        />
      )}
    </div>
  );
}
