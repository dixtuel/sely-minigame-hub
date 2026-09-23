import { useState } from "react";
import { evaluateVakaAttempt, type VakaCase, type VakaVerdict } from "@/lib/levelGenerators";
import type { SiteLocale } from "@/lib/i18n";
import { playAccuse, playContradiction, playHit } from "@/lib/sfx";

type Phase = "select-suspect" | "select-clue";

const REJECTION_PENALTY = 20;

function verdictMessage(verdict: VakaVerdict, locale: SiteLocale) {
  if (verdict === "no-contradiction") return locale === "en" ? "This clue does not connect to this suspect." : "Bu kanıt bu şüpheliyi bağlamıyor.";
  return locale === "en" ? "This clue clears the suspect instead of accusing them." : "Bu kanıt şüpheliyi temizliyor, suçlamıyor.";
}

export default function VakaBoard({ vakaCase, locale, soundOn, caseIndex, onSolved }: { vakaCase: VakaCase; locale: SiteLocale; soundOn: boolean; caseIndex: number; onSolved: (earnedScore: number) => void }) {
  const [phase, setPhase] = useState<Phase>("select-suspect");
  const [accusedSuspectId, setAccusedSuspectId] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);
  const [revealedClueIds, setRevealedClueIds] = useState<Set<string>>(() => new Set(vakaCase.clues.slice(0, vakaCase.revealCount).map(clue => clue.id)));
  const [penalty, setPenalty] = useState(0);
  const [resolved, setResolved] = useState(false);

  const accused = vakaCase.suspects.find(suspect => suspect.id === accusedSuspectId) ?? null;

  const accuse = (suspectId: string) => {
    if (resolved) return;
    playAccuse(soundOn);
    setAccusedSuspectId(suspectId);
    setRejection(null);
    setPhase("select-clue");
  };

  const backToSuspects = () => {
    setPhase("select-suspect");
    setAccusedSuspectId(null);
    setRejection(null);
  };

  const requestClue = () => {
    const hidden = vakaCase.clues.find(clue => !revealedClueIds.has(clue.id));
    if (!hidden) return;
    setRevealedClueIds(previous => new Set(previous).add(hidden.id));
    setPenalty(value => value + vakaCase.clueCost);
  };

  const presentClue = (clueId: string) => {
    if (resolved || !accusedSuspectId) return;
    const verdict = evaluateVakaAttempt(vakaCase, accusedSuspectId, clueId);
    if (verdict === "correct") {
      playContradiction(soundOn);
      setResolved(true);
      const earned = Math.max(0, 180 + caseIndex * 35 - penalty);
      window.setTimeout(() => onSolved(earned), 720);
    } else {
      playHit(soundOn);
      setRejection(verdictMessage(verdict, locale));
      setPenalty(value => value + REJECTION_PENALTY);
    }
  };

  const suspectNameById = (id?: string) => id ? vakaCase.suspects.find(suspect => suspect.id === id)?.name : undefined;
  const sortedClues = phase === "select-clue"
    ? [...vakaCase.clues].sort((a, b) => {
        const aRelevant = a.contradicts === accusedSuspectId || a.clears === accusedSuspectId ? 0 : 1;
        const bRelevant = b.contradicts === accusedSuspectId || b.clears === accusedSuspectId ? 0 : 1;
        return aRelevant - bRelevant;
      })
    : vakaCase.clues;

  return (
    <div className="marker-desk vaka-desk">
      <p className="vaka-briefing">{locale === "en" ? vakaCase.briefingEn : vakaCase.briefing}</p>
      <div className="marker-rule vaka-summary">
        <span>{locale === "en" ? "CASE FILE" : "VAKA DOSYASI"}</span>
        <h2>{accused ? `${accused.name}: ${accused.statement}` : (locale === "en" ? "Which suspect will you accuse?" : "Hangi şüpheliyi suçlayacaksın?")}</h2>
        {rejection && <p className="marker-clue vaka-rejection">{rejection}</p>}
        {phase === "select-clue" && (
          <div className="vaka-desk-actions">
            <button type="button" className="quiet-button" onClick={backToSuspects}>{locale === "en" ? "Withdraw accusation" : "Suçlamayı geri çek"}</button>
            <button type="button" className="quiet-button marker-clue-button" onClick={requestClue} disabled={revealedClueIds.size >= vakaCase.clues.length}>
              {locale === "en" ? "Request another clue" : "Bir ipucu daha iste"}
            </button>
          </div>
        )}
      </div>

      {phase === "select-suspect" ? (
        <div className="marker-options vaka-suspect-row">
          {vakaCase.suspects.map(suspect => (
            <button key={suspect.id} type="button" className="marker-card" onClick={() => accuse(suspect.id)}>
              <b>{suspect.name}</b>
              <span>{suspect.statement}</span>
              <i>{locale === "en" ? "Accuse" : "Suçla"}</i>
            </button>
          ))}
        </div>
      ) : (
        <div className="vaka-clue-rack">
          {sortedClues.map(clue => {
            const isRevealed = revealedClueIds.has(clue.id);
            const targetId = clue.contradicts ?? clue.clears;
            const targetName = suspectNameById(targetId);
            const relevant = targetId === accusedSuspectId;
            return (
              <button
                key={clue.id}
                type="button"
                className={`vaka-clue-card ${isRevealed ? "is-revealed" : "is-hidden"} ${isRevealed && relevant ? "is-relevant" : ""} ${resolved && clue.contradicts === accusedSuspectId ? "is-correct" : ""}`}
                onClick={() => isRevealed && presentClue(clue.id)}
                disabled={!isRevealed || resolved}
              >
                <b>{isRevealed ? clue.label : (locale === "en" ? "Locked clue" : "Kapalı kanıt")}</b>
                {/* Hedef rozeti YALNIZ o an suçlanan şüpheliyle ilgiliyse gösterilir — aksi halde
                    her kanıtın "About X" etiketi, hangi kanıtın failin kanıtı olduğunu suçlama
                    yapılmadan ÖNCE bile ifşa ederdi ve araştırmayı anlamsızlaştırırdı. */}
                {isRevealed && targetName && relevant && (
                  <em className="vaka-clue-target">
                    {clue.contradicts
                      ? (locale === "en" ? `About ${targetName}` : `${targetName} ile ilgili`)
                      : (locale === "en" ? `Clears ${targetName}` : `${targetName}'yi temizler`)}
                  </em>
                )}
                <span>{isRevealed ? clue.detail : (locale === "en" ? "Request another clue to open this card." : "Açmak için bir ipucu daha iste.")}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
