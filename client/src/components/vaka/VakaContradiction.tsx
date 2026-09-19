import { useState, useEffect } from "react";
import type { VakaDetailedCase, VakaSuspect } from "@shared/vakaTypes";
import type { SiteLocale } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { playAccuse, playContradiction, playHit } from "@/lib/sfx";

type Props = {
  vakaCase: VakaDetailedCase;
  locale: SiteLocale;
  soundOn: boolean;
  onSolved?: (score: number) => void;
  onOpenVerdict?: (suspectId?: string) => void;
  onCaseCompleted?: (caseId: string, score: number) => void;
  isCaseSolved?: boolean;
};

export default function VakaContradiction({
  vakaCase,
  locale,
  soundOn,
  onSolved,
  onOpenVerdict,
  onCaseCompleted,
  isCaseSolved,
}: Props) {
  const [unlockedMap] = useState<Record<string, boolean>>(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(`sely_vaka_unlocked_${vakaCase.id}`);
        if (saved) return JSON.parse(saved);
      }
    } catch {}
    return {};
  });

  const isSuspectUnlocked = (s: VakaSuspect) => {
    if (!s.isInitiallyLocked) return true;
    return Boolean(unlockedMap[s.id]);
  };

  const visibleSuspects = vakaCase.suspects.filter(isSuspectUnlocked);
  const initialSuspect = visibleSuspects[0] || vakaCase.suspects[0];

  const [selectedSuspectId, setSelectedSuspectId] = useState<string>(initialSuspect?.id || "");
  const [selectedSentenceId, setSelectedSentenceId] = useState<string | null>(null);
  const [selectedClueId, setSelectedClueId] = useState<string | null>(null);
  const [penalty, setPenalty] = useState(0);
  const [feedback, setFeedback] = useState<{ text: string; isSuccess: boolean } | null>(null);
  const [solved, setSolved] = useState(false);

  // Vaka değiştiğinde çelişki masasını sıfırla
  useEffect(() => {
    setSelectedSuspectId(initialSuspect?.id || "");
    setSelectedSentenceId(null);
    setSelectedClueId(null);
    setPenalty(0);
    setFeedback(null);
    setSolved(false);
  }, [vakaCase.id]);

  const activeSuspect = vakaCase.suspects.find((s) => s.id === selectedSuspectId) || initialSuspect;
  const contradictionMutation = trpc.vaka.checkContradiction.useMutation();

  const handlePresentObjection = async () => {
    if (!selectedSentenceId || !selectedClueId || solved) return;

    try {
      playAccuse(soundOn);
      const res = await contradictionMutation.mutateAsync({
        caseId: vakaCase.id,
        suspectId: selectedSuspectId,
        sentenceId: selectedSentenceId,
        clueId: selectedClueId,
        locale: locale === "en" ? "en" : "tr",
      });

      if (res.success) {
        playContradiction(soundOn);
        setSolved(true);
        setFeedback({ text: res.message, isSuccess: true });
        const earned = Math.max(0, 240 - penalty);
        onCaseCompleted?.(vakaCase.id, earned);

        // Çelişkiyi oturum hafızasına kaydet (Sorgu Odası katilin yakalandığını bilecek)
        if (typeof window !== "undefined") {
          try {
            const expKey = `sely_vaka_exposed_${vakaCase.id}`;
            const existing = JSON.parse(localStorage.getItem(expKey) || "{}");
            existing[selectedSuspectId] = {
              sentenceId: selectedSentenceId,
              clueId: selectedClueId,
              explanation: res.message,
              timestamp: Date.now(),
            };
            localStorage.setItem(expKey, JSON.stringify(existing));
          } catch {}
        }
      } else {
        playHit(soundOn);
        setPenalty((prev) => prev + (res.penalty || 15));
        setFeedback({ text: res.message, isSuccess: false });
      }
    } catch (err: any) {
      setFeedback({ text: err?.message || "Hata oluştu", isSuccess: false });
    }
  };

  return (
    <div className="vaka-contradiction-desk">
      {/* Şüpheli Seçimi */}
      <div className="vaka-suspect-selector-row">
        {visibleSuspects.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`vaka-suspect-badge-btn ${s.id === selectedSuspectId ? "is-active" : ""}`}
            onClick={() => {
              setSelectedSuspectId(s.id);
              setSelectedSentenceId(null);
              setFeedback(null);
            }}
          >
            <b>{s.name}</b>
            <small>{locale === "en" ? s.roleEn : s.role}</small>
          </button>
        ))}
      </div>

      {/* Şüphelinin Resmi İfadesi (Cümle Cümle Ayrılmış) */}
      <div className="vaka-testimony-box">
        <div className="vaka-testimony-header">
          <span>📜 {locale === "en" ? "OFFICIAL COURT TESTIMONY" : "RESMİ İFADE TUTANAĞI"}</span>
          <small>{locale === "en" ? "Click on the contradictory statement" : "Çelişkili olduğunu düşündüğün cümleye tıkla"}</small>
        </div>

        <div className="vaka-sentence-list">
          {activeSuspect.detailedStatements.map((sent, index) => {
            const isSelected = selectedSentenceId === sent.id;
            return (
              <button
                key={sent.id}
                type="button"
                className={`vaka-sentence-card ${isSelected ? "is-selected" : ""}`}
                onClick={() => setSelectedSentenceId(sent.id)}
              >
                <span className="vaka-sentence-num">#{index + 1}</span>
                <span className="vaka-sentence-text">
                  "{locale === "en" ? sent.textEn : sent.text}"
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Kanıt Masası */}
      <div className="vaka-clues-section">
        <div className="vaka-clues-header">
          <span>💼 {locale === "en" ? "EVIDENCE DOSSIER" : "DELİL DOSYASI"}</span>
          <small>{locale === "en" ? "Select the piece of evidence that disproves the statement" : "İfadeyi çürüten kanıtı seç"}</small>
        </div>

        <div className="vaka-clues-grid">
          {vakaCase.clues.map((clue) => {
            const isSelected = selectedClueId === clue.id;
            return (
              <button
                key={clue.id}
                type="button"
                className={`vaka-clue-item-card ${isSelected ? "is-selected" : ""}`}
                onClick={() => setSelectedClueId(clue.id)}
              >
                <div className="vaka-clue-label">
                  <b>{locale === "en" ? clue.labelEn : clue.label}</b>
                  <span className="vaka-clue-tag">
                    {clue.type === "alibi"
                      ? (locale === "en" ? "EVIDENCE" : "KANIT")
                      : clue.type === "object"
                      ? (locale === "en" ? "OBJECT" : "FİZİKSEL DELİL")
                      : clue.type === "forensic"
                      ? (locale === "en" ? "FORENSIC" : "ADLİ TIP")
                      : clue.type === "digital"
                      ? (locale === "en" ? "DIGITAL" : "DİJİTAL / LOG")
                      : clue.type === "spatial"
                      ? (locale === "en" ? "SPATIAL" : "MEKÂNSAL")
                      : clue.type === "numerical"
                      ? (locale === "en" ? "TIMELINE" : "ZAMAN / VERİ")
                      : (locale === "en" ? "BEHAVIORAL" : "DAVRANIŞSAL")}
                  </span>
                </div>
                <p className="vaka-clue-detail">{locale === "en" ? clue.detailEn : clue.detail}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Geri Bildirim Banner'ı */}
      {feedback && (
        <div className={`vaka-feedback-banner ${feedback.isSuccess ? "is-success" : "is-error"}`}>
          <b>{feedback.isSuccess ? (locale === "en" ? "OBJECTION SUCCESSFUL!" : "İTİRAZ KABUL EDİLDİ!") : (locale === "en" ? "OBJECTION OVERRULED!" : "İTİRAZ REDDEDİLDİ!")}</b>
          <p>{feedback.text}</p>
        </div>
      )}

      {/* İtiraz / Çelişki Hamlesi Butonu */}
      {!solved && (
        <div className="vaka-objection-action-bar">
          <button
            type="button"
            className="vaka-objection-btn"
            disabled={!selectedSentenceId || !selectedClueId || contradictionMutation.isPending || solved || Boolean(isCaseSolved)}
            onClick={handlePresentObjection}
          >
            ⚖️ {locale === "en" ? "PRESENT CONTRADICTION!" : "ÇELİŞKİYİ SUN / İTİRAZ ET!"}
          </button>
        </div>
      )}

      {/* Çelişki Çözüldükten Sonraki Mahkeme Sevk Butonu */}
      {solved && onOpenVerdict && (
        <div className="vaka-confession-footer-bar">
          <div className="vaka-confession-footer-info">
            <span>{isCaseSolved ? "✓ " : "✨ "}{isCaseSolved ? (locale === "en" ? "Contradiction Archived" : "Çelişki Arşivlendi") : (locale === "en" ? "Contradiction shattered the false defense!" : "Çelişki şüphelinin yalan savunmasını çökertti!")}</span>
            <p>
              {isCaseSolved
                ? (locale === "en" ? "The contradiction was formally recorded in the archives." : "Çelişki resmi tutanaklara geçti ve vaka sonuçlandırıldı.")
                : (locale === "en" ? "Now present the formal court indictment to deliver justice." : "Şimdi adaleti sağlamak için resmi mahkeme iddianamesini sunun.")}
            </p>
          </div>
          {!isCaseSolved && (
            <button
              type="button"
              className="vaka-indict-giant-btn"
              onClick={() => onOpenVerdict(selectedSuspectId)}
            >
              🏛️ {locale === "en" ? "PROCEED TO FORMAL INDICTMENT" : "RESMİ MAHKEME SUÇLAMASINA GEÇ"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
