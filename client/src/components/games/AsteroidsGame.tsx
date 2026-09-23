import React, { useEffect, useRef, useState } from "react";
import type { GameResult } from "@/components/games/shared";
import { useFinishOnce } from "@/components/games/shared";
import { playTone } from "@/lib/sfx";
import { getAdaptiveDpr } from "@/lib/devicePerformance";

interface AsteroidsGameProps {
  locale: "tr" | "en";
  seed: number;
  mastery: number;
  soundOn?: boolean;
  onFinish: (result: GameResult) => void;
}

interface Point {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

interface AsteroidItem {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vRot: number;
  scale: number;
  points: number[];
}

interface BulletItem {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  isAlien?: boolean;
}

interface AlienItem {
  x: number;
  y: number;
  vx: number;
  vy: number;
  shootCooldown: number;
}

// Original 1980/Doug McInnes Asteroid polygon vertices
const BASE_ASTEROID_POINTS = [-10, 0, -5, 7, -3, 4, 1, 10, 5, 4, 10, 0, 5, -6, 2, -10, -4, -10, -4, -5];
const SHIP_POINTS = [-6, 6, 0, -14, 6, 6];
const EXHAUST_POINTS = [-4, 7, 0, 13, 4, 7];
const ALIEN_POINTS = [-16, 0, -10, -4, 10, -4, 16, 0, 10, 4, -10, 4, -16, 0, 16, 0];

export default function AsteroidsGame({ locale, seed, mastery, soundOn = true, onFinish }: AsteroidsGameProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [finish, isFinished] = useFinishOnce(onFinish);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [wave, setWave] = useState(1);

  // Key states. joyAngle/joyMag are the GTA-style mobile joystick inputs:
  // joyAngle = direction the stick is pointing (degrees, 0=right, -90=up),
  // joyMag = how far the stick is pushed (0..1). When active, the ship
  // smoothly rotates toward joyAngle and thrusts proportionally to joyMag.
  const keysRef = useRef<{ left: boolean; right: boolean; up: boolean; fire: boolean; joyAngle: number; joyMag: number; joyActive: boolean }>({
    left: false,
    right: false,
    up: false,
    fire: false,
    joyAngle: 0,
    joyMag: 0,
    joyActive: false,
  });
  const joyPadRef = useRef<HTMLDivElement | null>(null);
  const joyPointerIdRef = useRef<number | null>(null);

  // Sound triggers
  const sfxRef = useRef({
    laser: () => {
      if (!soundOn) return;
      playTone(880, "sawtooth", 0.08, 0.12);
      playTone(440, "square", 0.05, 0.08);
    },
    thrust: () => {
      if (!soundOn) return;
      playTone(110, "triangle", 0.06, 0.05);
    },
    boom: (large: boolean) => {
      if (!soundOn) return;
      playTone(large ? 90 : 160, "sawtooth", 0.25, 0.25);
      playTone(large ? 45 : 80, "sine", 0.35, 0.3);
    },
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
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
    // ResizeObserver catches every case a bare window "resize" listener misses on mobile —
    // the dynamic arcade stage settling its flex layout after mount, orientation changes that
    // don't fire a window resize on some engines, etc. — which was leaving the canvas sized
    // to a stale measurement and an empty gap at the bottom of the screen.
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => onResize()) : null;
    resizeObserver?.observe(canvas);
    window.addEventListener("resize", onResize);
    // Tracks mobile browser chrome (address bar) show/hide more reliably than window
    // "resize"/ResizeObserver alone on some engines (notably iOS Safari).
    window.visualViewport?.addEventListener("resize", onResize);

    // Game state
    let shipX = width / 2;
    let shipY = height / 2;
    let shipVx = 0;
    let shipVy = 0;
    let shipRot = 0; // degrees
    let shipVisible = true;
    let invulnerableTimer = 60;
    let bulletTimer = 0;
    let currentLives = 3;
    let currentScore = 0;
    let currentWave = 1;

    let asteroids: AsteroidItem[] = [];
    let bullets: BulletItem[] = [];
    let particles: Particle[] = [];
    let alien: AlienItem | null = null;
    let alienSpawnTimer = 300 + Math.random() * 300;

    let asteroidIdCounter = 1;

    // Seeded random
    let rngVal = (seed ^ 0xa5a5a5a5) >>> 0;
    const nextRng = () => {
      rngVal = (Math.imul(rngVal, 1664525) + 1013904223) >>> 0;
      return rngVal / 4294967296;
    };

    const spawnAsteroid = (scale = 5, x?: number, y?: number, vx?: number, vy?: number) => {
      const edge = Math.floor(nextRng() * 4);
      let posX = x !== undefined ? x : edge === 0 ? 0 : edge === 1 ? width : nextRng() * width;
      let posY = y !== undefined ? y : edge === 2 ? 0 : edge === 3 ? height : nextRng() * height;

      // Keep safe distance from ship if spawning at start
      if (x === undefined && y === undefined) {
        if (Math.hypot(posX - shipX, posY - shipY) < 120) {
          posX = (posX + width / 2) % width;
          posY = (posY + height / 2) % height;
        }
      }

      const speed = 1.0 + (5 - scale) * 0.4 + mastery * 0.15;
      const angle = nextRng() * Math.PI * 2;
      const velocityX = vx !== undefined ? vx : Math.cos(angle) * speed;
      const velocityY = vy !== undefined ? vy : Math.sin(angle) * speed;

      asteroids.push({
        id: asteroidIdCounter++,
        x: posX,
        y: posY,
        vx: velocityX,
        vy: velocityY,
        rot: nextRng() * 360,
        vRot: (nextRng() - 0.5) * 3,
        scale,
        points: [...BASE_ASTEROID_POINTS],
      });
    };

    const startWave = (waveNum: number) => {
      currentWave = waveNum;
      setWave(waveNum);
      const count = 3 + waveNum + Math.min(3, mastery);
      for (let i = 0; i < count; i++) {
        spawnAsteroid(5);
      }
    };

    startWave(1);

    const createExplosion = (x: number, y: number, count = 16, color = "#E9563F") => {
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1 + Math.random() * 4;
        particles.push({
          x,
          y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          life: 25 + Math.random() * 20,
          maxLife: 45,
          color,
        });
      }
    };

    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = Math.min(2.0, (time - lastTime) / 16.666);
      lastTime = time;

      // Ship controls — keyboard is binary, joystick is GTA-style (point direction = ship faces
      // that way and thrusts). Both input methods coexist: keyboard always works, joystick
      // overrides rotation when active.
      if (shipVisible) {
        const keys = keysRef.current;

        if (keys.joyActive && keys.joyMag > 0.15) {
          // GTA-style: smoothly rotate ship toward joystick angle, thrust proportionally.
          const targetRot = keys.joyAngle + 90; // +90 because ship graphic points up at rot=0
          // Shortest-path angular interpolation
          let diff = ((targetRot - shipRot + 540) % 360) - 180;
          const rotSpeed = 6.0; // degrees per dt — smooth turning
          if (Math.abs(diff) < rotSpeed * dt) {
            shipRot = targetRot;
          } else {
            shipRot += Math.sign(diff) * rotSpeed * dt;
          }
          // Thrust — gentler than keyboard (0.22 vs 0.5) so mobile feels controllable
          const rad = ((shipRot - 90) * Math.PI) / 180;
          const thrustInput = keys.joyMag;
          shipVx += Math.cos(rad) * 0.22 * dt * thrustInput;
          shipVy += Math.sin(rad) * 0.22 * dt * thrustInput;
          if (Math.random() < 0.3 * thrustInput) sfxRef.current.thrust();
        } else {
          // Keyboard controls (unchanged from original)
          const keyTurn = (keys.left ? -1 : 0) + (keys.right ? 1 : 0);
          shipRot += 6.0 * dt * keyTurn;

          if (keys.up) {
            const rad = ((shipRot - 90) * Math.PI) / 180;
            shipVx += Math.cos(rad) * 0.5 * dt;
            shipVy += Math.sin(rad) * 0.5 * dt;
            if (Math.random() < 0.3) sfxRef.current.thrust();
          }
        }

        // Friction & speed cap
        const speed = Math.hypot(shipVx, shipVy);
        const isThrusting = (keys.joyActive && keys.joyMag > 0.15) || keys.up;
        // Joystick: softer speed cap at 5; keyboard: original cap at 8
        const maxSpeed = keys.joyActive ? 5.0 : 8.0;
        if (speed > maxSpeed) {
          const dampen = maxSpeed / speed * 0.97;
          shipVx *= dampen;
          shipVy *= dampen;
        }
        if (!isThrusting && speed > 0.05) {
          // Coast drag — ship glides to a stop in ~1.5 seconds
          const drag = Math.pow(0.97, dt);
          shipVx *= drag;
          shipVy *= drag;
        }

        shipX = (shipX + shipVx * dt + width) % width;
        shipY = (shipY + shipVy * dt + height) % height;

        // Firing: max 10 active player bullets (original pool = 10)
        bulletTimer -= dt;
        const activePlayerBullets = bullets.filter(b => !b.isAlien).length;
        if (keysRef.current.fire && bulletTimer <= 0 && activePlayerBullets < 10) {
          bulletTimer = 10;
          const rad = ((shipRot - 90) * Math.PI) / 180;
          const bx = shipX + Math.cos(rad) * 14;
          const by = shipY + Math.sin(rad) * 14;
          bullets.push({
            x: bx,
            y: by,
            vx: Math.cos(rad) * 6.0 + shipVx,
            vy: Math.sin(rad) * 6.0 + shipVy,
            life: 50,
          });
          sfxRef.current.laser();
        }
      }

      if (invulnerableTimer > 0) invulnerableTimer -= dt;

      // Alien spawn
      alienSpawnTimer -= dt;
      if (!alien && alienSpawnTimer <= 0) {
        alienSpawnTimer = 400 + Math.random() * 400;
        const fromLeft = Math.random() < 0.5;
        alien = {
          x: fromLeft ? 0 : width,
          y: 40 + Math.random() * (height - 80),
          vx: (fromLeft ? 1.8 : -1.8) * (1 + mastery * 0.1),
          vy: (Math.random() - 0.5) * 1.5,
          shootCooldown: 40,
        };
      }

      // Alien update
      if (alien) {
        alien.x += alien.vx * dt;
        alien.y += alien.vy * dt;
        alien.shootCooldown -= dt;
        if (alien.shootCooldown <= 0) {
          alien.shootCooldown = 65;
          const angleToShip = Math.atan2(shipY - alien.y, shipX - alien.x) + (Math.random() - 0.5) * 0.4;
          bullets.push({
            x: alien.x,
            y: alien.y,
            vx: Math.cos(angleToShip) * 5.2,
            vy: Math.sin(angleToShip) * 5.2,
            life: 60,
            isAlien: true,
          });
          sfxRef.current.laser();
        }

        if (alien.x < -40 || alien.x > width + 40) {
          alien = null;
        }
      }

      // Bullets update
      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x = (b.x + b.vx * dt + width) % width;
        b.y = (b.y + b.vy * dt + height) % height;
        b.life -= dt;
        if (b.life <= 0) {
          bullets.splice(i, 1);
        }
      }

      // Asteroids update
      for (const ast of asteroids) {
        ast.x = (ast.x + ast.vx * dt + width) % width;
        ast.y = (ast.y + ast.vy * dt + height) % height;
        ast.rot += ast.vRot * dt;
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // Bullet-Asteroid collisions
      for (let bi = bullets.length - 1; bi >= 0; bi--) {
        const b = bullets[bi];
        if (b.isAlien) continue;

        let bulletRemoved = false;

        // Check against alien
        if (alien && Math.hypot(b.x - alien.x, b.y - alien.y) < 22) {
          createExplosion(alien.x, alien.y, 22, "#E5B341");
          sfxRef.current.boom(true);
          alien = null;
          bullets.splice(bi, 1);
          currentScore += 200; // Original 1980 UFO kill: 200 pts
          setScore(currentScore);
          continue;
        }

        for (let ai = asteroids.length - 1; ai >= 0; ai--) {
          const ast = asteroids[ai];
          const radius = ast.scale * 6;
          if (Math.hypot(b.x - ast.x, b.y - ast.y) < radius) {
            bullets.splice(bi, 1);
            bulletRemoved = true;
            createExplosion(ast.x, ast.y, 14, "#293B75");
            sfxRef.current.boom(ast.scale >= 4);

            // Original 1980 Asteroid scores: Large 20, Medium 60, Small 180
            const addPoints = ast.scale >= 4 ? 20 : ast.scale >= 2.5 ? 60 : 180;
            currentScore += addPoints;
            setScore(currentScore);

            const nextScale = ast.scale / 1.8;
            if (nextScale >= 1.4) {
              for (let k = 0; k < 2; k++) {
                const spd = Math.hypot(ast.vx, ast.vy) * 1.35;
                const dir = Math.random() * Math.PI * 2;
                spawnAsteroid(nextScale, ast.x, ast.y, Math.cos(dir) * spd, Math.sin(dir) * spd);
              }
            }

            asteroids.splice(ai, 1);
            break;
          }
        }
        if (bulletRemoved) continue;
      }

      // Ship collisions
      if (shipVisible && invulnerableTimer <= 0) {
        // Against asteroids
        for (const ast of asteroids) {
          const radius = ast.scale * 5.5;
          if (Math.hypot(shipX - ast.x, shipY - ast.y) < radius + 8) {
            shipDestroyed();
            break;
          }
        }

        // Against alien bullets
        for (let bi = bullets.length - 1; bi >= 0; bi--) {
          const b = bullets[bi];
          if (b.isAlien && Math.hypot(b.x - shipX, b.y - shipY) < 12) {
            bullets.splice(bi, 1);
            shipDestroyed();
            break;
          }
        }
      }

      function shipDestroyed() {
        createExplosion(shipX, shipY, 30, "#E9563F");
        sfxRef.current.boom(true);
        currentLives--;
        setLives(currentLives);
        shipVisible = false;

        if (currentLives <= 0) {
          setTimeout(() => {
            finish({
              score: currentScore,
              label: locale === "tr" ? "Mühür Kırıldı" : "Hull Breached",
              detail: locale === "tr" ? `Uzayda ${currentScore} puan toplayarak düştün.` : `Destroyed in deep space with ${currentScore} pts.`,
              outcome: "failure",
            });
          }, 800);
        } else {
          setTimeout(() => {
            shipX = width / 2;
            shipY = height / 2;
            shipVx = 0;
            shipVy = 0;
            shipRot = 0;
            shipVisible = true;
            invulnerableTimer = 90;
          }, 1000);
        }
      }

      // Wave completion check
      if (asteroids.length === 0) {
        currentScore += 500 * currentWave;
        setScore(currentScore);
        startWave(currentWave + 1);
      }

      // RENDER
      ctx.fillStyle = "#F6F0E3"; // SELY Paper background
      ctx.fillRect(0, 0, width, height);

      // Draw asteroids (Neobrutalist thick ink lines)
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = "#1B1A1B";
      ctx.fillStyle = "#E5DFD3";

      for (const ast of asteroids) {
        ctx.save();
        ctx.translate(ast.x, ast.y);
        ctx.rotate((ast.rot * Math.PI) / 180);
        ctx.beginPath();
        const pts = ast.points;
        ctx.moveTo(pts[0] * ast.scale * 0.6, pts[1] * ast.scale * 0.6);
        for (let i = 2; i < pts.length; i += 2) {
          ctx.lineTo(pts[i] * ast.scale * 0.6, pts[i + 1] * ast.scale * 0.6);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Draw Alien
      if (alien) {
        ctx.save();
        ctx.translate(alien.x, alien.y);
        ctx.lineWidth = 2.2;
        ctx.strokeStyle = "#E9563F";
        ctx.fillStyle = "#F2D5CE";
        ctx.beginPath();
        ctx.moveTo(ALIEN_POINTS[0], ALIEN_POINTS[1]);
        for (let i = 2; i < ALIEN_POINTS.length; i += 2) {
          ctx.lineTo(ALIEN_POINTS[i], ALIEN_POINTS[i + 1]);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Draw Bullets
      for (const b of bullets) {
        ctx.fillStyle = b.isAlien ? "#E9563F" : "#293B75";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.isAlien ? 3.5 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw Particles
      for (const p of particles) {
        ctx.fillStyle = p.color;
        const size = (p.life / p.maxLife) * 3.5;
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      }

      // Draw Ship
      if (shipVisible) {
        if (invulnerableTimer <= 0 || Math.floor(invulnerableTimer / 5) % 2 === 0) {
          ctx.save();
          ctx.translate(shipX, shipY);
          ctx.rotate((shipRot * Math.PI) / 180);

          // Exhaust flame when thrusting (keyboard or joystick)
          if ((keysRef.current.up || (keysRef.current.joyActive && keysRef.current.joyMag > 0.15)) && Math.random() > 0.2) {
            ctx.fillStyle = "#E9563F";
            ctx.beginPath();
            ctx.moveTo(EXHAUST_POINTS[0], EXHAUST_POINTS[1]);
            ctx.lineTo(EXHAUST_POINTS[2], EXHAUST_POINTS[3] + Math.random() * 4);
            ctx.lineTo(EXHAUST_POINTS[4], EXHAUST_POINTS[5]);
            ctx.closePath();
            ctx.fill();
          }

          ctx.lineWidth = 2.4;
          ctx.strokeStyle = "#293B75";
          ctx.fillStyle = "#DDE4F0";
          ctx.beginPath();
          ctx.moveTo(SHIP_POINTS[0], SHIP_POINTS[1]);
          ctx.lineTo(SHIP_POINTS[2], SHIP_POINTS[3]);
          ctx.lineTo(SHIP_POINTS[4], SHIP_POINTS[5]);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    // Keyboard handlers
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        keysRef.current.left = true;
      }
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        keysRef.current.right = true;
      }
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        keysRef.current.up = true;
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        keysRef.current.fire = true;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keysRef.current.left = false;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keysRef.current.right = false;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") keysRef.current.up = false;
      if (e.key === " " || e.key === "Enter") keysRef.current.fire = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [seed, mastery, soundOn, finish, locale]);

  // Virtual joystick — GTA-style: the angle you push = direction the ship faces,
  // the distance you push = how hard you thrust. Release = coast (no thrust, no turn).
  const updateJoystick = (e: React.PointerEvent<HTMLDivElement>) => {
    const pad = joyPadRef.current;
    if (!pad) return;
    const bounds = pad.getBoundingClientRect();
    const radius = bounds.width * 0.38;
    let x = (e.clientX - (bounds.left + bounds.width / 2)) / radius;
    let y = (e.clientY - (bounds.top + bounds.height / 2)) / radius;
    const magnitude = Math.min(1, Math.hypot(x, y));
    if (magnitude > 1) {
      x /= magnitude;
      y /= magnitude;
    }
    pad.style.setProperty("--joy-x", `${x * bounds.width * 0.24}px`);
    pad.style.setProperty("--joy-y", `${y * bounds.height * 0.24}px`);
    // atan2 gives angle in radians; convert to degrees (0=right, -90=up, 90=down)
    const angleDeg = (Math.atan2(y, x) * 180) / Math.PI;
    keysRef.current.joyAngle = angleDeg;
    keysRef.current.joyMag = magnitude;
    keysRef.current.joyActive = true;
  };
  const joystickStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    joyPointerIdRef.current = e.pointerId;
    updateJoystick(e);
  };
  const joystickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerIdRef.current !== e.pointerId) return;
    updateJoystick(e);
  };
  const joystickEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerIdRef.current !== e.pointerId) return;
    joyPointerIdRef.current = null;
    joyPadRef.current?.style.setProperty("--joy-x", "0px");
    joyPadRef.current?.style.setProperty("--joy-y", "0px");
    keysRef.current.joyMag = 0;
    keysRef.current.joyActive = false;
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-between select-none" style={{ touchAction: "none" }}>
      {/* Top HUD */}
      <div className="w-full flex items-center justify-between px-4 py-2 border-b-2 border-[#1B1A1B] bg-[#F6F0E3] text-[#1B1A1B] font-mono text-sm font-bold z-10">
        <div>{locale === "tr" ? "DALGA" : "WAVE"}: {wave}</div>
        <div>{locale === "tr" ? "SKOR" : "SCORE"}: {score}</div>
        <div className="flex gap-1">
          {locale === "tr" ? "CAN" : "LIVES"}:{" "}
          {Array.from({ length: Math.max(0, lives) }).map((_, i) => (
            <span key={i} className="text-[#E9563F]">▲</span>
          ))}
        </div>
      </div>

      {/* Canvas & In-Canvas Floating Controls */}
      <div className="relative w-full flex-1 overflow-visible">
        <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair" />

        {/* Floating virtual joystick (analog turn + thrust) directly over canvas */}
        <div
          ref={joyPadRef}
          className="touch-adaptive-controls asteroids-joystick asteroids-joystick-floating select-none"
          role="group"
          aria-label={locale === "tr" ? "Göktaşı hareket joystick'i" : "Asteroids movement joystick"}
          onPointerDown={joystickStart}
          onPointerMove={joystickMove}
          onPointerUp={joystickEnd}
          onPointerCancel={joystickEnd}
          onLostPointerCapture={joystickEnd}
        >
          <span className="asteroids-joystick-knob" aria-hidden="true" />
        </div>

        {/* Floating Right Control (Large Fire Button) directly over canvas */}
        <div
          className="touch-adaptive-controls asteroids-fire-floating select-none touch-none"
          onTouchStart={(e) => {
            e.preventDefault();
            keysRef.current.fire = true;
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            keysRef.current.fire = true;
          }}
          onTouchEnd={(e) => {
            // Multi-touch safe: only release fire once no remaining touch is still on the
            // button (a second finger elsewhere lifting must not cut fire early).
            let stillPressed = false;
            for (let i = 0; i < e.touches.length; i++) {
              const el = document.elementFromPoint(e.touches[i].clientX, e.touches[i].clientY);
              if (el?.closest("[data-key='fire']")) stillPressed = true;
            }
            keysRef.current.fire = stillPressed;
          }}
          onTouchCancel={() => {
            keysRef.current.fire = false;
          }}
        >
          <button
            type="button"
            data-key="fire"
            className="asteroids-fire-btn"
          >
            <span className="text-2xl">⦿</span>
            <span>{locale === "tr" ? "ATEŞ" : "FIRE"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
