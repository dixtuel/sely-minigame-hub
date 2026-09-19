import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowLeft as ArrowLeftIcon, ArrowRight, ArrowUp, Maximize, Minimize, RotateCcw, Volume2, X } from "lucide-react";
import SparkCanvasGame from "@/components/SparkCanvasGame";
import VakaBoard from "@/components/VakaBoard";
import VakaHub from "@/components/VakaHub";
import AdSenseResultUnit from "@/components/AdSenseResultUnit";
import type { GameId, GameMeta } from "@/lib/catalog";
import type { SiteLocale } from "@/lib/i18n";
import { playComplete, playFail, playHit, playSlice, playStamp, playThrust } from "@/lib/sfx";
import {
  generateCutLevel,
  generateHaneLevel,
  generateHaneWordLevel,
  generateKnotLevel,
  type Direction,
  generateVakaCases,
  generateShadowLevel,
  masteryBand,
  compareHaneNumberGuess,
  compareHaneWordGuess,
  isHaneGuessValid,
  isHaneWordGuessValid,
  type Point,
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
type GameResult = { score: number; label: string; detail: string; outcome: ResultOutcome; answer?: string };
type Position = { r: number; c: number };
const local = (locale: SiteLocale, tr: string, en: string) => locale === "en" ? en : tr;
export const runMasteryFor = (highScore: number, dailyDifficulty: number) => Math.min(4, Math.max(masteryBand(highScore), dailyDifficulty));
export function resultActionsFor(outcome: ResultOutcome, failureCount: number, gameId?: GameId) {
  if (gameId === "spark") {
    // Kıvılcım sonsuz arcade uçuş oyunudur; seviye atlama/geçiş olmaz, her zaman tekrar denenebilir
    return { canRetry: true, canAdvance: false };
  }
  if (gameId === "hane") {
    // Hane her tekrar denendiğinde yeni bir kelime/sayı tohumuyla açılır; hem başarıda hem başarısızlıkta tekrar oynanabilir
    return { canRetry: true, canAdvance: outcome === "success" || failureCount >= 3 };
  }
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
  const shellRef = useRef<HTMLElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    shellRef.current?.requestFullscreen?.();
  };

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
    if (next.outcome === "success" || game.id === "spark") onScore(finalScore);
    setFailureCount(current => next.outcome === "failure" ? current + 1 : 0);
    setResult({ ...next, score: finalScore });
  }, [game.id, onScore]);

  return (
    <main ref={shellRef} className={`studio-shell ${sparkActive ? "studio-shell-spark" : ""}`} lang={locale} style={{ "--game-accent": game.accent, "--game-ink": game.ink } as React.CSSProperties}>
      <header className="studio-topbar">
        <button className="back-button" onClick={onBack} aria-label={locale === "en" ? "Return to game catalogue" : "Oyun kataloğuna dön"}><ArrowLeft size={18} /> {locale === "en" ? "Catalogue" : "Katalog"}</button>
        <div className="studio-title"><span>{game.number}</span><strong>{game.title}</strong><em>{game.eyebrow}</em></div>
        <div className="studio-actions">
          <span className="best-score">{locale === "en" ? "BEST" : "EN İYİ"} <b>{highScore.toLocaleString(locale === "en" ? "en-US" : "tr-TR")}</b></span>
          <button className="icon-button" onClick={onToggleSound} aria-label={soundOn ? (locale === "en" ? "Mute sound" : "Sesi kapat") : (locale === "en" ? "Enable sound" : "Sesi aç")}><Volume2 size={18} className={soundOn ? "" : "sound-muted"} /></button>
          <button className="icon-button" onClick={toggleFullscreen} aria-label={isFullscreen ? (locale === "en" ? "Exit fullscreen" : "Tam ekrandan çık") : (locale === "en" ? "Enter fullscreen" : "Tam ekrana al")}>{isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}</button>
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
            <GameRenderer key={runKey} game={game} locale={locale} dailySeed={game.id === "spark" ? ((dailySeed ^ ((runKey + 1) * 0x1f351f) ^ Math.imul(runKey + 7, 0x9e3779b9)) >>> 0) : game.id === "hane" ? (runKey === 0 ? dailySeed : ((dailySeed ^ ((runKey + 1) * 0x27d4eb2d) ^ Math.imul(runKey + 13, 0x1000193)) >>> 0)) : dailySeed} mastery={runMastery} demo={demo} soundOn={soundOn} onFinish={finish} />
            {result && (
              <div className="result-panel" role="dialog" aria-modal="true" aria-label={locale === "en" ? "Run result" : "Tur sonucu"}>
                <button className="result-close" onClick={() => setResult(null)} aria-label={locale === "en" ? "Close result" : "Sonucu kapat"}><X size={18} /></button>
                <span className="studio-kicker">{locale === "en" ? "RUN COMPLETE" : "TUR TAMAMLANDI"}</span>
                <h2>{result.label}</h2>
                {result.answer && (
                  <div className="result-target-reveal" role="status">
                    <span className="result-target-label">{locale === "en" ? "SECRET ANSWER" : "GİZLİ YANIT"}</span>
                    <strong className="result-target-value">{result.answer}</strong>
                  </div>
                )}
                <p>{result.detail}</p>
                <div className="result-score"><span>{locale === "en" ? "SCORE" : "PUAN"}</span><strong>{result.score.toLocaleString(locale === "en" ? "en-US" : "tr-TR")}</strong></div>
                <div className="result-actions">
                  {resultActionsFor(result.outcome, failureCount, game.id).canRetry && <button className="ink-button" onClick={restart}>{game.id === "hane" ? (locale === "en" ? "New word" : "Yeni kelimeyle oyna") : (locale === "en" ? "Try again" : "Tekrar dene")} <RotateCcw size={16} /></button>}
                  {resultActionsFor(result.outcome, failureCount, game.id).canAdvance && <button className="ink-button" onClick={continueToNext}>{result.outcome === "success" ? (locale === "en" ? "Continue" : "Devam et") : (locale === "en" ? "Next level" : "Sonraki seviyeye geç")} <ArrowRight size={16} /></button>}
                  <button className="quiet-button" onClick={onBack}>{locale === "en" ? "Choose a route" : "Rota seç"}</button>
                </div>
                {game.id !== "spark" && result.outcome === "failure" && failureCount >= 3 && <p className="result-nudge">{locale === "en" ? "A new route is available after three attempts." : "Üç denemeden sonra yeni rota açıldı."}</p>}
                <AdSenseResultUnit locale={locale} />
              </div>
            )}
          </div>
        )}
      </section>
      <footer className={`studio-footer ${sparkActive ? "studio-footer-spark" : ""}`}><span>SELY.TR / {locale === "en" ? "GAME CATALOGUE" : "OYUN KATALOĞU"}</span><span>{locale === "en" ? "Reduced-motion preference supported" : "Hareket azaltma tercihi desteklenir"}</span></footer>
    </main>
  );
}

const EchoRoom3D = lazy(() => import("@/components/EchoRoom3D"));

function GameRenderer({ game, locale, dailySeed, mastery, demo, soundOn, onFinish }: { game: GameMeta; locale: SiteLocale; dailySeed: number; mastery: number; demo?: "spark" | "spark-fail" | "cut-fail"; soundOn: boolean; onFinish: (result: GameResult) => void }) {
  if (game.id === "echo") return <Suspense fallback={<div className="game-surface game-loading">{local(locale, "Oda yükleniyor…", "Loading room…")}</div>}><EchoRoom3D locale={locale} seed={dailySeed} mastery={mastery} onFinish={onFinish} /></Suspense>;
  if (game.id === "knot") return <KnotGame locale={locale} seed={dailySeed} mastery={mastery} soundOn={soundOn} onFinish={onFinish} />;
  if (game.id === "cut") return <CutGame locale={locale} seed={dailySeed} mastery={mastery} demo={demo === "cut-fail"} soundOn={soundOn} onFinish={onFinish} />;
  if (game.id === "shadow") return <ShadowGame locale={locale} seed={dailySeed} mastery={mastery} soundOn={soundOn} onFinish={onFinish} />;
  if (game.id === "hane") return <HaneGame locale={locale} seed={dailySeed} mastery={mastery} onFinish={onFinish} />;
  if (game.id === "spark") return <SparkCanvasGame locale={locale} seed={dailySeed} mastery={mastery} demo={demo === "spark" ? "success" : demo === "spark-fail" ? "fail" : undefined} soundOn={soundOn} onFinish={onFinish} />;
  return <VakaGame locale={locale} seed={dailySeed} mastery={mastery} soundOn={soundOn} onFinish={onFinish} />;
}

type Tile = { r: number; c: number; base: Direction[]; rot: number; locked?: boolean; label?: string };
const directionOrder: Direction[] = ["N", "E", "S", "W"];
const step: Record<Direction, [number, number]> = { N: [-1, 0], E: [0, 1], S: [1, 0], W: [0, -1] };
const opposite: Record<Direction, Direction> = { N: "S", E: "W", S: "N", W: "E" };
const rotateDirs = (dirs: Direction[], rot: number) => dirs.map(dir => directionOrder[(directionOrder.indexOf(dir) + rot) % 4]);
const tileKey = (r: number, c: number) => `${r}-${c}`;

function KnotGame({ locale, seed, mastery, soundOn = true, onFinish }: { locale: SiteLocale; seed: number; mastery: number; soundOn?: boolean; onFinish: (result: GameResult) => void }) {
  const level = useMemo(() => generateKnotLevel(seed, mastery), [seed, mastery]);
  const finish = useFinishOnce(onFinish);
  const knotCriticalIndexes = useMemo(() => new Set([...level.targetPath, ...level.bonusPath]), [level.targetPath, level.bonusPath]);
  const baseTiles = useMemo<Tile[]>(() => level.tileShapes.map((base, index) => ({
    r: Math.floor(index / 4),
    c: index % 4,
    base,
    rot: index === level.sourceIndex || index === level.targetIndex ? 0 : level.rotations[index],
    locked: index === level.sourceIndex || index === level.targetIndex,
    label: index === level.sourceIndex ? "S" : index === level.targetIndex ? (locale === "en" ? "T" : "H") : undefined,
  })), [level, locale]);
  const [tiles, setTiles] = useState(baseTiles);
  const [turns, setTurns] = useState(0);
  const [lastRotated, setLastRotated] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);

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

  const prevConnectedSizeRef = useRef(connected.size);
  const targetConnected = connected.has(tileKey(Math.floor(level.targetIndex / 4), level.targetIndex % 4));
  const bonusConnected = level.bonusIndex >= 0 && connected.has(tileKey(Math.floor(level.bonusIndex / 4), level.bonusIndex % 4));
  const prevTargetConnectedRef = useRef(false);

  useEffect(() => {
    if (!prevTargetConnectedRef.current && targetConnected) {
      playStamp(soundOn, 8);
    } else if (connected.size > prevConnectedSizeRef.current) {
      playStamp(soundOn, Math.min(6, connected.size));
    }
    prevConnectedSizeRef.current = connected.size;
    prevTargetConnectedRef.current = targetConnected;
  }, [connected.size, targetConnected, soundOn]);

  const sealFlow = useCallback(() => {
    if (!targetConnected) return;
    playComplete(soundOn);
    finish({
      outcome: "success",
      score: Math.max(180, 860 - turns * 44 + (bonusConnected ? 180 : 0)),
      label: bonusConnected
        ? (locale === "en" ? "Seal & side flow solved" : "Mühür ve yan akış çözüldü")
        : (locale === "en" ? "Flow complete" : "Akış tamamlandı"),
      detail: locale === "en"
        ? `Route reached target in ${turns} turns${bonusConnected ? "; bonus knot energized." : "."}`
        : `${turns} hamlede hedefe ulaşan çizgiyi kurdun${bonusConnected ? "; yan düğüm de beslendi." : "."}`
    });
  }, [bonusConnected, finish, locale, soundOn, targetConnected, turns]);

  const rotate = useCallback((index: number) => {
    if (tiles[index].locked) return;
    playThrust(soundOn);
    const nextTurns = turns + 1;
    setTiles(previous => previous.map((tile, tileIndex) => tileIndex === index ? { ...tile, rot: (tile.rot + 1) % 4 } : tile));
    setTurns(nextTurns);
    setLastRotated(index);
    if (nextTurns > level.heatLimit) {
      playFail(soundOn);
      finish({
        outcome: "failure",
        score: 65,
        label: locale === "en" ? "Circuit overheated" : "Hat fazla ısındı",
        detail: locale === "en"
          ? "Trace the target path in advance instead of spinning random tiles."
          : "Aynı akışı tekrar tekrar çevirmek yerine önce hedef çizgisini gözünle kur."
      });
    }
  }, [finish, level.heatLimit, locale, soundOn, tiles, turns]);

  const undoLast = useCallback(() => {
    if (lastRotated === null) return;
    playThrust(soundOn);
    setTiles(previous => previous.map((tile, tileIndex) => tileIndex === lastRotated ? { ...tile, rot: (tile.rot + 3) % 4 } : tile));
    setTurns(value => Math.max(0, value - 1));
    setLastRotated(null);
  }, [lastRotated, soundOn]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const current = focusedIndex ?? 0;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        e.preventDefault();
        setFocusedIndex((current - 4 + 16) % 16);
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        e.preventDefault();
        setFocusedIndex((current + 4) % 16);
      } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        setFocusedIndex(current % 4 === 0 ? current + 3 : current - 1);
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        setFocusedIndex((current + 1) % 4 === 0 ? current - 3 : current + 1);
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (targetConnected && (current === level.targetIndex || e.key === "Enter")) {
          if (current === level.targetIndex) {
            sealFlow();
            return;
          }
        }
        rotate(current);
      } else if (e.key === "z" || e.key === "Z" || e.key === "Backspace" || e.key === "u" || e.key === "U") {
        e.preventDefault();
        undoLast();
      } else if ((e.key === "m" || e.key === "M") && targetConnected) {
        e.preventDefault();
        sealFlow();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedIndex, level.targetIndex, rotate, sealFlow, targetConnected, undoLast]);

  return <div className="knot-game game-surface">
    <div className="game-hud">
      <span>{locale === "en" ? "KNOT" : "DÜĞÜM"} <b>{turns}/{level.heatLimit}</b></span>
      <span>{locale === "en" ? "FLOW" : "AKIŞ"} <b>{connected.size}/16</b></span>
      <span>{targetConnected ? (bonusConnected ? (locale === "en" ? "SEAL READY + BONUS" : "MÜHÜR HAZIR + BONUS") : (locale === "en" ? "SEAL READY" : "MÜHÜR HAZIR")) : (locale === "en" ? "CONNECT TARGET" : "HEDEFİ BAĞLA")}</span>
    </div>
    <div className="knot-board" role="grid" aria-label={locale === "en" ? "Knot circuit board" : "Düğüm bağlantı tahtası"}>
      {tiles.map((tile, index) => {
        const active = connected.has(tileKey(tile.r, tile.c));
        const dirs = rotateDirs(tile.base, tile.rot);
        const bonus = level.bonusIndex === index;
        const critical = knotCriticalIndexes.has(index) && !tile.locked;
        const isSource = index === level.sourceIndex;
        const isTarget = index === level.targetIndex;
        const isFocused = focusedIndex === index;
        return <button
          key={tileKey(tile.r, tile.c)}
          onClick={() => { setFocusedIndex(index); rotate(index); }}
          className={`knot-tile ${active ? "is-active" : ""} ${tile.locked ? "is-locked" : ""} ${bonus ? "is-bonus" : ""} ${critical ? "is-critical" : ""} ${isSource ? "is-source" : ""} ${isTarget ? "is-target" : ""} ${isTarget && active ? "is-target-reached" : ""} ${isFocused ? "is-focused" : ""}`}
          aria-label={locale === "en" ? `Tile ${tile.r + 1}-${tile.c + 1}` : `Bağlantı karosu ${tile.r + 1}-${tile.c + 1}`}
        >
          <span className="knot-core">{tile.label || (bonus ? "✦" : "")}</span>
          {dirs.map(dir => <i key={dir} className={`knot-line line-${dir}`} />)}
        </button>;
      })}
    </div>
    <div className="knot-actions">
      <button type="button" className="quiet-button" onClick={undoLast} disabled={lastRotated === null}>
        {locale === "en" ? "Undo last turn (Z)" : "Son hamleyi geri al (Z)"}
      </button>
      {targetConnected && (
        <button className="ink-button knot-seal-button" onClick={sealFlow}>
          {bonusConnected ? (locale === "en" ? "Seal flow + bonus (M)" : "Akışı mühürle + bonus (M)") : (locale === "en" ? "Seal flow (M)" : "Akışı mühürle (M)")}
        </button>
      )}
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

function CutGame({ locale, seed, mastery, demo = false, soundOn = true, onFinish }: { locale: SiteLocale; seed: number; mastery: number; demo?: boolean; soundOn?: boolean; onFinish: (result: GameResult) => void }) {
  const level = useMemo(() => generateCutLevel(seed, mastery), [seed, mastery]);
  const finish = useFinishOnce(onFinish);
  const [cutsLeft, setCutsLeft] = useState(level.cuts);
  const [stains, setStains] = useState(0);
  const [line, setLine] = useState<{ a: Point; b: Point } | null>(null);
  const [score, setScore] = useState(0);
  const [shapes, setShapes] = useState<CutShape[]>(() => level.shapes.map(shape => ({ ...shape, cut: false })));
  const svgRef = useRef<SVGSVGElement>(null);
  const point = (event: React.PointerEvent<SVGSVGElement>) => {
    const box = svgRef.current!.getBoundingClientRect();
    return { x: ((event.clientX - box.left) / box.width) * 100, y: ((event.clientY - box.top) / box.height) * 56 };
  };

  const targetIndexMap = useMemo(() => {
    const map = new Map<number, number>();
    let idx = 0;
    for (const shape of shapes) {
      if (shape.target && !shape.cut) {
        map.set(shape.id, idx++);
      }
    }
    return map;
  }, [shapes]);

  const resolveCut = useCallback((cutLine: { a: Point; b: Point } | null) => {
    if (!cutLine || cutsLeft <= 0) return;
    const hit = shapes.filter(shape => !shape.cut && segmentDistance({ x: shape.x, y: shape.y }, cutLine.a, cutLine.b) < shape.size / 2 + 2);
    const targets = hit.filter(shape => shape.target);
    const decoys = hit.filter(shape => !shape.target);
    const nextStains = stains + decoys.length;
    const nextCuts = cutsLeft - 1;
    const chain = targets.filter(shape => shape.linked).length;
    const nextScore = score + targets.length * targets.length * 70 + chain * 95 - decoys.length * 55;

    if (hit.length > 0) playSlice(soundOn);
    if (targets.length > 0) playStamp(soundOn, Math.min(8, targets.length * 2));
    if (decoys.length > 0) playHit(soundOn);

    setShapes(previous => previous.map(shape => hit.some(hitShape => hitShape.id === shape.id) ? { ...shape, cut: true } : shape));
    setScore(nextScore);
    setCutsLeft(nextCuts);
    setStains(nextStains);
    setLine(null);

    const allTargetsCut = shapes.filter(shape => shape.target && !shape.cut && !targets.some(target => target.id === shape.id)).length === 0;

    if (nextStains > level.stainLimit) {
      playFail(soundOn);
      finish({
        outcome: "failure",
        score: Math.max(35, nextScore),
        label: locale === "en" ? "Canvas stained" : "Sayfa lekelendi",
        detail: locale === "en"
          ? "Decoys blocked the cutting line; observe the clean angles before cutting."
          : "Hedef olmayan şekiller kesim alanını kapattı; önce çizginin hangi taraftan geçtiğini oku."
      });
    } else if (allTargetsCut || nextCuts === 0) {
      if (allTargetsCut) playComplete(soundOn);
      else playFail(soundOn);
      finish({
        outcome: allTargetsCut ? "success" : "failure",
        score: Math.max(60, nextScore),
        label: allTargetsCut
          ? (locale === "en" ? "Plates cleanly separated" : "Plaka temiz ayrıldı")
          : (locale === "en" ? "Out of cuts" : "Kesim serisi bitti"),
        detail: allTargetsCut
          ? (locale === "en" ? `Cleanly isolated all targets.` : `${targets.length} hedefi son hamlede doğru plakaya ayırdın.`)
          : (locale === "en" ? "Try gathering linked targets in a single cut next time." : "Bir sonraki turda bağlı şekilleri aynı çizgide toplamayı dene.")
      });
    }
  }, [cutsLeft, finish, level.stainLimit, locale, score, shapes, soundOn, stains]);

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

  const keyboardCut = useCallback((index: number) => {
    const active = shapes.filter(shape => shape.target && !shape.cut);
    const target = active[index];
    if (!target) return;
    const partner = active[(index + 1) % active.length] ?? target;
    playSlice(soundOn);
    resolveCut({ a: { x: target.x - target.size, y: target.y }, b: { x: partner.x + partner.size, y: partner.y } });
  }, [resolveCut, shapes, soundOn]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= 9) {
        const active = shapes.filter(s => s.target && !s.cut);
        const targetIdx = num - 1;
        if (targetIdx < active.length) {
          e.preventDefault();
          keyboardCut(targetIdx);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [keyboardCut, shapes]);

  return <div className="cut-game game-surface">
    <div className="game-hud">
      <span>{locale === "en" ? "CUTS" : "KESİM"} <b>{cutsLeft}</b></span>
      <span>{locale === "en" ? "STAINS" : "LEKE"} <b>{stains}/{level.stainLimit}</b></span>
      <span>{locale === "en" ? "ISOLATE TARGETS" : "HEDEFLERİ AYIR"}</span>
    </div>
    <svg
      ref={svgRef}
      viewBox="0 0 100 56"
      className="cut-canvas"
      role="application"
      aria-label={locale === "en" ? "Cutout canvas. Drag to cut shapes." : "Kırpık tuvali. Şekilleri kesmek için sürükle."}
      onPointerDown={event => {
        event.currentTarget.setPointerCapture(event.pointerId);
        const current = point(event);
        playSlice(soundOn);
        setLine({ a: current, b: current });
      }}
      onPointerMove={event => line && setLine(previous => previous ? { ...previous, b: point(event) } : null)}
      onPointerUp={release}
      onPointerCancel={() => setLine(null)}
    >
      <rect width="100" height="56" rx="2" fill="#654169" />
      {shapes.map(shape => {
        const isTarget = shape.target;
        const targetNum = targetIndexMap.get(shape.id);
        return (
          <g
            key={shape.id}
            className={shape.cut ? "cut-shape is-cut" : "cut-shape"}
            transform={`translate(${shape.x} ${shape.y}) rotate(${shape.id * 19})`}
          >
            {isTarget ? (
              <>
                <rect
                  x={-shape.size}
                  y={-shape.size / 2}
                  width={shape.size * 2}
                  height={shape.size}
                  rx="1.2"
                  fill={shape.color}
                  stroke="#ffffff"
                  strokeWidth="0.7"
                />
                <circle cx="0" cy="0" r={shape.size * 0.38} fill="none" stroke="#ffffff" strokeWidth="0.5" strokeDasharray="1.2 0.8" />
                <circle cx="0" cy="0" r="0.7" fill="#ffffff" />
                {shape.linked && (
                  <g transform={`translate(${-shape.size * 0.65}, 0) rotate(${-shape.id * 19})`}>
                    <text textAnchor="middle" dominantBaseline="central" fontSize="2.8" fill="#ffd700" fontWeight="bold">✦</text>
                  </g>
                )}
                {!shape.cut && targetNum !== undefined && (
                  <g transform={`translate(${shape.size * 0.75}, ${-shape.size * 0.35}) rotate(${-shape.id * 19})`}>
                    <circle r="2.2" fill="#e9563f" stroke="#ffffff" strokeWidth="0.5" />
                    <text textAnchor="middle" dominantBaseline="central" fontSize="2.6" fontWeight="bold" fill="#ffffff" fontFamily="var(--font-mono)" className="cut-badge-text">
                      {targetNum + 1}
                    </text>
                  </g>
                )}
              </>
            ) : (
              <>
                <rect
                  x={-shape.size}
                  y={-shape.size / 2}
                  width={shape.size * 2}
                  height={shape.size}
                  rx="1.2"
                  fill={shape.color}
                  stroke="rgba(27,26,27,0.45)"
                  strokeWidth="0.5"
                  strokeDasharray="1.5 1"
                  opacity="0.82"
                />
                <line x1={-shape.size * 0.35} y1={-shape.size * 0.22} x2={shape.size * 0.35} y2={shape.size * 0.22} stroke="rgba(27,26,27,0.55)" strokeWidth="0.6" />
                <line x1={-shape.size * 0.35} y1={shape.size * 0.22} x2={shape.size * 0.35} y2={-shape.size * 0.22} stroke="rgba(27,26,27,0.55)" strokeWidth="0.6" />
              </>
            )}
          </g>
        );
      })}
      {line && (
        <>
          <line x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} className="cut-line-glow" />
          <line x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} className="cut-line-core" />
          <circle cx={line.a.x} cy={line.a.y} r="1.3" className="cut-node" />
          <circle cx={line.b.x} cy={line.b.y} r="1.3" className="cut-node" />
        </>
      )}
    </svg>
    <div className="cut-keyboard" aria-label={locale === "en" ? "Keyboard cut options" : "Klavye kesim seçenekleri"}>
      <span>{locale === "en" ? "KEYBOARD CUT (1-9)" : "KLAVYE KESİMİ (1-9)"}</span>
      {shapes.filter(shape => shape.target && !shape.cut).map((shape, index) => (
        <button key={shape.id} onClick={() => keyboardCut(index)} aria-label={locale === "en" ? `Cut target ${index + 1}` : `Hedef ${index + 1} kesimi`}>
          {index + 1}
        </button>
      ))}
    </div>
    <p className="game-tip">{level.lesson}</p>
  </div>;
}

function ShadowGame({
  locale,
  seed,
  mastery,
  soundOn,
  onFinish,
}: {
  locale: SiteLocale;
  seed: number;
  mastery: number;
  soundOn: boolean;
  onFinish: (result: GameResult) => void;
}) {
  const level = useMemo(() => generateShadowLevel(seed, mastery), [seed, mastery]);
  const finish = useFinishOnce(onFinish);

  type GameState = {
    player: Position;
    shadow: Position;
    history: Array<[number, number]>;
    open: boolean;
    moves: number;
    inverted: boolean;
  };

  const initial = useMemo<GameState>(
    () => ({
      player: { r: 0, c: 0 },
      shadow: { r: 0, c: 0 },
      history: [],
      open: false,
      moves: 0,
      inverted: false,
    }),
    [level]
  );

  const [state, setState] = useState<GameState>(initial);
  const [undoStack, setUndoStack] = useState<GameState[]>([]);

  // Seviye veya seed değişirse durumu sıfırla
  useEffect(() => {
    setState(initial);
    setUndoStack([]);
  }, [initial]);

  const at = (position: Position, point: Point) => position.c === point.x && position.r === point.y;
  const isInverse = (position: Position) => level.inverseTiles.some((point) => at(position, point));
  const onPad = (position: Position) => level.pads.some((point) => at(position, point));

  // Gölgenin önümüzdeki adımda nereye varacağını gösteren hayalet nokta
  const nextShadowPos = useMemo<Position | null>(() => {
    if (state.history.length < level.lag) return null;
    const [lagDr, lagDc] = state.history[0];
    const factor = isInverse(state.shadow) ? -1 : 1;
    const r = Math.max(0, Math.min(level.size - 1, state.shadow.r + lagDr * factor));
    const c = Math.max(0, Math.min(level.size - 1, state.shadow.c + lagDc * factor));
    return { r, c };
  }, [state.history, state.shadow, level]);

  const move = useCallback(
    (dr: number, dc: number) => {
      setState((previous) => {
        const player = {
          r: Math.max(0, Math.min(level.size - 1, previous.player.r + dr)),
          c: Math.max(0, Math.min(level.size - 1, previous.player.c + dc)),
        };

        // Eğer duvara çarpıp yerinde kaldıysa hamleyi yutma
        if (player.r === previous.player.r && player.c === previous.player.c) return previous;

        // Undo stack'e önceki geçerli durumu kaydet
        setUndoStack((prev) => [...prev.slice(-29), previous]);

        let shadow = previous.shadow;
        let inverted = previous.inverted;

        if (previous.history.length >= level.lag) {
          const [lagDr, lagDc] = previous.history[0];
          const factor = isInverse(previous.shadow) ? -1 : 1;
          shadow = {
            r: Math.max(0, Math.min(level.size - 1, previous.shadow.r + lagDr * factor)),
            c: Math.max(0, Math.min(level.size - 1, previous.shadow.c + lagDc * factor)),
          };
          inverted = isInverse(shadow);
        }

        // Kuyruk lag boyu kadar korunur
        const history = [...previous.history, [dr, dc] as [number, number]].slice(-level.lag);

        // İki farklı ped üzerinde biri oyuncu biri gölge mi?
        const justUnlocked =
          !previous.open &&
          onPad(player) &&
          onPad(shadow) &&
          (player.r !== shadow.r || player.c !== shadow.c);
        const open = previous.open || justUnlocked;

        if (justUnlocked) {
          playComplete(soundOn);
        } else {
          playThrust(soundOn);
        }

        const next = {
          player,
          shadow,
          history,
          open,
          moves: previous.moves + 1,
          inverted,
        };

        if (open && at(player, level.exit)) {
          playComplete(soundOn);
          finish({
            outcome: "success",
            score: Math.max(220, 980 - next.moves * 24 + (inverted ? 110 : 0)),
            label: local(locale, "Zaman hizalandı", "Time Aligned"),
            detail: inverted
              ? local(
                  locale,
                  "Işık plağından geçen gölgenin ters ritmini de çözdün.",
                  "You decoded the inverted rhythm through the light prism."
                )
              : local(
                  locale,
                  "Gölgenin geçmiş rotası çıkışı senin için açtı.",
                  "Your shadow's delayed steps unlocked the exit gate."
                ),
          });
        }

        return next;
      });
    },
    [finish, level, soundOn, locale]
  );

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setState(last);
      playThrust(soundOn);
      return prev.slice(0, -1);
    });
  }, [soundOn]);

  const restart = useCallback(() => {
    setState(initial);
    setUndoStack([]);
    playHit(soundOn);
  }, [initial, soundOn]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      // WASD, Arrow keys, Z (Undo), R (Restart)
      const map: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        KeyW: [-1, 0],
        w: [-1, 0],
        W: [-1, 0],
        ArrowDown: [1, 0],
        KeyS: [1, 0],
        s: [1, 0],
        S: [1, 0],
        ArrowLeft: [0, -1],
        KeyA: [0, -1],
        a: [0, -1],
        A: [0, -1],
        ArrowRight: [0, 1],
        KeyD: [0, 1],
        d: [0, 1],
        D: [0, 1],
      };

      if (event.key === "z" || event.key === "Z" || event.code === "KeyZ") {
        event.preventDefault();
        undo();
        return;
      }
      if (event.key === "r" || event.key === "R" || event.code === "KeyR") {
        event.preventDefault();
        restart();
        return;
      }

      const direction = map[event.code] || map[event.key];
      if (direction) {
        event.preventDefault();
        move(...direction);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [move, undo, restart]);

  const isPlayerOnAnyPad = onPad(state.player);
  const isShadowOnAnyPad = onPad(state.shadow);

  return (
    <div className="shadow-game game-surface">
      {/* Oyun Durum Başlığı (HUD) */}
      <div className="game-hud">
        <span>
          {local(locale, "GECİKME", "LAG")} <b>{level.lag}</b>
        </span>
        <span>
          {local(locale, "ADIM", "MOVES")} <b>{state.moves}</b>
        </span>
        <span className={state.open ? "is-hud-open" : ""}>
          {state.open
            ? `🚪 ${local(locale, "ÇIKIŞ AÇILDI!", "EXIT UNLOCKED!")}`
            : isPlayerOnAnyPad || isShadowOnAnyPad
            ? `⚖️ ${local(locale, "DİĞER PEDE ADIMLA", "STEP TO OTHER PAD")}`
            : `⚖️ ${local(locale, "İKİ PEDİ EŞLE", "ALIGN BOTH PADS")}`}
        </span>
      </div>

      {/* 5x5 veya 6x6 Gölge Tahtası */}
      <div
        className="shadow-board"
        style={{ gridTemplateColumns: `repeat(${level.size}, 1fr)` }}
        role="grid"
        aria-label={local(locale, "Gölge Payı Bulmaca Tahtası", "Shadow Share Puzzle Grid")}
      >
        {Array.from({ length: level.size * level.size }, (_, index) => {
          const r = Math.floor(index / level.size);
          const c = index % level.size;
          const position = { r, c };
          const pad = onPad(position);
          const exit = at(position, level.exit);
          const inverse = isInverse(position);

          const playerHere = state.player.r === r && state.player.c === c;
          const shadowHere = state.shadow.r === r && state.shadow.c === c;
          const isGhostTrail =
            Boolean(nextShadowPos && nextShadowPos.r === r && nextShadowPos.c === c) &&
            !shadowHere &&
            !state.open;

          return (
            <div
              key={`${r}-${c}`}
              className={`shadow-cell ${pad ? "is-pad" : ""} ${exit ? "is-exit" : ""} ${
                state.open ? "is-open" : ""
              } ${inverse ? "is-inverse" : ""} ${pad && playerHere ? "is-pad-player" : ""} ${
                pad && shadowHere ? "is-pad-shadow" : ""
              }`}
            >
              {/* Çıkış Kapısı */}
              {exit && (
                <span className="shadow-exit-glyph" title={state.open ? "Çıkış Açık" : "Kilitli"}>
                  {state.open ? "🚪" : "🔒"}
                </span>
              )}

              {/* Baskı Pedi İşareti */}
              {pad && !exit && (
                <span className={`shadow-pad-glyph ${playerHere || shadowHere ? "is-pressed" : ""}`}>
                  ◆
                </span>
              )}

              {/* Işık Prizması */}
              {inverse && <i>↺</i>}

              {/* Gölgenin Sıradaki Adım İzi */}
              {isGhostTrail && (
                <span
                  className="ghost-trail-dot"
                  title={local(locale, "Gölgenin sıradaki adımı", "Shadow's next step")}
                />
              )}

              {/* Oyuncu Karakteri */}
              {playerHere && (
                <span className="solid-figure" title={local(locale, "Sen (Işık)", "You (Light)")} />
              )}

              {/* Gölge Karakteri */}
              {shadowHere && (
                <span
                  className="ghost-figure"
                  title={local(locale, "Gölgen (Gecikmeli)", "Your Shadow (Delayed)")}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Kontrol Çubuğu & Taktiksel Butonlar */}
      <div className="shadow-controls-cluster">
        <DirectionPad locale={locale} onMove={move} />

        <div className="shadow-action-btns">
          <button
            type="button"
            className="shadow-tool-btn shadow-undo-btn"
            disabled={undoStack.length === 0}
            onClick={undo}
            title={local(locale, "Geri Al (Z)", "Undo (Z)")}
          >
            ↺ {local(locale, "Geri Al", "Undo")}
          </button>
          <button
            type="button"
            className="shadow-tool-btn shadow-restart-btn"
            onClick={restart}
            title={local(locale, "Baştan Başla (R)", "Restart (R)")}
          >
            ⟲ {local(locale, "Yeniden", "Reset")}
          </button>
        </div>
      </div>

      {/* İpucu ve Seviye Dersi */}
      <p className="game-tip">{locale === "en" ? level.lessonEn || level.lesson : level.lesson}</p>
    </div>
  );
}

function VakaGame({ locale, soundOn, onFinish }: { locale: SiteLocale; seed: number; mastery: number; soundOn: boolean; onFinish: (result: GameResult) => void }) {
  const finish = useFinishOnce(onFinish);

  const handleSolved = (earned: number) => {
    finish({
      outcome: "success",
      score: earned,
      label: locale === "en" ? "Case Closed" : "Dosya Kapandı",
      detail: locale === "en" ? "The truth was uncovered and recorded in the bureau archives." : "Gerçekler açığa çıkarıldı ve büro arşivine kaydedildi.",
    });
  };

  return (
    <div className="vaka-game game-surface">
      <VakaHub locale={locale} soundOn={soundOn} onSolved={handleSolved} />
    </div>
  );
}

function HaneGame({ locale, seed, mastery, onFinish }: { locale: SiteLocale; seed: number; mastery: number; onFinish: (result: GameResult) => void }) {
  const numberLevel = useMemo(() => generateHaneLevel(seed, mastery), [seed, mastery]);
  const wordLevel = useMemo(() => generateHaneWordLevel(seed, mastery, locale), [seed, mastery, locale]);
  const finish = useFinishOnce(onFinish);
  const [mode, setMode] = useState<"number" | "word">("word");
  const [guess, setGuess] = useState("");
  const [numberRows, setNumberRows] = useState<Array<{ guess: string; marks: Array<"exact" | "present" | "absent"> }>>([]);
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
  const [checkingWord, setCheckingWord] = useState(false);
  const submit = useCallback(() => {
    if (!isWord) {
      if (!isHaneGuessValid(guess, numberLevel)) { setNotice(local(locale, `${numberLevel.digits} haneli ve sıfırla başlamayan bir kayıt gir.`, `Enter a ${numberLevel.digits}-digit record that does not start with zero.`)); return; }
      const feedback = compareHaneNumberGuess(numberLevel.target, guess);
      const nextRows = [...numberRows, { guess, marks: feedback.marks }];
      setNumberRows(nextRows); setGuess(""); setNotice("");
      if (feedback.exact === numberLevel.digits) { finish({ outcome: "success", score: 1_100 - nextRows.length * 105 + mastery * 65, label: local(locale, "Kayıt hizalandı", "Record aligned"), answer: numberLevel.target, detail: local(locale, `${nextRows.length}. fişte kayıt numarasını çözdün.`, `You resolved the record number on receipt ${nextRows.length}.`) }); return; }
      if (nextRows.length >= numberLevel.maxGuesses) {
        setNotice(local(locale, `Aranan gizli kayıt: ${numberLevel.target}`, `The secret record was: ${numberLevel.target}`));
        finish({ outcome: "failure", score: Math.max(60, 180 + nextRows.reduce((total, row) => total + row.marks.filter(mark => mark !== "absent").length * 26, 0)), label: local(locale, "Kayıt kapanmadı", "Record remained open"), answer: numberLevel.target, detail: local(locale, `Aranan gizli kayıt "${numberLevel.target}" idi. ${numberLevel.lesson}`, `The secret record was "${numberLevel.target}". ${numberLevel.lesson}`) });
        return;
      }
      return;
    }
    setCheckingWord(true);
    isHaneWordGuessValid(guess, wordLevel, locale).then(valid => {
      setCheckingWord(false);
      if (!valid) { setNotice(local(locale, `${wordLevel.length} harfli, geçerli bir Türkçe sözcük gir.`, `Enter a valid ${wordLevel.length}-letter English word.`)); return; }
      const normalizedGuess = locale === "en"
        ? guess.trim().toUpperCase()
        : Array.from(guess.toLocaleUpperCase("tr-TR")).join("");
      const feedback = compareHaneWordGuess(wordLevel.target, normalizedGuess, locale);
      const nextRows = [...wordRows, { guess: normalizedGuess, marks: feedback.marks }];
      setWordRows(nextRows); setGuess(""); setNotice("");
      if (feedback.exact === wordLevel.length) { finish({ outcome: "success", score: 1_160 - nextRows.length * 105 + mastery * 65, label: local(locale, "Sözcük kayda geçti", "Word entered the record"), answer: wordLevel.target, detail: local(locale, `${nextRows.length}. fişte gizli sözcüğü çözdün.`, `You resolved the hidden word on receipt ${nextRows.length}.`) }); return; }
      if (nextRows.length >= wordLevel.maxGuesses) {
        setNotice(local(locale, `Aranan sözcük: "${wordLevel.target}"`, `The hidden word was: "${wordLevel.target}"`));
        finish({ outcome: "failure", score: Math.max(60, 180 + nextRows.reduce((total, row) => total + row.marks.filter(mark => mark !== "absent").length * 26, 0)), label: local(locale, "Sözcük açık kaldı", "Word record stayed open"), answer: wordLevel.target, detail: local(locale, `Aranan gizli sözcük "${wordLevel.target}" idi. ${wordLevel.lesson}`, `The secret word was "${wordLevel.target}". ${wordLevel.lesson}`) });
      }
    });
  }, [finish, guess, isWord, locale, mastery, numberLevel, numberRows, wordLevel, wordRows]);
  useEffect(() => {
    if (!isWord) return;
    const keydown = (event: KeyboardEvent) => {
      if (document.activeElement?.id === inputId) return;
      if (event.key === "Enter") { event.preventDefault(); submit(); return; }
      if (event.key === "Backspace") { event.preventDefault(); setGuess(current => Array.from(current).slice(0, -1).join("")); return; }
      const letter = locale === "en" ? event.key.toUpperCase() : event.key.toLocaleUpperCase("tr-TR");
      const pattern = locale === "en" ? /^[A-Z]$/ : /^[A-ZÇĞİÖŞÜ]$/;
      if (pattern.test(letter)) { event.preventDefault(); append(letter); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [inputId, isWord, locale, submit]);
  const wordKeyboard = locale === "en"
    ? ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"]
    : ["QWERTYUIOPĞÜ", "ASDFGHJKLŞİ", "ZXCVBNMÖÇ"];
  const bestMarkPerKey = (rows: Array<{ guess: string; marks: Array<"exact" | "present" | "absent"> }>) => {
    const rank: Record<"exact" | "present" | "absent", number> = { exact: 3, present: 2, absent: 1 };
    const marks: Record<string, "exact" | "present" | "absent"> = {};
    for (const row of rows) {
      Array.from(row.guess).forEach((key, index) => {
        const mark = row.marks[index];
        if (!marks[key] || rank[mark] > rank[marks[key]]) marks[key] = mark;
      });
    }
    return marks;
  };
  const keyboardMarks = useMemo(() => bestMarkPerKey(wordRows), [wordRows]);
  const numberKeyboardMarks = useMemo(() => bestMarkPerKey(numberRows), [numberRows]);
  return <div className="hane-game game-surface">
    <div className="game-hud"><span>{local(locale, "FİŞ", "RECEIPT")} <b>{activeRows.length}/{activeMaxGuesses}</b></span><span>{local(locale, "KAYIT", "RECORD")} <b>{isWord ? local(locale, "SÖZCÜK", "WORD") : local(locale, "SAYI", "NUMBER")}</b></span><span>{isWord ? local(locale, "KONU", "TOPIC") : local(locale, "KURAL", "RULE")} <b>{isWord ? (locale === "en" ? wordLevel.categoryEn : wordLevel.category) : (numberLevel.allowsRepeats ? local(locale, "TEKRAR AÇIK", "REPEATS ON") : local(locale, "TEKRAR YOK", "NO REPEATS"))}</b></span></div>
    <section className="hane-desk" aria-label={local(locale, "Hane kayıt masası", "Hane record desk")}>
      <div className="hane-head"><span>SELY / KAYIT MASASI</span><b>{isWord ? local(locale, "SÖZCÜK İZİ", "WORD TRACE") : local(locale, "SAYI İZİ", "NUMBER TRACE")}</b></div>
      <div className="hane-mode-tabs" role="tablist" aria-label={local(locale, "Hane kayıt türü", "Hane record type")}><button type="button" role="tab" aria-selected={!isWord} className={!isWord ? "is-active" : ""} onClick={() => chooseMode("number")}>{local(locale, "Sayı kaydı", "Number record")}</button><button type="button" role="tab" aria-selected={isWord} className={isWord ? "is-active" : ""} onClick={() => chooseMode("word")}>{local(locale, "Sözcük kaydı", "Word record")}</button></div>
      <div className="hane-key"><div><b>▣ {local(locale, "YERİNDE", "EXACT")}</b><span>{isWord ? local(locale, "doğru harf · doğru yer", "right letter · right place") : local(locale, "doğru hane · doğru yer", "right digit · right place")}</span></div><div><b>◌ {local(locale, "İZDE", "TRACED")}</b><span>{isWord ? local(locale, "doğru harf · başka yer", "right letter · other place") : local(locale, "doğru hane · başka yer", "right digit · other place")}</span></div></div>
      <ol className="hane-word-rows" aria-live="polite" style={{ "--word-length": activeLength } as React.CSSProperties}>{Array.from({ length: activeMaxGuesses }, (_, index) => { const row = activeRows[index]; return <li key={index}>{Array.from({ length: activeLength }, (_, cellIndex) => <span key={cellIndex} className={row ? `is-${row.marks[cellIndex]}` : ""}>{row?.guess[cellIndex] || ""}</span>)}</li>; })}</ol>
      <form className="hane-entry" onSubmit={event => { event.preventDefault(); submit(); }}><label htmlFor={inputId}>{isWord ? local(locale, "SÖZCÜK YAZ", "ENTER WORD") : local(locale, "KAYIT GİR", "ENTER RECORD")}</label><input id={inputId} value={guess} onChange={event => { setNotice(""); const next = isWord ? (locale === "en" ? Array.from(event.target.value.toUpperCase()).filter(letter => /^[A-Z]$/.test(letter)).slice(0, wordLevel.length).join("") : Array.from(event.target.value.toLocaleUpperCase("tr-TR")).filter(letter => /^[A-ZÇĞİÖŞÜ]$/.test(letter)).slice(0, wordLevel.length).join("")) : event.target.value.replace(/\D/g, "").slice(0, numberLevel.digits); setGuess(next); }} inputMode={isWord ? "text" : "numeric"} autoComplete="off" pattern={isWord ? (locale === "en" ? "[A-Za-z]+" : "[A-Za-zÇĞİÖŞÜçğıöşü]+") : "[0-9]*"} aria-describedby={`${inputId}-note`} placeholder={isWord ? "—".repeat(wordLevel.length) : "0".repeat(numberLevel.digits)} /><button className="ink-button" type="submit" disabled={checkingWord}>{checkingWord ? local(locale, "Kontrol ediliyor…", "Checking…") : local(locale, "Baskıya ver", "Stamp entry")}</button></form>
      {!isWord ? <div className="hane-word-keypad hane-number-keypad" aria-label={local(locale, "Sayı tuşları", "Number keypad")}><div>{[1,2,3,4,5,6,7,8,9,0].map(value => <button type="button" key={value} className={numberKeyboardMarks[String(value)] ? `is-${numberKeyboardMarks[String(value)]}` : ""} onClick={() => append(String(value))}>{value}</button>)}</div><button className="hane-backspace" type="button" onClick={() => setGuess(current => current.slice(0, -1))}>⌫</button></div> : <div className="hane-word-keypad" aria-label={local(locale, "Harf tuşları", "Letter keys")}>{wordKeyboard.map((line, index) => <div key={index}>{Array.from(line).map(letter => <button type="button" key={letter} className={keyboardMarks[letter] ? `is-${keyboardMarks[letter]}` : ""} onClick={() => append(letter)}>{letter}</button>)}</div>)}<button className="hane-backspace" type="button" onClick={() => setGuess(current => Array.from(current).slice(0, -1).join(""))}>⌫</button></div>}
      <p id={`${inputId}-note`} className={notice ? "hane-note is-alert" : "hane-note"}>{notice || (isWord ? (locale === "en" ? `Today’s topic: ${wordLevel.categoryEn}. ${wordLevel.lesson}` : `Bugünün konusu: ${wordLevel.category}. ${wordLevel.lesson}`) : numberLevel.lesson)}</p>
    </section>
  </div>;
}


function DirectionPad({ locale = "tr", onMove }: { locale?: SiteLocale; onMove: (dr: number, dc: number) => void }) {
  return <div className="direction-pad" aria-label={local(locale, "Yön kontrolleri", "Direction controls")}><span /><button onClick={() => onMove(-1, 0)} aria-label={local(locale, "Yukarı", "Up")}><ArrowUp size={18} /></button><span /><button onClick={() => onMove(0, -1)} aria-label={local(locale, "Sol", "Left")}><ArrowLeftIcon size={18} /></button><button onClick={() => onMove(1, 0)} aria-label={local(locale, "Aşağı", "Down")}><ArrowDown size={18} /></button><button onClick={() => onMove(0, 1)} aria-label={local(locale, "Sağ", "Right")}><ArrowRight size={18} /></button></div>;
}
