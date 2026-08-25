import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { generateEchoLevel, type EchoLevel, type Point } from "@/lib/levelGenerators";
import type { SiteLocale } from "@/lib/i18n";

type GameResult = { score: number; label: string; detail: string; outcome: "success" | "failure" };
const local = (locale: SiteLocale, tr: string, en: string) => (locale === "en" ? en : tr);
const CELL = 2;
const toWorld = (point: Point): [number, number, number] => [point.x * CELL, 0, point.y * CELL];

function useFinishOnce(onFinish: (result: GameResult) => void) {
  const done = useRef(false);
  return useCallback(
    (result: GameResult) => {
      if (done.current) return;
      done.current = true;
      window.setTimeout(() => onFinish(result), 90);
    },
    [onFinish],
  );
}

type EchoState = {
  player: Point;
  pulses: number;
  noise: number;
  moves: number;
  keyTaken: boolean;
  listenerStep: number;
  checkpointMask: number;
  visible: Set<string>;
};

function reveal(level: EchoLevel, visible: Set<string>, center: Point, radius: number) {
  const next = new Set(visible);
  for (let x = Math.max(0, center.x - radius); x <= Math.min(level.cols - 1, center.x + radius); x += 1) {
    for (let y = Math.max(0, center.y - radius); y <= Math.min(level.rows - 1, center.y + radius); y += 1) {
      if (Math.abs(x - center.x) + Math.abs(y - center.y) <= radius + 1) next.add(`${x}-${y}`);
    }
  }
  return next;
}

function LerpedGroup({ target, children }: { target: [number, number, number]; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    const t = 1 - Math.pow(0.001, delta);
    g.position.lerp(new THREE.Vector3(...target), t);
  });
  return <group ref={ref}>{children}</group>;
}

function FollowCamera({ target }: { target: [number, number, number] }) {
  const desired = useRef(new THREE.Vector3(...target));
  useFrame(({ camera }, delta) => {
    desired.current.set(target[0], 0, target[2]);
    // Oyuncunun her zaman geldiği köşenin (0,0) tersi yönünde, yükseltilmiş çapraz bir
    // "gerçek oyun" kamerası — tek eksenli bir "arkadan takip" yerine, karakter hangi
    // koridora girerse girsin sabit ve okunur bir 3/4 açı veriyor.
    const camTarget = new THREE.Vector3(target[0] - 5.5, 8, target[2] + 5.5);
    const t = 1 - Math.pow(0.0008, delta);
    camera.position.lerp(camTarget, t);
    camera.lookAt(desired.current.x, 0.6, desired.current.z);
  });
  return null;
}

function RoomGeometry({ level, visible, shadows }: { level: EchoLevel; visible: Set<string>; shadows: boolean }) {
  const floorRef = useRef<THREE.InstancedMesh>(null);
  const wallRef = useRef<THREE.InstancedMesh>(null);
  const cells = useMemo(() => {
    const floors: Point[] = [];
    const walls: Point[] = [];
    for (let x = 0; x < level.cols; x += 1) {
      for (let y = 0; y < level.rows; y += 1) {
        if (!visible.has(`${x}-${y}`)) continue;
        const isWall = level.walls.some(w => w.x === x && w.y === y);
        (isWall ? walls : floors).push({ x, y });
      }
    }
    return { floors, walls };
  }, [level, visible]);

  useEffect(() => {
    const mesh = floorRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    cells.floors.forEach((point, index) => {
      const [x, , z] = toWorld(point);
      m.makeTranslation(x, -0.05, z);
      mesh.setMatrixAt(index, m);
    });
    mesh.count = cells.floors.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [cells.floors]);

  useEffect(() => {
    const mesh = wallRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    cells.walls.forEach((point, index) => {
      const [x, , z] = toWorld(point);
      m.makeTranslation(x, 0.9, z);
      mesh.setMatrixAt(index, m);
    });
    mesh.count = cells.walls.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [cells.walls]);

  return (
    <>
      <instancedMesh ref={floorRef} args={[undefined, undefined, Math.max(1, level.cols * level.rows)]} receiveShadow={shadows}>
        <boxGeometry args={[CELL * 0.96, 0.1, CELL * 0.96]} />
        <meshStandardMaterial color="#3a3160" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={wallRef} args={[undefined, undefined, Math.max(1, level.cols * level.rows)]} receiveShadow={shadows} castShadow={shadows}>
        <boxGeometry args={[CELL * 0.96, 1.9, CELL * 0.96]} />
        <meshStandardMaterial color="#241f42" roughness={0.8} />
      </instancedMesh>
    </>
  );
}

function Marker({ point, visible, color, shape }: { point: Point; visible: boolean; color: string; shape: "torch" | "checkpoint" | "key" | "door" }) {
  if (!visible) return null;
  const [x, , z] = toWorld(point);
  if (shape === "door") return <mesh position={[x, 0.9, z]}><boxGeometry args={[CELL * 0.7, 1.7, 0.15]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} /></mesh>;
  if (shape === "key") return <mesh position={[x, 0.4, z]} rotation={[0, 0.4, 0]}><octahedronGeometry args={[0.28]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.7} /></mesh>;
  if (shape === "checkpoint") return <mesh position={[x, 0.15, z]}><torusGeometry args={[0.34, 0.08, 8, 16]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} /></mesh>;
  return <mesh position={[x, 0.5, z]}><coneGeometry args={[0.3, 0.7, 6]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.4} /></mesh>;
}

function Scene({ level, state, listener, shadows }: { level: EchoLevel; state: EchoState; listener: Point; shadows: boolean }) {
  const playerWorld = toWorld(state.player);
  const listenerWorld = toWorld(listener);
  return (
    <>
      <fog attach="fog" args={["#050509", 7, 20]} />
      <hemisphereLight args={["#8f86c9", "#0c0a17", 0.55]} />
      <ambientLight intensity={0.4} color="#4a4080" />
      <FollowCamera target={playerWorld} />
      <group position={playerWorld}>
        <pointLight intensity={shadows ? 16 : 12} distance={13} decay={1.6} color="#e5b341" castShadow={shadows} shadow-mapSize={[512, 512]} position={[0, 2.6, 0]} />
      </group>
      <RoomGeometry level={level} visible={state.visible} shadows={shadows} />
      {level.checkpoints.map((checkpoint, index) => (
        <Marker key={`cp-${index}`} point={checkpoint} visible={state.visible.has(`${checkpoint.x}-${checkpoint.y}`) && !((state.checkpointMask >> index) & 1)} color="#e5b341" shape="checkpoint" />
      ))}
      {level.key && !state.keyTaken && <Marker point={level.key} visible={state.visible.has(`${level.key.x}-${level.key.y}`)} color="#8fe3d0" shape="key" />}
      <Marker point={level.exit} visible={state.visible.has(`${level.exit.x}-${level.exit.y}`)} color="#e5b341" shape="door" />
      <LerpedGroup target={playerWorld}>
        <mesh castShadow={shadows} position={[0, 0.55, 0]}><capsuleGeometry args={[0.28, 0.5, 4, 8]} /><meshStandardMaterial color="#f6f0e3" /></mesh>
      </LerpedGroup>
      {state.visible.has(`${listener.x}-${listener.y}`) && (
        <LerpedGroup target={listenerWorld}>
          <mesh castShadow={shadows} position={[0, 0.6, 0]}><coneGeometry args={[0.32, 1.1, 6]} /><meshStandardMaterial color="#654169" emissive="#654169" emissiveIntensity={0.35} /></mesh>
        </LerpedGroup>
      )}
    </>
  );
}

function DirectionPad({ locale = "tr", onMove }: { locale?: SiteLocale; onMove: (dx: number, dy: number) => void }) {
  return (
    <div className="echo3d-pad" aria-hidden="true">
      <button onClick={() => onMove(0, -1)} aria-label={local(locale, "Yukarı", "Up")}>↑</button>
      <div className="echo3d-pad-row">
        <button onClick={() => onMove(-1, 0)} aria-label={local(locale, "Sol", "Left")}>←</button>
        <button onClick={() => onMove(0, 1)} aria-label={local(locale, "Aşağı", "Down")}>↓</button>
        <button onClick={() => onMove(1, 0)} aria-label={local(locale, "Sağ", "Right")}>→</button>
      </div>
    </div>
  );
}

export default function EchoRoom3D({ locale, seed, mastery, onFinish }: { locale: SiteLocale; seed: number; mastery: number; onFinish: (result: GameResult) => void }) {
  const level = useMemo(() => generateEchoLevel(seed, mastery), [seed, mastery]);
  const finish = useFinishOnce(onFinish);
  const shadows = useMemo(() => typeof window !== "undefined" && window.innerWidth > 720 && !window.matchMedia("(pointer: coarse)").matches, []);
  const [state, setState] = useState<EchoState>(() => ({
    player: { x: 0, y: 0 }, pulses: level.pulseBudget, noise: 0, moves: 0, keyTaken: !level.key, listenerStep: 0,
    checkpointMask: 0, visible: reveal(level, new Set<string>(), { x: 0, y: 0 }, 1),
  }));

  const move = useCallback((dx: number, dy: number) => {
    setState(previous => {
      const player = { x: Math.min(level.cols - 1, Math.max(0, previous.player.x + dx)), y: Math.min(level.rows - 1, Math.max(0, previous.player.y + dy)) };
      const blocked = level.walls.some(wall => wall.x === player.x && wall.y === player.y);
      if ((player.x === previous.player.x && player.y === previous.player.y) || blocked) return previous;
      const moves = previous.moves + 1;
      const listenerStep = (previous.listenerStep + (moves % 2 === 0 ? 1 : 0)) % level.listenerRoute.length;
      const listener = level.listenerRoute[listenerStep];
      const checkpointIndex = level.checkpoints.findIndex(checkpoint => checkpoint.x === player.x && checkpoint.y === player.y);
      const fractureNoise = level.fractures.some(fracture => fracture.x === player.x && fracture.y === player.y) ? 2 : 0;
      const next: EchoState = {
        ...previous,
        player,
        moves,
        listenerStep,
        noise: previous.noise + 1 + fractureNoise,
        keyTaken: previous.keyTaken || Boolean(level.key && player.x === level.key.x && player.y === level.key.y),
        checkpointMask: checkpointIndex >= 0 ? previous.checkpointMask | (1 << checkpointIndex) : previous.checkpointMask,
        visible: reveal(level, previous.visible, player, 1),
      };
      if (player.x === listener.x && player.y === listener.y) finish({ outcome: "failure", score: Math.max(40, next.moves * 12), label: local(locale, "Dinleyici seni duydu", "The listener heard you"), detail: local(locale, "Devriyenin bir sonraki dönüşünü okumadan aynı koridora girdin.", "You entered the same corridor before reading the patrol’s next turn.") });
      if (next.noise > level.noiseLimit) finish({ outcome: "failure", score: Math.max(30, next.moves * 8), label: local(locale, "Oda çok gürültülü", "The room is too loud"), detail: local(locale, "Daha sakin bir rota, daha yüksek bir puan ve güvenli çıkış getirirdi.", "A quieter route would have earned a better score and a safe exit.") });
      const allCheckpoints = next.checkpointMask === (1 << level.checkpoints.length) - 1;
      if (player.x === level.exit.x && player.y === level.exit.y && next.keyTaken && allCheckpoints) finish({ outcome: "success", score: Math.max(180, 1_560 - next.moves * 12 - next.noise * 18 + next.pulses * 65), label: local(locale, "Oda sustu", "The room fell quiet"), detail: local(locale, `${next.pulses} yankıyı saklayıp üç izi, mührü ve çıkışı buldun.`, `You found all three marks, the seal and the exit with ${next.pulses} echoes still held back.`) });
      return next;
    });
  }, [finish, level, locale]);

  const pulse = useCallback(() => {
    setState(previous => {
      if (previous.pulses <= 0) return previous;
      const listenerStep = (previous.listenerStep + 1) % level.listenerRoute.length;
      const listener = level.listenerRoute[listenerStep];
      const next: EchoState = { ...previous, pulses: previous.pulses - 1, noise: previous.noise + 2, listenerStep, visible: reveal(level, previous.visible, previous.player, 3) };
      if (listener.x === previous.player.x && listener.y === previous.player.y) finish({ outcome: "failure", score: Math.max(30, previous.moves * 8), label: local(locale, "Yankı yanlış yerde patladı", "The echo burst too close"), detail: local(locale, "Dinleyici sesin kaynağına ulaştı; yankıyı daha uzakta kullan.", "The listener reached the sound source; use the echo farther away.") });
      if (next.noise > level.noiseLimit) finish({ outcome: "failure", score: Math.max(30, previous.moves * 8), label: local(locale, "Oda çok gürültülü", "The room is too loud"), detail: local(locale, "Ses bütçeni koru; kısa bir karanlık an bazen daha güvenlidir.", "Protect your sound budget; a brief dark moment can be safer.") });
      return next;
    });
  }, [finish, level, locale]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const actions: Record<string, () => void> = { ArrowUp: () => move(0, -1), ArrowDown: () => move(0, 1), ArrowLeft: () => move(-1, 0), ArrowRight: () => move(1, 0), " ": pulse };
      const action = actions[event.key];
      if (action) { event.preventDefault(); action(); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [move, pulse]);

  const listener = level.listenerRoute[state.listenerStep % level.listenerRoute.length];
  const marksFound = level.checkpoints.filter((_, index) => Boolean(state.checkpointMask & (1 << index))).length;

  return (
    <div className="echo-game game-surface">
      <div className="game-hud"><span>{local(locale, "YANKI", "ECHO")} <b>{state.pulses}</b></span><span>{local(locale, "SES", "SOUND")} <b>{state.noise}/{level.noiseLimit}</b></span><span>{local(locale, "İZ", "MARKS")} <b>{marksFound}/{level.checkpoints.length}</b></span><span>{local(locale, "HAFIZA", "MEMORY")} <b>{state.visible.size}</b></span></div>
      <div className="echo3d-frame">
        <div className="echo-camera-label"><span>{local(locale, "ODA", "ROOM")}</span><b>{state.keyTaken ? local(locale, "ÇIKIŞI BUL", "FIND THE EXIT") : local(locale, "MÜHRÜ AÇ", "UNSEAL THE WAY")}</b></div>
        <Canvas className="echo3d-canvas" shadows={shadows} dpr={[1, shadows ? 1.5 : 1]} camera={{ fov: 52, near: 0.1, far: 40 }} aria-label={local(locale, "Yankı odası 3D oyun alanı", "Echo Room 3D game board")}>
          <Scene level={level} state={state} listener={listener} shadows={shadows} />
        </Canvas>
      </div>
      <div className="echo-controls"><button onClick={pulse} disabled={state.pulses === 0}>{local(locale, "Yankı gönder", "Send echo")} <span>Space</span></button><DirectionPad locale={locale} onMove={move} /></div>
      <p className="game-tip">{locale === "en" ? "Keep the echo for the moments when the room truly needs to be heard." : level.lesson}</p>
    </div>
  );
}
