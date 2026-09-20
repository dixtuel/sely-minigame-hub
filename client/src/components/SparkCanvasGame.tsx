import { useEffect, useMemo, useRef, useState } from "react";
import { local as worldWord, type SiteLocale } from "@/lib/i18n";
import { mulberry32 } from "@/lib/rng";
import { getContext as getSharedAudioContext } from "@/lib/sfx";
import { getAdaptiveDpr, isLowPowerMode } from "@/lib/devicePerformance";
import {
  isWasmReady,
  wasm_spark_physics_step,
  wasm_spark_calculate_pylon_height,
  wasm_spark_flight_collision,
} from "@/lib/wasmBridge";

export type Outcome = "success" | "failure";
export type SparkResult = { score: number; label: string; detail: string; outcome: Outcome };

export const CANVAS_WIDTH = 420;
export const CANVAS_HEIGHT = 600;
export const GROUND_HEIGHT = 65;
export const GROUND_Y = CANVAS_HEIGHT - GROUND_HEIGHT;

export const SPARK_DEFAULTS = {
  radius: 13,
  hitRadius: 10, // 25% hitbox forgiveness for fair and satisfying arcade feel
  startX: 88,
  startY: 270,
  gravity: 0.42,
  flapImpulse: -7.2,
  maxFallSpeed: 9.8,
  pylonWidth: 56,
  pylonSpacing: 220,
  baseGap: 155,
  minGap: 125,
  minTopHeight: 60,
};

export type Pylon = {
  id: number;
  x: number;
  width: number;
  topHeight: number;
  gap: number;
  bottomY: number;
  bottomHeight: number;
  passed: boolean;
};

export type SparkState = {
  x: number;
  y: number;
  vy: number;
  rotation: number;
};

export type SparkParticle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};

export type SparkTrailPoint = {
  x: number;
  y: number;
  vy: number;
  time: number;
};

const clamp = (value: number, lower: number, upper: number) => Math.max(lower, Math.min(upper, value));

/** Pylon yüksekliğini deterministik seed, index ve önceki pilon üzerinden dengeli hesaplar */
export function sparkCalculatePylonHeight(
  seed: number,
  index: number,
  minHeight = SPARK_DEFAULTS.minTopHeight,
  maxAvailable = 320,
  prevHeight?: number,
  maxDelta = 140
): number {
  if (isWasmReady()) {
    try {
      return wasm_spark_calculate_pylon_height(
        seed >>> 0,
        index,
        minHeight,
        maxAvailable,
        prevHeight !== undefined ? prevHeight : undefined,
        maxDelta
      );
    } catch {
      // Fallback to JS implementation
    }
  }
  const prng = mulberry32(seed ^ Math.imul(index + 37, 0x1f351f) ^ 0x9e3779b9);
  let raw = Math.floor(minHeight + prng() * (maxAvailable - minHeight));
  if (prevHeight !== undefined) {
    raw = clamp(raw, prevHeight - maxDelta, prevHeight + maxDelta);
    raw = clamp(raw, minHeight, maxAvailable);
  }
  return raw;
}

/** Zorluk kademesi: Skor arttıkça hız hafifçe yükselir, açıklık daralır. Ekran genişliğine dinamik uyum sağlar. */
export function sparkDifficulty(score: number, mastery: number, viewportWidth = 800) {
  const widthFactor = clamp(viewportWidth / 800, 0.9, 1.25);
  const tiers = Math.min(18, score);
  const baseSpeed = 2.8 + mastery * 0.18 + tiers * 0.09;
  const speed = clamp(baseSpeed * widthFactor, 2.6, 5.2);
  const gap = clamp(SPARK_DEFAULTS.baseGap - mastery * 5 - Math.floor(tiers / 3) * 3, SPARK_DEFAULTS.minGap, 165);
  return { speed, gap };
}

/** Tek bir fizik karesi adımı */
export function sparkPhysicsStep(
  spark: SparkState,
  dt: number,
  flap: boolean,
  gravity = SPARK_DEFAULTS.gravity,
  flapImpulse = SPARK_DEFAULTS.flapImpulse,
  maxFall = SPARK_DEFAULTS.maxFallSpeed
): SparkState {
  if (isWasmReady()) {
    try {
      return wasm_spark_physics_step(
        spark.x,
        spark.y,
        spark.vy,
        spark.rotation,
        dt,
        flap,
        gravity,
        flapImpulse,
        maxFall
      ) as SparkState;
    } catch {
      // Fallback to JS implementation
    }
  }
  let vy = spark.vy;
  if (flap) {
    vy = flapImpulse;
  } else {
    vy = Math.min(maxFall, vy + gravity * dt);
  }
  const y = spark.y + vy * dt;
  const rotation = clamp(vy * 6.5, -25, 70);
  return { x: spark.x, y, vy, rotation };
}

/** Daire ile eksen-hizalı dikdörtgen (AABB) çarpışması */
function circleRectCollide(cx: number, cy: number, cr: number, rx: number, ry: number, rw: number, rh: number): boolean {
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy < cr * cr;
}

/** Çarpışma denetimi: Tavan, zemin veya pylon direkleri */
export function sparkFlightCollision(
  sparkX: number,
  sparkY: number,
  hitRadius: number,
  pylon: Pylon,
  groundY = GROUND_Y
): boolean {
  if (isWasmReady()) {
    try {
      return wasm_spark_flight_collision(
        sparkX,
        sparkY,
        hitRadius,
        pylon.x,
        pylon.width,
        pylon.topHeight,
        pylon.bottomY,
        pylon.bottomHeight,
        groundY
      );
    } catch {
      // Fallback to JS implementation
    }
  }
  if (sparkY - hitRadius <= 0) return true;
  if (sparkY + hitRadius >= groundY) return true;

  // Üst direk kontrolü
  if (circleRectCollide(sparkX, sparkY, hitRadius, pylon.x, 0, pylon.width, pylon.topHeight)) {
    return true;
  }
  // Alt direk kontrolü
  if (circleRectCollide(sparkX, sparkY, hitRadius, pylon.x, pylon.bottomY, pylon.width, pylon.bottomHeight)) {
    return true;
  }
  return false;
}

/* =========================================================================
   Web Audio API Sentezleyicisi (Sıfır Dış Medya Varlığı)
   ========================================================================= */
function getAudioContext(): AudioContext | null {
  return getSharedAudioContext();
}

function playSynthTone(freqStart: number, freqEnd: number, duration: number, type: OscillatorType, gainVal: number, delay = 0) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, t);
  if (freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + duration);
  }

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(gainVal, t + duration * 0.2);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function playSparkFlap(soundOn: boolean) {
  if (!soundOn) return;
  playSynthTone(460, 840, 0.07, "sine", 0.16);
}

function playSparkScore(soundOn: boolean) {
  if (!soundOn) return;
  playSynthTone(523.25, 523.25, 0.08, "triangle", 0.18, 0);
  playSynthTone(659.25, 659.25, 0.10, "triangle", 0.16, 0.05);
}

function playSparkCrash(soundOn: boolean) {
  if (!soundOn) return;
  playSynthTone(160, 35, 0.28, "sawtooth", 0.22);
  playSynthTone(90, 30, 0.22, "square", 0.15, 0.02);
}

function playSparkComplete(soundOn: boolean) {
  if (!soundOn) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
    playSynthTone(freq, freq, 0.15, "triangle", 0.14, idx * 0.08);
  });
}

/* =========================================================================
   Kıvılcım Full-Width Canvas Bileşeni (Chrome Dino / Edge Surf Tarzı)
   ========================================================================= */
export default function SparkCanvasGame({
  locale = "tr",
  seed,
  mastery,
  demo,
  soundOn = true,
  onFinish,
  onHudChange,
}: {
  locale?: SiteLocale;
  seed: number;
  mastery: number;
  demo?: "success" | "fail";
  soundOn?: boolean;
  onFinish: (result: SparkResult) => void;
  onHudChange?: (hud: { score: number; voltage: number; speed: number }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cabinetRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;

  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const onHudChangeRef = useRef(onHudChange);
  onHudChangeRef.current = onHudChange;

  const finishedRef = useRef(false);
  const flapRequestedRef = useRef(false);

  const levelMeta = useMemo(() => {
    return {
      seed,
      mastery,
      initialDiff: sparkDifficulty(0, mastery),
    };
  }, [seed, mastery]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    finishedRef.current = false;
    flapRequestedRef.current = false;

    // Viewport pikselleri (Ekranı tam doldurur)
    let currentWidth = cabinetRef.current?.clientWidth || 800;
    let currentHeight = cabinetRef.current?.clientHeight || 520;
    let groundY = currentHeight - GROUND_HEIGHT;

    // Sabit yıldız arka planı tohumu
    const starPrng = mulberry32(seed ^ 0xabcdef);
    const stars: Array<{ xRel: number; yRel: number; size: number; phase: number }> = [];
    for (let i = 0; i < 40; i++) {
      stars.push({
        xRel: starPrng(),
        yRel: starPrng(),
        size: 0.8 + starPrng() * 1.8,
        phase: starPrng() * Math.PI * 2,
      });
    }

    // Dinamik Konumlandırma & Pylon Aralığı: Viewport ile tam senkron
    const getSparkX = (width: number) => Math.max(90, Math.min(320, Math.floor(width * 0.2)));
    const getPylonSpacing = (width: number) => Math.max(260, Math.min(460, Math.floor(220 + width * 0.14)));

    // Oyuncu Başlangıç Konumu: Ekran genişliğine göre sol tarafta ferah ve dinamik konum
    let spark: SparkState = {
      x: getSparkX(currentWidth),
      y: Math.floor(currentHeight * 0.45),
      vy: 0,
      rotation: 0,
    };

    let score = 0;
    let nextPylonIndex = 0;
    let pylons: Pylon[] = [];
    let particles: SparkParticle[] = [];
    let trail: SparkTrailPoint[] = [];
    let groundScrollX = 0;
    let bgScrollX = 0;
    let shake = 0;
    let flash = 0;
    let gameEnded = false;
    let lastTime = performance.now();
    let frameId = 0;
    let arcPhase = 0;

    // Pylon oluşturucu
    function spawnPylon(index: number, startX: number, prevTopHeight?: number) {
      const { gap } = sparkDifficulty(score, mastery, currentWidth);
      const topHeight = sparkCalculatePylonHeight(seed, index, SPARK_DEFAULTS.minTopHeight, groundY - gap - 50, prevTopHeight);
      const bottomY = topHeight + gap;
      const bottomHeight = groundY - bottomY;
      return {
        id: index,
        x: startX,
        width: SPARK_DEFAULTS.pylonWidth,
        topHeight,
        gap,
        bottomY,
        bottomHeight,
        passed: false,
      };
    }

    // İlk pylonları oyuncunun hemen önünde (1.8 - 2.5 saniye mesafede) başlayacak şekilde diz
    const spacing = getPylonSpacing(currentWidth);
    const firstPylonX = spark.x + Math.max(340, Math.min(580, Math.floor(currentWidth * 0.48)));
    const firstPylon = spawnPylon(nextPylonIndex++, firstPylonX);
    pylons.push(firstPylon);

    let currPylonX = firstPylonX + spacing;
    let prevH = firstPylon.topHeight;
    while (currPylonX < currentWidth + spacing) {
      const p = spawnPylon(nextPylonIndex++, currPylonX, prevH);
      pylons.push(p);
      prevH = p.topHeight;
      currPylonX += spacing;
    }

    // İlk HUD durumunu üst çubuktaki scoreboard'a bildir
    const { speed: initialSpeed } = sparkDifficulty(0, mastery, currentWidth);
    onHudChangeRef.current?.({
      score: 0,
      voltage: 100,
      speed: Number(initialSpeed.toFixed(1)),
    });

    // Parçacık patlaması üretici
    function createSparks(x: number, y: number, count: number, color = "#f8d77a", speed = 140) {
      if (reducedMotion || isLowPowerMode()) count = Math.max(2, Math.ceil(count * 0.5));
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const vel = speed * (0.4 + Math.random() * 0.8);
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * vel,
          vy: Math.sin(angle) * vel - 30,
          life: 0.35 + Math.random() * 0.25,
          maxLife: 0.6,
          color,
          size: 1.5 + Math.random() * 2.5,
        });
      }
    }

    // Dinamik Full-Width Yeniden Boyutlandırma (Chrome Dinozor / Edge Surf Modeli)
    const handleResize = () => {
      const cvs = canvasRef.current;
      const cab = cabinetRef.current;
      if (!cvs || !cab) return;

      const rect = cab.getBoundingClientRect();
      const newWidth = Math.max(320, Math.floor(rect.width));
      const newHeight = Math.max(340, Math.floor(rect.height));

      const dpr = getAdaptiveDpr(1.5);
      cvs.width = Math.floor(newWidth * dpr);
      cvs.height = Math.floor(newHeight * dpr);
      const c = cvs.getContext("2d");
      if (c) {
        c.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      currentWidth = newWidth;
      currentHeight = newHeight;
      groundY = currentHeight - GROUND_HEIGHT;
      spark.x = getSparkX(currentWidth);
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const handleVisibility = () => {
      lastTime = performance.now();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Giriş (Input) Tetikleyici
    const doFlap = () => {
      if (gameEnded) return;
      flapRequestedRef.current = true;
      playSparkFlap(soundOnRef.current);
      createSparks(spark.x - 6, spark.y + 8, 4, "#f8d77a", 70);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (finishedRef.current || gameEnded) return;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
        e.preventDefault();
        doFlap();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });

    // Oyun Bitiriş Fonksiyonu
    const finishGame = (result: SparkResult) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      gameEnded = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      onFinishRef.current(result);
    };

    // Ana Oyun Döngüsü
    const tick = (now: number) => {
      if (gameEnded || finishedRef.current) return;
      if (document.hidden) {
        // Sekme veya WebView arka planda: CPU/pil tüketimini sıfırlamak için simülasyonu beklet
        lastTime = now;
        frameId = window.requestAnimationFrame(tick);
        return;
      }
      const rawDt = clamp((now - lastTime) / 1000, 0, 0.04);
      lastTime = now;
      arcPhase += rawDt * 12;

      // 60fps normalize katsayısı (dt = 1 @ 60fps)
      const simDt = rawDt * 60;
      const { speed } = sparkDifficulty(score, mastery, currentWidth);

      // Sarsıntı ve parlama sönümleme
      shake = Math.max(0, shake - rawDt * 3.6);
      flash = Math.max(0, flash - rawDt * 2.8);

      // Parçacık güncelleme
      for (const p of particles) {
        p.x += p.vx * rawDt;
        p.y += p.vy * rawDt;
        p.vy += 180 * rawDt;
        p.life -= rawDt;
      }
      particles = particles.filter(p => p.life > 0);

      // Akıcı Plazma Kuyruğu İz Noktası (Trail History)
      trail.unshift({ x: spark.x, y: spark.y, vy: spark.vy, time: now });
      const maxTrail = isLowPowerMode() ? 8 : 14;
      if (trail.length > maxTrail) trail.pop();

      // Kıvılcım serbest mikro parçacık dökülmesi
      if (!reducedMotion && !isLowPowerMode() && Math.random() > 0.4) {
        particles.push({
          x: spark.x - 10 + (Math.random() - 0.5) * 4,
          y: spark.y + (Math.random() - 0.5) * 4,
          vx: -speed * 28 + (Math.random() - 0.5) * 20,
          vy: (Math.random() - 0.5) * 35 - 12,
          life: 0.25 + Math.random() * 0.18,
          maxLife: 0.42,
          color: Math.random() > 0.35 ? "#f8d77a" : "#e9563f",
          size: 1.5 + Math.random() * 2,
        });
      }

      // Demo Autopilot Kontrolü
      if (demo === "success") {
        const targetPylon = pylons.find(p => p.x + p.width > spark.x - 10) ?? pylons[0];
        if (targetPylon) {
          const targetCenterY = targetPylon.topHeight + targetPylon.gap * 0.5;
          if (spark.y > targetCenterY + 12 && spark.vy > -1.5) {
            doFlap();
          }
        }
      }

      // Fizik Güncellemesi
      const shouldFlap = flapRequestedRef.current;
      flapRequestedRef.current = false;
      spark = sparkPhysicsStep(spark, simDt, shouldFlap);

      // Zemin ve Arka Plan Paralaks Hareketi
      groundScrollX = (groundScrollX + speed * 60 * rawDt) % 40;
      bgScrollX = (bgScrollX + speed * 14 * rawDt) % currentWidth;
      arcPhase += rawDt * 16;

      // Pylon Hareketi & Doğurma
      for (const pylon of pylons) {
        pylon.x -= speed * simDt;

        // Puan Kazanımı (Pylon geçildi)
        if (!pylon.passed && pylon.x + pylon.width < spark.x) {
          pylon.passed = true;
          score += 1;
          playSparkScore(soundOnRef.current);
          createSparks(spark.x + 8, spark.y, 8, "#fcd34d", 90);

          onHudChangeRef.current?.({
            score,
            voltage: Math.min(100, 80 + score * 2),
            speed: Number(speed.toFixed(1)),
          });

          // Demo başarı sonlandırma
          if (demo === "success" && score >= 5) {
            playSparkComplete(soundOnRef.current);
            finishGame({
              outcome: "success",
              score: 850 + score * 85,
              label: worldWord(locale, "Şebeke Hattı Aşıldı", "Grid Stretch Cleared"),
              detail: worldWord(locale, `${score} gerilim direği hatasız aşıldı.`, `Successfully cleared ${score} voltage pylons.`),
            });
            return;
          }
        }
      }

      // Ekrandan çıkan pylonları sil ve yenisini ekle
      pylons = pylons.filter(p => p.x + p.width > -60);
      const lastPylon = pylons[pylons.length - 1];
      const spacingNow = getPylonSpacing(currentWidth);
      if (lastPylon && lastPylon.x < currentWidth + spacingNow) {
        pylons.push(spawnPylon(nextPylonIndex++, lastPylon.x + spacingNow, lastPylon.topHeight));
      }

      // Çarpışma Denetimi
      for (const pylon of pylons) {
        if (sparkFlightCollision(spark.x, spark.y, SPARK_DEFAULTS.hitRadius, pylon, groundY)) {
          shake = reducedMotion ? 0.2 : 1.0;
          flash = 0.45;
          playSparkCrash(soundOnRef.current);
          createSparks(spark.x, spark.y, 24, "#e9563f", 210);

          const finalScore = Math.max(0, score * 110 + Math.floor(spark.x * 0.5));
          finishGame({
            outcome: "failure",
            score: finalScore,
            label: worldWord(locale, "Kıvılcım Söndü", "Spark Extinguished"),
            detail: worldWord(
              locale,
              `Yüksek gerilim hattında ${score} direk geçtin. Ritmik dokunuşlarla voltajı koru.`,
              `Cleared ${score} pylons in the high-voltage grid. Keep voltage balanced with rhythmic taps.`
            ),
          });
          return;
        }
      }

      // -------------------------------------------------------------
      // ÇİZİM (FULL-WIDTH 2D CANVAS RENDERING)
      // -------------------------------------------------------------
      ctx.save();

      // Ekran sarsıntısı
      if (shake > 0.002) {
        const mag = shake * 6;
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      }

      // 1. Gökyüzü Degradesi (Derin Gece Şebekesi & Nükleer Lacivert)
      const bgGrad = ctx.createLinearGradient(0, 0, 0, currentHeight);
      bgGrad.addColorStop(0, "#080c18");
      bgGrad.addColorStop(0.4, "#0e172a");
      bgGrad.addColorStop(0.75, "#14223d");
      bgGrad.addColorStop(1, "#1c3057");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, currentWidth, currentHeight);

      // 2. Arka Planda Parıldayan Şebeke Yıldızları
      ctx.save();
      for (const star of stars) {
        const twinkle = Math.sin(now * 0.003 + star.phase);
        const starAlpha = 0.25 + (twinkle + 1) * 0.25;
        const sx = star.xRel * currentWidth;
        const sy = star.yRel * (groundY - 40);
        ctx.fillStyle = `rgba(186, 218, 255, ${starAlpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 3. Asılı Katener Yüksek Gerilim Telleri (Tüm Ekran Boyunca Sarkan Teller)
      ctx.save();
      const drawCatenaryWire = (baseY: number, sag: number, alpha: number, pulseOffset: number) => {
        ctx.strokeStyle = `rgba(100, 140, 200, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, baseY);
        ctx.quadraticCurveTo(currentWidth * 0.5, baseY + sag, currentWidth, baseY);
        ctx.stroke();

        // Tel üzerinde seyahat eden parlak enerji kıvılcımı
        const pulseProgress = ((now * 0.00035 + pulseOffset) % 1);
        const px = pulseProgress * currentWidth;
        const t = pulseProgress;
        const py = (1 - t) * (1 - t) * baseY + 2 * (1 - t) * t * (baseY + sag) + t * t * baseY;

        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(248, 215, 122, 0.6)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.stroke();
      };

      drawCatenaryWire(24, 16, 0.35, 0.15);
      drawCatenaryWire(46, 22, 0.25, 0.65);
      ctx.restore();

      // 4. Uzak Silüet: Endüstriyel Şehir & Trafo İstasyonu (Tüm Genişlikte Kesintisiz)
      ctx.save();
      const drawCitySilhouette = (offsetX: number) => {
        ctx.fillStyle = "rgba(10, 15, 26, 0.62)";
        ctx.beginPath();
        ctx.moveTo(offsetX, groundY);
        ctx.lineTo(offsetX, groundY - 35);
        ctx.lineTo(offsetX + 35, groundY - 35);
        ctx.lineTo(offsetX + 45, groundY - 75);
        ctx.lineTo(offsetX + 65, groundY - 75);
        ctx.lineTo(offsetX + 75, groundY - 30);
        ctx.lineTo(offsetX + 120, groundY - 30);
        ctx.lineTo(offsetX + 140, groundY - 60);
        ctx.lineTo(offsetX + 170, groundY - 60);
        ctx.lineTo(offsetX + 180, groundY - 35);
        ctx.lineTo(offsetX + 245, groundY - 35);
        ctx.lineTo(offsetX + 265, groundY - 95);
        ctx.lineTo(offsetX + 295, groundY - 95);
        ctx.lineTo(offsetX + 305, groundY - 40);
        ctx.lineTo(offsetX + 360, groundY - 40);
        ctx.lineTo(offsetX + 380, groundY - 55);
        ctx.lineTo(offsetX + currentWidth, groundY - 55);
        ctx.lineTo(offsetX + currentWidth, groundY);
        ctx.closePath();
        ctx.fill();

        // İkaz flaşörü
        const beaconY = groundY - 97;
        const beaconX = offsetX + 280;
        if (beaconX >= -10 && beaconX <= currentWidth + 10) {
          const blink = Math.sin(now * 0.006) > 0.1;
          ctx.fillStyle = blink ? "#ef4444" : "rgba(239, 68, 68, 0.25)";
          ctx.beginPath();
          ctx.arc(beaconX, beaconY, blink ? 2.5 : 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      drawCitySilhouette(-bgScrollX);
      drawCitySilhouette(-bgScrollX + currentWidth);
      ctx.restore();

      // 5. Yüksek Gerilim Pylonları (Lattice Truss Kuleleri, İzolatörler, Tehlike Şeritleri)
      for (const p of pylons) {
        ctx.save();

        // Metalik Çelik Gövde Degradesi
        const pylonGrad = ctx.createLinearGradient(p.x, 0, p.x + p.width, 0);
        pylonGrad.addColorStop(0, "#10192a");
        pylonGrad.addColorStop(0.2, "#1c2b45");
        pylonGrad.addColorStop(0.5, "#2c446c");
        pylonGrad.addColorStop(0.8, "#1e2e49");
        pylonGrad.addColorStop(1, "#0d1522");

        // --- A) ÜST PYLON DİREĞİ ---
        ctx.fillStyle = pylonGrad;
        ctx.fillRect(p.x, 0, p.width, p.topHeight);
        ctx.strokeStyle = "#436599";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(p.x, 0, p.width, p.topHeight);

        // Çift Çapraz Kiriş Deseni (X-Truss Bracing)
        ctx.strokeStyle = "rgba(125, 175, 245, 0.26)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let y = 14; y < p.topHeight - 24; y += 22) {
          ctx.moveTo(p.x + 2, y);
          ctx.lineTo(p.x + p.width - 2, y + 20);
          ctx.moveTo(p.x + p.width - 2, y);
          ctx.lineTo(p.x + 2, y + 20);
        }
        ctx.stroke();

        // ÜST KULE TEHLİKE ŞERİDİ (CLIP İLE SÜTUNA KESİN KİLİTLİ, ASLA TAŞMAZ)
        if (p.topHeight > 80) {
          const hBandY = p.topHeight - 48;
          ctx.save();
          ctx.beginPath();
          ctx.rect(p.x + 1.5, hBandY, p.width - 3, 12);
          ctx.clip(); // Sütun sınırının dışına taşmayı %100 engeller

          ctx.fillStyle = "#1b1a1b";
          ctx.fillRect(p.x + 1.5, hBandY, p.width - 3, 12);
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let hx = p.x - 10; hx < p.x + p.width + 10; hx += 8) {
            ctx.moveTo(hx, hBandY + 12);
            ctx.lineTo(hx + 8, hBandY);
          }
          ctx.stroke();
          ctx.restore();
        }

        // Üst Seramik İzolatör Boğumları (3 Kademeli Disk)
        const topIsoY = p.topHeight - 20;
        for (let d = 0; d < 3; d++) {
          const dy = topIsoY + d * 5;
          const dw = p.width + (2 - d) * 4;
          const dx = p.x + (p.width - dw) / 2;
          ctx.fillStyle = d === 2 ? "#e9563f" : "#c23924";
          ctx.fillRect(dx, dy, dw, 4);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 0.8;
          ctx.strokeRect(dx, dy, dw, 4);
        }

        // Üst Pirinç Kondansatör Terminali
        const topTerminalGrad = ctx.createRadialGradient(
          p.x + p.width * 0.5 - 1,
          p.topHeight - 1,
          1,
          p.x + p.width * 0.5,
          p.topHeight,
          6
        );
        topTerminalGrad.addColorStop(0, "#fff5c0");
        topTerminalGrad.addColorStop(0.6, "#e5b341");
        topTerminalGrad.addColorStop(1, "#926815");
        ctx.fillStyle = topTerminalGrad;
        ctx.beginPath();
        ctx.arc(p.x + p.width * 0.5, p.topHeight, 6, 0, Math.PI * 2);
        ctx.fill();

        // --- B) ALT PYLON DİREĞİ ---
        ctx.fillStyle = pylonGrad;
        ctx.fillRect(p.x, p.bottomY, p.width, p.bottomHeight);
        ctx.strokeStyle = "#436599";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(p.x, p.bottomY, p.width, p.bottomHeight);

        // Alt Direk İçi Kafes Kiriş Deseni
        ctx.strokeStyle = "rgba(125, 175, 245, 0.26)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let y = p.bottomY + 24; y < groundY - 20; y += 22) {
          ctx.moveTo(p.x + 2, y);
          ctx.lineTo(p.x + p.width - 2, y + 20);
          ctx.moveTo(p.x + p.width - 2, y);
          ctx.lineTo(p.x + 2, y + 20);
        }
        ctx.stroke();

        // ALT KULE TEHLİKE ŞERİDİ (CLIP İLE SÜTUNA KESİN KİLİTLİ, ASLA TAŞMAZ)
        if (p.bottomHeight > 80) {
          const hBandY = p.bottomY + 32;
          ctx.save();
          ctx.beginPath();
          ctx.rect(p.x + 1.5, hBandY, p.width - 3, 12);
          ctx.clip(); // Sütun sınırının dışına taşmayı %100 engeller

          ctx.fillStyle = "#1b1a1b";
          ctx.fillRect(p.x + 1.5, hBandY, p.width - 3, 12);
          ctx.strokeStyle = "#f59e0b";
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let hx = p.x - 10; hx < p.x + p.width + 10; hx += 8) {
            ctx.moveTo(hx, hBandY + 12);
            ctx.lineTo(hx + 8, hBandY);
          }
          ctx.stroke();
          ctx.restore();
        }

        // Alt Seramik İzolatör Boğumları
        for (let d = 0; d < 3; d++) {
          const dy = p.bottomY + 4 + d * 5;
          const dw = p.width + d * 4;
          const dx = p.x + (p.width - dw) / 2;
          ctx.fillStyle = d === 0 ? "#e9563f" : "#c23924";
          ctx.fillRect(dx, dy, dw, 4);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 0.8;
          ctx.strokeRect(dx, dy, dw, 4);
        }

        // Alt Pirinç Kondansatör Terminali
        const bottomTerminalGrad = ctx.createRadialGradient(
          p.x + p.width * 0.5 - 1,
          p.bottomY - 1,
          1,
          p.x + p.width * 0.5,
          p.bottomY,
          6
        );
        bottomTerminalGrad.addColorStop(0, "#fff5c0");
        bottomTerminalGrad.addColorStop(0.6, "#e5b341");
        bottomTerminalGrad.addColorStop(1, "#926815");
        ctx.fillStyle = bottomTerminalGrad;
        ctx.beginPath();
        ctx.arc(p.x + p.width * 0.5, p.bottomY, 6, 0, Math.PI * 2);
        ctx.fill();

        // Alt Pylon Zemin Flanş Pabucu
        ctx.fillStyle = "#0c121d";
        ctx.fillRect(p.x - 7, groundY - 7, p.width + 14, 9);
        ctx.strokeStyle = "#e5b341";
        ctx.lineWidth = 1.2;
        ctx.strokeRect(p.x - 7, groundY - 7, p.width + 14, 9);

        // Kaide Montaj Cıvataları
        ctx.fillStyle = "#f8d77a";
        ctx.fillRect(p.x - 4, groundY - 5, 3, 3);
        ctx.fillRect(p.x + p.width + 1, groundY - 5, 3, 3);

        // --- C) SÜTUNLAR ARASINDA ÇITIRDAYAN TESLA ELEKTRİK ARKI ---
        if (Math.sin(arcPhase + p.id * 2.1) > 0.12) {
          const startArcY = p.topHeight;
          const endArcY = p.bottomY;
          const midX = p.x + p.width * 0.5;
          const steps = 9;
          const arcPoints: Array<{ x: number; y: number }> = [{ x: midX, y: startArcY }];

          for (let s = 1; s < steps; s++) {
            const progress = s / steps;
            const sy = startArcY + (endArcY - startArcY) * progress;
            const jitter = (Math.sin(arcPhase * 3.8 + s * 2.7 + p.id) * 8.5) + ((Math.random() - 0.5) * 4);
            arcPoints.push({ x: midX + jitter, y: sy });
          }
          arcPoints.push({ x: midX, y: endArcY });

          // Dış Plazma Halesi
          ctx.strokeStyle = "rgba(248, 215, 122, 0.45)";
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(arcPoints[0].x, arcPoints[0].y);
          for (let i = 1; i < arcPoints.length; i++) {
            ctx.lineTo(arcPoints[i].x, arcPoints[i].y);
          }
          ctx.stroke();

          // Orta Siyan Plazma Çizgisi
          ctx.strokeStyle = "rgba(165, 243, 252, 0.85)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(arcPoints[0].x, arcPoints[0].y);
          for (let i = 1; i < arcPoints.length; i++) {
            ctx.lineTo(arcPoints[i].x, arcPoints[i].y);
          }
          ctx.stroke();

          // İç Saf Beyaz Şimşek Çekirdeği
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(arcPoints[0].x, arcPoints[0].y);
          for (let i = 1; i < arcPoints.length; i++) {
            ctx.lineTo(arcPoints[i].x, arcPoints[i].y);
          }
          ctx.stroke();

          // Çatallanan Yan Ark
          if (Math.random() > 0.42) {
            const branchIdx = 3 + Math.floor(Math.random() * 4);
            const bp = arcPoints[branchIdx];
            ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(bp.x, bp.y);
            ctx.lineTo(bp.x + (Math.random() > 0.5 ? 14 : -14), bp.y + (Math.random() - 0.5) * 12);
            ctx.stroke();
          }
        }

        ctx.restore();
      }

      // 6. Zemin Hattı: Yüksek Gerilim Reaktör Yolu (Tüm Genişlik)
      const groundGrad = ctx.createLinearGradient(0, groundY, 0, currentHeight);
      groundGrad.addColorStop(0, "#10151f");
      groundGrad.addColorStop(0.2, "#18202e");
      groundGrad.addColorStop(1, "#0a0d14");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, groundY, currentWidth, GROUND_HEIGHT);

      // Zemin Üst Güvenlik Rayı (Katı Metalik Bordür - Kesintisiz)
      ctx.strokeStyle = "#e5b341";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(currentWidth, groundY);
      ctx.stroke();

      // Zemin İçi Çelik Derz Panelleri (Pylonlarla Tam Senkron)
      ctx.fillStyle = "rgba(246, 240, 227, 0.12)";
      for (let x = -groundScrollX; x < currentWidth + 40; x += 40) {
        ctx.fillRect(x, groundY, 2, GROUND_HEIGHT);
      }
      // NOT: Kullanıcının isteğiyle alttaki - - - - kesikli çizgiler kaldırıldı.

      // 7. Parçacıklar (Kıvılcım Pırıltıları)
      for (const p of particles) {
        const alpha = clamp(p.life / p.maxLife, 0, 1);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 8. Kıvılcım İyonize Plazma Kuyruğu (Ionized Ribbon Trail)
      if (trail.length > 2) {
        ctx.save();
        for (let i = 1; i < trail.length; i++) {
          const pt = trail[i];
          const progress = 1 - i / trail.length;
          const radius = SPARK_DEFAULTS.radius * (0.2 + progress * 0.75);
          ctx.beginPath();
          ctx.arc(pt.x - i * 1.5, pt.y, radius, 0, Math.PI * 2);

          if (i < 3) {
            ctx.fillStyle = `rgba(255, 255, 255, ${progress * 0.7})`;
          } else if (i < 7) {
            ctx.fillStyle = `rgba(248, 215, 122, ${progress * 0.5})`;
          } else {
            ctx.fillStyle = `rgba(233, 86, 63, ${progress * 0.3})`;
          }
          ctx.fill();
        }
        ctx.restore();
      }

      // 9. Kıvılcım (Oyuncu Enerji Küresi & Çok Katmanlı Plazma Çekirdeği)
      ctx.save();
      ctx.translate(spark.x, spark.y);
      ctx.rotate((spark.rotation * Math.PI) / 180);

      // İvmelenmeye Duyarlı Squash & Stretch
      const stretch = clamp(1 - spark.vy * 0.016, 0.86, 1.22);
      ctx.scale(1 / Math.sqrt(stretch), stretch);

      // A) Dış Plazma Halesi (Glow Pulse)
      const pulse = Math.sin(now * 0.015) * 2.8;
      const glowGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, SPARK_DEFAULTS.radius * 2.2 + pulse);
      glowGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      glowGrad.addColorStop(0.25, "rgba(248, 215, 122, 0.85)");
      glowGrad.addColorStop(0.65, "rgba(233, 86, 63, 0.45)");
      glowGrad.addColorStop(1, "rgba(233, 86, 63, 0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, SPARK_DEFAULTS.radius * 2.2 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // B) Çevrede Dönen Kuantum Mikro Plazma İyonları
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 1.3;
      for (let t = 0; t < 3; t++) {
        const angle = (now * 0.009) + (t * (Math.PI * 2 / 3));
        const dist = SPARK_DEFAULTS.radius + 3 + (Math.sin(now * 0.022 + t) * 2);
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // C) Canlı Füzyon Enerji Çekirdeği
      const coreGrad = ctx.createRadialGradient(-2, -2, 1, 0, 0, SPARK_DEFAULTS.radius);
      coreGrad.addColorStop(0, "#ffffff");
      coreGrad.addColorStop(0.4, "#f8d77a");
      coreGrad.addColorStop(0.78, "#e9563f");
      coreGrad.addColorStop(1, "#b91c1c");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(0, 0, SPARK_DEFAULTS.radius, 0, Math.PI * 2);
      ctx.fill();

      // D) Parlak Çekirdek & Göz Işıltısı
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(3, -1, SPARK_DEFAULTS.radius * 0.42, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // 10. Canlı Skor Metni (Orta Üst - Topbarın hemen altında ferah sayaç)
      ctx.font = '700 36px "DM Mono", monospace';
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.fillText(String(score), currentWidth / 2 + 2, 92);
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      ctx.fillText(String(score), currentWidth / 2, 90);

      ctx.restore();

      // Flaş Efekti
      if (flash > 0.002) {
        ctx.save();
        ctx.globalAlpha = flash;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, currentWidth, currentHeight);
        ctx.restore();
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      gameEnded = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [demo, locale, mastery, seed]);

  // Dokunmatik ve Fare Tıklama İşleyicisi
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (finishedRef.current) return;
    if (e.currentTarget.setPointerCapture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // pointer capture optional
      }
    }
    flapRequestedRef.current = true;
    playSparkFlap(soundOnRef.current);
  };

  return (
    <div
      className="spark-canvas-game"
      ref={containerRef}
      onPointerDown={handlePointerDown}
      style={{ touchAction: "none" }}
    >
      {/* Chrome Dinozor / Edge Surf Modeli Full-Width Oyun Kabini */}
      <div className="spark-stage-cabinet" ref={cabinetRef}>
        <canvas
          ref={canvasRef}
          className="spark-canvas"
          tabIndex={0}
          onPointerDown={handlePointerDown}
          style={{ touchAction: "none" }}
          aria-label={worldWord(
            locale,
            "Kıvılcım uçuş oyunu. Boşluk tuşu, tıkla veya ekrana dokunarak kıvılcımı havada tut.",
            "Spark flight game. Press space, click or tap screen to keep the spark airborne."
          )}
        />
      </div>
    </div>
  );
}
