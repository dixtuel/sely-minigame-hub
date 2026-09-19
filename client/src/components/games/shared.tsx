import { useCallback, useRef, useState } from "react";
import type { GameId } from "@/lib/catalog";
import { masteryBand } from "@/lib/levelGenerators";

export type ResultOutcome = "success" | "failure";
export type GameResult = { score: number; label: string; detail: string; outcome: ResultOutcome; answer?: string };
export type Position = { r: number; c: number };

export const runMasteryFor = (highScore: number, dailyDifficulty: number) => Math.min(4, Math.max(masteryBand(highScore), dailyDifficulty));

export function resultActionsFor(outcome: ResultOutcome, failureCount: number, gameId?: GameId) {
  if (gameId === "spark") {
    // Kıvılcım sonsuz arcade uçuş oyunudur; seviye atlama/geçiş olmaz, her zaman tekrar denenebilir
    return { canRetry: true, canAdvance: false };
  }
  if (gameId === "hane") {
    // Hane her tekrar denendiğinde yeni bir kelime/sayı tohumuyla açılır; hem başarıda hem başarısızlıkta tekrar oynanabilir
    return { canRetry: true, canAdvance: outcome === "success" || failureCount >= 3 };
  }
  return { canRetry: outcome === "failure", canAdvance: outcome === "success" || failureCount >= 3 };
}

export function scoreFor(id: GameId, raw: number) {
  const multiplier: Record<GameId, number> = { echo: 1, knot: 2, cut: 1, shadow: 2, vaka: 3, hane: 2, spark: 1 };
  return Math.max(0, Math.round(raw * multiplier[id]));
}

export function useFinishOnce(onFinish: (result: GameResult) => void) {
  const [isFinished, setIsFinished] = useState(false);
  const done = useRef(false);
  const finish = useCallback((result: GameResult) => {
    if (done.current) return;
    done.current = true;
    setIsFinished(true);
    window.setTimeout(() => onFinish(result), 90);
  }, [onFinish]);
  return [finish, isFinished] as const;
}
