import React, { useState, useCallback, useEffect } from "react";
import type { GameResult } from "@/components/games/shared";
import { useFinishOnce } from "@/components/games/shared";
import {
  LIGHTS_OUT_LEVELS,
  generateSolvableLightsOutGrid,
  toggleLightCell,
  isLightsOutCleared,
} from "@/lib/levelGenerators/lightsout";
import { playTone } from "@/lib/sfx";

interface LightsOutGameProps {
  locale: "tr" | "en";
  seed: number;
  mastery: number;
  soundOn?: boolean;
  onFinish: (result: GameResult) => void;
}

export default function LightsOutGame({ locale, seed, mastery, soundOn = true, onFinish }: LightsOutGameProps) {
  const [finish] = useFinishOnce(onFinish);

  // Difficulty level 1..4 based on mastery
  const levelNum = Math.min(4, Math.max(1, mastery || 1));
  const config = LIGHTS_OUT_LEVELS[levelNum] || LIGHTS_OUT_LEVELS[1];
  const size = config.size;

  const [grid, setGrid] = useState<boolean[][]>(() =>
    generateSolvableLightsOutGrid(size, config.shuffles, seed)
  );
  const [moves, setMoves] = useState(0);

  const playToggleSfx = (isOn: boolean) => {
    if (!soundOn) return;
    playTone(isOn ? 520 : 340, "sine", 0.06, 0.12);
  };

  const playWinSfx = () => {
    if (!soundOn) return;
    playTone(440, "sine", 0.1, 0.2);
    playTone(660, "triangle", 0.15, 0.25);
    playTone(880, "sine", 0.25, 0.3);
  };

  const handleCellClick = useCallback(
    (r: number, c: number) => {
      setGrid(prev => {
        const next = prev.map(row => [...row]);
        toggleLightCell(next, r, c, size);

        playToggleSfx(next[r][c]);

        if (isLightsOutCleared(next)) {
          playWinSfx();
          const finalScore = Math.max(100, 1000 - (moves + 1) * 15);
          setTimeout(() => {
            finish({
              score: finalScore,
              label: locale === "tr" ? "Şebeke Karardı" : "Grid Cleared",
              detail: locale === "tr" ? `Tüm ışıklar ${moves + 1} hamlede söndürüldü.` : `All lights extinguished in ${moves + 1} moves.`,
              outcome: "success",
            });
          }, 500);
        }

        return next;
      });
      setMoves(m => m + 1);
    },
    [size, moves, finish, locale, soundOn]
  );

  const restart = useCallback(() => {
    setGrid(generateSolvableLightsOutGrid(size, config.shuffles, seed));
    setMoves(0);
  }, [size, config.shuffles, seed]);

  const activeCount = grid.reduce((acc, row) => acc + row.filter(Boolean).length, 0);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between select-none" style={{ touchAction: "none" }}>
      {/* Top HUD */}
      <div className="w-full flex items-center justify-between px-4 py-2 border-b-2 border-[#1B1A1B] bg-[#F6F0E3] text-[#1B1A1B] font-mono text-sm font-bold z-10">
        <div>
          {locale === "tr" ? "IZGARA" : "GRID"}: {size}x{size}
        </div>
        <div>
          {locale === "tr" ? "HAMLE" : "MOVES"}: {moves}
        </div>
        <div>
          {locale === "tr" ? "YANAN" : "ACTIVE"}:{" "}
          <span className={activeCount === 0 ? "text-[#296A55]" : "text-[#E9563F]"}>{activeCount}</span>
        </div>
        <button
          className="px-2 py-1 bg-[#EAE2D0] border-2 border-[#1B1A1B] text-xs font-bold hover:bg-[#DDE4F0]"
          onClick={restart}
        >
          {locale === "tr" ? "Yenile" : "Reset"}
        </button>
      </div>

      {/* Lights Grid Area */}
      <div className="relative w-full flex-1 overflow-hidden flex items-center justify-center p-4">
        <div
          className="grid gap-3 p-4 bg-[#EFE8DA] border-2 border-[#1B1A1B] shadow-[4px_4px_0px_#1B1A1B] max-w-[min(420px,78vh,92vw)] w-full aspect-square"
          style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
        >
          {grid.map((row, r) =>
            row.map((isOn, c) => (
              <button
                key={`${r}-${c}`}
                onClick={() => handleCellClick(r, c)}
                className={`relative flex items-center justify-center aspect-square rounded-full border-2 border-[#1B1A1B] transition-all duration-150 cursor-pointer ${
                  isOn
                    ? "bg-[#E5B341] shadow-[0_0_15px_#E5B341] active:scale-95"
                    : "bg-[#293B75] active:scale-95"
                }`}
                aria-label={`Cell ${r + 1}, ${c + 1}`}
              >
                {/* Visual core radiating rings matching the uploaded poster */}
                {isOn ? (
                  <div className="w-1/2 h-1/2 rounded-full bg-[#FFF3D6] border border-[#1B1A1B] flex items-center justify-center">
                    <div className="w-1/3 h-1/3 rounded-full bg-[#E5B341]" />
                  </div>
                ) : (
                  <div className="w-1/3 h-1/3 rounded-full bg-[#1B2544] border border-[#38487A]" />
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Bottom Hint */}
      <div className="w-full py-3 bg-[#EAE2D0] border-t-2 border-[#1B1A1B] text-center font-mono text-xs text-[#1B1A1B] font-bold z-10">
        {locale === "tr"
          ? "HER DOKUNUŞ KENDİSİNİ VE 4 KOMŞUSUNU TERSİNE ÇEVİRİR. TÜM IŞIKLARI SÖNDÜR."
          : "EVERY TAP TOGGLES ITSELF AND ITS 4 NEIGHBORS. EXTINGUISH ALL LIGHTS."}
      </div>
    </div>
  );
}
