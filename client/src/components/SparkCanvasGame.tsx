import { useEffect, useMemo, useRef, useState } from "react";
import type { SiteLocale } from "@/lib/i18n";

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
  pylonWidth: 54,
  pylonSpacing: 210,
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

const clamp = (value: number, lower: number, upper: number) => Math.max(lower, Math.min(upper, value));

/** Deterministik sözde rastlantısal sayı üreticisi (PRNG) */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pylon yüksekliğini deterministik seed, index ve önceki pilon üzerinden dengeli hesaplar */
export function sparkCalculatePylonHeight(
  seed: number,
  index: number,
  minHeight = SPARK_DEFAULTS.minTopHeight,
  maxAvailable = 320,
  prevHeight?: number,
  maxDelta = 140
): number {
  const prng = mulberry32(seed ^ Math.imul(index + 37, 0x1f351f) ^ 0x9e3779b9);
  let raw = Math.floor(minHeight + prng() * (maxAvailable - minHeight));
  if (prevHeight !== undefined) {
    raw = clamp(raw, prevHeight - maxDelta, prevHeight + maxDelta);
    raw = clamp(raw, minHeight, maxAvailable);
  }
  return raw;
}

/** Zorluk kademesi: Skor arttıkça hız hafifçe yükselir, açıklık daralır */
export function sparkDifficulty(score: number, mastery: number) {
  const tiers = Math.min(18, score);
  const speed = clamp(2.6 + mastery * 0.18 + tiers * 0.09, 2.6, 4.6);
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
let sharedAudioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudioCtx) {
    const CtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (CtxClass) sharedAudioCtx = new CtxClass();
  }
  if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
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
  // Elektrik kıvılcım zıplama sesi: hızlı frekans yükselişi
  playSynthTone(460, 840, 0.07, "sine", 0.16);
}

function playSparkScore(soundOn: boolean) {
  if (!soundOn) return;
  // Harmonik iki-tonlu geçiş sesi
  playSynthTone(523.25, 523.25, 0.08, "triangle", 0.18, 0);
  playSynthTone(659.25, 659.25, 0.10, "triangle", 0.16, 0.05);
}

function playSparkCrash(soundOn: boolean) {
  if (!soundOn) return;
  // Ark boşalması / çarpışma çıtırtısı
  playSynthTone(160, 35, 0.28, "sawtooth", 0.22);
  playSynthTone(90, 30, 0.22, "square", 0.15, 0.02);
}

function playSparkComplete(soundOn: boolean) {
  if (!soundOn) return;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
    playSynthTone(freq, freq, 0.15, "triangle", 0.14, idx * 0.08);
  });
}

const worldWord = (locale: SiteLocale, tr: string, en: string) => locale === "en" ? en : tr;

/* =========================================================================
   Kıvılcım Canvas Bileşeni
   ========================================================================= */
export default function SparkCanvasGame({
  locale = "tr",
  seed,
  mastery,
  demo,
  soundOn = true,
  onFinish,
}: {
  locale?: SiteLocale;
  seed: number;
  mastery: number;
  demo?: "success" | "fail";
  soundOn?: boolean;
  onFinish: (result: SparkResult) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;

  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  const finishedRef = useRef(false);
  const flapRequestedRef = useRef(false);

  const [hud, setHud] = useState({
    score: 0,
    voltage: 100,
    speed: 2.6,
    notice: worldWord(locale, "Boşluk, tıkla veya dokunarak süzül.", "Press space, click or tap to glide."),
  });

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

    // Oyun İçi Durum Değişkenleri
    let spark: SparkState = {
      x: SPARK_DEFAULTS.startX,
      y: SPARK_DEFAULTS.startY,
      vy: 0,
      rotation: 0,
    };

    let score = 0;
    let nextPylonIndex = 0;
    let pylons: Pylon[] = [];
    let particles: SparkParticle[] = [];
    let groundScrollX = 0;
    let bgScrollX = 0;
    let shake = 0;
    let flash = 0;
    let gameEnded = false;
    let lastTime = performance.now();
    let frameId = 0;
    let arcPhase = 0;

    // İlk 3 pylon oluşturulur
    function spawnPylon(index: number, startX: number, prevTopHeight?: number) {
      const { gap } = sparkDifficulty(score, mastery);
      const topHeight = sparkCalculatePylonHeight(seed, index, SPARK_DEFAULTS.minTopHeight, GROUND_Y - gap - 50, prevTopHeight);
      const bottomY = topHeight + gap;
      const bottomHeight = GROUND_Y - bottomY;
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

    const firstPylon = spawnPylon(nextPylonIndex++, CANVAS_WIDTH + 60);
    pylons.push(firstPylon);
    const secondPylon = spawnPylon(nextPylonIndex++, CANVAS_WIDTH + 60 + SPARK_DEFAULTS.pylonSpacing, firstPylon.topHeight);
    pylons.push(secondPylon);
    const thirdPylon = spawnPylon(nextPylonIndex++, CANVAS_WIDTH + 60 + SPARK_DEFAULTS.pylonSpacing * 2, secondPylon.topHeight);
    pylons.push(thirdPylon);

    // Parçacık patlaması üretici
    function createSparks(x: number, y: number, count: number, color = "#f8d77a", speed = 140) {
      if (reducedMotion) count = Math.min(count, 4);
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

    // Tuval Boyutlandırma ve Retina/DPR Yönetimi
    const handleResize = () => {
      const container = containerRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(CANVAS_WIDTH * dpr);
      canvas.height = Math.floor(CANVAS_HEIGHT * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) resizeObserver.observe(containerRef.current);

    // Giriş (Input) Tetikleyici
    const doFlap = () => {
      if (gameEnded) return;
      flapRequestedRef.current = true;
      playSparkFlap(soundOnRef.current);
      // Zıplama anında aşağıya dökülen minik kıvılcım pırıltıları
      createSparks(spark.x - 6, spark.y + 8, 3, "#f8d77a", 60);
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
      onFinishRef.current(result);
    };

    // Ana Oyun Döngüsü
    const tick = (now: number) => {
      if (gameEnded || finishedRef.current) return;
      const rawDt = clamp((now - lastTime) / 1000, 0, 0.04);
      lastTime = now;
      arcPhase += rawDt * 12;

      // 60fps normalize katsayısı (dt = 1 @ 60fps)
      const simDt = rawDt * 60;

      const { speed, gap } = sparkDifficulty(score, mastery);

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

      // Kıvılcım iz parçacığı (arka kuyruk)
      if (!reducedMotion && Math.random() > 0.45) {
        particles.push({
          x: spark.x - 10 + (Math.random() - 0.5) * 4,
          y: spark.y + (Math.random() - 0.5) * 4,
          vx: -speed * 25 + (Math.random() - 0.5) * 20,
          vy: (Math.random() - 0.5) * 30 - 10,
          life: 0.22 + Math.random() * 0.18,
          maxLife: 0.4,
          color: Math.random() > 0.4 ? "#f8d77a" : "#e9563f",
          size: 1.5 + Math.random() * 2,
        });
      }

      // Demo Autopilot Kontrolü
      if (demo === "success") {
        // En yakın önümüzdeki pylon'u bul
        const targetPylon = pylons.find(p => p.x + p.width > spark.x - 10) ?? pylons[0];
        if (targetPylon) {
          const targetCenterY = targetPylon.topHeight + targetPylon.gap * 0.5;
          if (spark.y > targetCenterY + 12 && spark.vy > -1.5) {
            doFlap();
          }
        }
      } else if (demo === "fail") {
        // demo fail: dokunma ve direğe çarp
      }

      // Fizik Güncellemesi
      const shouldFlap = flapRequestedRef.current;
      flapRequestedRef.current = false;
      spark = sparkPhysicsStep(spark, simDt, shouldFlap);

      // Zemin ve Arka Plan Paralaks Hareketi (Pylonlarla Tam Senkron)
      groundScrollX = (groundScrollX + speed * 60 * rawDt) % 40;
      bgScrollX = (bgScrollX + speed * 12 * rawDt) % CANVAS_WIDTH;
      arcPhase += rawDt * 16;

      // Pylon Hareketi & Doğurma
      for (const pylon of pylons) {
        pylon.x -= speed * simDt;

        // Puan Kazanımı (Pylon geçildi)
        if (!pylon.passed && pylon.x + pylon.width < spark.x) {
          pylon.passed = true;
          score += 1;
          playSparkScore(soundOnRef.current);
          createSparks(spark.x + 8, spark.y, 6, "#e5b341", 80);

          setHud({
            score,
            voltage: Math.min(100, 80 + score * 2),
            speed: Number(speed.toFixed(1)),
            notice: worldWord(locale, "Akım dengede! Bir sonraki hatta ilerle.", "Current stable! Advance to the next line."),
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
      pylons = pylons.filter(p => p.x + p.width > -50);
      const lastPylon = pylons[pylons.length - 1];
      if (lastPylon && lastPylon.x < CANVAS_WIDTH) {
        pylons.push(spawnPylon(nextPylonIndex++, lastPylon.x + SPARK_DEFAULTS.pylonSpacing, lastPylon.topHeight));
      }

      // Çarpışma Denetimi
      for (const pylon of pylons) {
        if (sparkFlightCollision(spark.x, spark.y, SPARK_DEFAULTS.hitRadius, pylon, GROUND_Y)) {
          // Çarpışma!
          shake = reducedMotion ? 0.2 : 1.0;
          flash = 0.45;
          playSparkCrash(soundOnRef.current);
          createSparks(spark.x, spark.y, 22, "#e9563f", 200);

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
      // ÇİZİM (RENDERING)
      // -------------------------------------------------------------
      ctx.save();

      // Ekran sarsıntısı
      if (shake > 0.002) {
        const mag = shake * 6;
        ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
      }

      // 1. Gökyüzü Degradesi (Sely Risograph Gece Mavisi)
      const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      bgGrad.addColorStop(0, "#0e1422");
      bgGrad.addColorStop(0.65, "#18223a");
      bgGrad.addColorStop(1, "#223363");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 2. Arka Plan: Yumuşak Paralaks Endüstriyel Şehir & Trafo Silüeti (Kesintisiz Çift Döngü)
      ctx.save();
      const drawCitySilhouette = (offsetX: number) => {
        ctx.fillStyle = "rgba(14, 20, 34, 0.55)";
        ctx.beginPath();
        ctx.moveTo(offsetX, GROUND_Y);
        ctx.lineTo(offsetX, GROUND_Y - 35);
        ctx.lineTo(offsetX + 35, GROUND_Y - 35);
        ctx.lineTo(offsetX + 45, GROUND_Y - 75);
        ctx.lineTo(offsetX + 65, GROUND_Y - 75);
        ctx.lineTo(offsetX + 75, GROUND_Y - 30);
        ctx.lineTo(offsetX + 120, GROUND_Y - 30);
        ctx.lineTo(offsetX + 140, GROUND_Y - 60);
        ctx.lineTo(offsetX + 170, GROUND_Y - 60);
        ctx.lineTo(offsetX + 180, GROUND_Y - 35);
        ctx.lineTo(offsetX + 245, GROUND_Y - 35);
        ctx.lineTo(offsetX + 265, GROUND_Y - 90);
        ctx.lineTo(offsetX + 295, GROUND_Y - 90);
        ctx.lineTo(offsetX + 305, GROUND_Y - 40);
        ctx.lineTo(offsetX + 360, GROUND_Y - 40);
        ctx.lineTo(offsetX + 380, GROUND_Y - 55);
        ctx.lineTo(offsetX + CANVAS_WIDTH, GROUND_Y - 55);
        ctx.lineTo(offsetX + CANVAS_WIDTH, GROUND_Y);
        ctx.closePath();
        ctx.fill();

        // Kule anten uçlarında yanıp sönen kırmızı ikaz LED'leri
        const beaconY = GROUND_Y - 92;
        const beaconX = offsetX + 280;
        if (beaconX >= -10 && beaconX <= CANVAS_WIDTH + 10) {
          const blink = Math.sin(now * 0.006) > 0.1;
          ctx.fillStyle = blink ? "#ef4444" : "rgba(239, 68, 68, 0.25)";
          ctx.beginPath();
          ctx.arc(beaconX, beaconY, blink ? 2.5 : 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      drawCitySilhouette(-bgScrollX);
      drawCitySilhouette(-bgScrollX + CANVAS_WIDTH);
      ctx.restore();

      // 3. Yüksek Gerilim Pylonları (Lattice Truss Kuleleri & Seramik İzolatörler)
      for (const p of pylons) {
        ctx.save();

        // Üst Kule Gövdesi
        const pylonGrad = ctx.createLinearGradient(p.x, 0, p.x + p.width, 0);
        pylonGrad.addColorStop(0, "#131f33");
        pylonGrad.addColorStop(0.2, "#1e314f");
        pylonGrad.addColorStop(0.5, "#2a436c");
        pylonGrad.addColorStop(0.85, "#1c2e4b");
        pylonGrad.addColorStop(1, "#111b2d");

        // Üst Direk Gövdesi
        ctx.fillStyle = pylonGrad;
        ctx.fillRect(p.x, 0, p.width, p.topHeight);
        ctx.strokeStyle = "#38527d";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(p.x, 0, p.width, p.topHeight);

        // Üst Direk İçi Kafes Kiriş Deseni (Truss Bracing)
        ctx.strokeStyle = "rgba(100, 140, 200, 0.28)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let y = 16; y < p.topHeight - 20; y += 22) {
          ctx.moveTo(p.x + 2, y);
          ctx.lineTo(p.x + p.width - 2, y + 18);
          ctx.moveTo(p.x + p.width - 2, y);
          ctx.lineTo(p.x + 2, y + 18);
        }
        ctx.stroke();

        // Üst Seramik İzolatör Boğumları (3 Kademeli Disk)
        const topIsoY = p.topHeight - 18;
        for (let d = 0; d < 3; d++) {
          const dy = topIsoY + d * 5;
          const dw = p.width + (2 - d) * 4;
          const dx = p.x + (p.width - dw) / 2;
          ctx.fillStyle = d === 2 ? "#e9563f" : "#d9442e";
          ctx.fillRect(dx, dy, dw, 4);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 0.8;
          ctx.strokeRect(dx, dy, dw, 4);
        }

        // Üst Pirinç Kondansatör Terminali (Arkın Çıktığı Nokta)
        ctx.fillStyle = "#e5b341";
        ctx.beginPath();
        ctx.arc(p.x + p.width * 0.5, p.topHeight, 5, 0, Math.PI * 2);
        ctx.fill();

        // Alt Kule Gövdesi
        ctx.fillStyle = pylonGrad;
        ctx.fillRect(p.x, p.bottomY, p.width, p.bottomHeight);
        ctx.strokeStyle = "#38527d";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(p.x, p.bottomY, p.width, p.bottomHeight);

        // Alt Direk İçi Kafes Kiriş Deseni
        ctx.strokeStyle = "rgba(100, 140, 200, 0.28)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let y = p.bottomY + 18; y < GROUND_Y - 16; y += 22) {
          ctx.moveTo(p.x + 2, y);
          ctx.lineTo(p.x + p.width - 2, y + 18);
          ctx.moveTo(p.x + p.width - 2, y);
          ctx.lineTo(p.x + 2, y + 18);
        }
        ctx.stroke();

        // Alt Seramik İzolatör Boğumları
        for (let d = 0; d < 3; d++) {
          const dy = p.bottomY + 3 + d * 5;
          const dw = p.width + d * 4;
          const dx = p.x + (p.width - dw) / 2;
          ctx.fillStyle = d === 0 ? "#e9563f" : "#d9442e";
          ctx.fillRect(dx, dy, dw, 4);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 0.8;
          ctx.strokeRect(dx, dy, dw, 4);
        }

        // Alt Pirinç Kondansatör Terminali
        ctx.fillStyle = "#e5b341";
        ctx.beginPath();
        ctx.arc(p.x + p.width * 0.5, p.bottomY, 5, 0, Math.PI * 2);
        ctx.fill();

        // ALT PYLON TABAN PABUCU (Zemine Perçinli Ağır Çelik Kaide)
        // Pylonun havada yüzmesini engeller, zemine sağlamca kenetler
        ctx.fillStyle = "#0f1624";
        ctx.fillRect(p.x - 7, GROUND_Y - 7, p.width + 14, 9);
        ctx.strokeStyle = "#e5b341";
        ctx.lineWidth = 1.2;
        ctx.strokeRect(p.x - 7, GROUND_Y - 7, p.width + 14, 9);

        // Kaide Montaj Cıvataları
        ctx.fillStyle = "#f8d77a";
        ctx.fillRect(p.x - 4, GROUND_Y - 5, 3, 3);
        ctx.fillRect(p.x + p.width + 1, GROUND_Y - 5, 3, 3);

        // 4. Sütunlar Arasındaki Fraktal Tesla Elektrik Arkı (Realist Lightning Crackle)
        if (Math.sin(arcPhase + p.id * 2.1) > 0.15) {
          const startArcY = p.topHeight;
          const endArcY = p.bottomY;
          const midX = p.x + p.width * 0.5;
          const steps = 8;
          const arcPoints: Array<{ x: number; y: number }> = [{ x: midX, y: startArcY }];

          for (let s = 1; s < steps; s++) {
            const progress = s / steps;
            const sy = startArcY + (endArcY - startArcY) * progress;
            // Çift harmonik kırılma + mikro rastgele sapma
            const jitter = (Math.sin(arcPhase * 3.5 + s * 2.8 + p.id) * 8) + ((Math.random() - 0.5) * 4);
            arcPoints.push({ x: midX + jitter, y: sy });
          }
          arcPoints.push({ x: midX, y: endArcY });

          // Dış Plazma Halesi (Neon Glow)
          ctx.strokeStyle = "rgba(248, 215, 122, 0.55)";
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(arcPoints[0].x, arcPoints[0].y);
          for (let i = 1; i < arcPoints.length; i++) {
            ctx.lineTo(arcPoints[i].x, arcPoints[i].y);
          }
          ctx.stroke();

          // İç Beyaz-Sıcak Yıldırım Çekirdeği
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(arcPoints[0].x, arcPoints[0].y);
          for (let i = 1; i < arcPoints.length; i++) {
            ctx.lineTo(arcPoints[i].x, arcPoints[i].y);
          }
          ctx.stroke();

          // Çatallanan Yan Kıvılcım (Branching spark)
          if (Math.random() > 0.45) {
            const branchIdx = 3 + Math.floor(Math.random() * 3);
            const bp = arcPoints[branchIdx];
            ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(bp.x, bp.y);
            ctx.lineTo(bp.x + (Math.random() > 0.5 ? 12 : -12), bp.y + (Math.random() - 0.5) * 10);
            ctx.stroke();
          }
        }

        ctx.restore();
      }

      // 5. Zemin Hattı: Yüksek Gerilim Reaktör Yolu (Pylonlarla BİREBİR AYNI HIZDA Dönen Raylar)
      const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, CANVAS_HEIGHT);
      groundGrad.addColorStop(0, "#13171e");
      groundGrad.addColorStop(0.2, "#1d222b");
      groundGrad.addColorStop(1, "#0d0f13");
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, GROUND_HEIGHT);

      // Zemin Üst Güvenlik Rayı (Katı Metalik Bordür)
      ctx.strokeStyle = "#e5b341";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(CANVAS_WIDTH, GROUND_Y);
      ctx.stroke();

      // Zemin İçi: Pylonlarla Birebir Aynı Hızda Akan Çelik Derz Panelleri
      ctx.fillStyle = "rgba(246, 240, 227, 0.12)";
      for (let x = -groundScrollX; x < CANVAS_WIDTH + 40; x += 40) {
        ctx.fillRect(x, GROUND_Y, 2, GROUND_HEIGHT);
      }

      // Kayan Sarı-Siyah Endüstriyel Tehlike Şeridi
      ctx.strokeStyle = "rgba(248, 215, 122, 0.35)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([12, 10]);
      ctx.lineDashOffset = -groundScrollX;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y + 12);
      ctx.lineTo(CANVAS_WIDTH, GROUND_Y + 12);
      ctx.stroke();
      ctx.setLineDash([]);

      // 6. Parçacıklar
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

      // 7. Kıvılcım (Oyuncu Enerji Küresi & Çok Katmanlı Plazma Çekirdeği)
      ctx.save();
      ctx.translate(spark.x, spark.y);
      ctx.rotate((spark.rotation * Math.PI) / 180);

      // A) Dış Plazma Halesi (Glow Pulse)
      const pulse = Math.sin(now * 0.014) * 2.5;
      const glowGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, SPARK_DEFAULTS.radius * 2.0 + pulse);
      glowGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      glowGrad.addColorStop(0.25, "rgba(248, 215, 122, 0.85)");
      glowGrad.addColorStop(0.65, "rgba(233, 86, 63, 0.45)");
      glowGrad.addColorStop(1, "rgba(233, 86, 63, 0)");
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, SPARK_DEFAULTS.radius * 2.0 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // B) Çevrede Dönen 3 Adet Mikro Plazma Kıvılcımı (Orbiting Tendrils)
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 1.2;
      for (let t = 0; t < 3; t++) {
        const angle = (now * 0.008) + (t * (Math.PI * 2 / 3));
        const dist = SPARK_DEFAULTS.radius + 3 + (Math.sin(now * 0.02 + t) * 2);
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * dist, Math.sin(angle) * dist, 1.4, 0, Math.PI * 2);
        ctx.stroke();
      }

      // C) Canlı Enerji Küresi
      const coreGrad = ctx.createRadialGradient(-2, -2, 1, 0, 0, SPARK_DEFAULTS.radius);
      coreGrad.addColorStop(0, "#ffffff");
      coreGrad.addColorStop(0.4, "#f8d77a");
      coreGrad.addColorStop(1, "#e9563f");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(0, 0, SPARK_DEFAULTS.radius, 0, Math.PI * 2);
      ctx.fill();

      // D) Parlak Çekirdek & Göz Işıltısı (Uçuş Yönüne Bakan Odak Noktası)
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(3, -1, SPARK_DEFAULTS.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // 8. Canlı Skor Metni (Orta Üst)
      ctx.font = '700 32px "DM Mono", monospace';
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillText(String(score), CANVAS_WIDTH / 2 + 2, 54);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(String(score), CANVAS_WIDTH / 2, 52);

      ctx.restore();

      // Flaş Efekti
      if (flash > 0.002) {
        ctx.save();
        ctx.globalAlpha = flash;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.restore();
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      gameEnded = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
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
    <div className="spark-canvas-game" ref={containerRef}>
      {/* 390px Mobil Uyumlu HUD */}
      <div className="spark-canvas-hud" aria-live="polite">
        <span>
          {worldWord(locale, "SKOR", "SCORE")} <b>{hud.score}</b>
        </span>
        <span>
          {worldWord(locale, "VOLTAJ", "VOLTAGE")} <b>%{hud.voltage}</b>
        </span>
        <span>
          {worldWord(locale, "HIZ", "SPEED")} <b>{hud.speed}x</b>
        </span>
        <span>
          {worldWord(locale, "MOD", "MODE")} <b>{worldWord(locale, "ARK", "ARC")}</b>
        </span>
      </div>

      {/* Ana Tuval */}
      <canvas
        ref={canvasRef}
        className="spark-canvas"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        style={{ touchAction: "none" }}
        aria-label={worldWord(
          locale,
          "Kıvılcım uçuş oyunu. Boşluk tuşu, tıkla veya dokunarak kıvılcımı havada tut.",
          "Spark flight game. Press space, click or tap to keep the spark airborne."
        )}
      />

      <p className="spark-canvas-tip">{hud.notice}</p>

      {/* Mobil Dostu Büyük Dokunmatik Kontrol Butonu */}
      <div className="spark-canvas-controls" aria-label={worldWord(locale, "Kıvılcım kontrolleri", "Spark controls")}>
        <button
          type="button"
          onPointerDown={handlePointerDown}
          className="spark-flap-button"
          aria-label={worldWord(locale, "Kıvılcımı uçur", "Flap spark")}
        >
          <b>✦</b>
          <span>{worldWord(locale, "DOKUN / SÜZÜL (BOŞLUK)", "TAP / GLIDE (SPACE)")}</span>
        </button>
      </div>
    </div>
  );
}
