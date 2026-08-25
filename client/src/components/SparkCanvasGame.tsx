import { useEffect, useMemo, useRef, useState } from "react";
import { generateSparkLevel, generateSparkWorldSegment, sparkEscalationFor, type SparkEventType } from "@/lib/levelGenerators";
import type { SiteLocale } from "@/lib/i18n";
import { playComplete, playFail, playHit, playStamp } from "@/lib/sfx";

type Outcome = "success" | "failure";
type SparkResult = { score: number; label: string; detail: string; outcome: Outcome };
type EntityKind = SparkEventType;
type Entity = { id: string; kind: EntityKind; lane: number; z: number; resolved: boolean };
type Player = { x: number; vx: number; lane: number; distance: number; speed: number; focus: number; pickups: number; clean: number; combo: number; maxCombo: number; hitCooldown: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number };
type World = {
  player: Player; entities: Entity[]; particles: Particle[]; shake: number; flash: number; hitStopFrames: number;
  generatedSegments: Set<number>; width: number; height: number; startedAt: number; lastAt: number; ended: boolean;
};

function spawnBurst(world: World, x: number, y: number, count: number, color: string, spread: number, speed: number) {
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 + Math.random() * .6;
    const velocity = speed * (.5 + Math.random() * .7);
    world.particles.push({
      x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity - speed * .2,
      life: .38 + Math.random() * .26, maxLife: .6, color, size: 2 + Math.random() * spread,
    });
  }
}

const worldWord = (locale: SiteLocale, tr: string, en: string) => locale === "en" ? en : tr;
const clamp = (value: number, lower: number, upper: number) => Math.max(lower, Math.min(upper, value));
// Yolun ekran genişliğinin ne kadarını kapladığı — küçüldükçe şeritler daha dar/dikey bir
// alanda toplanır, sağda solda daha çok boşluk kalır ("araba/yol çok geniş" geri bildirimi
// üzerine .42'den düşürüldü). Tek kaynak: render'daki TÜM ekran-x hesapları buradan okur.
const ROAD_SCREEN_SPAN = .3;

/** Şerit i'nin merkez x'i (-1..1 aralığında) ve yarı-genişliği — üstten görünümde tek
 * doğruluk kaynağı: hem render hem çarpışma buradan okur. */
export function sparkLaneBounds(laneCount: number): { center: number; half: number }[] {
  const width = 2 / laneCount;
  return Array.from({ length: laneCount }, (_, index) => ({ center: -1 + width * (index + .5), half: width * .43 }));
}

export function sparkLaneOf(x: number, laneCount: number): number {
  const bounds = sparkLaneBounds(laneCount);
  let closest = 0;
  let bestDistance = Infinity;
  bounds.forEach((bound, index) => { const distance = Math.abs(x - bound.center); if (distance < bestDistance) { bestDistance = distance; closest = index; } });
  return closest;
}

/** Oyuncu, engelin şeridinin İÇİNDE ve aynı satırdaysa çarpışma sayılır — şerit sınırları
 * render ile aynı sparkLaneBounds'tan geldiği için "görünmez duvar" riski yok. */
export function sparkCollision(playerX: number, playerDistance: number, entity: { lane: number; z: number }, laneCount: number, rowTolerance = .95): boolean {
  if (Math.abs(entity.z - playerDistance) >= rowTolerance) return false;
  const bound = sparkLaneBounds(laneCount)[entity.lane];
  return Math.abs(playerX - bound.center) < bound.half;
}

/** 0 (taban hız) ile 1 (azami hız) arasında normalize edilmiş hız oranı — arabanın ekrandaki
 * ileri kayma miktarını buradan türetiyoruz, hem çizimde hem çarpışma efektlerinde aynı değer. */
export function sparkSpeedRatio(speed: number, baseSpeed: number, maxSpeed: number): number {
  return clamp((speed - baseSpeed) / Math.max(1, maxSpeed - baseSpeed), 0, 1);
}

/** Yalnız yol kaymıyor — araba da hız arttıkça ekranda hafifçe öne (yukarı) kayar, gerçek bir
 * ilerleme hissi verir. Sabit bir Y'de donup kalmak "araba hiç ilerlemiyor" hissi yaratıyordu. */
export function sparkPlayerScreenY(height: number, speedRatio: number): number {
  return height * (.82 - speedRatio * .1);
}

const SPRITE_SOURCES: Record<EntityKind, string> = {
  traffic: "/manus-storage/spark-car-blue.png",
  barrel: "/manus-storage/spark-barrel.png",
  cone: "/manus-storage/spark-cone.png",
  barrier: "/manus-storage/spark-barrier.png",
  rock: "/manus-storage/spark-rock.png",
  tires: "/manus-storage/spark-tires.png",
  pickup: "/manus-storage/spark-arrow.png",
};
const TRAFFIC_VARIANTS = ["/manus-storage/spark-car-blue.png", "/manus-storage/spark-car-red.png", "/manus-storage/spark-car-green.png", "/manus-storage/spark-car-black.png"];
// Gerçek sprite oranına göre (araba dar/uzun, varil/koni küçük, bariyer geniş) her tür için
// render genişliği bir şerit payının kesri olarak — çarpışma sınırı sparkLaneBounds'tan
// bağımsız kalır (o sınır şeridin TAMAMI), bu yalnız görsel boyut. Değerler kasıtlı olarak
// küçük tutuluyor — şeridin tamamını dolduran dev sprite'lar hem çirkin duruyor hem de yolu
// okumayı zorlaştırıyordu ("araba kocaman, engeller kocaman" geri bildirimi üzerine küçültüldü).
const ENTITY_VISUAL_WIDTH: Record<EntityKind, number> = { traffic: .36, barrel: .2, cone: .17, barrier: .46, rock: .23, tires: .21, pickup: .19 };
const PLAYER_VISUAL_WIDTH = .34;

function loadSprite(src: string): HTMLImageElement {
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  return image;
}

function entityForSegment(seed: number, mastery: number, segmentIndex: number): Entity[] {
  const level = generateSparkLevel(seed, mastery);
  return generateSparkWorldSegment(level, segmentIndex).events.map(event => ({
    id: `${segmentIndex}-${event.id}`,
    kind: event.type,
    lane: event.lane,
    z: event.z,
    resolved: false,
  }));
}

function trafficVariantFor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TRAFFIC_VARIANTS[hash % TRAFFIC_VARIANTS.length];
}

function drawScene(context: CanvasRenderingContext2D, world: World, locale: SiteLocale, laneCount: number, sprites: Map<string, HTMLImageElement>, speedRatio: number) {
  const { width, height, player, entities } = world;
  context.save();
  if (world.shake > .002) {
    const mag = world.shake * 7;
    context.translate((Math.random() - .5) * mag, (Math.random() - .5) * mag);
  }

  context.fillStyle = "#2c2f33";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#3a3e42";
  const bounds = sparkLaneBounds(laneCount);
  context.fillRect(width * (.5 + (bounds[0].center - bounds[0].half) * ROAD_SCREEN_SPAN), 0, width * ((bounds[laneCount - 1].center + bounds[laneCount - 1].half) - (bounds[0].center - bounds[0].half)) * ROAD_SCREEN_SPAN, height);

  // Şerit ayırıcı kesikli çizgiler — kaydırma efekti player.distance'a bağlı.
  context.strokeStyle = "rgba(245,236,212,.55)";
  context.lineWidth = 3;
  context.setLineDash([26, 22]);
  context.lineDashOffset = -(player.distance * 34) % 48;
  for (let lane = 1; lane < laneCount; lane += 1) {
    const x = width * (.5 + (bounds[lane].center - bounds[lane].half + .01) * ROAD_SCREEN_SPAN);
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke();
  }
  context.setLineDash([]);

  context.font = "10px DM Mono, monospace";
  context.fillStyle = "rgba(245,236,212,.82)";
  context.fillText(`SELY TRAFİK / ${String(Math.floor(player.distance / 100) + 1).padStart(2, "0")}`, width - 150, 20);
  context.fillText(worldWord(locale, "SOL/SAĞ: ŞERİT DEĞİŞTİR", "LEFT/RIGHT: CHANGE LANE"), 14, height - 14);

  const pixelsPerUnit = height * .052;
  const playerScreenY = sparkPlayerScreenY(height, speedRatio);
  const laneScreenX = (lane: number) => width * (.5 + bounds[lane].center * ROAD_SCREEN_SPAN);

  const visible = entities.filter(entity => !entity.resolved && entity.z > player.distance - 3 && entity.z < player.distance + 22).sort((a, b) => b.z - a.z);
  for (const entity of visible) {
    const screenY = playerScreenY - (entity.z - player.distance) * pixelsPerUnit;
    if (screenY < -60 || screenY > height + 60) continue;
    const screenX = laneScreenX(entity.lane);
    const spriteKey = entity.kind === "traffic" ? trafficVariantFor(entity.id) : SPRITE_SOURCES[entity.kind];
    const sprite = sprites.get(spriteKey);
    const laneWidthPx = width * (bounds[entity.lane].half * 2) * ROAD_SCREEN_SPAN;
    const drawWidth = laneWidthPx * ENTITY_VISUAL_WIDTH[entity.kind];
    if (sprite?.complete && sprite.naturalWidth > 0) {
      const drawHeight = drawWidth * (sprite.naturalHeight / sprite.naturalWidth);
      context.save();
      if (entity.kind === "pickup") {
        const pulse = 1 + Math.sin(world.lastAt * .006 + entity.z) * .08;
        context.translate(screenX, screenY);
        context.scale(pulse, pulse);
        context.shadowColor = "rgba(228,181,69,.65)";
        context.shadowBlur = 12;
        context.drawImage(sprite, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        context.restore();
      } else {
        context.drawImage(sprite, screenX - drawWidth / 2, screenY - drawHeight / 2, drawWidth, drawHeight);
      }
    }
  }

  for (const particle of world.particles) {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  const playerScreenX = laneScreenX(0) + (player.x - bounds[0].center) * (width * ROAD_SCREEN_SPAN);
  const playerSprite = sprites.get("/manus-storage/spark-car-player.png");
  if (player.speed > 9) {
    context.save();
    context.globalAlpha = .5 + Math.sin(world.lastAt * .03) * .15;
    const flameGradient = context.createRadialGradient(playerScreenX, playerScreenY + 26, 1, playerScreenX, playerScreenY + 26, 16);
    flameGradient.addColorStop(0, "#f8d77a");
    flameGradient.addColorStop(1, "rgba(240,93,71,0)");
    context.fillStyle = flameGradient;
    context.beginPath(); context.arc(playerScreenX, playerScreenY + 26, 15, 0, Math.PI * 2); context.fill();
    context.restore();
  }
  context.save();
  context.translate(playerScreenX, playerScreenY);
  context.rotate(clamp(player.vx * .3, -.22, .22));
  context.shadowColor = "rgba(0,0,0,.35)";
  context.shadowBlur = 6;
  context.shadowOffsetY = 3;
  const laneWidthPx = width * (bounds[0].half * 2) * ROAD_SCREEN_SPAN;
  const playerWidth = laneWidthPx * PLAYER_VISUAL_WIDTH;
  if (playerSprite?.complete && playerSprite.naturalWidth > 0) {
    const playerHeight = playerWidth * (playerSprite.naturalHeight / playerSprite.naturalWidth);
    context.drawImage(playerSprite, -playerWidth / 2, -playerHeight / 2, playerWidth, playerHeight);
  }
  context.restore();
  context.restore();

  if (world.flash > .002) {
    context.save();
    context.globalAlpha = world.flash;
    context.fillStyle = "#e9563f";
    context.fillRect(0, 0, width, height);
    context.restore();
  }
}

export default function SparkCanvasGame({ locale, seed, mastery, demo, soundOn = true, onFinish }: { locale: SiteLocale; seed: number; mastery: number; demo?: "success" | "fail"; soundOn?: boolean; onFinish: (result: SparkResult) => void }) {
  const level = useMemo(() => generateSparkLevel(seed, mastery), [seed, mastery]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spritesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const inputRef = useRef({ left: false, right: false });
  const doneRef = useRef(false);
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;
  const [hud, setHud] = useState({ distance: 0, focus: level.focus, pickups: 0, clean: 0, combo: 0, speed: 0, sheet: 1, notice: level.lesson });

  useEffect(() => {
    const sources = Array.from(new Set([...Object.values(SPRITE_SOURCES), ...TRAFFIC_VARIANTS, "/manus-storage/spark-car-player.png"]));
    for (const src of sources) if (!spritesRef.current.has(src)) spritesRef.current.set(src, loadSprite(src));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bounds = sparkLaneBounds(level.laneCount);
    const startLane = Math.floor(level.laneCount / 2);
    const world: World = {
      player: { x: bounds[startLane].center, vx: 0, lane: startLane, distance: 0, speed: level.baseSpeed * (reducedMotion ? .72 : 1), focus: level.focus, pickups: 0, clean: 0, combo: 0, maxCombo: 0, hitCooldown: 0 },
      entities: [], particles: [], shake: 0, flash: 0, hitStopFrames: 0, generatedSegments: new Set<number>(), width: 1, height: 1, startedAt: performance.now(), lastAt: performance.now(), ended: false,
    };
    let frame = 0;
    let lastHudAt = 0;
    const finish = (result: SparkResult) => {
      if (doneRef.current) return;
      doneRef.current = true;
      world.ended = true;
      onFinish(result);
    };
    const streamWorld = () => {
      const current = Math.floor(world.player.distance / level.segmentDistance);
      for (const segment of [current, current + 1]) {
        if (!world.generatedSegments.has(segment)) {
          world.generatedSegments.add(segment);
          const generated = entityForSegment(seed, mastery, segment);
          if (demo === "success") {
            let lastThreatZ = -Infinity;
            const safeDemoEntities = generated.filter((entity, index) => {
              if (entity.kind === "pickup") return true;
              if (index % 2 !== 0 || entity.z - lastThreatZ < 6.4) return false;
              lastThreatZ = entity.z;
              return true;
            }).map((entity, index) => entity.kind === "pickup" ? entity : { ...entity, lane: index % 2 === 0 ? 0 : level.laneCount - 1 });
            world.entities.push(...safeDemoEntities);
          } else if (demo === "fail" && segment === 0) {
            world.entities.push(
              { id: "demo-fail-1", kind: "barrier", lane: world.player.lane, z: 12, resolved: false },
              { id: "demo-fail-2", kind: "barrier", lane: world.player.lane, z: 21, resolved: false },
              { id: "demo-fail-3", kind: "barrier", lane: world.player.lane, z: 30, resolved: false },
            );
          } else {
            world.entities.push(...generated);
          }
        }
      }
      world.entities = world.entities.filter(entity => entity.z > world.player.distance - 4);
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(rect.height * pixelRatio));
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      world.width = rect.width; world.height = rect.height;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    const key = (event: KeyboardEvent, down: boolean) => {
      const controls: Record<string, keyof typeof inputRef.current> = { ArrowLeft: "left", ArrowRight: "right", a: "left", d: "right" };
      const control = controls[event.key];
      if (!control) return;
      event.preventDefault();
      inputRef.current[control] = down;
    };
    const keydown = (event: KeyboardEvent) => key(event, true);
    const keyup = (event: KeyboardEvent) => key(event, false);
    window.addEventListener("keydown", keydown, { passive: false });
    window.addEventListener("keyup", keyup, { passive: false });
    const tick = (now: number) => {
      if (world.ended) return;
      const rawDt = clamp((now - world.lastAt) / 1000, 0, .034);
      const hitStopping = world.hitStopFrames > 0;
      if (hitStopping) world.hitStopFrames -= 1;
      const dt = hitStopping ? rawDt * .12 : rawDt;
      world.lastAt = now;
      world.shake = Math.max(0, world.shake - rawDt * 3.4);
      world.flash = Math.max(0, world.flash - rawDt * 2.6);
      for (const particle of world.particles) {
        particle.x += particle.vx * rawDt;
        particle.y += particle.vy * rawDt;
        particle.vy += 240 * rawDt;
        particle.life -= rawDt;
      }
      world.particles = world.particles.filter(particle => particle.life > 0);
      streamWorld();
      const input = inputRef.current;
      const upcomingThreats = world.entities.filter(entity => entity.kind !== "pickup" && !entity.resolved && entity.z > world.player.distance - .4 && entity.z - world.player.distance < 9);
      const laneOpen = (lane: number) => upcomingThreats.every(entity => entity.lane !== lane);
      const autoTargetLane = demo === "success"
        ? (laneOpen(world.player.lane) ? world.player.lane : Array.from({ length: level.laneCount }, (_, i) => i).find(laneOpen) ?? world.player.lane)
        : world.player.lane;
      const autoAxis = demo === "success" ? Math.sign(bounds[autoTargetLane].center - world.player.x) : 0;
      const axis = (input.right ? 1 : 0) - (input.left ? 1 : 0) || autoAxis;
      const acceleration = 6.4;
      world.player.vx += axis * acceleration * dt;
      world.player.vx *= Math.pow(.0006, dt);
      world.player.vx = clamp(world.player.vx, -1.9, 1.9);
      world.player.x = clamp(world.player.x + world.player.vx * dt, -1 + bounds[0].half * .2, 1 - bounds[0].half * .2);
      world.player.lane = sparkLaneOf(world.player.x, level.laneCount);
      const speedTarget = clamp(level.baseSpeed + level.acceleration * world.player.distance, level.baseSpeed, level.maxSpeed);
      world.player.speed += (speedTarget - world.player.speed) * Math.min(1, dt * 4.8);
      world.player.distance += world.player.speed * dt;
      world.player.hitCooldown = Math.max(0, world.player.hitCooldown - dt);

      const speedRatio = sparkSpeedRatio(world.player.speed, level.baseSpeed, level.maxSpeed);
      const laneScreenX = (lane: number) => world.width * (.5 + bounds[lane].center * ROAD_SCREEN_SPAN);
      const playerScreenX = laneScreenX(0) + (world.player.x - bounds[0].center) * (world.width * ROAD_SCREEN_SPAN);
      const playerScreenY = sparkPlayerScreenY(world.height, speedRatio);

      for (const entity of world.entities) {
        if (entity.resolved || entity.z > world.player.distance + .9) continue;
        const collision = sparkCollision(world.player.x, world.player.distance, entity, level.laneCount);
        if (entity.kind === "pickup") {
          if (collision) {
            entity.resolved = true;
            world.player.pickups += 1;
            world.player.combo = Math.min(9, world.player.combo + 1);
            world.player.maxCombo = Math.max(world.player.maxCombo, world.player.combo);
            playStamp(soundOnRef.current, world.player.combo);
            spawnBurst(world, playerScreenX, playerScreenY - 24, 8, "#e4b545", 2, 120);
          } else if (entity.z < world.player.distance - .9) { entity.resolved = true; world.player.combo = 0; }
          continue;
        }
        if (collision && world.player.hitCooldown <= 0) {
          entity.resolved = true;
          world.player.hitCooldown = 1;
          world.player.focus -= 1;
          world.player.combo = 0;
          world.shake = 1;
          world.flash = .38;
          world.hitStopFrames = 4;
          playHit(soundOnRef.current);
          spawnBurst(world, playerScreenX, playerScreenY, 12, "#172842", 3, 170);
          if (world.player.focus <= 0) {
            playFail(soundOnRef.current);
            finish({ outcome: "failure", score: Math.round(world.player.distance * 19 + world.player.pickups * 130 + world.player.clean * 28 + world.player.maxCombo * 40), label: worldWord(locale, "Trafik seni durdurdu", "Traffic stopped you"), detail: worldWord(locale, "Şeritler arasında en az biri her zaman açık — erken göç et, son ana bırakma.", "One lane is always open — change lanes early, not at the last moment.") });
            return;
          }
        } else if (entity.z < world.player.distance - .9) {
          entity.resolved = true;
          if (entity.lane !== world.player.lane) world.player.clean += 1;
        }
      }
      if (demo === "success" && world.player.distance >= level.segmentDistance * 2) {
        playComplete(soundOnRef.current);
        finish({ outcome: "success", score: Math.round(world.player.distance * 19 + world.player.pickups * 130 + world.player.clean * 28 + world.player.focus * 90 + world.player.maxCombo * 40), label: worldWord(locale, "İki yol kesimi aşıldı", "Two road stretches cleared"), detail: worldWord(locale, `${world.player.pickups} bonus ve ${world.player.clean} temiz geçişle yolu tamamladın.`, `You completed the road with ${world.player.pickups} bonuses and ${world.player.clean} clean passes.`) });
        return;
      }
      drawScene(context, world, locale, level.laneCount, spritesRef.current, speedRatio);
      if (now - lastHudAt > 100) {
        lastHudAt = now;
        setHud({ distance: Math.floor(world.player.distance), focus: world.player.focus, pickups: world.player.pickups, clean: world.player.clean, combo: world.player.combo, speed: Number(world.player.speed.toFixed(1)), sheet: Math.floor(world.player.distance / level.segmentDistance) + 1, notice: worldWord(locale, "Yol ileriden hazırlanır; sol/sağ ile açık şeride geç.", "The road is prepared ahead; steer left/right into an open lane.") });
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => { world.ended = true; window.cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); };
  }, [demo, level, locale, mastery, onFinish, seed]);

  const hold = (control: keyof typeof inputRef.current, active: boolean) => { inputRef.current[control] = active; };
  const controls = [
    { key: "left" as const, label: worldWord(locale, "Sol", "Left"), glyph: "←" },
    { key: "right" as const, label: worldWord(locale, "Sağ", "Right"), glyph: "→" },
  ];
  return <div className="spark-canvas-game">
    <div className="spark-canvas-hud" aria-live="polite"><span>{worldWord(locale, "MESAFE", "DISTANCE")} <b>{hud.distance}m</b></span><span>{worldWord(locale, "ODAK", "FOCUS")} <b>{hud.focus}/{level.focus}</b></span><span>{worldWord(locale, "BONUS", "BONUS")} <b>{hud.pickups}</b></span><span>{worldWord(locale, "ZİNCİR", "COMBO")} <b>×{hud.combo}</b></span><span>{worldWord(locale, "HIZ", "SPEED")} <b>{hud.speed}</b></span><span>{worldWord(locale, "KESİM", "STRETCH")} <b>{String(hud.sheet).padStart(2, "0")}</b></span></div>
    <canvas ref={canvasRef} className="spark-canvas" tabIndex={0} aria-label={worldWord(locale, "Kıvılcım trafik kaçışı. Sol ve sağ ile şerit değiştir.", "Spark traffic escape. Steer left and right to change lanes.")} />
    <p className="spark-canvas-tip">{hud.notice}</p>
    <div className="spark-canvas-controls" aria-label={worldWord(locale, "Kıvılcım dokunmatik kontrolleri", "Spark touch controls")}>{controls.map(control => <button type="button" key={control.key} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); hold(control.key, true); }} onPointerUp={() => hold(control.key, false)} onPointerCancel={() => hold(control.key, false)} onPointerLeave={() => hold(control.key, false)} aria-label={control.label}><b>{control.glyph}</b><span>{control.label}</span></button>)}</div>
  </div>;
}
