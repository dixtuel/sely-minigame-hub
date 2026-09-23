import React, { useEffect, useRef, useState, useCallback } from "react";
import type { GameResult } from "@/components/games/shared";
import { useFinishOnce } from "@/components/games/shared";
import {
  SOKOBAN_LEVELS,
  parseSokobanLevel,
  isSokobanWin,
  type SokobanGameState,
  type SokobanHistoryStep,
} from "@/lib/levelGenerators/sokoban";
import { playTone } from "@/lib/sfx";
import { getAdaptiveDpr } from "@/lib/devicePerformance";

interface SokobanGameProps {
  locale: "tr" | "en";
  seed: number;
  mastery: number;
  soundOn?: boolean;
  onFinish: (result: GameResult) => void;
}

export default function SokobanGame({ locale, seed, mastery, soundOn = true, onFinish }: SokobanGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [finish] = useFinishOnce(onFinish);

  // Pick level based on daily seed & mastery (0..9)
  const initialLevelIndex = Math.min(SOKOBAN_LEVELS.length - 1, Math.max(0, (seed + mastery) % SOKOBAN_LEVELS.length));
  const [levelIndex, setLevelIndex] = useState(initialLevelIndex);

  const [gameState, setGameState] = useState<SokobanGameState>(() => parseSokobanLevel(SOKOBAN_LEVELS[initialLevelIndex]));
  const [moves, setMoves] = useState(0);
  const [pushes, setPushes] = useState(0);

  const historyRef = useRef<SokobanHistoryStep[]>([]);
  const stateRef = useRef<SokobanGameState>(gameState);
  stateRef.current = gameState;

  const playStepSfx = () => {
    if (!soundOn) return;
    playTone(280, "triangle", 0.04, 0.05);
  };

  const playPushSfx = () => {
    if (!soundOn) return;
    playTone(180, "square", 0.08, 0.1);
  };

  const playWinSfx = () => {
    if (!soundOn) return;
    playTone(440, "sine", 0.1, 0.2);
    playTone(660, "triangle", 0.15, 0.25);
    playTone(880, "sine", 0.25, 0.3);
  };

  const loadLevel = useCallback((idx: number) => {
    const nextState = parseSokobanLevel(SOKOBAN_LEVELS[idx]);
    setLevelIndex(idx);
    setGameState(nextState);
    setMoves(0);
    setPushes(0);
    historyRef.current = [];
  }, []);

  const movePlayer = useCallback(
    (dx: number, dy: number) => {
      const state = stateRef.current;
      const nx = state.player.x + dx;
      const ny = state.player.y + dy;

      // Check wall
      if (state.walls.some(w => w.x === nx && w.y === ny)) return;

      // Check box
      const boxIdx = state.boxes.findIndex(b => b.x === nx && b.y === ny);
      if (boxIdx !== -1) {
        const bnx = nx + dx;
        const bny = ny + dy;

        // Check obstacle behind box
        const wallBehind = state.walls.some(w => w.x === bnx && w.y === bny);
        const boxBehind = state.boxes.some(b => b.x === bnx && b.y === bny);
        if (wallBehind || boxBehind) return;

        // Save history for undo
        historyRef.current.push({
          player: { ...state.player },
          boxes: state.boxes.map(b => ({ ...b })),
          moves,
          pushes,
        });

        // Push box
        const newBoxes = state.boxes.map((b, i) => (i === boxIdx ? { x: bnx, y: bny } : b));
        const nextState: SokobanGameState = {
          ...state,
          player: { x: nx, y: ny },
          boxes: newBoxes,
        };

        setGameState(nextState);
        setMoves(m => m + 1);
        setPushes(p => p + 1);
        playPushSfx();

        if (isSokobanWin(nextState)) {
          playWinSfx();
          const finalScore = Math.max(100, 1000 - (moves + 1) * 10 - (pushes + 1) * 5);
          setTimeout(() => {
            finish({
              score: finalScore,
              label: locale === "tr" ? "İstif Tamamlandı" : "Level Solved",
              detail: locale === "tr" ? `Tüm kutular ${moves + 1} hamle ve ${pushes + 1} itmede yerleştirildi.` : `Solved in ${moves + 1} moves, ${pushes + 1} pushes.`,
              outcome: "success",
            });
          }, 600);
        }
      } else {
        // Move into empty floor
        historyRef.current.push({
          player: { ...state.player },
          boxes: state.boxes.map(b => ({ ...b })),
          moves,
          pushes,
        });

        setGameState({
          ...state,
          player: { x: nx, y: ny },
        });
        setMoves(m => m + 1);
        playStepSfx();
      }
    },
    [moves, pushes, finish, locale, soundOn]
  );

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current.pop()!;
    setGameState(s => ({
      ...s,
      player: prev.player,
      boxes: prev.boxes,
    }));
    setMoves(prev.moves);
    setPushes(prev.pushes);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          e.preventDefault();
          movePlayer(0, -1);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          e.preventDefault();
          movePlayer(0, 1);
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          movePlayer(-1, 0);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          movePlayer(1, 0);
          break;
        case "u":
        case "U":
          e.preventDefault();
          undo();
          break;
        case "r":
        case "R":
          e.preventDefault();
          loadLevel(levelIndex);
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [movePlayer, undo, loadLevel, levelIndex]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.clientWidth || 560;
    const height = canvas.clientHeight || 480;
    const dpr = getAdaptiveDpr(1.5);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#F6F0E3"; // SELY Paper
    ctx.fillRect(0, 0, width, height);

    const state = gameState;
    const cellSize = Math.min(Math.floor((width - 40) / state.width), Math.floor((height - 40) / state.height), 48);

    const offsetX = Math.floor((width - state.width * cellSize) / 2);
    const offsetY = Math.floor((height - state.height * cellSize) / 2);

    // Floor
    ctx.fillStyle = "#EFE8DA";
    ctx.fillRect(offsetX, offsetY, state.width * cellSize, state.height * cellSize);

    // Grid border
    ctx.strokeStyle = "rgba(27, 26, 27, 0.1)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= state.width; x++) {
      ctx.beginPath();
      ctx.moveTo(offsetX + x * cellSize, offsetY);
      ctx.lineTo(offsetX + x * cellSize, offsetY + state.height * cellSize);
      ctx.stroke();
    }
    for (let y = 0; y <= state.height; y++) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + y * cellSize);
      ctx.lineTo(offsetX + state.width * cellSize, offsetY + y * cellSize);
      ctx.stroke();
    }

    // Walls
    for (const wall of state.walls) {
      const wx = offsetX + wall.x * cellSize;
      const wy = offsetY + wall.y * cellSize;
      ctx.fillStyle = "#1B1A1B";
      ctx.fillRect(wx, wy, cellSize, cellSize);

      // Inner brick outline
      ctx.strokeStyle = "#383638";
      ctx.lineWidth = 2;
      ctx.strokeRect(wx + 2, wy + 2, cellSize - 4, cellSize - 4);
    }

    // Targets
    for (const target of state.targets) {
      const tx = offsetX + target.x * cellSize + cellSize / 2;
      const ty = offsetY + target.y * cellSize + cellSize / 2;
      ctx.fillStyle = "#E5B341";
      ctx.beginPath();
      ctx.arc(tx, ty, cellSize * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1B1A1B";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Boxes
    for (const box of state.boxes) {
      const bx = offsetX + box.x * cellSize + 4;
      const by = offsetY + box.y * cellSize + 4;
      const bSize = cellSize - 8;
      const onTarget = state.targets.some(t => t.x === box.x && t.y === box.y);

      ctx.fillStyle = onTarget ? "#296A55" : "#E9563F";
      ctx.fillRect(bx, by, bSize, bSize);

      ctx.strokeStyle = "#1B1A1B";
      ctx.lineWidth = 2.4;
      ctx.strokeRect(bx, by, bSize, bSize);

      // Cross mark on box
      ctx.beginPath();
      ctx.moveTo(bx + 6, by + 6);
      ctx.lineTo(bx + bSize - 6, by + bSize - 6);
      ctx.moveTo(bx + bSize - 6, by + 6);
      ctx.lineTo(bx + 6, by + bSize - 6);
      ctx.stroke();
    }

    // Player
    const px = offsetX + state.player.x * cellSize + cellSize / 2;
    const py = offsetY + state.player.y * cellSize + cellSize / 2;
    const pr = cellSize * 0.36;

    ctx.fillStyle = "#293B75";
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1B1A1B";
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Eyes
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(px - pr * 0.35, py - pr * 0.2, pr * 0.25, 0, Math.PI * 2);
    ctx.arc(px + pr * 0.35, py - pr * 0.2, pr * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1B1A1B";
    ctx.beginPath();
    ctx.arc(px - pr * 0.35, py - pr * 0.2, pr * 0.12, 0, Math.PI * 2);
    ctx.arc(px + pr * 0.35, py - pr * 0.2, pr * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }, [gameState]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between select-none" style={{ touchAction: "none" }}>
      {/* Top HUD */}
      <div className="w-full flex items-center justify-between px-4 py-2 border-b-2 border-[#1B1A1B] bg-[#F6F0E3] text-[#1B1A1B] font-mono text-sm font-bold z-10">
        <div>
          {locale === "tr" ? "SEVİYE" : "LEVEL"}: {levelIndex + 1} ({SOKOBAN_LEVELS[levelIndex].name})
        </div>
        <div>
          {locale === "tr" ? "HAMLE" : "MOVES"}: {moves} | {locale === "tr" ? "İTME" : "PUSHES"}: {pushes}
        </div>
        <div className="flex gap-2">
          <button
            className="px-2 py-1 bg-[#EAE2D0] border-2 border-[#1B1A1B] text-xs font-bold hover:bg-[#DDE4F0]"
            onClick={undo}
          >
            {locale === "tr" ? "Geri Al (U)" : "Undo (U)"}
          </button>
          <button
            className="px-2 py-1 bg-[#EAE2D0] border-2 border-[#1B1A1B] text-xs font-bold hover:bg-[#DDE4F0]"
            onClick={() => loadLevel(levelIndex)}
          >
            {locale === "tr" ? "Yenile (R)" : "Reset (R)"}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative w-full flex-1 overflow-hidden flex items-center justify-center p-2">
        <canvas ref={canvasRef} className="w-full h-full block max-w-2xl max-h-[min(640px,78vh)]" />
      </div>

      {/* Mobile D-Pad Controls */}
      <div className="touch-adaptive-controls w-full flex flex-col items-center gap-1.5 p-2 bg-[#EAE2D0] border-t-2 border-[#1B1A1B] z-10 select-none">
        <button
          type="button"
          className="w-12 h-12 bg-[#F6F0E3] border-2 border-[#1B1A1B] font-bold active:bg-[#DDE4F0] text-lg rounded-none select-none touch-none shadow-[2px_2px_0px_#1B1A1B]"
          onPointerDown={(e) => { e.preventDefault(); movePlayer(0, -1); }}
        >
          ▲
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            className="w-12 h-12 bg-[#F6F0E3] border-2 border-[#1B1A1B] font-bold active:bg-[#DDE4F0] text-lg rounded-none select-none touch-none shadow-[2px_2px_0px_#1B1A1B]"
            onPointerDown={(e) => { e.preventDefault(); movePlayer(-1, 0); }}
          >
            ◀
          </button>
          <button
            type="button"
            className="w-12 h-12 bg-[#F6F0E3] border-2 border-[#1B1A1B] font-bold active:bg-[#DDE4F0] text-lg rounded-none select-none touch-none shadow-[2px_2px_0px_#1B1A1B]"
            onPointerDown={(e) => { e.preventDefault(); movePlayer(0, 1); }}
          >
            ▼
          </button>
          <button
            type="button"
            className="w-12 h-12 bg-[#F6F0E3] border-2 border-[#1B1A1B] font-bold active:bg-[#DDE4F0] text-lg rounded-none select-none touch-none shadow-[2px_2px_0px_#1B1A1B]"
            onPointerDown={(e) => { e.preventDefault(); movePlayer(1, 0); }}
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
