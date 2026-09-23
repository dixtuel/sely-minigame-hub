import React, { useEffect, useRef, useState } from "react";
import type { GameResult } from "@/components/games/shared";
import { useFinishOnce } from "@/components/games/shared";
import { LANDER_CONFIG, generateLanderTerrain, type LanderTerrainPoint } from "@/lib/levelGenerators/lander";
import { playTone } from "@/lib/sfx";
import { getAdaptiveDpr } from "@/lib/devicePerformance";

interface LanderGameProps {
  locale: "tr" | "en";
  seed: number;
  mastery: number;
  soundOn?: boolean;
  onFinish: (result: GameResult) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export default function LanderGame({ locale, seed, mastery, soundOn = true, onFinish }: LanderGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [finish] = useFinishOnce(onFinish);

  const [fuel, setFuel] = useState(100);
  const [speedVal, setSpeedVal] = useState(0);
  const [angleDeg, setAngleDeg] = useState(0);

  const controlsRef = useRef({ left: false, right: false, thrust: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let finishTimeout: number | undefined;
    let width = 720;
    let height = 520;

    const onResize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const newWidth = Math.max(320, Math.floor(rect.width || canvas.clientWidth || 720));
      const newHeight = Math.max(340, Math.floor(rect.height || canvas.clientHeight || 520));
      const dpr = getAdaptiveDpr(1.5);
      canvas.width = Math.floor(newWidth * dpr);
      canvas.height = Math.floor(newHeight * dpr);
      const c = canvas.getContext("2d");
      if (c) {
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      width = newWidth;
      height = newHeight;
    };
    onResize();
    // ResizeObserver + visualViewport: catches cases a bare window "resize" listener misses
    // on mobile (dynamic arcade stage settling its flex layout after mount, mobile browser
    // chrome show/hide changing dvh without a window resize on some engines) — without these
    // the canvas could stay sized to a stale measurement, leaving a gap at the bottom.
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => onResize()) : null;
    resizeObserver?.observe(canvas);
    window.addEventListener("resize", onResize);
    window.visualViewport?.addEventListener("resize", onResize);

    const terrainData = generateLanderTerrain(seed, width, height);

    // Lander state
    let px = width * 0.2;
    let py = 60;
    let vx = 0.6;
    let vy = 0;
    let angle = 0;
    let vAngle = 0;
    let currentFuel = LANDER_CONFIG.initialFuel;
    let isAlive = true;
    let hasLanded = false;
    let isGameOver = false;

    let particles: Particle[] = [];

    const playThrustSfx = () => {
      if (!soundOn) return;
      playTone(95, "sawtooth", 0.05, 0.05);
    };

    const playCrashSfx = () => {
      if (!soundOn) return;
      playTone(130, "sawtooth", 0.35, 0.3);
      playTone(60, "sine", 0.45, 0.35);
    };

    const playSuccessSfx = () => {
      if (!soundOn) return;
      playTone(440, "sine", 0.15, 0.2);
      playTone(660, "triangle", 0.2, 0.2);
    };

    const createExplosion = (x: number, y: number) => {
      for (let i = 0; i < 30; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1 + Math.random() * 5;
        particles.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 30 + Math.random() * 20,
          color: Math.random() > 0.5 ? "#E9563F" : "#E5B341",
        });
      }
    };

    let lastTime = performance.now();

    const finishRound = (result: GameResult) => {
      if (isGameOver) return;
      isGameOver = true;
      controlsRef.current = { left: false, right: false, thrust: false };
      cancelAnimationFrame(animId);
      finish(result);
    };

    const loop = (time: number) => {
      if (isGameOver) return;
      const dt = Math.min(2.0, (time - lastTime) / 16.666);
      lastTime = time;

      if (isAlive && !hasLanded) {
        // Controls
        if (controlsRef.current.left) vAngle -= LANDER_CONFIG.rotationSpeed * dt;
        if (controlsRef.current.right) vAngle += LANDER_CONFIG.rotationSpeed * dt;

        // Clamp angular velocity to prevent wild spinning
        vAngle = Math.max(-LANDER_CONFIG.maxAngularVelocity, Math.min(LANDER_CONFIG.maxAngularVelocity, vAngle));

        // Thrust
        if (controlsRef.current.thrust && currentFuel > 0) {
          const thrust = LANDER_CONFIG.mainThrust * dt;
          vx += Math.sin(angle) * thrust;
          vy -= Math.cos(angle) * thrust;
          currentFuel = Math.max(0, currentFuel - 0.28 * dt);
          setFuel(Math.round(currentFuel));
          playThrustSfx();

          // Exhaust particle
          const flameAngle = angle + Math.PI;
          particles.push({
            x: px + Math.sin(flameAngle) * 14,
            y: py - Math.cos(flameAngle) * 14,
            vx: Math.sin(flameAngle) * (2 + Math.random() * 3) + vx * 0.2,
            vy: -Math.cos(flameAngle) * (2 + Math.random() * 3) + vy * 0.2,
            life: 12 + Math.random() * 8,
            color: Math.random() > 0.4 ? "#E9563F" : "#E5B341",
          });
        }

        // Apply angular damping & gravity (Original: angleDamping = 0.95, gravity = -0.001)
        vAngle *= Math.pow(LANDER_CONFIG.angleDamping, dt);
        angle += vAngle * dt;
        // Normalize angle within [-PI, PI]
        angle = Math.atan2(Math.sin(angle), Math.cos(angle));
        vy += LANDER_CONFIG.gravity * dt;

        px += vx * dt;
        py += vy * dt;

        // Wrap horizontal edges
        if (px < 0) px = width;
        if (px > width) px = 0;

        const currentSpeed = Math.hypot(vx, vy);
        setSpeedVal(Number(currentSpeed.toFixed(2)));
        setAngleDeg(Math.round((angle * 180) / Math.PI));

        // Terrain collision detection
        // Find segment under lander
        const pts = terrainData.points;
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          if (px >= p1.x && px <= p2.x) {
            const t = (px - p1.x) / (p2.x - p1.x);
            const groundY = p1.y + t * (p2.y - p1.y);

            if (py + 12 >= groundY) {
              // Full module foot span check (both left and right feet must land cleanly on the flat pad)
              const padLeft = terrainData.padX;
              const padRight = terrainData.padX + terrainData.padWidth;
              const onPad = p1.isPad && p2.isPad && (px - 10 >= padLeft) && (px + 10 <= padRight);
              const angleSafe = Math.abs(angle) <= LANDER_CONFIG.maxLandingAngle;
              const speedSafe = currentSpeed <= LANDER_CONFIG.maxLandingSpeed;

              if (onPad && angleSafe && speedSafe) {
                // Successful landing!
                hasLanded = true;
                py = groundY - 12;
                vx = 0;
                vy = 0;
                vAngle = 0;
                angle = 0;
                playSuccessSfx();

                const scoreAward = Math.round(500 + currentFuel * 5 + (LANDER_CONFIG.maxLandingSpeed - currentSpeed) * 100);
                finishTimeout = window.setTimeout(() => {
                  finishRound({
                    score: scoreAward,
                    label: locale === "tr" ? "Başarılı İniş" : "Touchdown!",
                    detail: locale === "tr" ? `Modül güvenle indi. Kalan yakıt: %${Math.round(currentFuel)}` : `Landed safely with ${Math.round(currentFuel)}% fuel remaining.`,
                    outcome: "success",
                  });
                }, 800);
              } else {
                // Crash!
                isAlive = false;
                createExplosion(px, py);
                playCrashSfx();

                const failReason = !onPad
                  ? locale === "tr" ? "Pist dışı engebeli araziye çakıldın!" : "Crashed off the landing pad!"
                  : !speedSafe
                  ? locale === "tr" ? "Aşırı hızla sert iniş yaptın!" : "Touchdown speed too fast!"
                  : locale === "tr" ? "Modül dik açıda değildi, devrildin!" : "Module tilted beyond safe limit!";

                finishTimeout = window.setTimeout(() => {
                  finishRound({
                    score: 50,
                    label: locale === "tr" ? "Modül Parçalandı" : "Lander Destroyed",
                    detail: failReason,
                    outcome: "failure",
                  });
                }, 900);
              }
              break;
            }
          }
        }
      }

      // Update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // RENDER
      ctx.fillStyle = "#F6F0E3"; // SELY Paper background
      ctx.fillRect(0, 0, width, height);

      // Draw Terrain
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (const p of terrainData.points) {
        ctx.lineTo(p.x, p.y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = "#EAE2D0";
      ctx.fill();
      ctx.strokeStyle = "#1B1A1B";
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Highlight Landing Pad
      ctx.fillStyle = "#E5B341";
      ctx.fillRect(terrainData.padX, terrainData.padY, terrainData.padWidth, 6);
      ctx.strokeStyle = "#1B1A1B";
      ctx.lineWidth = 2;
      ctx.strokeRect(terrainData.padX, terrainData.padY, terrainData.padWidth, 6);

      // Pad flag / beacon
      ctx.fillStyle = "#E9563F";
      ctx.fillRect(terrainData.padX + terrainData.padWidth / 2 - 2, terrainData.padY - 16, 4, 16);
      ctx.beginPath();
      ctx.moveTo(terrainData.padX + terrainData.padWidth / 2 + 2, terrainData.padY - 16);
      ctx.lineTo(terrainData.padX + terrainData.padWidth / 2 + 14, terrainData.padY - 11);
      ctx.lineTo(terrainData.padX + terrainData.padWidth / 2 + 2, terrainData.padY - 6);
      ctx.closePath();
      ctx.fill();

      // Draw Particles
      for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      }

      // Draw Lander
      if (isAlive) {
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(angle);

        // Body
        ctx.fillStyle = "#DDE4F0";
        ctx.strokeStyle = "#1B1A1B";
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(-10, -6);
        ctx.lineTo(10, -6);
        ctx.lineTo(13, 6);
        ctx.lineTo(-13, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cockpit dome
        ctx.fillStyle = "#293B75";
        ctx.beginPath();
        ctx.arc(0, -6, 6, Math.PI, 0);
        ctx.fill();
        ctx.stroke();

        // Landing legs
        ctx.beginPath();
        ctx.moveTo(-10, 6);
        ctx.lineTo(-15, 13);
        ctx.moveTo(10, 6);
        ctx.lineTo(15, 13);
        ctx.stroke();

        // Feet pads
        ctx.fillStyle = "#E5B341";
        ctx.fillRect(-18, 12, 6, 2);
        ctx.fillRect(12, 12, 6, 2);

        ctx.restore();
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    // Keyboard handlers
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        controlsRef.current.left = true;
      }
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        controlsRef.current.right = true;
      }
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === " ") {
        e.preventDefault();
        controlsRef.current.thrust = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") controlsRef.current.left = false;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") controlsRef.current.right = false;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === " ") controlsRef.current.thrust = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      if (finishTimeout !== undefined) window.clearTimeout(finishTimeout);
      cancelAnimationFrame(animId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [seed, mastery, soundOn, finish, locale]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between select-none" style={{ touchAction: "none" }}>
      {/* Top HUD */}
      <div className="w-full flex items-center justify-between px-4 py-2 border-b-2 border-[#1B1A1B] bg-[#F6F0E3] text-[#1B1A1B] font-mono text-sm font-bold z-10">
        <div>
          {locale === "tr" ? "YAKIT" : "FUEL"}:{" "}
          <span className={fuel < 25 ? "text-[#E9563F]" : "text-[#293B75]"}>{fuel}%</span>
        </div>
        <div>
          {locale === "tr" ? "HIZ" : "SPEED"}:{" "}
          <span className={speedVal > LANDER_CONFIG.maxLandingSpeed ? "text-[#E9563F]" : "text-[#296A55]"}>
            {speedVal} m/s
          </span>
        </div>
        <div>
          {locale === "tr" ? "AÇI" : "TILT"}:{" "}
          <span className={Math.abs(angleDeg) > 12 ? "text-[#E9563F]" : "text-[#296A55]"}>
            {angleDeg}°
          </span>
        </div>
      </div>

      {/* Canvas & In-Canvas Floating Controls */}
      <div className="relative w-full flex-1 overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Floating Mobile Controls directly over canvas. Single mechanism, multi-touch safe:
            every touch event recomputes the full left/right/thrust state from ALL currently
            active touches (via elementFromPoint), same proven pattern as AsteroidsGame's
            control pad — so holding LEFT with one finger and THRUST with another works, and
            there is only ever one writer (no race with a second, independent per-button
            pointer mechanism, which is what caused the earlier stuck-rotation bug). */}
        <div
          className="touch-adaptive-controls absolute bottom-4 left-4 right-4 z-20 flex justify-between items-end select-none touch-none"
          onTouchStart={(e) => {
            const touches = e.touches;
            const newCtrl = { left: false, right: false, thrust: false };
            for (let i = 0; i < touches.length; i++) {
              const el = document.elementFromPoint(touches[i].clientX, touches[i].clientY);
              const k = el?.closest("[data-key]")?.getAttribute("data-key");
              if (k === "left") newCtrl.left = true;
              if (k === "right") newCtrl.right = true;
              if (k === "thrust") newCtrl.thrust = true;
            }
            controlsRef.current = newCtrl;
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            const touches = e.touches;
            const newCtrl = { left: false, right: false, thrust: false };
            for (let i = 0; i < touches.length; i++) {
              const el = document.elementFromPoint(touches[i].clientX, touches[i].clientY);
              const k = el?.closest("[data-key]")?.getAttribute("data-key");
              if (k === "left") newCtrl.left = true;
              if (k === "right") newCtrl.right = true;
              if (k === "thrust") newCtrl.thrust = true;
            }
            controlsRef.current = newCtrl;
          }}
          onTouchEnd={(e) => {
            const touches = e.touches;
            const newCtrl = { left: false, right: false, thrust: false };
            for (let i = 0; i < touches.length; i++) {
              const el = document.elementFromPoint(touches[i].clientX, touches[i].clientY);
              const k = el?.closest("[data-key]")?.getAttribute("data-key");
              if (k === "left") newCtrl.left = true;
              if (k === "right") newCtrl.right = true;
              if (k === "thrust") newCtrl.thrust = true;
            }
            controlsRef.current = newCtrl;
          }}
          onTouchCancel={() => {
            controlsRef.current = { left: false, right: false, thrust: false };
          }}
        >
          <div className="flex gap-2 justify-start">
            <button
              type="button"
              data-key="left"
              className="w-14 h-14 bg-[#1B1A1B]/85 text-[#F6F0E3] border-2 border-[#F6F0E3]/70 font-bold text-xl rounded-xl shadow-lg active:bg-[#293B75] flex items-center justify-center backdrop-blur-sm select-none touch-none"
            >
              ◀
            </button>
            <button
              type="button"
              data-key="right"
              className="w-14 h-14 bg-[#1B1A1B]/85 text-[#F6F0E3] border-2 border-[#F6F0E3]/70 font-bold text-xl rounded-xl shadow-lg active:bg-[#293B75] flex items-center justify-center backdrop-blur-sm select-none touch-none"
            >
              ▶
            </button>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              data-key="thrust"
              className="w-24 h-16 bg-[#E5B341]/95 text-[#1B1A1B] border-2 border-[#1B1A1B] font-mono text-sm font-black tracking-wider uppercase rounded-xl shadow-xl active:bg-[#C99B2D] active:scale-95 flex flex-col items-center justify-center gap-0.5 backdrop-blur-sm select-none touch-none"
            >
              <span className="text-base">▲</span>
              <span>{locale === "tr" ? "İTME" : "THRUST"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
