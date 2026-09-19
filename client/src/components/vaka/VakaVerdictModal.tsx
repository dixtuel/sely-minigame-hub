import { useState, useEffect } from "react";
import { Share2 } from "lucide-react";
import type { VakaDetailedCase } from "@shared/vakaTypes";
import type { SiteLocale } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { playAccuse, playContradiction, playHit } from "@/lib/sfx";
import { getPlayerNick } from "@/lib/playerNick";
import ShareResultModal from "@/components/ShareResultModal";

type Props = {
  vakaCase: VakaDetailedCase;
  locale: SiteLocale;
  soundOn: boolean;
  defaultSuspectId?: string;
  onClose: () => void;
  onSolved?: (score: number) => void;
  nextCase?: VakaDetailedCase;
  nextCaseIndex?: number;
  onNextCase?: (nextCaseId: string) => void;
  onFinishBureau?: (score: number) => void;
  onCaseCompleted?: (caseId: string, score: number) => void;
};

export default function VakaVerdictModal({
  vakaCase,
  locale,
  soundOn,
  defaultSuspectId,
  onClose,
  onSolved,
  nextCase,
  nextCaseIndex,
  onNextCase,
  onFinishBureau,
  onCaseCompleted,
}: Props) {
  const isEn = locale === "en";
  const [selectedSuspectId, setSelectedSuspectId] = useState<string>(
    defaultSuspectId || vakaCase.suspects[0]?.id || ""
  );
  const [selectedClueId, setSelectedClueId] = useState<string>(
    vakaCase.clues[0]?.id || ""
  );
  const [methodText, setMethodText] = useState("");
  const [motiveText, setMotiveText] = useState("");
  const [shareVisualOpen, setShareVisualOpen] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    grade: "S" | "A" | "B" | "C";
    score: number;
    message: string;
    confession?: string;
    culpritName: string;
    shareCard: string;
  } | null>(null);

  // Vaka değiştiğinde iddianame formunu ve sonucu sıfırla
  useEffect(() => {
    setSelectedSuspectId(defaultSuspectId || vakaCase.suspects[0]?.id || "");
    setSelectedClueId(vakaCase.clues[0]?.id || "");
    setMethodText("");
    setMotiveText("");
    setResult(null);
  }, [vakaCase.id, defaultSuspectId]);

  const accuseMutation = trpc.vaka.accuse.useMutation();

  const handleIndictmentSubmit = async () => {
    if (!selectedSuspectId || !selectedClueId) {
      alert(isEn ? "Select both the suspect and the key evidence!" : "Hem şüpheliyi hem de kesin delili seçmelisiniz!");
      return;
    }

    try {
      playAccuse(soundOn);
      const res = await accuseMutation.mutateAsync({
        caseId: vakaCase.id,
        accusedId: selectedSuspectId,
        decisiveClueId: selectedClueId,
        method: methodText,
        motive: motiveText,
        locale: isEn ? "en" : "tr",
      });

      const squares = res.success ? "🟩🟩🟩" : res.score > 0 ? "🟨🟨🟥" : "🟥🟥🟥";
      const shareCard = isEn
        ? `SELY Vaka Mystery | Case: ${vakaCase.titleEn}\nVerdict: ${res.success ? "SOLVED (Grade " + res.grade + ")" : "DISMISSED"}\n${squares}\nScore: ${res.score} pts\nhttps://sely.tr`
        : `SELY Vaka Gizemi | Vaka: ${vakaCase.title}\nHüküm: ${res.success ? "ÇÖZÜLDÜ (Derece " + res.grade + ")" : "DÜŞTÜ"}\n${squares}\nPuan: ${res.score}\nhttps://sely.tr`;

      setResult({
        ...res,
        shareCard,
      });

      if (res.success) {
        playContradiction(soundOn);
        onCaseCompleted?.(vakaCase.id, res.score);
      } else {
        playHit(soundOn);
      }
    } catch (err: any) {
      alert(err?.message || "Hata oluştu");
    }
  };

  const copyShareCard = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.shareCard);
    alert(isEn ? "Report card copied to clipboard!" : "Dedektif karnesi panoya kopyalandı!");
  };

  return (
    <div className="vaka-modal-overlay">
      <div className="vaka-modal-container">
        <div className="vaka-modal-header">
          <h2>🏛️ {isEn ? "FORMAL COURT INDICTMENT" : "RESMİ MAHKEME İDDİANAMESİ"}</h2>
          <button type="button" className="vaka-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {!result ? (
          <div className="vaka-indictment-form">
            <p className="vaka-form-guide">
              {isEn
                ? "The court demands conclusive deduction. Formulate your 4-pillar accusation against the accused."
                : "Mahkeme somut mantık ve kanıt talep ediyor. Şüpheliye karşı 4 ayaklı iddianamenizi sunun."}
            </p>

            {/* 1. Ayak: Fail Seçimi */}
            <div className="vaka-form-group">
              <label>1. {isEn ? "Accused Perpetrator:" : "Suçlanan Fail:"}</label>
              <div className="vaka-suspect-radio-grid">
                {vakaCase.suspects.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`vaka-suspect-pill-btn ${selectedSuspectId === s.id ? "is-active" : ""}`}
                    onClick={() => setSelectedSuspectId(s.id)}
                  >
                    <b>{s.name}</b>
                    <small>{isEn ? s.roleEn : s.role}</small>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Ayak: Kesin Çürütücü Delil */}
            <div className="vaka-form-group">
              <label>2. {isEn ? "Decisive Rebuttal Evidence:" : "Kesin Çürütücü Kanıt:"}</label>
              <div className="vaka-clue-radio-grid">
                {vakaCase.clues.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`vaka-clue-pill-btn ${selectedClueId === c.id ? "is-active" : ""}`}
                    onClick={() => setSelectedClueId(c.id)}
                  >
                    <b>{isEn ? c.labelEn : c.label}</b>
                    <span className="vaka-clue-tag">
                      {c.type === "alibi"
                        ? (isEn ? "EVIDENCE" : "KANIT")
                        : c.type === "object"
                        ? (isEn ? "OBJECT" : "FİZİKSEL DELİL")
                        : c.type === "forensic"
                        ? (isEn ? "FORENSIC" : "ADLİ TIP")
                        : c.type === "digital"
                        ? (isEn ? "DIGITAL" : "DİJİTAL / LOG")
                        : c.type === "spatial"
                        ? (isEn ? "SPATIAL" : "MEKÂNSAL")
                        : c.type === "numerical"
                        ? (isEn ? "TIMELINE" : "ZAMAN / VERİ")
                        : (isEn ? "BEHAVIORAL" : "DAVRANIŞSAL")}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Ayak: Suç Yöntemi & Hilesi */}
            <div className="vaka-form-group">
              <label>3. {isEn ? "Modus Operandi / Method Used:" : "Kullanılan Yöntem / Suç Aleti:"}</label>
              <input
                type="text"
                className="vaka-text-input"
                placeholder={isEn ? "E.g. Poisoned goblet rim, rigged window bolt..." : "Örn: Zehirli kadeh kenarı, misina ile kilitli oda..."}
                value={methodText}
                onChange={(e) => setMethodText(e.target.value)}
              />
            </div>

            {/* 4. Ayak: Suçun Asıl Motifi */}
            <div className="vaka-form-group">
              <label>4. {isEn ? "Primary Motive:" : "Asıl Motivasyon / Gizli Sebep:"}</label>
              <input
                type="text"
                className="vaka-text-input"
                placeholder={isEn ? "E.g. Gambling debt, forged dissertation, insurance..." : "Örn: Kumar borcu, intihal ifşası, miras kavgası..."}
                value={motiveText}
                onChange={(e) => setMotiveText(e.target.value)}
              />
            </div>

            <div className="vaka-form-actions">
              <button
                type="button"
                className="vaka-submit-indictment-btn"
                disabled={accuseMutation.isPending}
                onClick={handleIndictmentSubmit}
              >
                ⚖️ {isEn ? "Deliver Verdict to Court" : "Hükmü Mahkemeye Sun"}
              </button>
            </div>
          </div>
        ) : (
          <div className="vaka-verdict-result-view">
            <div className={`vaka-verdict-banner ${result.success ? "is-success" : "is-failed"}`}>
              <h3>{result.success ? (isEn ? "GUILTY AS CHARGED" : "SUÇLU BULUNDU") : (isEn ? "CHARGES DISMISSED" : "DAVA DÜŞTÜ")}</h3>
              <p>{result.message}</p>
            </div>

            {result.confession && (
              <div className="vaka-court-confession">
                <b>{isEn ? "Signed Confession:" : "İmzalı İtiraf Tutanağı:"}</b>
                <p>"{result.confession}"</p>
              </div>
            )}

            <div className="vaka-scorecard-box">
              <div className="vaka-score-grade">
                <span>{isEn ? "DETECTIVE GRADE" : "DEDEKTİFLİK DERECESİ"}</span>
                <b className={`is-grade-${result.grade}`}>{result.grade}</b>
              </div>
              <div className="vaka-score-points">
                <span>{isEn ? "TOTAL SCORE" : "TOPLAM PUAN"}</span>
                <b>{result.score}</b>
              </div>
            </div>

            <div className="vaka-share-box">
              <pre>{result.shareCard}</pre>
              <div style={{ display: "flex", gap: "0.5rem", width: "100%", marginTop: "0.5rem" }}>
                <button type="button" className="vaka-copy-btn" onClick={copyShareCard} style={{ flex: 1 }}>
                  📋 {isEn ? "Copy Scorecard" : "Karneni Kopyala"}
                </button>
                <button
                  type="button"
                  className="vaka-copy-btn"
                  onClick={() => setShareVisualOpen(true)}
                  style={{
                    flex: 1,
                    background: "var(--color-primary, #b91c1c)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.4rem",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  <Share2 size={16} /> {isEn ? "Share Visual Card" : "Görsel Kartı Paylaş"}
                </button>
              </div>
            </div>

            {shareVisualOpen && (
              <ShareResultModal
                isOpen={shareVisualOpen}
                onClose={() => setShareVisualOpen(false)}
                data={{
                  gameId: "vaka",
                  gameTitle: isEn ? (vakaCase.titleEn || vakaCase.title) : vakaCase.title,
                  score: result.score,
                  nick: getPlayerNick(locale),
                  outcome: result.success ? "solved" : "dismissed",
                  grade: result.grade,
                  caseTitle: isEn ? (vakaCase.titleEn || vakaCase.title) : vakaCase.title,
                  suspect: result.culpritName,
                  locale,
                }}
              />
            )}

            <div className="vaka-verdict-actions-grid">
              {result.success ? (
                <>
                  {nextCase && onNextCase && (
                    <button
                      type="button"
                      className="vaka-verdict-next-btn"
                      onClick={() => onNextCase(nextCase.id)}
                    >
                      ⏩ {isEn
                        ? `Advance to Next Case (#${nextCaseIndex}: ${nextCase.titleEn}) →`
                        : `Sonraki Vaka Dosyasına Geç (#${nextCaseIndex}: ${nextCase.title}) →`}
                    </button>
                  )}

                  <button
                    type="button"
                    className="vaka-verdict-finish-btn"
                    onClick={() => {
                      if (onFinishBureau) {
                        onFinishBureau(result.score);
                      } else {
                        onSolved?.(result.score);
                      }
                    }}
                  >
                    🏢 {isEn ? "Complete Bureau Shift & Archive Score" : "Büro Mesaisini Tamamla & Skoru Kaydet"}
                  </button>

                  <button type="button" className="vaka-verdict-close-btn" onClick={onClose}>
                    🔍 {isEn ? "Review Case Evidence & Dossier" : "Delilleri İncelemeye Devam Et"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="vaka-submit-indictment-btn"
                    onClick={() => setResult(null)}
                  >
                    🔄 {isEn ? "Re-evaluate Evidence & Reformulate Indictment" : "Kanıtları Tekrar Değerlendir & İddianameyi Yenile"}
                  </button>
                  <button type="button" className="vaka-verdict-close-btn" onClick={onClose}>
                    ✕ {isEn ? "Return to Interrogation" : "Sorgu Odasına Dön"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
