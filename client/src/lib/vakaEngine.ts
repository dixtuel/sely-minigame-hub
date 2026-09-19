import type { SiteLocale } from "./i18n";
import type { VakaGameMode, VakaDetailedCase } from "@shared/vakaTypes";
import { secureStorage } from "./secureStorage";

export type DetectiveGrade = "S" | "A" | "B" | "C";

export type VakaScoreReport = {
  grade: DetectiveGrade;
  score: number;
  timeSpentSec: number;
  questionCount: number;
  penaltyPoints: number;
  shareCard: string;
};

export function calculateVakaScore(
  baseScore: number,
  questionCount: number,
  timeSpentSec: number,
  penalty: number,
  locale: SiteLocale = "tr"
): VakaScoreReport {
  let finalScore = Math.max(0, baseScore - questionCount * 8 - Math.floor(timeSpentSec / 10) * 3 - penalty);

  let grade: DetectiveGrade = "C";
  if (finalScore >= 240) grade = "S";
  else if (finalScore >= 180) grade = "A";
  else if (finalScore >= 120) grade = "B";

  const squares = [
    finalScore >= 240 ? "🟩" : finalScore >= 180 ? "🟨" : "🟥",
    questionCount <= 5 ? "🟩" : questionCount <= 10 ? "🟨" : "🟥",
    penalty === 0 ? "🟩" : penalty <= 20 ? "🟨" : "🟥",
  ].join("");

  const shareCard =
    locale === "en"
      ? `SELY Vaka Daily | Grade: ${grade} | Score: ${finalScore}\n${squares}\nhttps://sely.tr`
      : `SELY Günün Vakası | Derece: ${grade} | Puan: ${finalScore}\n${squares}\nhttps://sely.tr`;

  return {
    grade,
    score: finalScore,
    timeSpentSec,
    questionCount,
    penaltyPoints: penalty,
    shareCard,
  };
}

export function getSavedVakaMode(allowedModes: VakaGameMode[], defaultMode: VakaGameMode): VakaGameMode {
  try {
    const saved = secureStorage.getItem("sely_vaka_preferred_mode") as VakaGameMode;
    if (saved && allowedModes.includes(saved)) {
      return saved;
    }
  } catch {
    // localStorage erişilemezse varsayılana dön
  }
  return defaultMode;
}

export function saveVakaMode(mode: VakaGameMode): void {
  try {
    secureStorage.setItem("sely_vaka_preferred_mode", mode);
  } catch {
    // localStorage erişilemezse devam et
  }
}
