import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useFinishOnce } from "@/components/games/shared";
import { getAdaptiveDpr } from "@/lib/devicePerformance";
import { BREAKLINE_STAGE_COUNT, generateBreaklineRun, type BreaklineStage } from "@/lib/levelGenerators/breakline";
import { playTone } from "@/lib/sfx";

interface BreaklineGameProps {
  locale: "tr" | "en";
  seed: number;
  mastery: number;
  soundOn?: boolean;
  onHudChange?: (hud: { stage: number; stages: number; pattern: string; score: number; lives: number }) => void;
  onFinish: (result: { score: number; label: string; detail: string; outcome: "success" | "failure" }) => void;
}

interface Brick {
  row: number;
  col: number;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

const BALL_R = 8;
const PADDLE_H = 12;
const BRICK_GAP_X = 4;
const BRICK_GAP_Y = 4;
const BRICK_MARGIN = 22;
const BRICK_TOP = 22;
const STAGE_COLORS = ["#51c7b1", "#e5b341", "#ee775e", "#9c8be8"];

function loc(locale: BreaklineGameProps["locale"], tr: string, en: string) {
  return locale === "tr" ? tr : en;
}

function patternName(patternIndex: number, locale: BreaklineGameProps["locale"]) {
  const names = locale === "tr"
    ? ["Elmas", "Çapraz", "Yay", "Dalga", "Sütun", "Kelebek", "Kale", "Mızrak", "Çerçeve", "Merdiven", "Kapı", "Kum Saati", "Şeritler", "Mozaik", "Örgü", "Katmanlar", "Ok", "İkiz Kale", "Koza", "Yıldız", "Siper", "Halka", "Izgara"]
    : ["Diamond", "Cross", "Arc", "Wave", "Pillars", "Butterfly", "Fortress", "Spear", "Frame", "Staircase", "Gate", "Hourglass", "Bands", "Mosaic", "Weave", "Layers", "Arrow", "Twin Forts", "Cocoon", "Star", "Bulwark", "Ring", "Grid"];
  return names[patternIndex] ?? names[0];
}

function seededRng(seed: number) {
  let value = (seed >>> 0) || 1;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function BreaklineGame({ locale, seed, mastery, soundOn = true, onFinish, onHudChange }: BreaklineGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [finish] = useFinishOnce(onFinish);
  const paddleTargetRef = useRef<number | null>(null);
  const inputRef = useRef({ left: false, right: false });
  const mouseTrackingRef = useRef(true);
  const localeRef = useRef(locale);
  const soundOnRef = useRef(soundOn);
  const onHudChangeRef = useRef(onHudChange);
  localeRef.current = locale;
  soundOnRef.current = soundOn;
  onHudChangeRef.current = onHudChange;
  const [mouseTracking, setMouseTracking] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx) return;

    const run = generateBreaklineRun(seed, mastery);
    const dpr = getAdaptiveDpr(1.5);
    const random = seededRng((seed ^ Math.imul(mastery + 71, 0x27d4eb2d)) >>> 0);
    let width = 0;
    let height = 0;
    let alive = true;
    let raf = 0;
    let last = performance.now();
    let points = 0;
    let lives = 3;
    let stageIndex = 0;
    let stageTransition = 0;
    let serveDelay = 0;
    let serveContext: "new-stage" | "life-lost" | null = null;
    let paddleX = 0;
    let brickW = 0;
    let brickH = 20;
    let pitchY = 24;
    let bricks: Brick[] = [];
    let activeStage: BreaklineStage = run.stages[0];
    const touchQuery = window.matchMedia("(any-pointer: coarse), (any-hover: none)");
    let touchMode = touchQuery.matches;

    const paddleW = () => Math.min(width * 0.23, 128);
    const paddleY = () => height - (touchMode ? 108 : 58);
    const ball = { x: 0, y: 0, vx: 0, vy: 0 };
    const baseBallSpeed = () => 244 + run.mastery * 13 + stageIndex * 18;

    const serve = (delay: number, context: typeof serveContext = null) => {
      const speed = baseBallSpeed();
      const angle = (random() - 0.5) * 0.72;
      ball.x = paddleX;
      ball.y = paddleY() - 22;
      ball.vx = Math.sin(angle) * speed;
      ball.vy = -Math.cos(angle) * speed;
      serveDelay = delay;
      serveContext = context;
    };

    const createStage = (stage: BreaklineStage) => {
      activeStage = stage;
      bricks = [];
      for (let row = 0; row < run.rows; row++) {
        for (let col = 0; col < run.cols; col++) {
          const hp = Number(stage.cells[row * run.cols + col] ?? 0);
          if (hp > 0) bricks.push({ row, col, hp, maxHp: hp, x: 0, y: 0, w: 0, h: 0 });
        }
      }
      layoutBricks();
    };

    const publishHud = () => onHudChangeRef.current?.({
      stage: stageIndex + 1,
      stages: BREAKLINE_STAGE_COUNT,
      pattern: patternName(activeStage.patternIndex, localeRef.current),
      score: points,
      lives,
    });

    // Resizing only changes geometry: cell health and the seeded layout survive intact.
    const layoutBricks = () => {
      const oldBrickW = brickW;
      const availableWidth = Math.max(240, width - BRICK_MARGIN * 2);
      brickW = (availableWidth - (run.cols - 1) * BRICK_GAP_X) / run.cols;
      const usableHeight = Math.max(180, height - BRICK_TOP - (touchMode ? 145 : 95));
      pitchY = Math.min(28, Math.max(19, usableHeight / run.rows));
      brickH = Math.max(14, pitchY - BRICK_GAP_Y);
      const totalWidth = run.cols * brickW + (run.cols - 1) * BRICK_GAP_X;
      const left = (width - totalWidth) / 2;

      for (const brick of bricks) {
        brick.x = left + brick.col * (brickW + BRICK_GAP_X);
        brick.y = BRICK_TOP + brick.row * pitchY;
        brick.w = brickW;
        brick.h = brickH;
      }

      if (oldBrickW > 0) paddleX = Math.max(paddleW() / 2, Math.min(width - paddleW() / 2, paddleX));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const oldWidth = width;
      const oldHeight = height;
      width = Math.max(280, rect.width || 480);
      height = Math.max(360, rect.height || 580);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (oldWidth > 0 && oldHeight > 0) {
        const sx = width / oldWidth;
        const sy = height / oldHeight;
        paddleX *= sx;
        ball.x *= sx;
        ball.y *= sy;
        ball.vx *= sx;
        ball.vy *= sy;
      } else {
        paddleX = width / 2;
      }
      layoutBricks();
    };

    const end = (success: boolean) => {
      if (!alive) return;
      alive = false;
      if (soundOnRef.current) playTone(success ? 660 : 200, success ? "sine" : "sawtooth", success ? 0.4 : 0.25, 0.1);
      finish({
        score: points + (success ? 120 + run.mastery * 20 : 0),
        label: loc(localeRef.current, success ? "Sekiz Düzen Temizlendi" : "Hat Koptu", success ? "Eight Patterns Cleared" : "Line Lost"),
        detail: success
          ? loc(localeRef.current, `${points} puan · ${BREAKLINE_STAGE_COUNT} düzen tamamlandı.`, `${points} points · ${BREAKLINE_STAGE_COUNT} patterns cleared.`)
          : loc(localeRef.current, `${points} puan · ${stageIndex + 1}. düzende durdun.`, `${points} points · stopped on pattern ${stageIndex + 1}.`),
        outcome: success ? "success" : "failure",
      });
    };

    const setStage = (nextIndex: number) => {
      if (nextIndex >= run.stages.length) {
        end(true);
        return;
      }
      stageIndex = nextIndex;
      createStage(run.stages[stageIndex]);
      publishHud();
      paddleTargetRef.current = null;
      serve(0.9, "new-stage");
      stageTransition = 1.0;
      if (soundOnRef.current) {
        playTone(500 + stageIndex * 70, "triangle", 0.1, 0.08);
        playTone(720 + stageIndex * 55, "sine", 0.12, 0.1);
      }
    };

    const roundedRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fill();
    };

    const draw = () => {
      ctx.fillStyle = "#172842";
      ctx.fillRect(0, 0, width, height);

      const backgroundGlow = ctx.createRadialGradient(width * 0.5, height * 0.25, 12, width * 0.5, height * 0.25, height * 0.8);
      backgroundGlow.addColorStop(0, "rgba(41,59,117,0.19)");
      backgroundGlow.addColorStop(1, "rgba(23,40,66,0)");
      ctx.fillStyle = backgroundGlow;
      ctx.fillRect(0, 0, width, height);

      const accent = STAGE_COLORS[stageIndex % STAGE_COLORS.length];

      for (const brick of bricks) {
        if (brick.hp <= 0) continue;
        const color = brick.hp === 1 ? accent : brick.hp === 2 ? "#e5b341" : "#ee775e";
        ctx.shadowColor = color;
        ctx.shadowBlur = brick.hp > 1 ? 8 : 4;
        ctx.fillStyle = color;
        roundedRect(brick.x, brick.y, brick.w, brick.h, Math.min(5, brick.h / 4));
        ctx.shadowBlur = 0;

        ctx.fillStyle = "rgba(255,255,255,0.2)";
        roundedRect(brick.x + 2, brick.y + 2, brick.w - 4, Math.max(2, brick.h * 0.18), 2);
        if (brick.maxHp > 1) {
          ctx.fillStyle = "rgba(23,40,66,0.7)";
          ctx.font = `700 ${Math.max(9, Math.min(13, brick.h * 0.58))}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(brick.hp), brick.x + brick.w / 2, brick.y + brick.h * 0.62);
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
        }
      }

      const py = paddleY();
      const pw = paddleW();
      ctx.shadowColor = "#f6f0e3";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#f6f0e3";
      roundedRect(paddleX - pw / 2, py, pw, PADDLE_H, 6);
      ctx.shadowBlur = 0;

      ctx.shadowColor = "#e5b341";
      ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = "#fff8e8"; ctx.fill();
      ctx.shadowBlur = 0;

      if (serveDelay > 0 && serveContext) {
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(246,240,227,0.78)";
        ctx.font = "10px monospace";
        const message = serveContext === "new-stage"
          ? loc(localeRef.current, "YENİ DÜZEN", "NEXT PATTERN")
          : loc(localeRef.current, `TOP DÜŞTÜ · ${lives}/3 CAN KALDI`, `BALL LOST · ${lives}/3 LIVES LEFT`);
        ctx.fillText(message, width / 2, height * 0.56);
        ctx.textAlign = "left";
      }
    };

    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (document.hidden) {
        raf = requestAnimationFrame(loop);
        return;
      }

      const pw = paddleW();
      const target = paddleTargetRef.current;
      if (target !== null) paddleX += (target - paddleX) * Math.min(1, dt * 22);
      else {
        const controls = inputRef.current;
        paddleX += (controls.right ? 440 : controls.left ? -440 : 0) * dt;
      }
      paddleX = Math.max(pw / 2, Math.min(width - pw / 2, paddleX));

      if (stageTransition > 0) stageTransition = Math.max(0, stageTransition - dt);
      else if (serveDelay > 0) {
        serveDelay = Math.max(0, serveDelay - dt);
        ball.x = paddleX;
        ball.y = paddleY() - 22;
      } else {
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        if (ball.x - BALL_R < 0) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); }
        if (ball.x + BALL_R > width) { ball.x = width - BALL_R; ball.vx = -Math.abs(ball.vx); }
        if (ball.y - BALL_R < 0) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); }

        const py = paddleY();
        if (
          ball.vy > 0
          && ball.y + BALL_R >= py
          && ball.y - BALL_R <= py + PADDLE_H
          && ball.x >= paddleX - pw / 2 - BALL_R
          && ball.x <= paddleX + pw / 2 + BALL_R
        ) {
          const hit = Math.max(-1, Math.min(1, (ball.x - paddleX) / (pw / 2)));
          const angle = hit * (Math.PI / 3.4);
          const speed = Math.min(520, Math.hypot(ball.vx, ball.vy) + 5);
          ball.vx = Math.sin(angle) * speed;
          ball.vy = -Math.abs(Math.cos(angle) * speed);
          ball.y = py - BALL_R;
          if (soundOnRef.current) playTone(380, "sine", 0.045, 0.05);
        }

        if (ball.y - BALL_R > height + 8) {
          lives -= 1;
          publishHud();
          if (lives <= 0) {
            end(false);
            return;
          }
          paddleX = width / 2;
          serve(0.65, "life-lost");
          if (soundOnRef.current) playTone(230, "triangle", 0.16, 0.08);
        }

        let hitBrick: Brick | undefined;
        for (const brick of bricks) {
          if (brick.hp <= 0) continue;
          if (
            ball.x + BALL_R > brick.x
            && ball.x - BALL_R < brick.x + brick.w
            && ball.y + BALL_R > brick.y
            && ball.y - BALL_R < brick.y + brick.h
          ) {
            hitBrick = brick;
            break;
          }
        }

        if (hitBrick) {
          const overlapLeft = ball.x + BALL_R - hitBrick.x;
          const overlapRight = hitBrick.x + hitBrick.w - (ball.x - BALL_R);
          const overlapTop = ball.y + BALL_R - hitBrick.y;
          const overlapBottom = hitBrick.y + hitBrick.h - (ball.y - BALL_R);
          if (Math.min(overlapLeft, overlapRight) < Math.min(overlapTop, overlapBottom)) ball.vx *= -1;
          else ball.vy *= -1;
          hitBrick.hp -= 1;
          points += hitBrick.hp === 0 ? 10 + hitBrick.maxHp * 4 : 3;
          publishHud();
          if (soundOnRef.current) playTone(hitBrick.hp === 0 ? 620 + Math.min(points, 500) * 0.12 : 390, "square", 0.045, 0.045);
        }

        if (!bricks.some(brick => brick.hp > 0)) {
          points += 35 + stageIndex * 15;
          setStage(stageIndex + 1);
          // The last pattern ends the run inside setStage; do not render or
          // schedule another frame after handing control to the result panel.
          if (!alive) return;
        }
      }

      draw();
      raf = requestAnimationFrame(loop);
    };

    resize();
    createStage(run.stages[0]);
    publishHud();
    serve(0);
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(canvas);
    const onTouchChange = (event: MediaQueryListEvent) => {
      touchMode = event.matches;
      layoutBricks();
      paddleX = Math.max(paddleW() / 2, Math.min(width - paddleW() / 2, paddleX));
      if (serveDelay > 0) {
        ball.x = paddleX;
        ball.y = paddleY() - 22;
      }
    };
    touchQuery.addEventListener?.("change", onTouchChange);

    const onPointerMove = (event: PointerEvent) => {
      if (!mouseTrackingRef.current) return;
      const rect = canvas.getBoundingClientRect();
      paddleTargetRef.current = event.clientX - rect.left;
    };
    const onPointerLeave = () => {
      if (mouseTrackingRef.current) paddleTargetRef.current = null;
    };
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);

    const onKey = (event: KeyboardEvent, down: boolean) => {
      const key = event.key.toLowerCase();
      if (key !== "arrowleft" && key !== "a" && key !== "arrowright" && key !== "d") return;
      event.preventDefault();
      if (key === "arrowleft" || key === "a") inputRef.current.left = down;
      if (key === "arrowright" || key === "d") inputRef.current.right = down;
      if (down) paddleTargetRef.current = null;
    };
    const keyDown = (event: KeyboardEvent) => onKey(event, true);
    const keyUp = (event: KeyboardEvent) => onKey(event, false);
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      touchQuery.removeEventListener?.("change", onTouchChange);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      inputRef.current.left = false;
      inputRef.current.right = false;
    };
  }, [finish, mastery, seed]);

  const bindTouch = (direction: "left" | "right") => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
      inputRef.current[direction] = true;
      paddleTargetRef.current = null;
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch {}
      inputRef.current[direction] = false;
    },
    onPointerCancel: () => { inputRef.current[direction] = false; },
    onLostPointerCapture: () => { inputRef.current[direction] = false; },
    onContextMenu: (event: React.SyntheticEvent) => event.preventDefault(),
  });

  const toggleMouse = () => {
    const next = !mouseTrackingRef.current;
    mouseTrackingRef.current = next;
    setMouseTracking(next);
    if (!next) paddleTargetRef.current = null;
  };

  return (
    <div className="breakline-game">
      <div className="arcade-game-frame arcade-frame-breakline">
        <canvas ref={canvasRef} className="breakline-canvas" aria-label={loc(locale, "Breakline tuğla kırma oyunu", "Breakline brick breaker game")} />
        <button
          type="button"
          className="breakline-mouse-toggle"
          onClick={toggleMouse}
          title={mouseTracking ? loc(locale, "Fare takibini kapat", "Disable mouse tracking") : loc(locale, "Fare takibini aç", "Enable mouse tracking")}
          aria-label={mouseTracking ? loc(locale, "Fare takibini kapat", "Disable mouse tracking") : loc(locale, "Fare takibini aç", "Enable mouse tracking")}
          aria-pressed={mouseTracking}
        >
          {mouseTracking ? "🖱" : "⌨"}
        </button>
        <div className="breakline-pad">
          <button type="button" aria-label={loc(locale, "Sola git", "Move left")} {...bindTouch("left")}><ArrowLeft size={30} strokeWidth={2.5} /></button>
          <button type="button" aria-label={loc(locale, "Sağa git", "Move right")} {...bindTouch("right")}><ArrowRight size={30} strokeWidth={2.5} /></button>
        </div>
      </div>
    </div>
  );
}
