import React, { useState, useEffect, useRef, useCallback } from "react";
import type { GameResult } from "@/components/games/shared";
import { useFinishOnce } from "@/components/games/shared";
import { Game2048Engine, type TileItem } from "@/lib/levelGenerators/game2048";
import { playTone } from "@/lib/sfx";

interface Game2048Props {
  locale: "tr" | "en";
  seed: number;
  mastery: number;
  soundOn?: boolean;
  onFinish: (result: GameResult) => void;
}

// Sely retro pastel palette for 2048 tiles
const TILE_COLORS: Record<number, { bg: string; text: string }> = {
  2: { bg: "#EFE8DA", text: "#1B1A1B" },
  4: { bg: "#E5DFD3", text: "#1B1A1B" },
  8: { bg: "#F2D5CE", text: "#E9563F" },
  16: { bg: "#E9563F", text: "#FFFFFF" },
  32: { bg: "#D9422B", text: "#FFFFFF" },
  64: { bg: "#C4301B", text: "#FFFFFF" },
  128: { bg: "#F4E0A5", text: "#1B1A1B" },
  256: { bg: "#E5B341", text: "#1B1A1B" },
  512: { bg: "#D19F2D", text: "#FFFFFF" },
  1024: { bg: "#293B75", text: "#FFFFFF" },
  2048: { bg: "#296A55", text: "#FFFFFF" },
};

export default function Game2048({ locale, seed, mastery, soundOn = true, onFinish }: Game2048Props) {
  const [finish] = useFinishOnce(onFinish);

  const engineRef = useRef<Game2048Engine>(new Game2048Engine(seed + mastery));
  const [grid, setGrid] = useState<(TileItem | null)[][]>(() => engineRef.current.grid);
  const [score, setScore] = useState(0);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const playSlideSfx = () => {
    if (!soundOn) return;
    playTone(320, "triangle", 0.04, 0.06);
  };

  const playMergeSfx = () => {
    if (!soundOn) return;
    playTone(520, "sine", 0.08, 0.12);
  };

  const handleMove = useCallback(
    (direction: number) => {
      const engine = engineRef.current;
      const prevScore = engine.score;
      const moved = engine.move(direction);

      if (moved) {
        setGrid(engine.grid.map(row => [...row]));
        setScore(engine.score);

        if (engine.score > prevScore) {
          playMergeSfx();
        } else {
          playSlideSfx();
        }

        if (engine.over) {
          setTimeout(() => {
            finish({
              score: engine.score,
              label: locale === "tr" ? "Hamle Kalmadı" : "Game Over",
              detail: locale === "tr" ? `${engine.score} puan toplandı.` : `Scored ${engine.score} points.`,
              outcome: engine.won ? "success" : "failure",
            });
          }, 600);
        }
      }
    },
    [finish, locale, soundOn]
  );

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          e.preventDefault();
          handleMove(0);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          handleMove(1);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          e.preventDefault();
          handleMove(2);
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          handleMove(3);
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleMove]);

  // Touch Swipe navigation
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) > 20) {
      // 0: Up, 1: Right, 2: Down, 3: Left
      if (absDx > absDy) {
        handleMove(dx > 0 ? 1 : 3);
      } else {
        handleMove(dy > 0 ? 2 : 0);
      }
    }
  };

  return (
    <div
      className="relative w-full h-full flex flex-col items-center justify-between select-none"
      style={{ touchAction: "none" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top HUD */}
      <div className="w-full flex items-center justify-between px-4 py-2 border-b-2 border-[#1B1A1B] bg-[#F6F0E3] text-[#1B1A1B] font-mono text-sm font-bold z-10">
        <div>{locale === "tr" ? "SKOR" : "SCORE"}: {score}</div>
        <div className="text-xs text-[#293B75]">
          {locale === "tr" ? "Yön tuşları veya kaydır" : "Arrow keys or Swipe"}
        </div>
      </div>

      {/* 2048 4x4 Grid Board */}
      <div className="relative w-full flex-1 overflow-hidden flex items-center justify-center p-4">
        <div className="p-3 bg-[#1B1A1B] border-2 border-[#1B1A1B] shadow-[4px_4px_0px_#1B1A1B] max-w-[min(460px,75vh,92vw)] w-full aspect-square grid grid-cols-4 gap-2 rounded-none">
          {[0, 1, 2, 3].map((y) =>
            [0, 1, 2, 3].map((x) => {
              const tile = grid[x][y];
              const colors = tile ? TILE_COLORS[tile.value] || { bg: "#1B1A1B", text: "#FFFFFF" } : null;

              return (
                <div
                  key={`${x}-${y}`}
                  className="relative flex items-center justify-center aspect-square bg-[#EFE8DA] border border-[#1B1A1B]/20 font-mono font-black"
                >
                  {tile && (
                    <div
                      className="w-full h-full flex items-center justify-center border-2 border-[#1B1A1B] transition-transform duration-100"
                      style={{
                        backgroundColor: colors?.bg,
                        color: colors?.text,
                        fontSize: tile.value >= 1024 ? "1.1rem" : tile.value >= 128 ? "1.3rem" : "1.6rem",
                      }}
                    >
                      {tile.value}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Mobile D-Pad */}
      <div className="touch-adaptive-controls w-full flex flex-col items-center gap-1 p-2 bg-[#EAE2D0] border-t-2 border-[#1B1A1B] z-10">
        <button
          className="w-12 h-12 bg-[#F6F0E3] border-2 border-[#1B1A1B] font-bold active:bg-[#DDE4F0] text-lg rounded-none"
          onClick={() => handleMove(0)}
        >
          ▲
        </button>
        <div className="flex gap-2">
          <button
            className="w-12 h-12 bg-[#F6F0E3] border-2 border-[#1B1A1B] font-bold active:bg-[#DDE4F0] text-lg rounded-none"
            onClick={() => handleMove(3)}
          >
            ◀
          </button>
          <button
            className="w-12 h-12 bg-[#F6F0E3] border-2 border-[#1B1A1B] font-bold active:bg-[#DDE4F0] text-lg rounded-none"
            onClick={() => handleMove(2)}
          >
            ▼
          </button>
          <button
            className="w-12 h-12 bg-[#F6F0E3] border-2 border-[#1B1A1B] font-bold active:bg-[#DDE4F0] text-lg rounded-none"
            onClick={() => handleMove(1)}
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
