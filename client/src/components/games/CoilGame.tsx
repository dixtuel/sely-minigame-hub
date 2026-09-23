import { useEffect, useRef } from "react";
import { useFinishOnce } from "@/components/games/shared";
import { getAdaptiveDpr } from "@/lib/devicePerformance";
import { generateCoilRun, COIL_GRID, type CoilPoint } from "@/lib/levelGenerators/coil";
import { directionFromCoilSwipe } from "@/lib/coilControls";
import { mulberry32 } from "@/lib/rng";
import { playTone } from "@/lib/sfx";

interface CoilGameProps {
  locale: "tr" | "en";
  seed: number;
  mastery: number;
  soundOn?: boolean;
  onHudChange?: (hud: { score: number; pace: number }) => void;
  onFinish: (result: { score: number; label: string; detail: string; outcome: "success" | "failure" }) => void;
}

type Direction = CoilPoint;
type DirectionKey = "left" | "right" | "up" | "down";
type CoilLocale = CoilGameProps["locale"];

const DIRECTIONS: Record<DirectionKey, Direction> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

const PALETTE = {
  night: "#172842",
  board: "#1a2b32",
  grid: "rgba(119, 153, 139, .085)",
  border: "#304a49",
  snake: "#5fba91",
  head: "#a0e0b3",
  fruit: "#efbd5d",
};

function loc(locale: CoilLocale, tr: string, en: string) {
  return locale === "tr" ? tr : en;
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawFruit(ctx: CanvasRenderingContext2D, point: CoilPoint, cell: number, x: number, y: number, now: number) {
  const centerX = x + (point.x + 0.5) * cell;
  const centerY = y + (point.y + 0.5) * cell;
  const pulse = Math.sin(now / 320) * 0.045 + 1;
  const radius = Math.max(2, cell * 0.28 * pulse);

  ctx.fillStyle = "rgba(239,189,93,.12)";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.fruit;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#7f9c66";
  ctx.lineWidth = Math.max(1, cell * 0.075);
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - radius * 0.75);
  ctx.quadraticCurveTo(centerX + radius * 0.25, centerY - radius * 1.55, centerX + radius * 0.8, centerY - radius * 1.18);
  ctx.stroke();
}

export default function CoilGame({ locale, seed, mastery, soundOn = true, onFinish, onHudChange }: CoilGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [finish] = useFinishOnce(onFinish);
  const propsRef = useRef({ locale, soundOn, finish });
  const onHudChangeRef = useRef(onHudChange);
  const swipeStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);
  const turnRef = useRef<(direction: DirectionKey) => void>(() => {});
  propsRef.current = { locale, soundOn, finish };
  onHudChangeRef.current = onHudChange;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx) return;

    const run = generateCoilRun(seed, mastery);
    const random = mulberry32(seed ^ 0x46525549);
    let width = 1;
    let height = 1;
    let dpr = getAdaptiveDpr(1.5);
    let raf = 0;
    let last = performance.now();
    let accumulated = 0;
    let alive = true;
    let reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const syncReducedMotion = () => { reducedMotion = media?.matches ?? false; };
    media?.addEventListener?.("change", syncReducedMotion);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      width = rect.width;
      height = rect.height;
      dpr = getAdaptiveDpr(1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(canvas);

    const state = {
      snake: [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }],
      direction: { ...DIRECTIONS.right },
      turns: [] as Direction[],
      food: { ...run.initialFood },
      fruitCount: 0,
      score: 0,
    };

    const requestTurn = (key: DirectionKey) => {
      if (!alive) return;
      const next = DIRECTIONS[key];
      const previous = state.turns.at(-1) ?? state.direction;
      if (next.x === previous.x && next.y === previous.y) return;
      if (next.x === -previous.x && next.y === -previous.y) return;
      if (state.turns.length < 2) state.turns.push(next);
    };
    turnRef.current = requestTurn;

    const complete = (outcome: "success" | "failure", detail: string) => {
      alive = false;
      const current = propsRef.current;
      if (current.soundOn) playTone(outcome === "success" ? 620 : 180, outcome === "success" ? "sine" : "sawtooth", 0.22, 0.1);
      current.finish({
        score: state.score,
        label: outcome === "success" ? loc(current.locale, "Tahta temizlendi", "Board cleared") : loc(current.locale, "Yolun sonu", "Run over"),
        detail,
        outcome,
      });
    };

    const spawnFood = (): CoilPoint | null => {
      const free: CoilPoint[] = [];
      for (let y = 0; y < COIL_GRID; y += 1) {
        for (let x = 0; x < COIL_GRID; x += 1) {
          if (!state.snake.some(segment => segment.x === x && segment.y === y)) free.push({ x, y });
        }
      }
      if (!free.length) return null;
      return free[Math.floor(random() * free.length)];
    };

    const currentPaceIndex = () => run.milestones.findIndex(milestone => state.fruitCount < milestone.fruitCount);
    const stepSeconds = () => {
      const index = currentPaceIndex();
      return run.milestones[index < 0 ? run.milestones.length - 1 : index].stepSeconds;
    };
    const publishHud = () => {
      const index = currentPaceIndex();
      onHudChangeRef.current?.({
        score: state.score,
        pace: index < 0 ? run.milestones.length + 1 : index + 1,
      });
    };
    publishHud();

    const draw = (now: number) => {
      ctx.fillStyle = PALETTE.night;
      ctx.fillRect(0, 0, width, height);

      const availableHeight = Math.max(40, height - 32);
      const availableWidth = Math.max(40, width - 24);
      const cell = Math.max(1, Math.floor(Math.min(availableWidth, availableHeight) / COIL_GRID));
      const boardSize = cell * COIL_GRID;
      const boardX = Math.floor((width - boardSize) / 2);
      const boardY = Math.floor((height - boardSize) / 2);

      const panelX = boardX - 4;
      const panelY = boardY - 4;
      const panelSize = boardSize + 8;
      ctx.fillStyle = PALETTE.board;
      ctx.strokeStyle = PALETTE.border;
      ctx.lineWidth = 1;
      roundedRect(ctx, panelX, panelY, panelSize, panelSize, Math.max(8, cell * 0.42));
      ctx.fill();
      ctx.stroke();

      ctx.save();
      roundedRect(ctx, boardX, boardY, boardSize, boardSize, Math.max(5, cell * 0.24));
      ctx.clip();
      ctx.fillStyle = PALETTE.board;
      ctx.fillRect(boardX, boardY, boardSize, boardSize);
      if (cell >= 9) {
        ctx.strokeStyle = PALETTE.grid;
        ctx.lineWidth = 1;
        for (let grid = 1; grid < COIL_GRID; grid += 1) {
          const pos = Math.round(grid * cell) + 0.5;
          ctx.beginPath(); ctx.moveTo(boardX + pos, boardY); ctx.lineTo(boardX + pos, boardY + boardSize); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(boardX, boardY + pos); ctx.lineTo(boardX + boardSize, boardY + pos); ctx.stroke();
        }
      }

      drawFruit(ctx, state.food, cell, boardX, boardY, reducedMotion ? 0 : now);

      const inset = Math.max(1, cell * 0.09);
      const segmentSize = cell - inset * 2;
      state.snake.forEach((segment, index) => {
        const x = boardX + segment.x * cell + inset;
        const y = boardY + segment.y * cell + inset;
        const radius = Math.max(2, cell * (index === 0 ? 0.35 : 0.29));
        ctx.fillStyle = index === 0 ? PALETTE.head : PALETTE.snake;
        roundedRect(ctx, x, y, segmentSize, segmentSize, radius);
        ctx.fill();

        if (index === 0 && cell >= 7) {
          const eyeRadius = Math.max(1, cell * 0.065);
          const eyeForwardX = state.direction.x * cell * 0.13;
          const eyeForwardY = state.direction.y * cell * 0.13;
          const eyeSideX = state.direction.y * cell * 0.17;
          const eyeSideY = -state.direction.x * cell * 0.17;
          ctx.fillStyle = PALETTE.night;
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(
              boardX + (segment.x + 0.5) * cell + eyeForwardX + eyeSideX * side,
              boardY + (segment.y + 0.5) * cell + eyeForwardY + eyeSideY * side,
              eyeRadius,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
        }
      });
      ctx.restore();

    };

    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (!document.hidden) {
        accumulated += dt;
        if (accumulated >= stepSeconds()) {
          accumulated -= stepSeconds();
          if (state.turns.length) state.direction = state.turns.shift()!;
          const head = {
            x: state.snake[0].x + state.direction.x,
            y: state.snake[0].y + state.direction.y,
          };
          const eats = head.x === state.food.x && head.y === state.food.y;
          const collisionLength = state.snake.length - (eats ? 0 : 1);
          const hitWall = head.x < 0 || head.y < 0 || head.x >= COIL_GRID || head.y >= COIL_GRID;
          const hitSnake = state.snake.slice(0, collisionLength).some(segment => segment.x === head.x && segment.y === head.y);

          if (hitWall || hitSnake) {
            complete("failure", loc(propsRef.current.locale, `${state.fruitCount} meyve topladın · ${state.score} puan`, `${state.fruitCount} fruit collected · ${state.score} points`));
            return;
          }

          state.snake.unshift(head);
          if (eats) {
            state.fruitCount += 1;
            const milestone = run.milestones.find(item => item.fruitCount === state.fruitCount);
            state.score += 10 + (milestone?.bonus ?? 0);
            publishHud();
            if (propsRef.current.soundOn) playTone(milestone ? 780 : 620, "sine", 0.075, 0.055);
            const nextFood = spawnFood();
            if (!nextFood) {
              complete("success", loc(propsRef.current.locale, "Bütün alanı doldurdun.", "You filled the entire board."));
              return;
            }
            state.food = nextFood;
          } else {
            state.snake.pop();
          }
        }
        draw(now);
      }
      raf = requestAnimationFrame(loop);
    };

    const keyMap: Record<string, DirectionKey> = {
      arrowleft: "left", a: "left",
      arrowright: "right", d: "right",
      arrowup: "up", w: "up",
      arrowdown: "down", s: "down",
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const key = keyMap[event.key.toLowerCase()];
      if (!key || event.repeat) return;
      event.preventDefault();
      requestTurn(key);
    };
    window.addEventListener("keydown", onKeyDown);
    draw(performance.now());
    raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      media?.removeEventListener?.("change", syncReducedMotion);
      window.removeEventListener("keydown", onKeyDown);
      turnRef.current = () => {};
    };
  }, [mastery, seed]);

  const onCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!event.isPrimary) return;
    event.preventDefault();
    swipeStartRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onCanvasPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const start = swipeStartRef.current;
    if (!start || !event.isPrimary || start.pointerId !== event.pointerId) return;
    swipeStartRef.current = null;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const direction = directionFromCoilSwipe(dx, dy);
    if (direction) turnRef.current(direction);
  };

  return (
    <div className="coil-game">
      <div className="arcade-game-frame arcade-frame-coil">
        <canvas
          ref={canvasRef}
          className="coil-canvas"
          aria-label={loc(locale, "Yılan oyunu alanı. Kaydırarak veya yön tuşlarıyla hareket et.", "Snake game board. Swipe or use the direction keys to move.")}
          onPointerDown={onCanvasPointerDown}
          onPointerUp={onCanvasPointerUp}
          onPointerCancel={event => {
            if (swipeStartRef.current?.pointerId === event.pointerId) swipeStartRef.current = null;
          }}
        />
      </div>
    </div>
  );
}
