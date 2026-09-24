import { useEffect, useRef, useState } from "react";
import { useFinishOnce } from "@/components/games/shared";
import { getAdaptiveDpr } from "@/lib/devicePerformance";
import { advanceApexSpeed, apexNearMissReward, APEX_CRUISE_SPEED, apexRoadFlowMultiplier, createApexRandom, createApexTrafficGenerator, type ApexLane, type ApexTrafficKind, type ApexTrafficSpawn } from "@/lib/levelGenerators/apex";
import { playTone } from "@/lib/sfx";

interface ApexGameProps {
  locale: "tr" | "en";
  seed: number;
  mastery: number;
  soundOn?: boolean;
  onHudChange?: (hud: { score: number; speed: number; combo: number }) => void;
  onFinish: (result: { score: number; label: string; detail: string; outcome: "success" | "failure" }) => void;
}

type TrafficCar = ApexTrafficSpawn & {
  y: number;
  nearMissArmed: boolean;
  nearMissPaid: boolean;
};

type Controls = { left: boolean; right: boolean; gas: boolean; brake: boolean };
type PedalControls = Pick<Controls, "gas" | "brake">;
type Locale = ApexGameProps["locale"];

function pedalsAtTouches(touches: ArrayLike<Pick<Touch, "clientX" | "clientY">>): PedalControls {
  const pedals: PedalControls = { gas: false, brake: false };
  for (let index = 0; index < touches.length; index += 1) {
    const touch = touches[index];
    const control = document
      .elementFromPoint(touch.clientX, touch.clientY)
      ?.closest("[data-apex-pedal]")
      ?.getAttribute("data-apex-pedal");
    if (control === "gas" || control === "brake") pedals[control] = true;
  }
  return pedals;
}

const COLORS = {
  field: "#172842",
  asphalt: "#303735",
  shoulder: "#586354",
  marking: "#e8dfc8",
  amber: "#efb84b",
  danger: "#e45d46",
  green: "#73967e",
  glass: "#b6c7c2",
};

const text = (locale: Locale, tr: string, en: string) => locale === "tr" ? tr : en;

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  kind: ApexTrafficKind | "player",
  facingDown = false,
) {
  const proportions = kind === "van" ? 1.12 : kind === "compact" ? 0.84 : 1;
  const bodyW = width * proportions;
  const left = x - bodyW / 2;
  const top = y;
  const bodyRadius = Math.min(width * 0.22, 8);

  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,.3)";
  roundedRect(ctx, left + 3, top + 6, bodyW, height, bodyRadius);
  ctx.fill();

  // Tyres sit partly outside the shell and make vehicle widths readable at speed.
  ctx.fillStyle = "#151a18";
  for (const wheelY of [top + height * 0.2, top + height * 0.68]) {
    roundedRect(ctx, left - 2, wheelY, 5, height * 0.19, 2);
    ctx.fill();
    roundedRect(ctx, left + bodyW - 3, wheelY, 5, height * 0.19, 2);
    ctx.fill();
  }

  ctx.fillStyle = color;
  roundedRect(ctx, left, top, bodyW, height, bodyRadius);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.19)";
  roundedRect(ctx, left + bodyW * 0.15, top + height * 0.08, bodyW * 0.7, height * 0.08, 3);
  ctx.fill();

  const windshieldY = facingDown ? top + height * 0.58 : top + height * 0.18;
  const windshieldH = kind === "van" ? height * 0.29 : height * 0.34;
  ctx.fillStyle = COLORS.glass;
  ctx.globalAlpha = 0.78;
  roundedRect(ctx, left + bodyW * 0.17, windshieldY, bodyW * 0.66, windshieldH, bodyRadius * 0.75);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = facingDown ? "#ffdf8a" : "#f05d4e";
  const lightY = facingDown ? top + height - 5 : top + 4;
  for (const lightX of [left + bodyW * 0.2, left + bodyW * 0.8]) {
    roundedRect(ctx, lightX - 2, lightY, 4, 4, 1.5);
    ctx.fill();
  }
  if (kind === "player") {
    ctx.fillStyle = "rgba(255,255,255,.62)";
    ctx.fillRect(x - 1, top + height * 0.47, 2, height * 0.22);
  }
  ctx.restore();
}

export default function ApexGame({ locale, seed, mastery, soundOn = true, onFinish, onHudChange }: ApexGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [finish] = useFinishOnce(onFinish);
  const controlsRef = useRef<Controls>({ left: false, right: false, gas: false, brake: false });
  const touchPedalsRef = useRef<PedalControls>({ gas: false, brake: false });
  const [pressedPedals, setPressedPedals] = useState<PedalControls>({ gas: false, brake: false });
  const pendingTouchSteeringRef = useRef(0);
  const onHudChangeRef = useRef(onHudChange);
  onHudChangeRef.current = onHudChange;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let dpr = getAdaptiveDpr(1.5);
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(280, rect.width || 400);
      height = Math.max(360, rect.height || 600);
      dpr = getAdaptiveDpr(1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(canvas);

    const nextWave = createApexTrafficGenerator(seed, mastery);
    const random = createApexRandom(seed ^ 0xa53e91);
    let cars: TrafficCar[] = [];
    let nextWaveAt = 76;
    let elapsed = 0;
    let distance = 0;
    let score = 0;
    let bonusScore = 0;
    let speed = APEX_CRUISE_SPEED;
    let roadOffset = 0;
    let reflectorOffset = 0;
    let combo = 0;
    let comboTime = 0;
    let lastNearMiss = 0;
    let lane: ApexLane = 3;
    let laneVisual = 3;
    let steerCooldown = 0;
    let raf = 0;
    let alive = true;
    let last = performance.now();
    let lastHudUpdate = -Infinity;
    let lastHudSignature = "";
    let lastHudCombo = -1;

    const publishHud = (now: number, force = false) => {
      const next = { score, speed: Math.round(speed), combo };
      const signature = `${next.score}:${next.speed}:${next.combo}`;
      if (force || (signature !== lastHudSignature && now - lastHudUpdate >= 120) || combo !== lastHudCombo) {
        lastHudSignature = signature;
        lastHudUpdate = now;
        lastHudCombo = combo;
        onHudChangeRef.current?.(next);
      }
    };
    publishHud(last, true);

    const roadWidth = () => Math.min(width * 0.83, 620);
    const roadLeft = () => (width - roadWidth()) / 2;
    const laneWidth = () => roadWidth() / 4;
    const laneX = (laneIndex: number) => roadLeft() + laneWidth() * (laneIndex + 0.5);
    const playerW = () => Math.min(laneWidth() * 0.57, 64);
    const playerH = () => Math.max(50, Math.min(72, height * 0.105));
    const playerY = () => height - playerH() - Math.max(106, height * 0.2);
    const pixelsPerKph = () => height / 980;
    const drawRoad = (dt: number) => {
      ctx.fillStyle = COLORS.field;
      ctx.fillRect(0, 0, width, height);

      // Roadside reflectors and scrub create a sense of movement without image assets.
      const rl = roadLeft();
      const rw = roadWidth();
      ctx.fillStyle = COLORS.shoulder;
      ctx.fillRect(rl - 8, 0, 8, height);
      ctx.fillRect(rl + rw, 0, 8, height);
      ctx.fillStyle = COLORS.asphalt;
      ctx.fillRect(rl, 0, rw, height);
      ctx.fillStyle = "rgba(232,223,200,.045)";
      ctx.fillRect(rl + 14, 0, 2, height);
      ctx.fillRect(rl + rw - 16, 0, 2, height);

      const dashH = Math.max(28, height * 0.065);
      const dashGap = dashH * 1.05;
      const roadFlow = speed * pixelsPerKph() * dt * apexRoadFlowMultiplier(speed);
      for (let y = -dashH + roadOffset; y < height; y += dashH + dashGap) {
        for (const divider of [1, 2, 3]) {
          const x = rl + laneWidth() * divider;
          if (divider === 2) {
            ctx.fillStyle = COLORS.amber;
            ctx.fillRect(x - 3.5, y, 2, dashH);
            ctx.fillRect(x + 1.5, y, 2, dashH);
          } else {
            ctx.fillStyle = "rgba(232,223,200,.42)";
            ctx.fillRect(x - 1, y, 2, dashH);
          }
        }
        ctx.fillStyle = "rgba(239,184,75,.62)";
        ctx.fillRect(rl - 5, y + dashH * 0.24, 2, dashH * 0.32);
        ctx.fillRect(rl + rw + 3, y + dashH * 0.24, 2, dashH * 0.32);
      }
      roadOffset = (roadOffset + roadFlow) % (dashH + dashGap);

      const reflectorGap = Math.max(72, height * 0.15);
      const reflectorHeight = Math.max(5, Math.min(12, height * 0.014));
      reflectorOffset = (reflectorOffset + roadFlow * 1.3) % reflectorGap;
      ctx.fillStyle = speed >= 170 ? "rgba(239,184,75,.9)" : "rgba(239,184,75,.56)";
      for (let y = -reflectorHeight + reflectorOffset; y < height; y += reflectorGap) {
        ctx.fillRect(rl - 15, y, 4, reflectorHeight);
        ctx.fillRect(rl + rw + 11, y, 4, reflectorHeight);
      }
    };

    const drawNearMissFeedback = (nearMissLabel: boolean) => {
      const compact = width < 480;
      if (combo > 1) {
        ctx.textAlign = "center";
        ctx.fillStyle = COLORS.amber;
        ctx.font = `700 ${compact ? 13 : 15}px "DM Mono", monospace`;
        ctx.fillText(`${combo}× ${text(locale, "MAKAS SERİSİ", "NEAR-MISS RUN")}`, width / 2, Math.max(30, height * 0.12));
        ctx.textAlign = "left";
      } else if (nearMissLabel) {
        ctx.textAlign = "center";
        ctx.fillStyle = COLORS.marking;
        ctx.font = `700 ${compact ? 13 : 15}px "DM Mono", monospace`;
        ctx.fillText(text(locale, "TEMİZ MAKAS  +100", "CLEAN PASS  +100"), width / 2, Math.max(30, height * 0.12));
        ctx.textAlign = "left";
      }
    };

    const end = () => {
      if (!alive) return;
      alive = false;
      if (soundOn) playTone(145, "sawtooth", 0.4, 0.13);
      finish({
        score,
        label: text(locale, "Temas!", "Impact!"),
        detail: text(locale, `${Math.floor(distance)} m sürdün, ${combo}× makas serisi yaptın.`, `You drove ${Math.floor(distance)} m with a ${combo}× near-miss run.`),
        outcome: "failure",
      });
    };

    const loop = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.035, Math.max(0, (now - last) / 1000));
      last = now;
      if (document.hidden) { raf = requestAnimationFrame(loop); return; }
      elapsed += dt;
      steerCooldown = Math.max(0, steerCooldown - dt);

      const controls = controlsRef.current;
      speed = advanceApexSpeed(speed, {
        gas: controls.gas || touchPedalsRef.current.gas,
        brake: controls.brake || touchPedalsRef.current.brake,
      }, dt);
      const progress = Math.min(1, distance / 4200);
      const trafficGap = Math.max(1.12, 1.4 - progress * 0.48 - Math.min(0.16, mastery * 0.03));

      if (steerCooldown === 0) {
        const touchSteering = pendingTouchSteeringRef.current === 0 ? 0 : Math.sign(pendingTouchSteeringRef.current);
        const steering = touchSteering || (controls.left ? -1 : controls.right ? 1 : 0);
        if (steering) {
          lane = Math.max(0, Math.min(3, lane + steering)) as ApexLane;
          if (touchSteering) pendingTouchSteeringRef.current -= touchSteering;
          steerCooldown = 0.19;
          if (soundOn) playTone(370, "sine", 0.035, 0.035);
        }
      }
      laneVisual += (lane - laneVisual) * Math.min(1, dt * 15);

      distance += (speed / 3.6) * dt;
      comboTime = Math.max(0, comboTime - dt);
      if (comboTime === 0) combo = 0;

      if (distance >= nextWaveAt) {
        for (const spawn of nextWave(distance)) {
          cars.push({ ...spawn, y: -76 - random() * 10, nearMissArmed: false, nearMissPaid: false });
        }
        nextWaveAt += (trafficGap + random() * 0.3) * speed / 3.6;
      }

      const laneXAtPlayer = laneX(laneVisual);
      const pw = playerW();
      const ph = playerH();
      const py = playerY();
      for (const car of cars) {
        const oncoming = car.lane < 2;
        const relativeSpeed = oncoming ? speed + car.speedKph : speed - car.speedKph;
        car.y += relativeSpeed * pixelsPerKph() * dt * 1.45;
        const cx = laneX(car.lane);
        const cw = playerW() * (car.kind === "van" ? 1.08 : car.kind === "compact" ? 0.82 : 0.94);
        const ch = ph * (car.kind === "van" ? 1.15 : 0.93);
        const dx = Math.abs(laneXAtPlayer - cx);
        const dy = Math.abs((py + ph / 2) - (car.y + ch / 2));

        const hitX = dx < (pw + cw) * 0.34;
        const hitY = dy < (ph + ch) * 0.36;
        if (elapsed > 1 && hitX && hitY) { end(); return; }

        const riskX = dx < (pw + cw) * 0.5 + laneWidth() * 0.5;
        const riskY = dy < (ph + ch) * 0.5 + 11;
        if (riskX && riskY && speed > 105 && relativeSpeed > 0) car.nearMissArmed = true;
        if (car.nearMissArmed && !car.nearMissPaid && car.y > py + ph + 4) {
          car.nearMissPaid = true;
          combo = comboTime > 0 ? combo + 1 : 1;
          comboTime = 2.8;
          lastNearMiss = elapsed;
          bonusScore += apexNearMissReward(combo);
          if (soundOn) playTone(650 + Math.min(5, combo) * 32, "triangle", 0.09, 0.075);
        }
      }
      score = Math.floor(distance * (speed / 110)) + bonusScore;
      publishHud(now);
      cars = cars.filter((car) => car.y < height + 110 && !(car.nearMissPaid && car.y < -120));

      drawRoad(dt);
      const carHeight = ph * 0.91;
      for (const car of cars) {
        const ch = ph * (car.kind === "van" ? 1.15 : 0.93);
        if (car.y + ch < 0 || car.y > height) continue;
        const cx = laneX(car.lane);
        const cw = pw * (car.kind === "van" ? 1.08 : car.kind === "compact" ? 0.82 : 0.94);
        drawCar(ctx, cx, car.y, cw, ch, car.color, car.kind, car.lane >= 2);
      }
      drawCar(ctx, laneXAtPlayer, py, pw, carHeight, COLORS.amber, "player");
      drawNearMissFeedback(elapsed - lastNearMiss < 0.72);
      raf = requestAnimationFrame(loop);
    };

    const setControl = (key: keyof Controls, down: boolean) => { controlsRef.current[key] = down; };
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const control = key === "arrowleft" || key === "a" ? "left"
        : key === "arrowright" || key === "d" ? "right"
        : key === "arrowup" || key === "w" || key === " " ? "gas"
        : key === "arrowdown" || key === "s" ? "brake"
        : null;
      if (control) { event.preventDefault(); setControl(control, true); }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const control = key === "arrowleft" || key === "a" ? "left"
        : key === "arrowright" || key === "d" ? "right"
        : key === "arrowup" || key === "w" || key === " " ? "gas"
        : key === "arrowdown" || key === "s" ? "brake"
        : null;
      if (control) setControl(control, false);
    };
    const releaseInputs = () => { controlsRef.current = { left: false, right: false, gas: false, brake: false }; };
    let touchPointerId: number | null = null;
    let touchLastX = 0;
    let touchTravelX = 0;
    const onTouchPointerDown = (event: PointerEvent) => {
      if (touchPointerId !== null || event.pointerType === "mouse" || event.button !== 0) return;
      event.preventDefault();
      touchPointerId = event.pointerId;
      touchLastX = event.clientX;
      touchTravelX = 0;
      pendingTouchSteeringRef.current = 0;
      canvas.setPointerCapture(event.pointerId);
    };
    const onTouchPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== touchPointerId) return;
      event.preventDefault();
      touchTravelX += event.clientX - touchLastX;
      touchLastX = event.clientX;
      const threshold = Math.max(30, laneWidth() * 0.38);
      const steps = Math.trunc(touchTravelX / threshold);
      if (steps !== 0) {
        pendingTouchSteeringRef.current = Math.max(-3, Math.min(3, pendingTouchSteeringRef.current + steps));
        touchTravelX -= steps * threshold;
      }
    };
    const releaseTouchPointer = (event: PointerEvent) => {
      if (event.pointerId !== touchPointerId) return;
      touchPointerId = null;
      touchTravelX = 0;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    const onTouchPointerLostCapture = (event: PointerEvent) => {
      if (event.pointerId === touchPointerId) {
        touchPointerId = null;
        touchTravelX = 0;
      }
    };
    const releaseAllInputs = () => {
      releaseInputs();
      touchPedalsRef.current = { gas: false, brake: false };
      setPressedPedals({ gas: false, brake: false });
      if (touchPointerId !== null && canvas.hasPointerCapture(touchPointerId)) {
        canvas.releasePointerCapture(touchPointerId);
      }
      touchPointerId = null;
      touchTravelX = 0;
      pendingTouchSteeringRef.current = 0;
    };
    canvas.addEventListener("pointerdown", onTouchPointerDown);
    canvas.addEventListener("pointermove", onTouchPointerMove);
    canvas.addEventListener("pointerup", releaseTouchPointer);
    canvas.addEventListener("pointercancel", releaseTouchPointer);
    canvas.addEventListener("lostpointercapture", onTouchPointerLostCapture);
    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseAllInputs);
    raf = requestAnimationFrame(loop);

    return () => {
      alive = false;
      releaseAllInputs();
      cancelAnimationFrame(raf);
      observer?.disconnect();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAllInputs);
      canvas.removeEventListener("pointerdown", onTouchPointerDown);
      canvas.removeEventListener("pointermove", onTouchPointerMove);
      canvas.removeEventListener("pointerup", releaseTouchPointer);
      canvas.removeEventListener("pointercancel", releaseTouchPointer);
      canvas.removeEventListener("lostpointercapture", onTouchPointerLostCapture);
    };
  }, [finish, locale, mastery, seed, soundOn]);

  const bindControl = (control: keyof Controls) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === "touch") {
        controlsRef.current[control] = true;
        if (control === "gas" || control === "brake") {
          setPressedPedals((current) => current[control] ? current : { ...current, [control]: true });
        }
        return;
      }
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // The control still works when pointer capture is unavailable.
      }
      controlsRef.current[control] = true;
      if (control === "gas" || control === "brake") {
        setPressedPedals((current) => current[control] ? current : { ...current, [control]: true });
      }
    },
    onPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === "touch") {
        controlsRef.current[control] = false;
        if (control === "gas" || control === "brake") {
          setPressedPedals((current) => current[control] === touchPedalsRef.current[control]
            ? current
            : { ...current, [control]: touchPedalsRef.current[control] });
        }
        return;
      }
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Safari can end a touch pointer before explicit capture is released.
      }
      controlsRef.current[control] = false;
      if (control === "gas" || control === "brake") {
        setPressedPedals((current) => current[control] === touchPedalsRef.current[control]
          ? current
          : { ...current, [control]: touchPedalsRef.current[control] });
      }
    },
    onPointerCancel: () => {
      controlsRef.current[control] = false;
      if (control === "gas" || control === "brake") {
        setPressedPedals((current) => ({ ...current, [control]: touchPedalsRef.current[control] }));
      }
    },
    onLostPointerCapture: () => {
      controlsRef.current[control] = false;
      if (control === "gas" || control === "brake") {
        setPressedPedals((current) => ({ ...current, [control]: touchPedalsRef.current[control] }));
      }
    },
    onTouchStart: (event: React.TouchEvent<HTMLButtonElement>) => {
      const pedals = pedalsAtTouches(event.touches);
      touchPedalsRef.current = pedals;
      setPressedPedals(pedals);
    },
    onTouchMove: (event: React.TouchEvent<HTMLButtonElement>) => {
      event.preventDefault();
      const pedals = pedalsAtTouches(event.touches);
      touchPedalsRef.current = pedals;
      setPressedPedals((current) => current.gas === pedals.gas && current.brake === pedals.brake ? current : pedals);
    },
    onTouchEnd: (event: React.TouchEvent<HTMLButtonElement>) => {
      const pedals = pedalsAtTouches(event.touches);
      touchPedalsRef.current = pedals;
      setPressedPedals((current) => current.gas === pedals.gas && current.brake === pedals.brake ? current : pedals);
    },
    onTouchCancel: () => {
      touchPedalsRef.current = { gas: false, brake: false };
      setPressedPedals({ gas: false, brake: false });
    },
  });

  return (
    <div className="apex-game">
      <div className="arcade-game-frame arcade-frame-apex">
        <canvas ref={canvasRef} className="apex-canvas" aria-label={text(locale, "Dört şeritli otoyolda araba sürüş oyunu", "Four-lane highway driving game")} />
        <div className="apex-pad" role="group" aria-label={text(locale, "Sürüş kontrolleri", "Driving controls")}>
          <button
            type="button"
            className="touch-adaptive-controls apex-pedal apex-pedal-brake"
            data-apex-pedal="brake"
            aria-label={text(locale, "Freni basılı tut", "Hold brake")}
            aria-pressed={pressedPedals.brake}
            {...bindControl("brake")}
          >
            <span aria-hidden="true">−</span><small>{text(locale, "FREN", "BRAKE")}</small>
          </button>
          <button
            type="button"
            className="touch-adaptive-controls apex-pedal apex-pedal-gas"
            data-apex-pedal="gas"
            aria-label={text(locale, "Gazı basılı tut", "Hold throttle")}
            aria-pressed={pressedPedals.gas}
            {...bindControl("gas")}
          >
            <span aria-hidden="true">＋</span><small>{text(locale, "GAZ", "THROTTLE")}</small>
          </button>
        </div>
      </div>
    </div>
  );
}
