import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowLeft as ArrowLeftIcon, ArrowRight, ArrowUp, RotateCcw, Volume2, X } from "lucide-react";
import SparkCanvasGame from "@/components/SparkCanvasGame";
import VakaBoard from "@/components/VakaBoard";
import type { GameId, GameMeta } from "@/lib/catalog";
import type { SiteLocale } from "@/lib/i18n";
import {
  generateCutLevel,
  generateEchoLevel,
  generateHaneLevel,
  generateHaneWordLevel,
  generateKnotLevel,
  KNOT_BONUS_PATH,
  KNOT_SOURCE_INDEX,
  KNOT_TARGET_INDEX,
  KNOT_TARGET_PATH,
  KNOT_TILE_SHAPES,
  type Direction,
  generateVakaCases,
  generateShadowLevel,
  generateSparkLevel,
  generateSparkWorldSegment,
  masteryBand,
  compareHaneGuess,
  compareHaneWordGuess,
  isHaneGuessValid,
  isHaneWordGuessValid,
  pointKey,
  type Point,
  type SparkEvent,
} from "@/lib/levelGenerators";

type GameStudioProps = {
  game: GameMeta;
  locale?: SiteLocale;
  autoStart?: boolean;
  demo?: "spark" | "spark-fail" | "cut-fail";
  dailySeed?: number;
  dailyDifficulty?: number;
  highScore: number;
  soundOn: boolean;
  onToggleSound: () => void;
  onBack: () => void;
  onNextLevel: () => void;
  onScore: (score: number) => void;
};

export type ResultOutcome = "success" | "failure";
type GameResult = { score: number; label: string; detail: string; outcome: ResultOutcome };
type Position = { r: number; c: number };
const local = (locale: SiteLocale, tr: string, en: string) => locale === "en" ? en : tr;
export const runMasteryFor = (highScore: number, dailyDifficulty: number) => Math.min(4, Math.max(masteryBand(highScore), dailyDifficulty));
export function resultActionsFor(outcome: ResultOutcome, failureCount: number) {
  return { canRetry: outcome === "failure", canAdvance: outcome === "success" || failureCount >= 3 };
}

function scoreFor(id: GameId, raw: number) {
  const multiplier: Record<GameId, number> = { echo: 1, knot: 2, cut: 1, shadow: 2, vaka: 3, hane: 2, spark: 1 };
  return Math.max(0, Math.round(raw * multiplier[id]));
}

function useFinishOnce(onFinish: (result: GameResult) => void) {
  const done = useRef(false);
  return useCallback((result: GameResult) => {
    if (done.current) return;
    done.current = true;
    window.setTimeout(() => onFinish(result), 90);
  }, [onFinish]);
}

export default function GameStudio({ game, locale = "tr", autoStart = false, demo, dailySeed = 0, dailyDifficulty = 1, highScore, soundOn, onToggleSound, onBack, onNextLevel, onScore }: GameStudioProps) {
  const [started, setStarted] = useState(autoStart);
  const [runKey, setRunKey] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const [failureCount, setFailureCount] = useState(0);
  const displayMastery = runMasteryFor(highScore, dailyDifficulty);
  const [runMastery, setRunMastery] = useState(() => displayMastery);
  const sparkActive = game.id === "spark" && started;

  const restart = () => {
    setResult(null);
    setRunMastery(runMasteryFor(highScore, dailyDifficulty));
    setStarted(true);
    setRunKey(value => value + 1);
  };
  const continueToNext = () => {
    setResult(null);
    setFailureCount(0);
    onNextLevel();
  };

  const finish = useCallback((next: GameResult) => {
    const finalScore = scoreFor(game.id, next.score);
    if (next.outcome === "success") onScore(finalScore);
    setFailureCount(current => next.outcome === "failure" ? current + 1 : 0);
    setResult({ ...next, score: finalScore });
  }, [game.id, onScore]);

  return (
    <main className={`studio-shell ${sparkActive ? "studio-shell-spark" : ""}`} lang={locale} style={{ "--game-accent": game.accent, "--game-ink": game.ink } as React.CSSProperties}>
      <header className="studio-topbar">
        <button className="back-button" onClick={onBack} aria-label={locale === "en" ? "Return to game catalogue" : "Oyun kataloğuna dön"}><ArrowLeft size={18} /> {locale === "en" ? "Catalogue" : "Katalog"}</button>
        <div className="studio-title"><span>{game.number}</span><strong>{game.title}</strong><em>{game.eyebrow}</em></div>
        <div className="studio-actions">
          <span className="best-score">{locale === "en" ? "BEST" : "EN İYİ"} <b>{highScore.toLocaleString(locale === "en" ? "en-US" : "tr-TR")}</b></span>
          <button className="icon-button" onClick={onToggleSound} aria-label={soundOn ? (locale === "en" ? "Mute sound" : "Sesi kapat") : (locale === "en" ? "Enable sound" : "Sesi aç")}><Volume2 size={18} className={soundOn ? "" : "sound-muted"} /></button>
        </div>
      </header>

      <section className={`game-stage-wrap ${sparkActive ? "spark-stage-wrap" : ""}`}>
        {!started ? (
          <div className="game-intro">
            <div className={`game-intro-art intro-art-${game.id}`} aria-hidden="true"><span /><i /><b>{game.number}</b></div>
            <div className="game-intro-copy">
              <span className="studio-kicker">{locale === "en" ? "YOUR ROUTE · MASTERY" : "ROTAN · USTALIK"} {displayMastery}/4</span>
              <h1>{game.motto}</h1>
              <p>{game.mechanic}</p>
              <div className="control-chip">{game.controls}</div>
              <button className="ink-button" onClick={restart}>{locale === "en" ? "Start game" : "Oyunu başlat"} <span>→</span></button>
            </div>
          </div>
        ) : (
          <div className={`game-stage ${sparkActive ? "game-stage-spark" : ""}`}>
            <GameRenderer key={runKey} game={game} locale={locale} dailySeed={dailySeed} mastery={runMastery} demo={demo} soundOn={soundOn} onFinish={finish} />
            {result && (
              <div className="result-panel" role="dialog" aria-modal="true" aria-label={locale === "en" ? "Run result" : "Tur sonucu"}>
                <button className="result-close" onClick={() => setResult(null)} aria-label={locale === "en" ? "Close result" : "Sonucu kapat"}><X size={18} /></button>
                <span className="studio-kicker">{locale === "en" ? "RUN COMPLETE" : "TUR TAMAMLANDI"}</span>
                <h2>{result.label}</h2>
                <p>{result.detail}</p>
                <div className="result-score"><span>{locale === "en" ? "SCORE" : "PUAN"}</span><strong>{result.score.toLocaleString(locale === "en" ? "en-US" : "tr-TR")}</strong></div>
                <div className="result-actions">
                  {resultActionsFor(result.outcome, failureCount).canRetry && <button className="ink-button" onClick={restart}>{locale === "en" ? "Try again" : "Tekrar dene"} <RotateCcw size={16} /></button>}
                  {resultActionsFor(result.outcome, failureCount).canAdvance && <button className="ink-button" onClick={continueToNext}>{result.outcome === "success" ? (locale === "en" ? "Continue" : "Devam et") : (locale === "en" ? "Next level" : "Sonraki seviyeye geç")} <ArrowRight size={16} /></button>}
                  <button className="quiet-button" onClick={onBack}>{locale === "en" ? "Choose a route" : "Rota seç"}</button>
                </div>
                {result.outcome === "failure" && failureCount >= 3 && <p className="result-nudge">{locale === "en" ? "A new route is available after three attempts." : "Üç denemeden sonra yeni rota açıldı."}</p>}
              </div>
            )}
          </div>
        )}
      </section>
      <footer className={`studio-footer ${sparkActive ? "studio-footer-spark" : ""}`}><span>SELY.TR / {locale === "en" ? "GAME CATALOGUE" : "OYUN KATALOĞU"}</span><span>{locale === "en" ? "Reduced-motion preference supported" : "Hareket azaltma tercihi desteklenir"}</span></footer>
    </main>
  );
}

function GameRenderer({ game, locale, dailySeed, mastery, demo, soundOn, onFinish }: { game: GameMeta; locale: SiteLocale; dailySeed: number; mastery: number; demo?: "spark" | "spark-fail" | "cut-fail"; soundOn: boolean; onFinish: (result: GameResult) => void }) {
  if (game.id === "echo") return <EchoRoomGame locale={locale} seed={dailySeed} mastery={mastery} onFinish={onFinish} />;
  if (game.id === "knot") return <KnotGame locale={locale} seed={dailySeed} mastery={mastery} onFinish={onFinish} />;
  if (game.id === "cut") return <CutGame locale={locale} seed={dailySeed} mastery={mastery} demo={demo === "cut-fail"} onFinish={onFinish} />;
  if (game.id === "shadow") return <ShadowGame locale={locale} seed={dailySeed} mastery={mastery} onFinish={onFinish} />;
  if (game.id === "hane") return <HaneGame locale={locale} seed={dailySeed} mastery={mastery} onFinish={onFinish} />;
  if (game.id === "spark") return <SparkCanvasGame locale={locale} seed={dailySeed} mastery={mastery} demo={demo === "spark" ? "success" : demo === "spark-fail" ? "fail" : undefined} soundOn={soundOn} onFinish={onFinish} />;
  return <VakaGame locale={locale} seed={dailySeed} mastery={mastery} soundOn={soundOn} onFinish={onFinish} />;
}

function EchoRoomGame({ locale, seed, mastery, onFinish }: { locale: SiteLocale; seed: number; mastery: number; onFinish: (result: GameResult) => void }) {
  const level = useMemo(() => generateEchoLevel(seed, mastery), [seed, mastery]);
  const finish = useFinishOnce(onFinish);
  const [state, setState] = useState(() => ({
    player: { x: 0, y: 0 }, pulses: level.pulseBudget, noise: 0, moves: 0, keyTaken: !level.key, listenerStep: 0,
    checkpointMask: 0, visible: new Set<string>(["0-0", "1-0", "0-1"]),
  }));

  const reveal = (visible: Set<string>, center: Point, radius: number) => {
    const next = new Set(visible);
    for (let x = Math.max(0, center.x - radius); x <= Math.min(level.cols - 1, center.x + radius); x += 1) {
      for (let y = Math.max(0, center.y - radius); y <= Math.min(level.rows - 1, center.y + radius); y += 1) {
        if (Math.abs(x - center.x) + Math.abs(y - center.y) <= radius + 1) next.add(`${x}-${y}`);
      }
    }
    return next;
  };

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
      const next = {
        ...previous,
        player,
        moves,
        listenerStep,
        noise: previous.noise + 1 + fractureNoise,
        keyTaken: previous.keyTaken || Boolean(level.key && player.x === level.key.x && player.y === level.key.y),
        checkpointMask: checkpointIndex >= 0 ? previous.checkpointMask | (1 << checkpointIndex) : previous.checkpointMask,
        visible: reveal(previous.visible, player, 1),
      };
      if (player.x === listener.x && player.y === listener.y) finish({ outcome: "failure", score: Math.max(40, next.moves * 12), label: local(locale, "Dinleyici seni duydu", "The listener heard you"), detail: local(locale, "Devriyenin bir sonraki dönüşünü okumadan aynı koridora girdin.", "You entered the same corridor before reading the patrol’s next turn.") });
      if (next.noise > level.noiseLimit) finish({ outcome: "failure", score: Math.max(30, next.moves * 8), label: local(locale, "Oda çok gürültülü", "The room is too loud"), detail: local(locale, "Daha sakin bir rota, daha yüksek bir puan ve güvenli çıkış getirirdi.", "A quieter route would have earned a better score and a safe exit.") });
      const allCheckpoints = next.checkpointMask === (1 << level.checkpoints.length) - 1;
      if (player.x === level.exit.x && player.y === level.exit.y && next.keyTaken && allCheckpoints) finish({ outcome: "success", score: Math.max(180, 1_560 - next.moves * 12 - next.noise * 18 + next.pulses * 65), label: local(locale, "Oda sustu", "The room fell quiet"), detail: local(locale, `${next.pulses} yankıyı saklayıp üç izi, mührü ve çıkışı buldun.`, `You found all three marks, the seal and the exit with ${next.pulses} echoes still held back.`) });
      return next;
    });
  }, [finish, level]);

  const pulse = useCallback(() => {
    setState(previous => {
      if (previous.pulses <= 0) return previous;
      const listenerStep = (previous.listenerStep + 1) % level.listenerRoute.length;
      const listener = level.listenerRoute[listenerStep];
      const next = { ...previous, pulses: previous.pulses - 1, noise: previous.noise + 2, listenerStep, visible: reveal(previous.visible, previous.player, 3) };
      if (listener.x === previous.player.x && listener.y === previous.player.y) finish({ outcome: "failure", score: Math.max(30, previous.moves * 8), label: local(locale, "Yankı yanlış yerde patladı", "The echo burst too close"), detail: local(locale, "Dinleyici sesin kaynağına ulaştı; yankıyı daha uzakta kullan.", "The listener reached the sound source; use the echo farther away.") });
      if (next.noise > level.noiseLimit) finish({ outcome: "failure", score: Math.max(30, previous.moves * 8), label: local(locale, "Oda çok gürültülü", "The room is too loud"), detail: local(locale, "Ses bütçeni koru; kısa bir karanlık an bazen daha güvenlidir.", "Protect your sound budget; a brief dark moment can be safer.") });
      return next;
    });
  }, [finish, level]);

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
  const viewCols = Math.min(level.viewport.cols, level.cols); const viewRows = Math.min(level.viewport.rows, level.rows);
  const cameraX = Math.max(0, Math.min(level.cols - viewCols, state.player.x - Math.floor(viewCols / 2)));
  const cameraY = Math.max(0, Math.min(level.rows - viewRows, state.player.y - Math.floor(viewRows / 2)));
  return <div className="echo-game game-surface">
    <div className="game-hud"><span>{local(locale, "YANKI", "ECHO")} <b>{state.pulses}</b></span><span>{local(locale, "SES", "SOUND")} <b>{state.noise}/{level.noiseLimit}</b></span><span>{local(locale, "İZ", "MARKS")} <b>{marksFound}/{level.checkpoints.length}</b></span><span>{local(locale, "HAFIZA", "MEMORY")} <b>{state.visible.size}</b></span></div>
    <div className="echo-frame"><div className="echo-camera-label"><span>{local(locale, "ODA", "ROOM")} {cameraX + 1}–{cameraX + viewCols} / {cameraY + 1}–{cameraY + viewRows}</span><b>{state.keyTaken ? local(locale, "ÇIKIŞI BUL", "FIND THE EXIT") : local(locale, "MÜHRÜ AÇ", "UNSEAL THE WAY")}</b></div><div className="echo-grid" style={{ gridTemplateColumns: `repeat(${viewCols}, 1fr)` }} aria-label={local(locale, "Yankı odası oyun alanı", "Echo Room game board")}>
      {Array.from({ length: viewRows * viewCols }, (_, index) => {
        const x = cameraX + (index % viewCols); const y = cameraY + Math.floor(index / viewCols); const visible = state.visible.has(`${x}-${y}`);
        const isPlayer = state.player.x === x && state.player.y === y; const isExit = level.exit.x === x && level.exit.y === y;
        const checkpointIndex = level.checkpoints.findIndex(checkpoint => checkpoint.x === x && checkpoint.y === y); const isCheckpoint = checkpointIndex >= 0; const checkpointTaken = isCheckpoint && Boolean(state.checkpointMask & (1 << checkpointIndex));
        const isKey = Boolean(level.key && level.key.x === x && level.key.y === y && !state.keyTaken); const isListener = listener.x === x && listener.y === y; const isWall = level.walls.some(wall => wall.x === x && wall.y === y); const isFracture = level.fractures.some(fracture => fracture.x === x && fracture.y === y);
        return <div key={`${x}-${y}`} className={`echo-cell ${visible ? "is-visible" : ""} ${isExit ? "is-goal" : ""} ${isCheckpoint ? "is-checkpoint" : ""} ${isListener && visible ? "is-trap" : ""} ${isWall && visible ? "is-wall" : ""} ${isFracture && visible ? "is-fracture" : ""}`}>
          {isPlayer && <span className="echo-player" />}{visible && isWall && <span className="echo-wall">▤</span>}{visible && isExit && <span className="echo-door">⇢</span>}{visible && isKey && <span className="echo-key">✦</span>}{visible && isCheckpoint && !checkpointTaken && <span className="echo-mark">▣</span>}{visible && isListener && <span className="echo-trap">◌</span>}{visible && isFracture && <span className="echo-fracture">⌁</span>}
        </div>;
      })}
    </div></div>
    <div className="echo-controls"><button onClick={pulse} disabled={state.pulses === 0}>{local(locale, "Yankı gönder", "Send echo")} <span>Space</span></button><DirectionPad locale={locale} onMove={move} /></div>
    <p className="game-tip">{locale === "en" ? "Keep the echo for the moments when the room truly needs to be heard." : level.lesson}</p>
  </div>;
}

type Tile = { r: number; c: number; base: Direction[]; rot: number; locked?: boolean; label?: string };
const directionOrder: Direction[] = ["N", "E", "S", "W"];
const step: Record<Direction, [number, number]> = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
const opposite: Record<Direction, Direction> = { N: "S", E: "W", S: "N", W: "E" };
const rotateDirs = (dirs: Direction[], rot: number) => dirs.map(dir => directionOrder[(directionOrder.indexOf(dir) + rot) % 4]);
const tileKey = (r: number, c: number) => `${r}-${c}`;
const KNOT_CRITICAL_INDEXES = new Set([...KNOT_TARGET_PATH, ...KNOT_BONUS_PATH]);

function KnotGame({ locale, seed, mastery, onFinish }: { locale: SiteLocale; seed: number; mastery: number; onFinish: (result: GameResult) => void }) {
  const level = useMemo(() => generateKnotLevel(seed, mastery), [seed, mastery]);
  const finish = useFinishOnce(onFinish);
  const baseTiles = useMemo<Tile[]>(() => KNOT_TILE_SHAPES.map((base, index) => ({
    r: Math.floor(index / 4),
    c: index % 4,
    base,
    rot: index === KNOT_SOURCE_INDEX || index === KNOT_TARGET_INDEX ? 0 : level.rotations[index],
    locked: index === KNOT_SOURCE_INDEX || index === KNOT_TARGET_INDEX,
    label: index === KNOT_SOURCE_INDEX ? "S" : index === KNOT_TARGET_INDEX ? "H" : undefined,
  })), [level.rotations]);
  const [tiles, setTiles] = useState(baseTiles);
  const [turns, setTurns] = useState(0);
  const [lastRotated, setLastRotated] = useState<number | null>(null);

  const connected = useMemo(() => {
    const map = new Map(tiles.map(tile => [tileKey(tile.r, tile.c), tile]));
    const visited = new Set([tileKey(0, 0)]); const queue: Tile[] = [map.get("0-0")!];
    while (queue.length) {
      const current = queue.shift()!;
      for (const dir of rotateDirs(current.base, current.rot)) {
        const [dr, dc] = step[dir]; const neighbor = map.get(tileKey(current.r + dr, current.c + dc));
        if (!neighbor || !rotateDirs(neighbor.base, neighbor.rot).includes(opposite[dir])) continue;
        const key = tileKey(neighbor.r, neighbor.c); if (!visited.has(key)) { visited.add(key); queue.push(neighbor); }
      }
    }
    return visited;
  }, [tiles]);

  const targetConnected = connected.has(tileKey(Math.floor(KNOT_TARGET_INDEX / 4), KNOT_TARGET_INDEX % 4));
  const bonusConnected = level.bonusIndex >= 0 && connected.has(tileKey(Math.floor(level.bonusIndex / 4), level.bonusIndex % 4));
  const sealFlow = () => {
    if (!targetConnected) return;
    finish({ outcome: "success", score: Math.max(180, 860 - turns * 44 + (bonusConnected ? 180 : 0)), label: bonusConnected ? "Mühür ve yan akış çözüldü" : "Akış tamamlandı", detail: `${turns} hamlede hedefe ulaşan çizgiyi kurdun${bonusConnected ? "; yan düğüm de beslendi." : "."}` });
  };

  const rotate = (index: number) => {
    if (tiles[index].locked) return;
    const nextTurns = turns + 1;
    setTiles(previous => previous.map((tile, tileIndex) => tileIndex === index ? { ...tile, rot: (tile.rot + 1) % 4 } : tile));
    setTurns(nextTurns);
    setLastRotated(index);
    if (nextTurns > level.heatLimit) finish({ outcome: "failure", score: 65, label: "Hat fazla ısındı", detail: "Aynı akışı tekrar tekrar çevirmek yerine önce hedef çizgisini gözünle kur." });
  };
  const undoLast = () => {
    if (lastRotated === null) return;
    setTiles(previous => previous.map((tile, tileIndex) => tileIndex === lastRotated ? { ...tile, rot: (tile.rot + 3) % 4 } : tile));
    setTurns(value => Math.max(0, value - 1));
    setLastRotated(null);
  };

  return <div className="knot-game game-surface">
    <div className="game-hud"><span>DÜĞÜM <b>{turns}/{level.heatLimit}</b></span><span>AKIŞ <b>{connected.size}/16</b></span><span>{targetConnected ? (bonusConnected ? "MÜHÜR HAZIR" : "BONUS HAT AÇIK") : "HEDEFİ BAĞLA"}</span></div>
    <div className="knot-board" role="grid" aria-label="Düğüm bağlantı tahtası">
      {tiles.map((tile, index) => {
        const active = connected.has(tileKey(tile.r, tile.c)); const dirs = rotateDirs(tile.base, tile.rot); const bonus = level.bonusIndex === index;
        const critical = KNOT_CRITICAL_INDEXES.has(index) && !tile.locked;
        return <button key={tileKey(tile.r, tile.c)} onClick={() => rotate(index)} className={`knot-tile ${active ? "is-active" : ""} ${tile.locked ? "is-locked" : ""} ${bonus ? "is-bonus" : ""} ${critical ? "is-critical" : ""}`} aria-label={`Bağlantı karosu ${tile.r + 1}-${tile.c + 1}`}>
          <span className="knot-core">{tile.label || (bonus ? "✦" : "")}</span>{dirs.map(dir => <i key={dir} className={`knot-line line-${dir}`} />)}
        </button>;
      })}
    </div>
    <div className="knot-actions">
      <button type="button" className="quiet-button" onClick={undoLast} disabled={lastRotated === null}>{locale === "en" ? "Undo last turn" : "Son hamleyi geri al"}</button>
      {targetConnected && <button className="ink-button knot-seal-button" onClick={sealFlow}>{bonusConnected ? "Akışı mühürle + bonus" : "Akışı mühürle"}</button>}
    </div>
    <p className="game-tip">{level.lesson}</p>
  </div>;
}

type CutShape = ReturnType<typeof generateCutLevel>["shapes"][number] & { cut: boolean };
function segmentDistance(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x; const dy = b.y - a.y; const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function CutGame({ locale, seed, mastery, demo = false, onFinish }: { locale: SiteLocale; seed: number; mastery: number; demo?: boolean; onFinish: (result: GameResult) => void }) {
  const level = useMemo(() => generateCutLevel(seed, mastery), [seed, mastery]);
  const finish = useFinishOnce(onFinish);
  const [cutsLeft, setCutsLeft] = useState(level.cuts);
  const [stains, setStains] = useState(0);
  const [line, setLine] = useState<{ a: Point; b: Point } | null>(null);
  const [score, setScore] = useState(0);
  const [shapes, setShapes] = useState<CutShape[]>(() => level.shapes.map(shape => ({ ...shape, cut: false })));
  const svgRef = useRef<SVGSVGElement>(null);
  const point = (event: React.PointerEvent<SVGSVGElement>) => { const box = svgRef.current!.getBoundingClientRect(); return { x: ((event.clientX - box.left) / box.width) * 100, y: ((event.clientY - box.top) / box.height) * 56 }; };

  const resolveCut = useCallback((cutLine: { a: Point; b: Point } | null) => {
    if (!cutLine || cutsLeft <= 0) return;
    const hit = shapes.filter(shape => !shape.cut && segmentDistance({ x: shape.x, y: shape.y }, cutLine.a, cutLine.b) < shape.size / 2 + 2);
    const targets = hit.filter(shape => shape.target); const decoys = hit.filter(shape => !shape.target);
    const nextStains = stains + decoys.length; const nextCuts = cutsLeft - 1;
    const chain = targets.filter(shape => shape.linked).length;
    const nextScore = score + targets.length * targets.length * 70 + chain * 95 - decoys.length * 55;
    setShapes(previous => previous.map(shape => hit.some(hitShape => hitShape.id === shape.id) ? { ...shape, cut: true } : shape));
    setScore(nextScore); setCutsLeft(nextCuts); setStains(nextStains); setLine(null);
    const allTargetsCut = shapes.filter(shape => shape.target && !shape.cut && !targets.some(target => target.id === shape.id)).length === 0;
    if (nextStains > level.stainLimit) finish({ outcome: "failure", score: Math.max(35, nextScore), label: "Sayfa lekelendi", detail: "Hedef olmayan şekiller kesim alanını kapattı; önce çizginin hangi taraftan geçtiğini oku." });
    else if (allTargetsCut || nextCuts === 0) finish({ outcome: allTargetsCut ? "success" : "failure", score: Math.max(60, nextScore), label: allTargetsCut ? "Plaka temiz ayrıldı" : "Kesim serisi bitti", detail: allTargetsCut ? `${targets.length} hedefi son hamlede doğru plakaya ayırdın.` : "Bir sonraki turda bağlı şekilleri aynı çizgide toplamayı dene." });
  }, [cutsLeft, finish, level.stainLimit, score, shapes, stains]);
  const resolveCutRef = useRef(resolveCut);
  useEffect(() => { resolveCutRef.current = resolveCut; }, [resolveCut]);
  useEffect(() => {
    if (!demo) return;
    const decoys = level.shapes.filter(shape => !shape.target).slice(0, level.stainLimit + 1);
    const timers = decoys.map((shape, index) => window.setTimeout(() => {
      resolveCutRef.current({ a: { x: shape.x - shape.size, y: shape.y }, b: { x: shape.x + shape.size, y: shape.y } });
    }, 160 + index * 420));
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [demo, level.shapes, level.stainLimit]);

  const release = () => resolveCut(line);
  const keyboardCut = (index: number) => {
    const targets = shapes.filter(shape => shape.target && !shape.cut);
    const target = targets[index];
    if (!target) return;
    const partner = targets[(index + 1) % targets.length] ?? target;
    resolveCut({ a: { x: target.x - target.size, y: target.y }, b: { x: partner.x + partner.size, y: partner.y } });
  };

  return <div className="cut-game game-surface">
    <div className="game-hud"><span>KESİM <b>{cutsLeft}</b></span><span>LEKE <b>{stains}/{level.stainLimit}</b></span><span>HEDEFLERİ AYIR</span></div>
    <svg ref={svgRef} viewBox="0 0 100 56" className="cut-canvas" role="application" aria-label={locale === "en" ? "Cutout canvas. Drag to cut shapes." : "Kırpık tuvali. Şekilleri kesmek için sürükle."} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); const current = point(event); setLine({ a: current, b: current }); }} onPointerMove={event => line && setLine(previous => previous ? { ...previous, b: point(event) } : null)} onPointerUp={release} onPointerCancel={() => setLine(null)}>
      <rect width="100" height="56" rx="2" fill="#654169" />
      {shapes.map(shape => <g key={shape.id} className={shape.cut ? "cut-shape is-cut" : "cut-shape"} transform={`translate(${shape.x} ${shape.y}) rotate(${shape.id * 19})`}><rect x={-shape.size} y={-shape.size / 2} width={shape.size * 2} height={shape.size} rx="1" fill={shape.color} /><circle cx={shape.size * .8} cy={shape.size * .5} r={shape.size / 3} fill={shape.target ? "#1b1a1b" : "#f6f0e3"} opacity=".5" />{shape.linked && <path d="M-2,-2 L2,2 M2,-2 L-2,2" stroke="#1b1a1b" strokeWidth=".8" />}</g>)}
      {line && <line x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} className="cut-line" />}
    </svg>
    <div className="cut-keyboard" aria-label={locale === "en" ? "Keyboard cut options" : "Klavye kesim seçenekleri"}><span>{locale === "en" ? "KEYBOARD CUT" : "KLAVYE KESİMİ"}</span>{shapes.filter(shape => shape.target && !shape.cut).map((shape, index) => <button key={shape.id} onClick={() => keyboardCut(index)} aria-label={locale === "en" ? `Cut target ${index + 1}` : `Hedef ${index + 1} kesimi`}>{index + 1}</button>)}</div>
    <p className="game-tip">{level.lesson}</p>
  </div>;
}

function ShadowGame({ locale, seed, mastery, onFinish }: { locale: SiteLocale; seed: number; mastery: number; onFinish: (result: GameResult) => void }) {
  const level = useMemo(() => generateShadowLevel(seed, mastery), [seed, mastery]);
  const finish = useFinishOnce(onFinish);
  const [state, setState] = useState({ player: { r: 0, c: 0 }, shadow: { r: 0, c: 0 }, history: [] as Array<[number, number]>, open: false, moves: 0, inverted: false });
  const at = (position: Position, point: Point) => position.c === point.x && position.r === point.y;
  const isInverse = (position: Position) => level.inverseTiles.some(point => at(position, point));
  const onPad = (position: Position) => level.pads.some(point => at(position, point));

  const move = useCallback((dr: number, dc: number) => {
    setState(previous => {
      const player = { r: Math.max(0, Math.min(level.size - 1, previous.player.r + dr)), c: Math.max(0, Math.min(level.size - 1, previous.player.c + dc)) };
      if (player.r === previous.player.r && player.c === previous.player.c) return previous;
      const history = [...previous.history, [dr, dc] as [number, number]];
      let shadow = previous.shadow; let inverted = previous.inverted;
      if (history.length > level.lag) {
        const [lagDr, lagDc] = history[history.length - level.lag - 1];
        const direction = isInverse(previous.shadow) ? [-lagDr, -lagDc] : [lagDr, lagDc];
        shadow = { r: Math.max(0, Math.min(level.size - 1, previous.shadow.r + direction[0])), c: Math.max(0, Math.min(level.size - 1, previous.shadow.c + direction[1])) };
        inverted = isInverse(shadow);
      }
      const open = previous.open || (onPad(player) && onPad(shadow) && (player.r !== shadow.r || player.c !== shadow.c));
      const next = { player, shadow, history, open, moves: previous.moves + 1, inverted };
      if (open && at(player, level.exit)) finish({ outcome: "success", score: Math.max(220, 980 - next.moves * 28 + (inverted ? 110 : 0)), label: "Zaman hizalandı", detail: inverted ? "Işık kapısından geçen gölgenin ters ritmini de çözdün." : "Gölgenin geçmiş rotası çıkışı senin için açtı." });
      return next;
    });
  }, [finish, level]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => { const map: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }; const direction = map[event.key]; if (direction) { event.preventDefault(); move(...direction); } };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [move]);

  return <div className="shadow-game game-surface">
    <div className="game-hud"><span>GECİKME <b>{level.lag}</b></span><span>ADIM <b>{state.moves}</b></span><span>{state.open ? "ÇIKIŞ AÇIK" : "İKİ PEDİ EŞLE"}</span></div>
    <div className="shadow-board" style={{ gridTemplateColumns: `repeat(${level.size}, 1fr)` }}>
      {Array.from({ length: level.size * level.size }, (_, index) => {
        const r = Math.floor(index / level.size); const c = index % level.size; const position = { r, c }; const pad = onPad(position); const exit = at(position, level.exit); const inverse = isInverse(position);
        return <div key={`${r}-${c}`} className={`shadow-cell ${pad ? "is-pad" : ""} ${exit ? "is-exit" : ""} ${state.open ? "is-open" : ""} ${inverse ? "is-inverse" : ""}`}>{state.player.r === r && state.player.c === c && <span className="solid-figure" />}{state.shadow.r === r && state.shadow.c === c && <span className="ghost-figure" />}{inverse && <i>↺</i>}</div>;
      })}
    </div>
    <DirectionPad onMove={move} />
    <p className="game-tip">{level.lesson}</p>
  </div>;
}

function VakaGame({ locale, seed, mastery, soundOn, onFinish }: { locale: SiteLocale; seed: number; mastery: number; soundOn: boolean; onFinish: (result: GameResult) => void }) {
  const cases = useMemo(() => generateVakaCases(seed, mastery), [seed, mastery]);
  const finish = useFinishOnce(onFinish);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const current = cases[index];

  const onSolved = (earned: number) => {
    const nextScore = score + earned;
    if (index === cases.length - 1) {
      finish({ outcome: "success", score: nextScore, label: "Dosya kapandı", detail: `${cases.length} vakada ${correctCount + 1} doğru itiraf aldın; güven zincirin kayda geçti.` });
    } else {
      setIndex(value => value + 1);
      setScore(nextScore);
      setCorrectCount(value => value + 1);
    }
  };

  return <div className="vaka-game game-surface">
    <div className="game-hud"><span>VAKA <b>{index + 1}/{cases.length}</b></span><span>GÜVEN <b>{score}</b></span><span>KANITI SUN</span></div>
    <VakaBoard key={current.id} vakaCase={current} locale={locale} soundOn={soundOn} caseIndex={index} onSolved={onSolved} />
    <p className="game-tip">Önce ifadeyi veren şüpheliyi işaretle, sonra elindeki kanıtlardan onu çelişkiye düşüreni sun. Yanlış kanıt vakayı açık bırakır, güven puanından küçük bir bedel alır.</p>
  </div>;
}

function HaneGame({ locale, seed, mastery, onFinish }: { locale: SiteLocale; seed: number; mastery: number; onFinish: (result: GameResult) => void }) {
  const numberLevel = useMemo(() => generateHaneLevel(seed, mastery), [seed, mastery]);
  const wordLevel = useMemo(() => generateHaneWordLevel(seed, mastery), [seed, mastery]);
  const finish = useFinishOnce(onFinish);
  const [mode, setMode] = useState<"number" | "word">("number");
  const [guess, setGuess] = useState("");
  const [numberRows, setNumberRows] = useState<Array<{ guess: string; locks: number; traces: number }>>([]);
  const [wordRows, setWordRows] = useState<Array<{ guess: string; marks: Array<"exact" | "present" | "absent"> }>>([]);
  const [notice, setNotice] = useState("");
  const inputId = `hane-entry-${seed}`;
  const isWord = mode === "word";
  const activeLength = isWord ? wordLevel.length : numberLevel.digits;
  const activeRows = isWord ? wordRows : numberRows;
  const activeMaxGuesses = isWord ? wordLevel.maxGuesses : numberLevel.maxGuesses;
  const chooseMode = (next: "number" | "word") => { setMode(next); setGuess(""); setNotice(""); };
  const append = (value: string) => {
    setNotice("");
    setGuess(current => Array.from(current).length < activeLength ? `${current}${value}` : current);
  };
  const submit = useCallback(() => {
    if (!isWord) {
      if (!isHaneGuessValid(guess, numberLevel)) { setNotice(local(locale, `${numberLevel.digits} haneli ve sıfırla başlamayan bir kayıt gir.`, `Enter a ${numberLevel.digits}-digit record that does not start with zero.`)); return; }
      const feedback = compareHaneGuess(numberLevel.target, guess);
      const nextRows = [...numberRows, { guess, ...feedback }];
      setNumberRows(nextRows); setGuess(""); setNotice("");
      if (feedback.locks === numberLevel.digits) { finish({ outcome: "success", score: 1_100 - nextRows.length * 105 + mastery * 65, label: local(locale, "Kayıt hizalandı", "Record aligned"), detail: local(locale, `${nextRows.length}. fişte kayıt numarasını çözdün.`, `You resolved the record number on receipt ${nextRows.length}.`) }); return; }
      if (nextRows.length >= numberLevel.maxGuesses) finish({ outcome: "failure", score: Math.max(60, 180 + nextRows.reduce((total, row) => total + row.locks * 32 + row.traces * 14, 0)), label: local(locale, "Kayıt kapanmadı", "Record remained open"), detail: local(locale, "Kilit ve iz toplamlarını birlikte oku; aynı hane hedefte yalnız bulunduğu kadar sayılır.", "Read lock and trace totals together; a digit can be counted only as often as it exists in the target.") });
      return;
    }
    if (!isHaneWordGuessValid(guess, wordLevel)) { setNotice(local(locale, `${wordLevel.length} harfli, kayıt bankasında bulunan bir sözcük gir.`, `Enter a ${wordLevel.length}-letter word from the record bank.`)); return; }
    const normalizedGuess = Array.from(guess.toLocaleUpperCase("tr-TR")).join("");
    const feedback = compareHaneWordGuess(wordLevel.target, normalizedGuess);
    const nextRows = [...wordRows, { guess: normalizedGuess, marks: feedback.marks }];
    setWordRows(nextRows); setGuess(""); setNotice("");
    if (feedback.exact === wordLevel.length) { finish({ outcome: "success", score: 1_160 - nextRows.length * 105 + mastery * 65, label: local(locale, "Sözcük kayda geçti", "Word entered the record"), detail: local(locale, `${nextRows.length}. fişte gizli sözcüğü çözdün.`, `You resolved the hidden word on receipt ${nextRows.length}.`) }); return; }
    if (nextRows.length >= wordLevel.maxGuesses) finish({ outcome: "failure", score: Math.max(60, 180 + nextRows.reduce((total, row) => total + row.marks.filter(mark => mark !== "absent").length * 26, 0)), label: local(locale, "Sözcük açık kaldı", "Word record stayed open"), detail: local(locale, "Önce yerinde olanları, sonra izde kalanları birlikte ele. Tekrarlanan harf yalnız hedefte olduğu kadar işaretlenir.", "Eliminate exact marks first, then letters elsewhere. A repeated letter is marked only as often as it exists in the target.") });
  }, [finish, guess, isWord, locale, mastery, numberLevel, numberRows, wordLevel, wordRows]);
  useEffect(() => {
    if (!isWord) return;
    const keydown = (event: KeyboardEvent) => {
      if (document.activeElement?.id === inputId) return;
      if (event.key === "Enter") { event.preventDefault(); submit(); return; }
      if (event.key === "Backspace") { event.preventDefault(); setGuess(current => Array.from(current).slice(0, -1).join("")); return; }
      const letter = event.key.toLocaleUpperCase("tr-TR");
      if (/^[A-ZÇĞİÖŞÜ]$/.test(letter)) { event.preventDefault(); append(letter); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [inputId, isWord, submit]);
  const wordKeyboard = ["QWERTYUIOPĞÜ", "ASDFGHJKLŞİ", "ZXCVBNMÖÇ"];
  const keyboardMarks = useMemo(() => {
    const rank: Record<"exact" | "present" | "absent", number> = { exact: 3, present: 2, absent: 1 };
    const marks: Record<string, "exact" | "present" | "absent"> = {};
    for (const row of wordRows) {
      Array.from(row.guess).forEach((letter, index) => {
        const mark = row.marks[index];
        if (!marks[letter] || rank[mark] > rank[marks[letter]]) marks[letter] = mark;
      });
    }
    return marks;
  }, [wordRows]);
  return <div className="hane-game game-surface">
    <div className="game-hud"><span>{local(locale, "FİŞ", "RECEIPT")} <b>{activeRows.length}/{activeMaxGuesses}</b></span><span>{local(locale, "KAYIT", "RECORD")} <b>{isWord ? local(locale, "SÖZCÜK", "WORD") : local(locale, "SAYI", "NUMBER")}</b></span><span>{isWord ? local(locale, "KONU", "TOPIC") : local(locale, "KURAL", "RULE")} <b>{isWord ? (locale === "en" ? wordLevel.categoryEn : wordLevel.category) : (numberLevel.allowsRepeats ? local(locale, "TEKRAR AÇIK", "REPEATS ON") : local(locale, "TEKRAR YOK", "NO REPEATS"))}</b></span></div>
    <section className="hane-desk" aria-label={local(locale, "Hane kayıt masası", "Hane record desk")}>
      <div className="hane-head"><span>SELY / KAYIT MASASI</span><b>{isWord ? local(locale, "SÖZCÜK İZİ", "WORD TRACE") : local(locale, "KİLİT + İZ", "LOCK + TRACE")}</b></div>
      <div className="hane-mode-tabs" role="tablist" aria-label={local(locale, "Hane kayıt türü", "Hane record type")}><button type="button" role="tab" aria-selected={!isWord} className={!isWord ? "is-active" : ""} onClick={() => chooseMode("number")}>{local(locale, "Sayı kaydı", "Number record")}</button><button type="button" role="tab" aria-selected={isWord} className={isWord ? "is-active" : ""} onClick={() => chooseMode("word")}>{local(locale, "Sözcük kaydı", "Word record")}</button></div>
      {!isWord ? <><div className="hane-key"><div><b>◼ {local(locale, "KİLİT", "LOCK")}</b><span>{local(locale, "doğru hane · doğru sıra", "right digit · right place")}</span></div><div><b>◌ {local(locale, "İZ", "TRACE")}</b><span>{local(locale, "doğru hane · başka sıra", "right digit · other place")}</span></div></div><ol className="hane-rows" aria-live="polite">{Array.from({ length: numberLevel.maxGuesses }, (_, index) => { const row = numberRows[index]; return <li key={index} className={row ? "is-filled" : ""}><span className="hane-row-index">{String(index + 1).padStart(2, "0")}</span><strong>{row?.guess || "—".repeat(numberLevel.digits)}</strong>{row ? <span className="hane-feedback"><i>◼ {row.locks}</i><i>◌ {row.traces}</i></span> : <span className="hane-feedback is-blank"><i>◼ ·</i><i>◌ ·</i></span>}</li>; })}</ol></> : <><div className="hane-key"><div><b>▣ {local(locale, "YERİNDE", "EXACT")}</b><span>{local(locale, "doğru harf · doğru yer", "right letter · right place")}</span></div><div><b>◌ {local(locale, "İZDE", "TRACED")}</b><span>{local(locale, "doğru harf · başka yer", "right letter · other place")}</span></div></div><ol className="hane-word-rows" aria-live="polite" style={{ "--word-length": wordLevel.length } as React.CSSProperties}>{Array.from({ length: wordLevel.maxGuesses }, (_, index) => { const row = wordRows[index]; return <li key={index}>{Array.from({ length: wordLevel.length }, (_, letterIndex) => <span key={letterIndex} className={row ? `is-${row.marks[letterIndex]}` : ""}>{row?.guess[letterIndex] || ""}</span>)}</li>; })}</ol></>}
      <form className="hane-entry" onSubmit={event => { event.preventDefault(); submit(); }}><label htmlFor={inputId}>{isWord ? local(locale, "SÖZCÜK YAZ", "ENTER WORD") : local(locale, "KAYIT GİR", "ENTER RECORD")}</label><input id={inputId} value={guess} onChange={event => { setNotice(""); const next = isWord ? Array.from(event.target.value.toLocaleUpperCase("tr-TR")).filter(letter => /^[A-ZÇĞİÖŞÜ]$/.test(letter)).slice(0, wordLevel.length).join("") : event.target.value.replace(/\D/g, "").slice(0, numberLevel.digits); setGuess(next); }} inputMode={isWord ? "text" : "numeric"} autoComplete="off" pattern={isWord ? "[A-Za-zÇĞİÖŞÜçğıöşü]+" : "[0-9]*"} aria-describedby={`${inputId}-note`} placeholder={isWord ? "—".repeat(wordLevel.length) : "0".repeat(numberLevel.digits)} /><button className="ink-button" type="submit">{local(locale, "Baskıya ver", "Stamp entry")}</button></form>
      {!isWord ? <div className="hane-keypad" aria-label={local(locale, "Sayı tuşları", "Number keypad")}>{[1,2,3,4,5,6,7,8,9,0].map(value => <button type="button" key={value} onClick={() => append(String(value))}>{value}</button>)}<button className="hane-backspace" type="button" onClick={() => setGuess(current => current.slice(0, -1))}>⌫</button></div> : <div className="hane-word-keypad" aria-label={local(locale, "Türkçe harf tuşları", "Turkish letter keys")}>{wordKeyboard.map((line, index) => <div key={index}>{Array.from(line).map(letter => <button type="button" key={letter} className={keyboardMarks[letter] ? `is-${keyboardMarks[letter]}` : ""} onClick={() => append(letter)}>{letter}</button>)}</div>)}<button className="hane-backspace" type="button" onClick={() => setGuess(current => Array.from(current).slice(0, -1).join(""))}>⌫</button></div>}
      <p id={`${inputId}-note`} className={notice ? "hane-note is-alert" : "hane-note"}>{notice || (isWord ? (locale === "en" ? `Today’s topic: ${wordLevel.categoryEn}. ${wordLevel.lesson}` : `Bugünün konusu: ${wordLevel.category}. ${wordLevel.lesson}`) : numberLevel.lesson)}</p>
    </section>
  </div>;
}

function SparkGame({ locale, seed, mastery, demo = false, onFinish }: { locale: SiteLocale; seed: number; mastery: number; demo?: boolean; onFinish: (result: GameResult) => void }) {
  const level = useMemo(() => generateSparkLevel(seed, mastery), [seed, mastery]);
  const finish = useFinishOnce(onFinish);
  const ended = useRef(false);
  const [state, setState] = useState({ elapsed: 0, drift: .5, driftVelocity: 0, boosting: false, points: 0, focus: level.focus, stamps: 0, combo: 0, clean: 0, chapters: 0 });
  const stateRef = useRef(state);
  const resolved = useRef(new Set<number>());
  const boostTimer = useRef<number | null>(null);
  const lastChapter = useRef(-1);
  const lastPaint = useRef(0);

  useEffect(() => { stateRef.current = state; }, [state]);

  const steer = useCallback((amount: number) => setState(previous => ({ ...previous, driftVelocity: Math.max(-.54, Math.min(.54, previous.driftVelocity + amount * 2.7)) })), []);
  const setDrift = useCallback((drift: number) => setState(previous => ({ ...previous, drift: Math.max(.06, Math.min(.94, drift)), driftVelocity: 0 })), []);
  const boost = useCallback(() => {
    if (stateRef.current.boosting) return;
    setState(previous => ({ ...previous, boosting: true }));
    if (boostTimer.current) window.clearTimeout(boostTimer.current);
    boostTimer.current = window.setTimeout(() => setState(previous => ({ ...previous, boosting: false })), 310);
  }, []);
  const finishRun = useCallback((result: GameResult) => {
    if (ended.current) return;
    ended.current = true;
    finish(result);
  }, [finish]);
  useEffect(() => {
    if (!demo) return;
    const timers: number[] = [];
    for (let chapter = 0; chapter < 2; chapter += 1) {
      for (const event of generateSparkWorldSegment(level, chapter).events.filter(item => item.type !== "stamp")) {
        const drift = event.drift; const offset = chapter * level.chapterDuration;
        if (event.type === "drop") {
          const targetDrift = drift < .5 ? Math.min(.9, drift + .26) : Math.max(.1, drift - .26);
          timers.push(window.setTimeout(() => setDrift(targetDrift), Math.max(0, (offset + event.at - .34) * 1000)));
        } else if (event.type === "barrier" || event.type === "gate") {
          timers.push(window.setTimeout(boost, Math.max(0, (offset + event.at - .12) * 1000)));
        }
      }
    }
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [boost, demo, level, setDrift]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const action: Record<string, () => void> = { ArrowLeft: () => steer(-.11), ArrowRight: () => steer(.11), ArrowUp: () => steer(-.11), ArrowDown: () => steer(.11), " ": boost };
      const run = action[event.key];
      if (run) { event.preventDefault(); run(); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [boost, steer]);

  useEffect(() => {
    const startedAt = performance.now();
    let frame = 0;
    let active = true;
    let lastFrameAt = startedAt;
    const tick = (now: number) => {
      if (!active) return;
      const elapsed = (now - startedAt) / 1000;
      const deltaSeconds = Math.min(.06, Math.max(.001, (now - lastFrameAt) / 1000));
      lastFrameAt = now;
      const chapter = Math.floor(elapsed / level.chapterDuration);
      const chapterElapsed = elapsed % level.chapterDuration;
      const segment = generateSparkWorldSegment(level, chapter);
      if (chapter !== lastChapter.current) { lastChapter.current = chapter; resolved.current.clear(); }
      if (now - lastPaint.current >= 33) {
        lastPaint.current = now;
        setState(current => {
          const velocity = Math.max(-.54, Math.min(.54, current.driftVelocity + segment.wind * .14));
          const drift = Math.max(.06, Math.min(.94, current.drift + velocity * deltaSeconds));
          return { ...current, elapsed, chapters: chapter, drift, driftVelocity: velocity * .9 };
        });
      }
      for (const event of segment.events) {
        if (event.at > chapterElapsed || resolved.current.has(event.id)) continue;
        resolved.current.add(event.id);
        const drift = event.drift;
        setState(current => {
          if (event.type === "stamp") {
            if (Math.abs(drift - current.drift) > .12) return { ...current, combo: 0 };
            const combo = Math.min(8, current.combo + 1);
            return { ...current, points: current.points + 90 + combo * 18, stamps: current.stamps + 1, combo };
          }
          const driftClear = Math.abs(drift - current.drift) > .15;
          const boostClear = current.boosting && (event.type === "barrier" || event.type === "gate");
          if (driftClear || boostClear) return { ...current, clean: current.clean + 1 };
          const focus = current.focus - 1;
          if (focus <= 0) {
            active = false;
            window.setTimeout(() => finishRun({ outcome: "failure", score: Math.max(45, current.points + Math.floor(elapsed * 14)), label: local(locale, "Rüzgâr çizgiyi dağıttı", "The wind scattered the line"), detail: local(locale, "Engeli son anda değil, yaklaşırken okumayı dene. Açık şerit her zaman puandan değerlidir.", "Read the obstacle as it approaches, not at the last moment. An open lane is worth more than a stamp.") }), 0);
          }
          return { ...current, focus: Math.max(0, focus), combo: 0 };
        });
      }
      if (!active) return;
      if (demo && elapsed >= level.chapterDuration * 2) {
        active = false;
        const final = stateRef.current;
        finishRun({ outcome: "success", score: 760 + final.points + final.focus * 120 + final.stamps * 35 + final.clean * 12, label: local(locale, "İki baskı şeridi tamamlandı", "Two print sheets completed"), detail: local(locale, `${final.stamps} damga, ${final.clean} temiz geçiş ve ${final.focus} odakla iki koridorluk akışı tamamladın.`, `You cleared two print corridors with ${final.stamps} stamps, ${final.clean} clean passes and ${final.focus} focus left.`) });
        return;
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => { active = false; window.cancelAnimationFrame(frame); if (boostTimer.current) window.clearTimeout(boostTimer.current); };
  }, [demo, finishRun, level, locale]);

  const chapterElapsed = state.elapsed % level.chapterDuration;
  const visibleEvents = [state.chapters, state.chapters + 1].flatMap(chapter => generateSparkWorldSegment(level, chapter).events.map(event => ({ event, chapter, delta: event.at + (chapter - state.chapters) * level.chapterDuration - chapterElapsed }))).filter(item => item.delta > -.52 && item.delta < 4.9);
  const quality = state.clean >= 18 ? local(locale, "Usta baskı", "Master print") : state.clean >= 9 ? local(locale, "Temiz baskı", "Clean print") : local(locale, "Prova baskısı", "Proof print");
  return <div className="spark-game game-surface">
    <div className="game-hud"><span>{local(locale, "MESAFE", "DISTANCE")} <b>{Math.floor(state.elapsed * 32)}m</b></span><span>{local(locale, "ODAK", "FOCUS")} <b>{state.focus}/{level.focus}</b></span><span>{local(locale, "ZİNCİR", "CHAIN")} <b>×{state.combo}</b></span><span>{local(locale, "BASKI", "SHEET")} <b>{String(state.chapters + 1).padStart(2, "0")}</b></span></div>
    <div className="spark-track spark-world" role="application" aria-label={local(locale, "Kıvılcım oyun alanı. Yukarı ve aşağı okla baskı hattında yön değiştir, boşlukla itki kullan.", "Spark game field. Shift through the press line with up and down arrows; use Space for thrust.") }>
      <div className="spark-sky" aria-hidden="true"><i /><i /><i /><b>SELY PRESSLINE / {String(state.chapters + 1).padStart(2, "0")}</b></div>
      <div className="spark-world-sun" aria-hidden="true" /><div className="spark-world-horizon" aria-hidden="true" />
      <div className="spark-world-grid" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>
      <div className="spark-world-silhouette silhouette-left" aria-hidden="true" /><div className="spark-world-silhouette silhouette-right" aria-hidden="true" />
      <div className="spark-world-ribbons" aria-hidden="true"><i /><i /><i /></div>
      <div className="spark-world-sign" aria-hidden="true"><span>R</span><span>E</span><span>G</span><span>↯</span></div>
      <div className={`spark-player ${state.boosting ? "is-boosting" : ""}`} style={{ "--drift-top": `${14 + state.drift * 72}%` } as React.CSSProperties}><i /><b /><em /></div>
      {visibleEvents.map(({ event, chapter, delta }) => {
        const depth = Math.max(.08, Math.min(1, 1 - delta / 4.9));
        return <div key={`${chapter}-${event.id}`} className={`spark-event event-${event.type}`} style={{ "--drift-top": `${14 + event.drift * 72}%`, "--depth": depth, "--distance": `${Math.max(0, 22 + delta * 15)}%` } as React.CSSProperties} aria-hidden="true">{event.type === "stamp" ? "✦" : event.type === "drop" ? "●" : event.type === "gate" ? "⌇" : "━"}</div>;
      })}
      <div className="spark-drift-ruler" aria-hidden="true"><span>ALT</span><span>MERKEZ</span><span>ÜST</span></div>
    </div>
    <div className="spark-station" aria-live="polite"><span>{local(locale, "KALİTE", "QUALITY")} <b>{quality}</b></span><span>{local(locale, "TEMİZ GEÇİŞ", "CLEAN PASS")} <b>{state.clean}</b></span><span>{local(locale, "DAMGA", "STAMP")} <b>{state.stamps}</b></span></div>
    <div className="spark-controls" aria-label={local(locale, "Kıvılcım dokunmatik kontrolleri", "Spark touch controls")}><button onClick={() => steer(-.14)} aria-label={local(locale, "Yukarı süzül", "Drift up")}>↑</button><button className="spark-jump" onClick={boost}>{local(locale, "Hızlan", "Boost")} <span>Space</span></button><button onClick={() => steer(.14)} aria-label={local(locale, "Aşağı süzül", "Drift down")}>↓</button></div>
    <p className="game-tip">{level.lesson}</p>
  </div>;
}

function DirectionPad({ locale = "tr", onMove }: { locale?: SiteLocale; onMove: (dr: number, dc: number) => void }) {
  return <div className="direction-pad" aria-label={local(locale, "Yön kontrolleri", "Direction controls")}><span /><button onClick={() => onMove(-1, 0)} aria-label={local(locale, "Yukarı", "Up")}><ArrowUp size={18} /></button><span /><button onClick={() => onMove(0, -1)} aria-label={local(locale, "Sol", "Left")}><ArrowLeftIcon size={18} /></button><button onClick={() => onMove(1, 0)} aria-label={local(locale, "Aşağı", "Down")}><ArrowDown size={18} /></button><button onClick={() => onMove(0, 1)} aria-label={local(locale, "Sağ", "Right")}><ArrowRight size={18} /></button></div>;
}
