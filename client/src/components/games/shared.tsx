import { useCallback, useRef, useState } from "react";
import type { GameId } from "@/lib/catalog";
import { masteryBand } from "@/lib/levelGenerators";

export type ResultOutcome = "success" | "failure";
export type GameResult = { score: number; label: string; detail: string; outcome: ResultOutcome; answer?: string };
export type Position = { r: number; c: number };

export const runMasteryFor = (highScore: number, dailyDifficulty: number) => Math.min(4, Math.max(masteryBand(highScore), dailyDifficulty));

// Dinamik/sonsuz/skor odaklı arcade oyunları: her denemede yeniden üretilir, seviye atlama yoktur.
// Tek kaynak — GameStudio.tsx da bu listeyi kullanır, üç ayrı yerde tekrarlanmaz.
export const ARCADE_DYNAMIC_GAME_IDS: GameId[] = ["spark", "asteroids", "lander", "tetris", "game2048", "coil", "apex", "lift", "breakline"];

export function resultActionsFor(outcome: ResultOutcome, failureCount: number, gameId?: GameId) {
  if (gameId && ARCADE_DYNAMIC_GAME_IDS.includes(gameId)) {
    // Dinamik, sonsuz veya skor odaklı arcade oyunları: seviye atlama yoktur, tek akış, yalnızca tekrar denenebilir
    return { canRetry: true, canAdvance: false };
  }
  if (gameId === "hane" || gameId === "sokoban" || gameId === "lightsout") {
    // Bulmaca / aşama bazlı oyunlar: başarıda veya 3 deneme sonrasında sonraki seviyeye geçiş
    return { canRetry: true, canAdvance: outcome === "success" || failureCount >= 3 };
  }
  return { canRetry: outcome === "failure", canAdvance: outcome === "success" || failureCount >= 3 };
}

export function scoreFor(id: GameId, raw: number) {
  const multiplier: Record<GameId, number> = {
    echo: 1,
    knot: 2,
    cut: 1,
    shadow: 2,
    vaka: 3,
    hane: 2,
    spark: 1,
    asteroids: 1,
    sokoban: 2,
    tetris: 1,
    lander: 2,
    lightsout: 2,
    game2048: 1,
    coil: 1,
    apex: 1,
    lift: 1,
    breakline: 1,
  };
  return Math.max(0, Math.round(raw * (multiplier[id] || 1)));
}

export function useFinishOnce(onFinish: (result: GameResult) => void) {
  const [isFinished, setIsFinished] = useState(false);
  const done = useRef(false);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const finish = useCallback((result: GameResult) => {
    if (done.current) return;
    done.current = true;
    setIsFinished(true);
    window.setTimeout(() => onFinishRef.current(result), 90);
  }, []);
  return [finish, isFinished] as const;
}
