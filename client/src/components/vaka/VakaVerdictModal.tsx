import { useState } from "react";
import type { VakaDetailedCase } from "@shared/vakaTypes";
import type { SiteLocale } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { playAccuse, playContradiction, playHit } from "@/lib/sfx";

type Props = {
  vakaCase: VakaDetailedCase;
  locale: SiteLocale;
  soundOn: boolean;
  defaultSuspectId?: string;
  onClose: () => void;
  onSolved?: (score: number) => void;
};

export default function VakaVerdictModal({
  vakaCase,
  locale,
  soundOn,
  defaultSuspectId,
  onClose,
  onSolved,
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
  const [result, setResult] = useState<{
    success: boolean;
    grade: "S" | "A" | "B" | "C";
    score: number;
    message: string;
    confession?: string;
    culpritName: string;
    shareCard: string;
  } | null>(null);

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
        onSolved?.(res.score);
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
                    <span className="vaka-clue-tag">{c.type.toUpperCase()}</span>
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
              <button type="button" className="vaka-copy-btn" onClick={copyShareCard}>
                📋 {isEn ? "Copy Scorecard" : "Karneni Kopyala"}
              </button>
            </div>

            <div className="vaka-form-actions">
              <button type="button" className="quiet-button" onClick={onClose}>
                {isEn ? "Close Dossier" : "Dosyayı Kapat"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
