import { useEffect, useMemo, useRef, useState } from "react";
import { generateSparkLevel, generateSparkWorldSegment, sparkEscalationFor, type SparkEventType } from "@/lib/levelGenerators";
import type { SiteLocale } from "@/lib/i18n";
import { playComplete, playFail, playHit, playStamp } from "@/lib/sfx";

type Outcome = "success" | "failure";
type SparkResult = { score: number; label: string; detail: string; outcome: Outcome };
type EntityKind = SparkEventType;
type Entity = { id: string; kind: EntityKind; x: number; z: number; size: number; resolved: boolean };
type SceneryKind = "tower" | "roller" | "paper" | "lamp";
export type SparkScenery = { id: string; kind: SceneryKind; x: number; z: number; size: number };
type Player = { x: number; vx: number; distance: number; speed: number; focus: number; stamps: number; clean: number; combo: number; maxCombo: number; hitCooldown: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number };
type World = { player: Player; entities: Entity[]; scenery: SparkScenery[]; particles: Particle[]; shake: number; flash: number; hitStopFrames: number; generatedSegments: Set<number>; generatedScenerySegments: Set<number>; width: number; height: number; startedAt: number; lastAt: number; ended: boolean };

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

const SEGMENT_DISTANCE = 54;
const WORLD_AHEAD = 34;
const worldWord = (locale: SiteLocale, tr: string, en: string) => locale === "en" ? en : tr;
const clamp = (value: number, lower: number, upper: number) => Math.max(lower, Math.min(upper, value));

export function projectSparkWorld(x: number, z: number, playerDistance: number, width: number, height: number) {
  const relativeZ = z - playerDistance;
  const depth = clamp(1 - relativeZ / WORLD_AHEAD, .05, 1.08);
  return {
    relativeZ,
    depth,
    x: width * .5 + x * width * (.08 + depth * .32),
    y: height * (.40 + depth * .46),
    scale: .26 + depth * 1.14,
  };
}

export function sparkWorldCollision(playerX: number, playerDistance: number, entity: Pick<Entity, "x" | "z" | "size">) {
  return Math.abs(entity.z - playerDistance) < .88 && Math.abs(entity.x - playerX) < (.18 + entity.size * .38);
}

function entityForSegment(seed: number, mastery: number, segmentIndex: number) {
  const level = generateSparkLevel(seed, mastery);
  return generateSparkWorldSegment(level, segmentIndex).events.map(event => ({
    id: `${segmentIndex}-${event.id}`,
    kind: event.type,
    x: Number((event.drift * 2 - 1).toFixed(3)),
    z: segmentIndex * SEGMENT_DISTANCE + 6 + event.at / level.chapterDuration * (SEGMENT_DISTANCE - 10),
    // gate görsel olarak iki dar sütun arasında bir boşluk bırakıyor — tek geniş kutu toleransı
    // (.78) bu boşluktan daha geniş olup "görünmez duvar" hissi yaratıyordu, .5'e daraltıldı.
    size: event.type === "gate" ? .5 : event.type === "barrier" ? .68 : event.type === "drop" ? .48 : .34,
    resolved: false,
  }));
}

export function sceneryForSparkSegment(seed: number, segmentIndex: number): SparkScenery[] {
  const lane = (index: number) => ((Math.sin(seed * .00019 + segmentIndex * 1.71 + index * 2.93) + 1) / 2);
  return Array.from({ length: 7 }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const x = side * (.9 + lane(index) * .55);
    const kinds: SceneryKind[] = ["tower", "roller", "lamp", "paper"];
    return { id: `scene-${segmentIndex}-${index}`, kind: kinds[(segmentIndex + index) % kinds.length], x: Number(x.toFixed(3)), z: segmentIndex * SEGMENT_DISTANCE + 3 + index * 7.1, size: Number((.72 + lane(index + 9) * .65).toFixed(2)) };
  });
}

const skyGradientCache = new Map<number, CanvasGradient>();
function skyGradientFor(context: CanvasRenderingContext2D, height: number) {
  const key = Math.round(height);
  let gradient = skyGradientCache.get(key);
  if (!gradient) {
    gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#122543");
    gradient.addColorStop(.42, "#455a8e");
    gradient.addColorStop(.43, "#e05b4b");
    gradient.addColorStop(.44, "#182945");
    gradient.addColorStop(1, "#0d1a31");
    if (skyGradientCache.size > 6) skyGradientCache.clear();
    skyGradientCache.set(key, gradient);
  }
  return gradient;
}

function drawScene(context: CanvasRenderingContext2D, world: World, locale: SiteLocale, backdrop: HTMLImageElement | null) {
  const { width, height, player, entities, scenery } = world;
  context.save();
  if (world.shake > .002) {
    const mag = world.shake * 7;
    context.translate((Math.random() - .5) * mag, (Math.random() - .5) * mag);
  }
  context.fillStyle = skyGradientFor(context, height);
  context.fillRect(0, 0, width, height);

  if (backdrop?.complete && backdrop.naturalWidth > 0) {
    context.save();
    context.globalAlpha = .22;
    context.drawImage(backdrop, 0, height * .08, width, height * .62);
    context.restore();
  }

  context.save();
  context.globalAlpha = .78;
  context.fillStyle = "#e4b545";
  context.beginPath();
  context.arc(width * .5, height * .22, Math.min(width, height) * .115, 0, Math.PI * 2);
  context.fill();
  context.globalCompositeOperation = "destination-out";
  for (let band = 0; band < 6; band += 1) context.fillRect(width * .39, height * (.145 + band * .027), width * .22, height * .008);
  context.restore();

  context.strokeStyle = "rgba(245,236,212,.33)";
  context.lineWidth = 1;
  for (let line = 0; line < 11; line += 1) {
    const depth = line / 10;
    const y = height * (.43 + depth * depth * .52);
    context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke();
  }
  for (let line = -6; line <= 6; line += 1) {
    context.beginPath();
    context.moveTo(width * .5, height * .43);
    context.lineTo(width * (.5 + line * .17), height);
    context.stroke();
  }

  context.fillStyle = "rgba(15,28,50,.85)";
  context.fillRect(0, height * .39, width * .15, height * .21);
  context.fillRect(width * .85, height * .39, width * .15, height * .21);
  context.fillStyle = "rgba(245,236,212,.82)";
  context.font = "10px DM Mono, monospace";
  context.fillText(`SELY PRESSLINE / ${String(Math.floor(player.distance / SEGMENT_DISTANCE) + 1).padStart(2, "0")}`, width - 212, 24);
  context.fillText(worldWord(locale, "SOL/SAĞ: YÖN · ↑ İTKİ · ↓ FREN", "LEFT/RIGHT: STEER · ↑ THRUST · ↓ BRAKE"), 18, height - 18);

  const visibleScenery = scenery.filter(item => item.z > player.distance - 5 && item.z < player.distance + WORLD_AHEAD + 8).sort((a, b) => b.z - a.z);
  for (const item of visibleScenery) {
    const screen = projectSparkWorld(item.x, item.z, player.distance, width, height);
    context.save();
    context.translate(screen.x, screen.y);
    context.scale(screen.scale * item.size, screen.scale * item.size);
    if (item.kind === "tower") {
      context.fillStyle = "#172842"; context.fillRect(-14, -50, 28, 58);
      context.fillStyle = "#e05b4b"; context.fillRect(-18, -54, 36, 6);
      context.fillStyle = "#f5ecd4"; context.fillRect(-7, -42, 14, 11);
    } else if (item.kind === "roller") {
      context.fillStyle = "#253759"; context.fillRect(-31, -11, 62, 22);
      context.fillStyle = "#e4b545"; context.fillRect(-26, -5, 52, 10);
      context.fillStyle = "#0d1a31"; context.beginPath(); context.arc(-25, 0, 11, 0, Math.PI * 2); context.arc(25, 0, 11, 0, Math.PI * 2); context.fill();
    } else if (item.kind === "paper") {
      context.rotate(-.16); context.fillStyle = "#f5ecd4"; context.fillRect(-24, -17, 48, 34);
      context.strokeStyle = "#e05b4b"; context.lineWidth = 3; context.strokeRect(-24, -17, 48, 34);
    } else {
      context.fillStyle = "#243652"; context.fillRect(-5, -43, 10, 47);
      context.fillStyle = "#e4b545"; context.beginPath(); context.arc(0, -48, 11, 0, Math.PI * 2); context.fill();
    }
    context.restore();
  }

  const visible = entities.filter(entity => !entity.resolved && entity.z > player.distance - 2 && entity.z < player.distance + WORLD_AHEAD).sort((a, b) => b.z - a.z);
  for (const entity of visible) {
    const screen = projectSparkWorld(entity.x, entity.z, player.distance, width, height);
    context.save();
    context.translate(screen.x, screen.y);
    // .68 (barrier) referans boyut — görsel boyut artık entity.size ile orantılı büyüyüp
    // küçülüyor, çarpışma toleransı (sparkWorldCollision) de aynı entity.size'ı kullanıyor;
    // tek kaynaktan geldikleri için hitbox/görsel artık yapısal olarak tutarlı.
    context.scale(screen.scale * (entity.size / .68), screen.scale * (entity.size / .68));
    if (entity.kind === "stamp") {
      const pulse = 1 + Math.sin(world.lastAt * .006 + entity.z) * .06;
      context.scale(pulse, pulse);
      context.shadowColor = "rgba(228,181,69,.65)";
      context.shadowBlur = 14;
      context.rotate(Math.PI / 4);
      context.fillStyle = "#e4b545";
      context.fillRect(-10, -10, 20, 20);
      context.shadowBlur = 0;
      context.strokeStyle = "#111827";
      context.lineWidth = 3;
      context.strokeRect(-10, -10, 20, 20);
    } else if (entity.kind === "barrier") {
      const barrierGradient = context.createLinearGradient(0, -10, 0, 10);
      barrierGradient.addColorStop(0, "#213458");
      barrierGradient.addColorStop(1, "#0f1c33");
      context.fillStyle = barrierGradient;
      context.fillRect(-34, -10, 68, 20);
      context.strokeStyle = "#f5ecd4";
      context.lineWidth = 3;
      context.strokeRect(-34, -10, 68, 20);
      context.fillStyle = "rgba(245,236,212,.5)";
      context.fillRect(-34, -10, 68, 3);
    } else if (entity.kind === "gate") {
      const gateGradient = context.createLinearGradient(-22, 0, 22, 0);
      gateGradient.addColorStop(0, "#547d64");
      gateGradient.addColorStop(1, "#3d5e49");
      context.fillStyle = gateGradient;
      context.fillRect(-22, -32, 12, 64);
      context.fillRect(10, -32, 12, 64);
      context.fillStyle = "#f5ecd4";
      context.fillRect(-22, -32, 44, 7);
    } else {
      const dropGradient = context.createRadialGradient(-4, -5, 2, 0, 0, 18);
      dropGradient.addColorStop(0, "#9c5c8c");
      dropGradient.addColorStop(1, "#601c50");
      context.fillStyle = dropGradient;
      context.beginPath(); context.arc(0, 0, 17, 0, Math.PI * 2); context.fill();
      context.strokeStyle = "#f5ecd4"; context.lineWidth = 3; context.stroke();
    }
    context.restore();
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

  // Oyuncunun x/y'si engellerle AYNI projeksiyon formülünü (projectSparkWorld) kullanmalı —
  // eskiden playerX ayrı bir sabit (width*.32) kullanıyordu, engellerin (.08+depth*.32)
  // formülünden çarpışma anında (depth≈1) ~%25 sapıyordu ("görünmez duvar" hissi).
  const playerProjection = projectSparkWorld(player.x, player.distance, player.distance, width, height);
  const playerX = playerProjection.x;
  const playerY = playerProjection.y;
  if (player.speed > 8) {
    context.save();
    context.globalAlpha = .5 + Math.sin(world.lastAt * .03) * .15;
    const flameGradient = context.createRadialGradient(playerX - 30, playerY, 1, playerX - 30, playerY, 16);
    flameGradient.addColorStop(0, "#f8d77a");
    flameGradient.addColorStop(1, "rgba(240,93,71,0)");
    context.fillStyle = flameGradient;
    context.beginPath(); context.arc(playerX - 26, playerY, 15, 0, Math.PI * 2); context.fill();
    context.restore();
  }
  context.save();
  context.translate(playerX, playerY);
  context.rotate(clamp(player.vx * .38, -.24, .24));
  context.shadowColor = "rgba(0,0,0,.35)";
  context.shadowBlur = 6;
  context.shadowOffsetY = 3;
  context.fillStyle = "#f05d47";
  context.beginPath(); context.moveTo(30, 0); context.lineTo(-20, -17); context.lineTo(-11, 0); context.lineTo(-20, 17); context.closePath(); context.fill();
  context.shadowBlur = 0; context.shadowOffsetY = 0;
  context.fillStyle = "#e4b545";
  context.fillRect(-32, -5, 19, 10);
  context.fillStyle = "#f5ecd4";
  context.fillRect(2, -7, 12, 14);
  context.strokeStyle = "#111827"; context.lineWidth = 3; context.stroke();
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
  const backdropRef = useRef<HTMLImageElement | null>(null);
  const inputRef = useRef({ left: false, right: false, thrust: false, brake: false });
  const doneRef = useRef(false);
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;
  const [hud, setHud] = useState({ distance: 0, focus: level.focus, stamps: 0, clean: 0, combo: 0, speed: 0, sheet: 1, notice: level.lesson });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const backdrop = new Image();
    backdrop.decoding = "async";
    backdrop.src = "/manus-storage/spark-pressline-world-panel_c474fbc0.png";
    backdrop.onload = () => { backdropRef.current = backdrop; };
    const baseSpeed = (6.8 + mastery * .42) * (reducedMotion ? .72 : 1);
    const world: World = {
      player: { x: 0, vx: 0, distance: 0, speed: baseSpeed, focus: level.focus, stamps: 0, clean: 0, combo: 0, maxCombo: 0, hitCooldown: 0 },
      entities: [], scenery: [], particles: [], shake: 0, flash: 0, hitStopFrames: 0, generatedSegments: new Set<number>(), generatedScenerySegments: new Set<number>(), width: 1, height: 1, startedAt: performance.now(), lastAt: performance.now(), ended: false,
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
      const current = Math.floor(world.player.distance / SEGMENT_DISTANCE);
      for (const segment of [current, current + 1]) {
        if (!world.generatedSegments.has(segment)) {
          world.generatedSegments.add(segment);
          const generated = entityForSegment(seed, mastery, segment);
          if (demo === "success") {
            let lastThreatZ = -Infinity;
            const safeDemoEntities = generated.filter((entity, index) => {
              if (entity.kind === "stamp") return true;
              if (index % 2 !== 0 || entity.z - lastThreatZ < 6.4) return false;
              lastThreatZ = entity.z;
              return true;
            }).map((entity, index) => entity.kind === "stamp" ? entity : { ...entity, x: index % 4 < 2 ? -.68 : .68 });
            world.entities.push(...safeDemoEntities);
          } else if (demo === "fail" && segment === 0) {
            world.entities.push(
              { id: "demo-fail-1", kind: "barrier", x: 0, z: 12, size: .9, resolved: false },
              { id: "demo-fail-2", kind: "barrier", x: 0, z: 21, size: .9, resolved: false },
              { id: "demo-fail-3", kind: "barrier", x: 0, z: 30, size: .9, resolved: false },
            );
          } else {
            world.entities.push(...generated);
          }
        }
      }
      for (let segment = Math.max(0, current - 1); segment <= current + 3; segment += 1) {
        if (!world.generatedScenerySegments.has(segment)) {
          world.generatedScenerySegments.add(segment);
          world.scenery.push(...sceneryForSparkSegment(seed, segment));
        }
      }
      world.entities = world.entities.filter(entity => entity.z > world.player.distance - 4);
      world.scenery = world.scenery.filter(item => item.z > world.player.distance - 12);
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
      const controls: Record<string, keyof typeof inputRef.current> = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "thrust", ArrowDown: "brake", a: "left", d: "right", w: "thrust", s: "brake" };
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
      const upcomingThreats = world.entities.filter(entity => entity.kind !== "stamp" && !entity.resolved && entity.z > world.player.distance - .4 && entity.z - world.player.distance < 9);
      const safeTargets = [-.76, -.38, 0, .38, .76].filter(candidate => upcomingThreats.every(entity => Math.abs(entity.x - candidate) > (.18 + entity.size * .38 + .12)));
      const demoTarget = safeTargets.length ? safeTargets.reduce((nearest, candidate) => Math.abs(candidate - world.player.x) < Math.abs(nearest - world.player.x) ? candidate : nearest, safeTargets[0]) : (world.player.x < 0 ? .78 : -.78);
      const autoAxis = demo === "success" ? Math.sign(demoTarget - world.player.x) : 0;
      const axis = (input.right ? 1 : 0) - (input.left ? 1 : 0) || autoAxis;
      const acceleration = 5.6;
      world.player.vx += axis * acceleration * dt;
      world.player.vx *= Math.pow(.0008, dt);
      world.player.vx = clamp(world.player.vx, -1.6, 1.6);
      world.player.x = clamp(world.player.x + world.player.vx * dt, -.92, .92);
      const escalation = sparkEscalationFor(Math.floor(world.player.distance / SEGMENT_DISTANCE));
      const speedTarget = clamp(baseSpeed * Math.min(escalation, 1.6) + (input.thrust ? 3.4 : 0) - (input.brake ? 3.2 : 0), 3.5, 14.5);
      world.player.speed += (speedTarget - world.player.speed) * Math.min(1, dt * 4.8);
      world.player.distance += world.player.speed * dt;
      world.player.hitCooldown = Math.max(0, world.player.hitCooldown - dt);

      const playerScreenX = world.width * .5 + world.player.x * world.width * .32;
      const playerScreenY = world.height * .84;

      for (const entity of world.entities) {
        if (entity.resolved || entity.z > world.player.distance + .9) continue;
        const collision = sparkWorldCollision(world.player.x, world.player.distance, entity);
        if (entity.kind === "stamp") {
          if (collision) {
            entity.resolved = true;
            world.player.stamps += 1;
            world.player.combo = Math.min(9, world.player.combo + 1);
            world.player.maxCombo = Math.max(world.player.maxCombo, world.player.combo);
            playStamp(soundOnRef.current, world.player.combo);
            spawnBurst(world, playerScreenX - 10, playerScreenY - 14, 8, "#e4b545", 2, 120);
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
            finish({ outcome: "failure", score: Math.round(world.player.distance * 19 + world.player.stamps * 130 + world.player.clean * 28 + world.player.maxCombo * 40), label: worldWord(locale, "Hat çizgiyi kesti", "The line was cut"), detail: worldWord(locale, "Ekrandaki tehdit ile dünya çarpışması artık aynı konumda. Sol/sağ ile açık hattı bul; yukarı itki, aşağı fren uygular.", "The threat and collision now share one position. Steer left/right toward an open line; up applies thrust and down brakes.") });
            return;
          }
        } else if (entity.z < world.player.distance - .9) {
          entity.resolved = true;
          if (Math.abs(entity.x - world.player.x) < .55) world.player.clean += 1;
        }
      }
      if (demo === "success" && world.player.distance >= SEGMENT_DISTANCE * 2) {
        playComplete(soundOnRef.current);
        finish({ outcome: "success", score: Math.round(world.player.distance * 19 + world.player.stamps * 130 + world.player.clean * 28 + world.player.focus * 90 + world.player.maxCombo * 40), label: worldWord(locale, "İki baskı hattı aşıldı", "Two press lines cleared"), detail: worldWord(locale, `${world.player.stamps} damga ve ${world.player.clean} yakın geçişle dünya hattını tamamladın.`, `You completed the world line with ${world.player.stamps} stamps and ${world.player.clean} close passes.`) });
        return;
      }
      drawScene(context, world, locale, backdropRef.current);
      if (now - lastHudAt > 100) {
        lastHudAt = now;
        setHud({ distance: Math.floor(world.player.distance), focus: world.player.focus, stamps: world.player.stamps, clean: world.player.clean, combo: world.player.combo, speed: Number(world.player.speed.toFixed(1)), sheet: Math.floor(world.player.distance / SEGMENT_DISTANCE) + 1, notice: worldWord(locale, "Hat dokusu ileriden hazırlanır; sol/sağ ile açık hattı ara.", "The pressline is prepared ahead; steer left/right toward an open lane.") });
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => { world.ended = true; window.cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); };
  }, [demo, level.focus, locale, mastery, onFinish, seed]);

  const hold = (control: keyof typeof inputRef.current, active: boolean) => { inputRef.current[control] = active; };
  const controls = [
    { key: "left" as const, label: worldWord(locale, "Sol", "Left"), glyph: "←" },
    { key: "brake" as const, label: worldWord(locale, "Fren", "Brake"), glyph: "↓" },
    { key: "thrust" as const, label: worldWord(locale, "İtki", "Thrust"), glyph: "↑" },
    { key: "right" as const, label: worldWord(locale, "Sağ", "Right"), glyph: "→" },
  ];
  return <div className="spark-canvas-game">
    <div className="spark-canvas-hud" aria-live="polite"><span>{worldWord(locale, "MESAFE", "DISTANCE")} <b>{hud.distance}m</b></span><span>{worldWord(locale, "ODAK", "FOCUS")} <b>{hud.focus}/{level.focus}</b></span><span>{worldWord(locale, "DAMGA", "STAMP")} <b>{hud.stamps}</b></span><span>{worldWord(locale, "ZİNCİR", "COMBO")} <b>×{hud.combo}</b></span><span>{worldWord(locale, "HIZ", "SPEED")} <b>{hud.speed}</b></span><span>{worldWord(locale, "HAT", "SHEET")} <b>{String(hud.sheet).padStart(2, "0")}</b></span></div>
    <canvas ref={canvasRef} className="spark-canvas" tabIndex={0} aria-label={worldWord(locale, "Kıvılcım baskı hattı. Sol ve sağ ile yönlen, yukarıyla itki ver, aşağıyla frenle.", "Spark press line. Steer with left and right, thrust with up, brake with down.")} />
    <p className="spark-canvas-tip">{hud.notice}</p>
    <div className="spark-canvas-controls" aria-label={worldWord(locale, "Kıvılcım dokunmatik kontrolleri", "Spark touch controls")}>{controls.map(control => <button type="button" key={control.key} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); hold(control.key, true); }} onPointerUp={() => hold(control.key, false)} onPointerCancel={() => hold(control.key, false)} onPointerLeave={() => hold(control.key, false)} aria-label={control.label}><b>{control.glyph}</b><span>{control.label}</span></button>)}</div>
  </div>;
}
