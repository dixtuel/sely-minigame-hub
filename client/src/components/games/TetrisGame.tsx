import React, { useEffect, useRef, useState, useCallback } from "react";
import type { GameResult } from "@/components/games/shared";
import { useFinishOnce } from "@/components/games/shared";
import {
  TETRIS_CONFIG,
  createTetrisBag,
  isPieceOccupied,
  forEachPieceBlock,
  type TetrisPieceType,
  type ActivePiece,
} from "@/lib/levelGenerators/tetris";
import { playTone } from "@/lib/sfx";
import { getAdaptiveDpr } from "@/lib/devicePerformance";

interface TetrisGameProps {
  locale: "tr" | "en";
  seed: number;
  mastery: number;
  soundOn?: boolean;
  onFinish: (result: GameResult) => void;
}

export default function TetrisGame({ locale, seed, mastery, soundOn = true, onFinish }: TetrisGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [finish] = useFinishOnce(onFinish);

  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);

  const getNextPieceRef = useRef<() => TetrisPieceType>(createTetrisBag(seed + mastery));

  // Game state references for 60fps loop
  const courtRef = useRef<(string | null)[][]>(
    Array.from({ length: TETRIS_CONFIG.ny }, () => Array(TETRIS_CONFIG.nx).fill(null))
  );

  const currentRef = useRef<ActivePiece | null>(null);
  const nextPieceRef = useRef<TetrisPieceType>(getNextPieceRef.current());

  const scoreRef = useRef(0);
  const linesRef = useRef(0);
  const gameOverRef = useRef(false);

  const playRotateSfx = () => {
    if (!soundOn) return;
    playTone(360, "triangle", 0.04, 0.08);
  };

  const playDropSfx = () => {
    if (!soundOn) return;
    playTone(180, "square", 0.06, 0.08);
  };

  const playClearSfx = (count: number) => {
    if (!soundOn) return;
    playTone(440, "sine", 0.1, 0.15);
    if (count > 1) playTone(550, "triangle", 0.12, 0.2);
    if (count >= 4) playTone(880, "sine", 0.2, 0.25);
  };

  const spawnPiece = useCallback(() => {
    const type = nextPieceRef.current;
    nextPieceRef.current = getNextPieceRef.current();

    const piece: ActivePiece = {
      type,
      dir: 0,
      x: Math.floor((TETRIS_CONFIG.nx - type.size) / 2),
      y: 0,
    };

    if (isPieceOccupied(piece.type, piece.x, piece.y, piece.dir, courtRef.current)) {
      // Court topped out
      gameOverRef.current = true;
      setIsGameOver(true);
      setTimeout(() => {
        finish({
          score: scoreRef.current,
          label: locale === "tr" ? "Kule Doldu" : "Top Out",
          detail: locale === "tr" ? `${linesRef.current} satır temizlendi, ${scoreRef.current} puan toplandı.` : `Cleared ${linesRef.current} lines with ${scoreRef.current} pts.`,
          outcome: linesRef.current >= 4 ? "success" : "failure",
        });
      }, 700);
      return;
    }

    currentRef.current = piece;
  }, [finish, locale]);

  // Movement methods
  const moveHorizontal = useCallback((dx: number) => {
    const current = currentRef.current;
    if (!current || gameOverRef.current) return;
    if (!isPieceOccupied(current.type, current.x + dx, current.y, current.dir, courtRef.current)) {
      current.x += dx;
    }
  }, []);

  const rotatePiece = useCallback(() => {
    const current = currentRef.current;
    if (!current || gameOverRef.current) return;
    const nextDir = (current.dir + 1) % 4;
    if (!isPieceOccupied(current.type, current.x, current.y, nextDir, courtRef.current)) {
      current.dir = nextDir;
      playRotateSfx();
    } else if (!isPieceOccupied(current.type, current.x - 1, current.y, nextDir, courtRef.current)) {
      // Basic wall kick left
      current.x -= 1;
      current.dir = nextDir;
      playRotateSfx();
    } else if (!isPieceOccupied(current.type, current.x + 1, current.y, nextDir, courtRef.current)) {
      // Basic wall kick right
      current.x += 1;
      current.dir = nextDir;
      playRotateSfx();
    }
  }, [soundOn]);

  const lockPiece = useCallback(() => {
    const current = currentRef.current;
    if (!current) return;

    forEachPieceBlock(current.type, current.x, current.y, current.dir, (bx, by) => {
      if (by >= 0 && by < TETRIS_CONFIG.ny && bx >= 0 && bx < TETRIS_CONFIG.nx) {
        courtRef.current[by][bx] = current.type.color;
      }
    });

    playDropSfx();
    // Award 10 points for piece lock as in original Jake Gordon Tetris
    scoreRef.current += 10;
    setScore(scoreRef.current);

    // Line clearing
    let clearedCount = 0;
    const newCourt = courtRef.current.filter(row => {
      const isFull = row.every(cell => cell != null);
      if (isFull) clearedCount++;
      return !isFull;
    });

    while (newCourt.length < TETRIS_CONFIG.ny) {
      newCourt.unshift(Array(TETRIS_CONFIG.nx).fill(null));
    }
    courtRef.current = newCourt;

    if (clearedCount > 0) {
      const award = 100 * Math.pow(2, clearedCount - 1);
      scoreRef.current += award;
      linesRef.current += clearedCount;
      setScore(scoreRef.current);
      setLines(linesRef.current);
      playClearSfx(clearedCount);
    }

    currentRef.current = null;
    spawnPiece();
  }, [spawnPiece, soundOn]);

  const dropStep = useCallback(() => {
    const current = currentRef.current;
    if (!current || gameOverRef.current) return;
    if (!isPieceOccupied(current.type, current.x, current.y + 1, current.dir, courtRef.current)) {
      current.y += 1;
    } else {
      lockPiece();
    }
  }, [lockPiece]);

  const hardDrop = useCallback(() => {
    const current = currentRef.current;
    if (!current || gameOverRef.current) return;
    while (!isPieceOccupied(current.type, current.x, current.y + 1, current.dir, courtRef.current)) {
      current.y += 1;
      scoreRef.current += 1;
    }
    setScore(scoreRef.current);
    lockPiece();
  }, [lockPiece]);

  // Initial piece
  useEffect(() => {
    spawnPiece();
  }, [spawnPiece]);

  // Game loop & drop timer
  useEffect(() => {
    let animId = 0;
    let dropTimer = 0;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const deltaSec = (time - lastTime) / 1000.0;
      lastTime = time;

      const currentSpeed = Math.max(
        TETRIS_CONFIG.speedMin,
        TETRIS_CONFIG.speedStart - linesRef.current * TETRIS_CONFIG.speedDecrement
      );

      if (!gameOverRef.current) {
        dropTimer += deltaSec;
        if (dropTimer >= currentSpeed) {
          dropTimer -= currentSpeed;
          dropStep();
        }
      }

      // RENDER COURT
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const w = canvas.clientWidth || 300;
          const h = canvas.clientHeight || 540;
          const dpr = getAdaptiveDpr(1.5);
          canvas.width = Math.floor(w * dpr);
          canvas.height = Math.floor(h * dpr);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const bw = w / TETRIS_CONFIG.nx;
          const bh = h / TETRIS_CONFIG.ny;

          ctx.fillStyle = "#F6F0E3";
          ctx.fillRect(0, 0, w, h);

          // Grid lines
          ctx.strokeStyle = "rgba(27, 26, 27, 0.08)";
          ctx.lineWidth = 1;
          for (let x = 0; x <= TETRIS_CONFIG.nx; x++) {
            ctx.beginPath();
            ctx.moveTo(x * bw, 0);
            ctx.lineTo(x * bw, h);
            ctx.stroke();
          }
          for (let y = 0; y <= TETRIS_CONFIG.ny; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * bh);
            ctx.lineTo(w, y * bh);
            ctx.stroke();
          }

          // Court placed blocks
          for (let y = 0; y < TETRIS_CONFIG.ny; y++) {
            for (let x = 0; x < TETRIS_CONFIG.nx; x++) {
              const color = courtRef.current[y][x];
              if (color) {
                ctx.fillStyle = color;
                ctx.fillRect(x * bw + 1, y * bh + 1, bw - 2, bh - 2);
                ctx.strokeStyle = "#1B1A1B";
                ctx.lineWidth = 1.8;
                ctx.strokeRect(x * bw + 1, y * bh + 1, bw - 2, bh - 2);
              }
            }
          }

          // Active piece
          const cur = currentRef.current;
          if (cur) {
            forEachPieceBlock(cur.type, cur.x, cur.y, cur.dir, (bx, by) => {
              if (by >= 0) {
                ctx.fillStyle = cur.type.color;
                ctx.fillRect(bx * bw + 1, by * bh + 1, bw - 2, bh - 2);
                ctx.strokeStyle = "#1B1A1B";
                ctx.lineWidth = 2.2;
                ctx.strokeRect(bx * bw + 1, by * bh + 1, bw - 2, bh - 2);
              }
            });
          }

          // Outer border
          ctx.strokeStyle = "#1B1A1B";
          ctx.lineWidth = 2.4;
          ctx.strokeRect(0, 0, w, h);
        }
      }

      // RENDER NEXT PREVIEW
      const nCanvas = nextCanvasRef.current;
      if (nCanvas) {
        const nctx = nCanvas.getContext("2d");
        if (nctx) {
          const nw = (nCanvas.width = nCanvas.clientWidth || 80);
          const nh = (nCanvas.height = nCanvas.clientHeight || 80);
          nctx.fillStyle = "#EFE8DA";
          nctx.fillRect(0, 0, nw, nh);

          const nextPiece = nextPieceRef.current;
          if (nextPiece) {
            const nbw = nw / 5;
            const nbh = nh / 5;
            const padX = (5 - nextPiece.size) / 2;
            const padY = (5 - nextPiece.size) / 2;

            forEachPieceBlock(nextPiece, padX, padY, 0, (bx, by) => {
              nctx.fillStyle = nextPiece.color;
              nctx.fillRect(bx * nbw + 1, by * nbh + 1, nbw - 2, nbh - 2);
              nctx.strokeStyle = "#1B1A1B";
              nctx.lineWidth = 1.6;
              nctx.strokeRect(bx * nbw + 1, by * nbh + 1, nbw - 2, nbh - 2);
            });
          }

          nctx.strokeStyle = "#1B1A1B";
          nctx.lineWidth = 2;
          nctx.strokeRect(0, 0, nw, nh);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [dropStep]);

  // Keyboard
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
        case "a":
        case "A":
          e.preventDefault();
          moveHorizontal(-1);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          e.preventDefault();
          moveHorizontal(1);
          break;
        case "ArrowUp":
        case "w":
        case "W":
          e.preventDefault();
          rotatePiece();
          break;
        case "ArrowDown":
        case "s":
        case "S":
          e.preventDefault();
          dropStep();
          break;
        case " ":
          e.preventDefault();
          hardDrop();
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveHorizontal, rotatePiece, dropStep, hardDrop]);

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleCanvasTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }
  };

  const handleCanvasTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length === 0) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Quick tap -> Rotate
    if (absDx < 15 && absDy < 15 && dt < 250) {
      rotatePiece();
      return;
    }

    if (Math.max(absDx, absDy) > 18) {
      if (absDx > absDy) {
        moveHorizontal(dx > 0 ? 1 : -1);
      } else {
        if (dy > 30) {
          if (dt < 200) hardDrop();
          else dropStep();
        } else if (dy < -20) {
          rotatePiece();
        }
      }
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between select-none" style={{ touchAction: "none" }}>
      {/* Top HUD */}
      <div className="w-full flex items-center justify-between px-4 py-2 border-b-2 border-[#1B1A1B] bg-[#F6F0E3] text-[#1B1A1B] font-mono text-sm font-bold z-10">
        <div>{locale === "tr" ? "SKOR" : "SCORE"}: {score}</div>
        <div>{locale === "tr" ? "SATIR" : "LINES"}: {lines}</div>
        <div className="flex items-center gap-2">
          <span className="text-xs">{locale === "tr" ? "SONRAKİ" : "NEXT"}:</span>
          <div className="w-8 h-8">
            <canvas ref={nextCanvasRef} className="w-full h-full block" />
          </div>
        </div>
      </div>

      {/* Canvas Area with touch gestures */}
      <div
        className="relative w-full flex-1 overflow-hidden flex items-center justify-center p-2 cursor-pointer"
        onTouchStart={handleCanvasTouchStart}
        onTouchEnd={handleCanvasTouchEnd}
      >
        <canvas ref={canvasRef} className="tetris-playfield h-full aspect-[1/2] block max-h-[min(760px,80vh)]" />
      </div>

      {/* Mobile Touch Controls */}
      <div className="touch-adaptive-controls w-full grid grid-cols-2 gap-3 p-2 bg-[#EAE2D0] border-t-2 border-[#1B1A1B] z-10 select-none">
        <div className="flex gap-2 justify-start">
          <button
            type="button"
            className="w-12 h-12 bg-[#F6F0E3] border-2 border-[#1B1A1B] font-bold active:bg-[#DDE4F0] text-lg rounded-none select-none touch-none"
            onPointerDown={(e) => { e.preventDefault(); moveHorizontal(-1); }}
          >
            ◀
          </button>
          <button
            type="button"
            className="w-12 h-12 bg-[#F6F0E3] border-2 border-[#1B1A1B] font-bold active:bg-[#DDE4F0] text-lg rounded-none select-none touch-none"
            onPointerDown={(e) => { e.preventDefault(); moveHorizontal(1); }}
          >
            ▶
          </button>
          <button
            type="button"
            className="w-12 h-12 bg-[#293B75] text-white border-2 border-[#1B1A1B] font-bold active:bg-[#1C284F] text-lg rounded-none select-none touch-none"
            onPointerDown={(e) => { e.preventDefault(); rotatePiece(); }}
          >
            ↻
          </button>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            className="w-14 h-12 bg-[#F6F0E3] border-2 border-[#1B1A1B] font-mono text-xs font-bold active:bg-[#DDE4F0] rounded-none select-none touch-none"
            onPointerDown={(e) => { e.preventDefault(); dropStep(); }}
          >
            {locale === "tr" ? "AŞAĞI" : "DOWN"}
          </button>
          <button
            type="button"
            className="w-14 h-12 bg-[#E9563F] text-white border-2 border-[#1B1A1B] font-mono text-xs font-bold active:bg-[#C9432E] rounded-none select-none touch-none"
            onPointerDown={(e) => { e.preventDefault(); hardDrop(); }}
          >
            {locale === "tr" ? "DÜŞÜR" : "DROP"}
          </button>
        </div>
      </div>
    </div>
  );
}
