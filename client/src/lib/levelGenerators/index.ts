import type { GameId } from "../catalog";
import { generateEchoLevel, isEchoLevelSolvable } from "./echo";
import { generateKnotLevel, isKnotLevelSolvable } from "./knot";
import { generateCutLevel, isCutLevelSolvable } from "./cut";
import { generateShadowLevel, isShadowLevelSolvable } from "./shadow";
import { generateVakaCases, isVakaCaseSolvable } from "./vaka";

export * from "./shared";
export * from "./hane";
export * from "./echo";
export * from "./knot";
export * from "./cut";
export * from "./shadow";
export * from "./vaka";

export function validateDailySeed(seed: number, gameId: GameId) {
  const mastery = 2;
  if (gameId === "echo") return isEchoLevelSolvable(generateEchoLevel(seed, mastery));
  if (gameId === "knot") return isKnotLevelSolvable(generateKnotLevel(seed, mastery));
  if (gameId === "cut") return isCutLevelSolvable(generateCutLevel(seed, mastery));
  if (gameId === "shadow") return isShadowLevelSolvable(generateShadowLevel(seed, mastery));
  if (gameId === "spark") return true;
  if (gameId === "vaka") return generateVakaCases(seed, mastery).every(isVakaCaseSolvable);
  return true;
}
