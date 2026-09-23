import { useEffect, useRef } from "react";
import { useFinishOnce } from "@/components/games/shared";
import { getAdaptiveDpr } from "@/lib/devicePerformance";
import {
  createLiftPlatformSequence,
  getLiftPlatformOffset,
  liftHorizontalSpeed,
  liftJumpSpeed,
  LIFT_PHYSICS,
  needsMoreLiftPlatforms,
  type LiftPlatform,
  type LiftPlatformKind,
} from "@/lib/levelGenerators/lift";
import { playTone } from "@/lib/sfx";

interface LiftGameProps {
  locale: "tr" | "en";
  seed: number;
  mastery: number;
  soundOn?: boolean;
  onHudChange?: (hud: { altitude: number }) => void;
  onFinish: (result: {
    score: number;
    label: string;
    detail: string;
    outcome: "success" | "failure";
  }) => void;
}

function loc(locale: LiftGameProps["locale"], tr: string, en: string) {
  return locale === "tr" ? tr : en;
}

const PLATFORM_H = 12;
const PLAYER_R = LIFT_PHYSICS.playerRadius;
const GRAVITY = LIFT_PHYSICS.gravity;
const PAPER = "#f6f0e3";
const AMBER = "#e5b341";
const CORAL = "#e9563f";
const SKY_ZONES = [
  ["#354d7a", "#172842", "#102033"],
  ["#365c70", "#183d4c", "#102b37"],
  ["#51456f", "#302b50", "#191f38"],
  ["#625044", "#3b3447", "#1c2334"],
] as const;

type LiftParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  life: number;
  duration: number;
  color: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function mixHex(from: string, to: string, amount: number) {
  const a = Number.parseInt(from.slice(1), 16);
  const b = Number.parseInt(to.slice(1), 16);
  const channel = (shift: number) =>
    Math.round(
      ((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount
    );
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

function skyPalette(score: number) {
  const zone = Math.floor(Math.max(0, score) / 480);
  const from = SKY_ZONES[zone % SKY_ZONES.length];
  const to = SKY_ZONES[(zone + 1) % SKY_ZONES.length];
  const progress = (Math.max(0, score) % 480) / 480;
  const blend = clamp(progress / 0.2, 0, 1);
  return from.map((color, index) => mixHex(color, to[index], blend)) as [
    string,
    string,
    string,
  ];
}

function overlapsWrappedX(
  playerX: number,
  radius: number,
  platformX: number,
  platformWidth: number,
  worldWidth: number
) {
  return [playerX, playerX - worldWidth, playerX + worldWidth].some(
    x => x + radius >= platformX && x - radius <= platformX + platformWidth
  );
}

export default function LiftGame({
  locale,
  seed,
  mastery,
  soundOn = true,
  onFinish,
  onHudChange,
}: LiftGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [finish] = useFinishOnce(onFinish);
  const onHudChangeRef = useRef(onHudChange);
  onHudChangeRef.current = onHudChange;
  const inputRef = useRef({ left: false, right: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let dpr = getAdaptiveDpr(1.5);
    let width = 0,
      height = 0;
    const platforms: LiftPlatform[] = [];
    const particles: LiftParticle[] = [];
    let player: { x: number; y: number; vy: number } | null = null;
    let horizontalVelocity = 0;
    let landingCompression = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const nextWidth = Math.max(220, rect.width || 400);
      const nextHeight = Math.max(300, rect.height || 560);
      if (width > 0 && nextWidth !== width) {
        const ratio = nextWidth / width;
        platforms.forEach(platform => {
          platform.x = Math.max(
            10,
            Math.min(nextWidth - platform.width - 10, platform.x * ratio)
          );
        });
        if (player) player.x *= ratio;
      }
      width = nextWidth;
      height = nextHeight;
      dpr = getAdaptiveDpr(1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    const sequence = createLiftPlatformSequence(
      seed,
      width,
      mastery,
      height - 60,
      Math.ceil(height / 104) + 5
    );
    platforms.push(...sequence.platforms);
    const makeNextPlatform = sequence.next;

    let alive = true,
      raf = 0,
      last = performance.now();
    let camera = 0; // how many px we've scrolled up (always increases)
    let highestCamera = 0;
    let points = 0;
    let elapsed = 0;
    let scoreAnnounced = 0;

    player = {
      x: platforms[0].x + platforms[0].width / 2,
      y: platforms[0].y - PLAYER_R,
      vy: -liftJumpSpeed(mastery),
    };
    onHudChangeRef.current?.({ altitude: 0 });

    let visualSeed = (seed ^ 0x9e3779b9) >>> 0 || 1;
    const visualRandom = () => {
      visualSeed ^= visualSeed << 13;
      visualSeed ^= visualSeed >>> 17;
      visualSeed ^= visualSeed << 5;
      return (visualSeed >>> 0) / 4294967296;
    };
    const burst = (x: number, y: number, color: string, count: number) => {
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + (visualRandom() - 0.5) * 0.38;
        const speed = 28 + visualRandom() * 90;
        const duration = 0.26 + visualRandom() * 0.22;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 12,
          radius: 1.3 + visualRandom() * 2.2,
          life: duration,
          duration,
          color,
        });
      }
    };

    const end = () => {
      alive = false;
      if (soundOn) playTone(220, "sawtooth", 0.3, 0.1);
      finish({
        score: points,
        label: loc(locale, "Tur bitti", "Run over"),
        detail: loc(
          locale,
          `${points} puan toplandı.`,
          `${points} points scored.`
        ),
        outcome: "failure",
      });
    };

    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.035, (now - last) / 1000);
      last = now;
      if (document.hidden) {
        raf = requestAnimationFrame(loop);
        return;
      }
      elapsed += dt;

      const c = inputRef.current;
      const direction = c.right ? 1 : c.left ? -1 : 0;
      const moveSpeed = liftHorizontalSpeed(width, mastery, points);
      const targetVelocity = direction * moveSpeed;
      const reversing =
        direction !== 0 &&
        Math.sign(horizontalVelocity) !== 0 &&
        Math.sign(horizontalVelocity) !== direction;
      const acceleration =
        direction === 0
          ? LIFT_PHYSICS.brakingAcceleration
          : reversing
            ? LIFT_PHYSICS.reverseAcceleration
            : LIFT_PHYSICS.horizontalAcceleration;
      horizontalVelocity += clamp(
        targetVelocity - horizontalVelocity,
        -acceleration * dt,
        acceleration * dt
      );
      player!.x += horizontalVelocity * dt;
      // Horizontal wrap
      if (player!.x < -PLAYER_R) player!.x = width + PLAYER_R;
      if (player!.x > width + PLAYER_R) player!.x = -PLAYER_R;

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        particle.life -= dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 150 * dt;
        if (particle.life <= 0) particles.splice(i, 1);
      }
      landingCompression = Math.max(0, landingCompression - dt * 3.8);

      player!.vy += GRAVITY * dt;
      const prevY = player!.y;
      player!.y += player!.vy * dt;

      // Camera follows player upward only
      const targetCamera = -(player!.y - height * 0.4);
      if (targetCamera > camera) camera = targetCamera;
      if (camera > highestCamera) {
        highestCamera = camera;
        points = Math.max(points, Math.round(highestCamera / 6));
        if (points !== scoreAnnounced) {
          scoreAnnounced = points;
          onHudChangeRef.current?.({ altitude: points });
        }
      }

      // Generate more platforms as camera scrolls
      let topPlatform = platforms[platforms.length - 1];
      while (needsMoreLiftPlatforms(topPlatform.y, camera, height)) {
        const next = makeNextPlatform(
          topPlatform.y,
          topPlatform.x,
          width,
          topPlatform.width
        );
        platforms.push(next);
        topPlatform = next;
      }

      // Platform collision — swept AABB: did player bottom pass through platform top this frame?
      if (player!.vy > 0) {
        for (const pl of platforms) {
          if (pl.used) continue;
          const drift = getLiftPlatformOffset(pl, elapsed);
          const platformX = Math.max(
            8,
            Math.min(width - pl.width - 8, pl.x + drift)
          );

          // The ball's bottom, not its center, crosses the platform's top.
          if (
            prevY + PLAYER_R <= pl.y &&
            player!.y + PLAYER_R >= pl.y - 2 &&
            overlapsWrappedX(player!.x, PLAYER_R, platformX, pl.width, width)
          ) {
            const spring = pl.kind === "spring";
            const boost = spring ? 1.42 : 1;
            player!.vy = -liftJumpSpeed(mastery, points) * boost;
            player!.y = pl.y - PLAYER_R;
            if (pl.kind === "crumble") pl.used = true;
            if (spring) horizontalVelocity *= 0.88;
            landingCompression = spring ? 0.56 : 0.34;
            burst(player!.x, pl.y, platformColor(pl.kind), spring ? 13 : 8);
            if (soundOn)
              playTone(
                pl.kind === "spring" ? 660 : 440 + mastery * 30,
                "sine",
                0.07,
                0.06
              );
            break;
          }
        }
      }

      // Fell below screen
      if (player!.y + camera > height + 60) return end();
      for (let i = platforms.length - 1; i >= 0; i -= 1) {
        if (platforms[i].y + camera > height + 100 && platforms.length > 18)
          platforms.splice(i, 1);
      }

      // --- Draw ---
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      const colors = skyPalette(points);
      sky.addColorStop(0, colors[0]);
      sky.addColorStop(0.48, colors[1]);
      sky.addColorStop(1, colors[2]);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      // Sparse ascent strata keep the existing night-sky identity while altitude changes.
      ctx.fillStyle = "rgba(134,174,188,0.12)";
      for (let band = 0; band < 5; band += 1) {
        const bandY = ((band * 191 + camera * 0.16) % (height + 80)) - 40;
        const bandX = ((band * 137 + camera * 0.035) % (width + 180)) - 90;
        ctx.fillRect(bandX, bandY, width * (0.24 + (band % 3) * 0.08), 1);
      }
      // Small, deterministic star points drift at different parallax speeds.
      ctx.fillStyle = "rgba(246,240,227,0.48)";
      for (let s = 0; s < 46; s += 1) {
        const sx = (s * 137.5 + (s % 3) * 19) % width;
        const sy = (s * 97.3 + camera * (0.045 + (s % 4) * 0.012)) % height;
        ctx.globalAlpha = s % 5 === 0 ? 0.78 : 0.38;
        ctx.fillRect(sx, sy, s % 7 === 0 ? 2 : 1, s % 7 === 0 ? 2 : 1);
      }
      ctx.globalAlpha = 1;

      // Platforms
      platforms.forEach(pl => {
        const wy = pl.y + camera;
        if (wy < -20 || wy > height + 20) return;
        const drift = getLiftPlatformOffset(pl, elapsed);
        const px = Math.max(8, Math.min(width - pl.width - 8, pl.x + drift));
        const color = platformColor(pl.kind);
        ctx.globalAlpha = pl.used ? 0.28 : 1;
        if (pl.kind === "moving") {
          ctx.strokeStyle = "rgba(246,240,227,0.18)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(Math.max(8, pl.x - pl.moveRange), wy + PLATFORM_H + 4);
          ctx.lineTo(
            Math.min(width - 8, pl.x + pl.width + pl.moveRange),
            wy + PLATFORM_H + 4
          );
          ctx.stroke();
        }
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = color;
        roundedRect(ctx, px, wy, pl.width, PLATFORM_H, 5);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(246,240,227,0.38)";
        roundedRect(ctx, px + 4, wy + 2, pl.width - 8, 2, 1);
        ctx.fill();
        if (pl.kind === "moving") {
          ctx.fillStyle = "rgba(246,240,227,0.72)";
          ctx.beginPath();
          ctx.moveTo(px + 7, wy + 6);
          ctx.lineTo(px + 12, wy + 4);
          ctx.lineTo(px + 12, wy + 8);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(px + pl.width - 7, wy + 6);
          ctx.lineTo(px + pl.width - 12, wy + 4);
          ctx.lineTo(px + pl.width - 12, wy + 8);
          ctx.fill();
        } else if (pl.kind === "crumble") {
          ctx.strokeStyle = "rgba(10,14,26,0.72)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px + pl.width * 0.45, wy + 3);
          ctx.lineTo(px + pl.width * 0.39, wy + 7);
          ctx.lineTo(px + pl.width * 0.52, wy + 10);
          ctx.stroke();
        } else if (pl.kind === "spring") {
          ctx.strokeStyle = "rgba(10,14,26,0.8)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let coil = 0; coil < 4; coil += 1)
            ctx.lineTo(
              px + pl.width * 0.43 + (coil % 2) * 6,
              wy - 1 - coil * 2
            );
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      });
      ctx.shadowBlur = 0;

      particles.forEach(particle => {
        const remaining = Math.max(0, particle.life / particle.duration);
        ctx.globalAlpha = remaining;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(
          particle.x,
          particle.y + camera,
          particle.radius * (0.55 + remaining * 0.45),
          0,
          Math.PI * 2
        );
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      // Original, code-drawn ember orb.
      const px = player!.x;
      const py = player!.y + camera;
      const scaleX = 1 + landingCompression * 0.5;
      const scaleY = 1 - landingCompression * 0.32;
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(scaleX, scaleY);
      ctx.shadowColor = CORAL;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.arc(0, 0, PLAYER_R, 0, Math.PI * 2);
      const orb = ctx.createRadialGradient(-4, -5, 1, 0, 0, PLAYER_R);
      orb.addColorStop(0, "#fff1c9");
      orb.addColorStop(0.28, "#ffb16e");
      orb.addColorStop(1, CORAL);
      ctx.fillStyle = orb;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(-4, -5, 2.3, 0, Math.PI * 2);
      ctx.fillStyle = PAPER;
      ctx.fill();
      ctx.restore();

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e: KeyboardEvent, down: boolean) => {
      const map: Record<string, "left" | "right"> = {
        arrowleft: "left",
        a: "left",
        arrowright: "right",
        d: "right",
      };
      const k = map[e.key.toLowerCase()];
      if (!k) return;
      e.preventDefault();
      inputRef.current[k] = down;
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    const onBlur = () => {
      inputRef.current.left = false;
      inputRef.current.right = false;
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", onBlur);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", onBlur);
    };
  }, [finish, locale, mastery, seed, soundOn]);

  const bindTouch = (dir: "left" | "right") => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
      inputRef.current[dir] = true;
    },
    onPointerUp: (e: React.PointerEvent) => {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      inputRef.current[dir] = false;
    },
    onPointerCancel: () => {
      inputRef.current[dir] = false;
    },
    onLostPointerCapture: () => {
      inputRef.current[dir] = false;
    },
    onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
  });

  return (
    <div
      className="lift-game"
      aria-label={loc(
        locale,
        "Lift dikey platform oyunu",
        "Lift vertical platform game"
      )}
    >
      <div className="arcade-game-frame arcade-frame-lift">
        <canvas ref={canvasRef} className="lift-canvas" />
        <div
          className="lift-pad"
          aria-label={loc(locale, "Hareket kontrolleri", "Movement controls")}
        >
          <button
            type="button"
            aria-label={loc(locale, "Sol", "Left")}
            {...bindTouch("left")}
          >
            ◀
          </button>
          <button
            type="button"
            aria-label={loc(locale, "Sağ", "Right")}
            {...bindTouch("right")}
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}

function platformColor(kind: LiftPlatformKind) {
  if (kind === "moving") return "#62b9aa";
  if (kind === "crumble") return AMBER;
  if (kind === "spring") return CORAL;
  return "#5b9b78";
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}
