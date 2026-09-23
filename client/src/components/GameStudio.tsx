import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Info, Maximize, Minimize, RotateCcw, Share2, Volume2, X } from "lucide-react";
// AdSense disabled on sely.tr, see the commented-out <AdSenseResultUnit /> usage below.
// import AdSenseResultUnit from "@/components/AdSenseResultUnit";
import ShareResultModal from "@/components/ShareResultModal";
import type { GameMeta } from "@/lib/catalog";
import { local, type SiteLocale } from "@/lib/i18n";
import { trackEvent } from "@/lib/analytics";



import { getPlayerNick } from "@/lib/playerNick";
import {
  runMasteryFor,
  resultActionsFor,
  scoreFor,
  ARCADE_DYNAMIC_GAME_IDS,
  type GameResult,
  type ResultOutcome,
  type Position,
} from "@/components/games/shared";

export { runMasteryFor, resultActionsFor, type GameResult, type ResultOutcome, type Position };

type CoilHud = { score: number; pace: number };
type ApexHud = { score: number; speed: number; combo: number };
type LiftHud = { altitude: number };
type BreaklineHud = { stage: number; stages: number; pattern: string; score: number; lives: number };

function isEditableGameTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, [contenteditable=\"true\"]"));
}

function controlHelp(gameId: GameMeta["id"], locale: SiteLocale, touch: boolean) {
  const en = locale === "en";
  const pc: Record<string, string> = {
    echo: en ? "WASD / Arrow keys: move · Space: send echo · F: fullscreen" : "WASD / Yön tuşları: hareket · Space: yankı gönder · F: tam ekran",
    vaka: en ? "Mouse: choose tabs and evidence · Text field: ask a question · Enter: send" : "Mouse: sekme ve delil seç · Metin alanı: soru sor · Enter: gönder",
    knot: en ? "Mouse: rotate a tile · Z: undo · Enter: seal the flow" : "Mouse: taşı döndür · Z: geri al · Enter: akışı mühürle",
    cut: en ? "Mouse drag: cut a line · 1–9: cut the numbered target" : "Mouse sürükle: çizgi kes · 1–9: numaralı hedefi kes",
    shadow: en ? "WASD / Arrow keys: move · Z: undo · R: restart" : "WASD / Yön tuşları: hareket · Z: geri al · R: yenile",
    hane: en ? "Type letters or numbers · Enter: submit · Backspace: delete" : "Harf veya sayı yaz · Enter: kontrol et · Backspace: sil",
    spark: en ? "Space / click: flap and rise" : "Space / tık: kanat çırp ve yüksel",
    asteroids: en ? "A/D or ←/→: turn · W/↑: thrust · Space: fire" : "A/D veya ←/→: dön · W/↑: itki · Space: ateş",
    sokoban: en ? "WASD / Arrow keys: move · U: undo · R: reset" : "WASD / Yön tuşları: hareket · U: geri al · R: yenile",
    tetris: en ? "←/→: move · ↑: rotate · ↓: soft drop · Space: hard drop" : "←/→: hareket · ↑: döndür · ↓: yumuşak düşür · Space: sert düşür",
    lander: en ? "←/A and →/D: rotate · ↑/W: thrust" : "←/A ve →/D: döndür · ↑/W: itki",
    lightsout: en ? "Mouse: toggle a light and its neighbors · R: reset" : "Mouse: ışığı ve komşularını değiştir · R: yenile",
    game2048: en ? "WASD / Arrow keys: slide tiles" : "WASD / Yön tuşları: taşları kaydır",
    coil: en ? "Swipe up, down, left or right · Arrow keys / WASD also work" : "Yukarı, aşağı, sağa veya sola kaydır · Yön tuşları / WASD da çalışır",
    apex: en ? "←/→ or A/D: steer · W/↑: accelerate · S/↓: brake" : "←/→ veya A/D: yön ver · W/↑: gaz · S/↓: fren",
    lift: en ? "Left/Right or A/D: move in the air" : "Sol/Sağ veya A/D: havada hareket et",
    breakline: en ? "Left/Right or cursor: move the paddle" : "Sol/Sağ veya imleç: raketi hareket ettir",
  };
  const touchControls: Record<string, string> = {
    echo: en ? "Drag the joystick to move · Echo button: send echo" : "Joystick'i sürükle: hareket · Yankı düğmesi: yankı gönder",
    vaka: en ? "Tap tabs, evidence and actions · Tap the field to open the touch keyboard" : "Sekme, delil ve aksiyonlara dokun · Klavyeyi açmak için alana dokun",
    knot: en ? "Tap a tile to rotate it · Tap Undo or Seal" : "Taşa dokun: döndür · Geri Al veya Mühürle düğmesine dokun",
    cut: en ? "Drag across the board to cut · Tap a numbered target" : "Tahta üzerinde sürükle: kes · Numara hedefe dokun",
    shadow: en ? "Use the four-way pad · Tap Undo or Restart" : "Dört yön padini kullan · Geri Al veya Yenile'ye dokun",
    hane: en ? "Use the on-screen letter or number keypad · Submit" : "Ekrandaki harf veya sayı klavyesini kullan · Kontrol et",
    spark: en ? "Tap or press the play area to flap" : "Kanat çırpmak için oyun alanına dokun",
    asteroids: en ? "Drag the left joystick · Hold FIRE on the right" : "Soldaki joystick'i sürükle · Sağdaki ATEŞ düğmesine basılı tut",
    sokoban: en ? "Use the four-way pad · Tap Undo or Reset" : "Dört yön padini kullan · Geri Al veya Yenile'ye dokun",
    tetris: en ? "Tap: rotate · Swipe left/right: move · Swipe down: drop · Fast swipe down: hard drop · Use the bottom buttons" : "Dokun: döndür · Sola/sağa kaydır: hareket · Aşağı kaydır: düşür · Hızlı aşağı kaydır: sert düşür · Alttaki tuşları kullan",
    lander: en ? "Hold LEFT/RIGHT to rotate · Hold THRUST to fire the engine" : "DÖN tuşlarını basılı tut · İTME tuşuna basılı tut: motoru çalıştır",
    lightsout: en ? "Tap a light to toggle it and its neighbors · Tap Reset" : "Işığa dokun: kendisi ve komşuları değişsin · Yenile'ye dokun",
    game2048: en ? "Swipe the board or use the four-way buttons" : "Tahtayı kaydır veya dört yön tuşlarını kullan",
    coil: en ? "Swipe up, down, left or right across the board" : "Tahtada yukarı, aşağı, sağa veya sola kaydır",
    apex: en ? "Swipe left/right to change lanes · Hold throttle or brake" : "Şerit değiştirmek için sağa/sola kaydır · Gazı veya freni basılı tut",
    lift: en ? "Hold left or right to steer" : "Yön vermek için solu veya sağı basılı tut",
    breakline: en ? "Drag across the play area to move the paddle" : "Raketi hareket ettirmek için oyun alanında sürükle",
  };
  return touch ? touchControls[gameId] : pc[gameId];
}

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

export default function GameStudio({ game, locale = "tr", autoStart = false, demo, dailySeed = 0, dailyDifficulty = 1, highScore, soundOn, onToggleSound, onBack, onNextLevel, onScore }: GameStudioProps) {
  const [started, setStarted] = useState(autoStart);
  const [runKey, setRunKey] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  const [completedResult, setCompletedResult] = useState<GameResult | null>(null);
  const [isResultDismissed, setIsResultDismissed] = useState(false);
  const [failureCount, setFailureCount] = useState(0);
  const [shareOpen, setShareOpen] = useState(false);
  const [sparkHud, setSparkHud] = useState<{ score: number; voltage: number; speed: number } | null>(null);
  const [coilHud, setCoilHud] = useState<CoilHud>({ score: 0, pace: 1 });
  const [apexHud, setApexHud] = useState<ApexHud>({ score: 0, speed: 100, combo: 0 });
  const [liftHud, setLiftHud] = useState<LiftHud>({ altitude: 0 });
  const [breaklineHud, setBreaklineHud] = useState<BreaklineHud | null>(null);
  const displayMastery = runMasteryFor(highScore, dailyDifficulty);
  const [runMastery, setRunMastery] = useState(() => displayMastery);
  const isArcadeDynamic = ARCADE_DYNAMIC_GAME_IDS.includes(game.id);
  const dynamicStageActive = isArcadeDynamic && started;
  const breaklineStageActive = game.id === "breakline" && dynamicStageActive;
  const coilStageActive = game.id === "coil" && dynamicStageActive;
  const apexStageActive = game.id === "apex" && dynamicStageActive;
  const liftStageActive = game.id === "lift" && dynamicStageActive;
  const sparkActive = game.id === "spark" && started;
  const shellRef = useRef<HTMLElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [hasTouchInput, setHasTouchInput] = useState(false);
  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);
  useEffect(() => {
    const updateTouchInput = () => {
      setHasTouchInput(
        typeof navigator !== "undefined" && navigator.maxTouchPoints > 0
          || typeof window !== "undefined" && window.matchMedia("(any-pointer: coarse), (any-hover: none)").matches
      );
    };
    updateTouchInput();
    const coarseQuery = window.matchMedia("(any-pointer: coarse)");
    coarseQuery.addEventListener?.("change", updateTouchInput);
    return () => coarseQuery.removeEventListener?.("change", updateTouchInput);
  }, []);
  useEffect(() => {
    const preventCallout = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      e.preventDefault();
    };
    window.addEventListener("contextmenu", preventCallout, { passive: false });
    window.addEventListener("selectstart", preventCallout, { passive: false });
    return () => {
      window.removeEventListener("contextmenu", preventCallout);
      window.removeEventListener("selectstart", preventCallout);
    };
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    shellRef.current?.requestFullscreen?.();
  };

  const restart = () => {
    setResult(null);
    setCompletedResult(null);
    setIsResultDismissed(false);
    setSparkHud({ score: 0, voltage: 100, speed: 2.6 });
    setRunMastery(runMasteryFor(highScore, dailyDifficulty));
    setStarted(true);
    setRunKey(value => value + 1);
    trackEvent("retry_game", { game: game.id });
  };
  const continueToNext = () => {
    setResult(null);
    setCompletedResult(null);
    setIsResultDismissed(false);
    setFailureCount(0);
    onNextLevel();
    trackEvent("next_level", { game: game.id });
  };

  const finish = useCallback((next: GameResult) => {
    const finalScore = scoreFor(game.id, next.score);
    const isArcadeScoreGame = ARCADE_DYNAMIC_GAME_IDS.includes(game.id);

    if (next.outcome === "success" || (isArcadeScoreGame && finalScore > 0)) {
      onScore(finalScore);
    }
    setFailureCount(current => next.outcome === "failure" ? current + 1 : 0);
    const fullResult = { ...next, score: finalScore };
    setResult(fullResult);
    setCompletedResult(fullResult);
    setIsResultDismissed(false);
    trackEvent("game_finish", { game: game.id, outcome: next.outcome });
  }, [game.id, onScore]);

  return (
    <main ref={shellRef} className={`studio-shell ${dynamicStageActive ? "studio-shell-dynamic" : ""} ${sparkActive ? "studio-shell-spark" : ""} ${breaklineStageActive ? "studio-shell-breakline-active" : ""} ${coilStageActive ? "studio-shell-coil-active" : ""} ${apexStageActive ? "studio-shell-apex-active" : ""} ${liftStageActive ? "studio-shell-lift-active" : ""}`} lang={locale} style={{ "--game-accent": game.accent, "--game-ink": game.ink } as React.CSSProperties}>
      <header className="studio-topbar">
        <button className="back-button" onClick={onBack} aria-label={locale === "en" ? "Return to game catalogue" : "Oyun kataloğuna dön"}><ArrowLeft size={18} /> {locale === "en" ? "Catalogue" : "Katalog"}</button>
        <div className="studio-title">
          {sparkActive && sparkHud ? (
            <div className="spark-topbar-hud" aria-live="polite">
              <div className="spark-topbar-cell">
                <span className="spark-topbar-label">{locale === "en" ? "SCORE" : "SKOR"}</span>
                <b className="spark-topbar-val spark-val-score">{sparkHud.score}</b>
              </div>
              <div className="spark-topbar-cell">
                <span className="spark-topbar-label">{locale === "en" ? "VOLTAGE" : "VOLTAJ"}</span>
                <b className="spark-topbar-val spark-val-voltage">%{sparkHud.voltage}</b>
              </div>
              <div className="spark-topbar-cell">
                <span className="spark-topbar-label">{locale === "en" ? "SPEED" : "HIZ"}</span>
                <b className="spark-topbar-val">{sparkHud.speed}x</b>
              </div>
              <div className="spark-topbar-cell">
                <span className="spark-topbar-label">{locale === "en" ? "GRID" : "ŞEBEKE"}</span>
                <b className="spark-topbar-val">{locale === "en" ? "ARC" : "ARK"}</b>
              </div>
            </div>
          ) : coilStageActive ? (
            <div className="coil-topbar-hud">
              <div className="coil-topbar-cell">
                <span className="coil-topbar-label">{locale === "en" ? "SCORE" : "PUAN"}</span>
                <b className="coil-topbar-val">{coilHud.score.toLocaleString(locale === "en" ? "en-US" : "tr-TR")}</b>
              </div>
              <div className="coil-topbar-cell">
                <span className="coil-topbar-label">{locale === "en" ? "PACE" : "TEMPO"}</span>
                <b className="coil-topbar-val">{coilHud.pace}</b>
              </div>
            </div>
          ) : apexStageActive ? (
            <div className="apex-topbar-hud">
              <div className="apex-topbar-cell">
                <span className="apex-topbar-label">{locale === "en" ? "SCORE" : "PUAN"}</span>
                <b className="apex-topbar-val">{apexHud.score.toLocaleString(locale === "en" ? "en-US" : "tr-TR")}</b>
              </div>
              <div className="apex-topbar-cell">
                <span className="apex-topbar-label">{locale === "en" ? "SPEED" : "HIZ"}</span>
                <b className="apex-topbar-val apex-speed-val">{apexHud.speed} <small>km/h</small></b>
              </div>
              <div className="apex-topbar-cell">
                <span className="apex-topbar-label">{locale === "en" ? "NEAR MISS" : "MAKAS"}</span>
                <b className="apex-topbar-val">{apexHud.combo > 0 ? `${apexHud.combo}×` : "—"}</b>
              </div>
            </div>
          ) : liftStageActive ? (
            <div className="lift-topbar-hud">
              <div className="lift-topbar-cell">
                <span className="lift-topbar-label">{locale === "en" ? "ALTITUDE" : "YÜKSEKLİK"}</span>
                <b className="lift-topbar-val">{liftHud.altitude.toLocaleString(locale === "en" ? "en-US" : "tr-TR")}</b>
              </div>
            </div>
          ) : breaklineStageActive ? (
            <div className="breakline-topbar-hud">
              {breaklineHud && <>
                <div className="breakline-topbar-cell breakline-pattern-cell">
                  <span className="breakline-topbar-label">{locale === "en" ? "PATTERN" : "DÜZEN"}</span>
                  <b className="breakline-topbar-val">{String(breaklineHud.stage).padStart(2, "0")} / {String(breaklineHud.stages).padStart(2, "0")}</b>
                  {breaklineHud.pattern && <small>{breaklineHud.pattern}</small>}
                </div>
                <div className="breakline-topbar-cell">
                  <span className="breakline-topbar-label">{locale === "en" ? "SCORE" : "PUAN"}</span>
                  <b className="breakline-topbar-val">{breaklineHud.score.toLocaleString(locale === "en" ? "en-US" : "tr-TR")}</b>
                </div>
                <div className="breakline-topbar-cell">
                  <span className="breakline-topbar-label">{locale === "en" ? "LIVES" : "CAN"}</span>
                  <b className="breakline-topbar-val breakline-lives-val">{"●".repeat(breaklineHud.lives)}{"○".repeat(Math.max(0, 3 - breaklineHud.lives))}</b>
                </div>
              </>}
            </div>
          ) : (
            <>
              <span>{game.number}</span>
              <strong>{game.title}</strong>
              <em>{game.eyebrow}</em>
            </>
          )}
        </div>
        <div className="studio-actions">
          {isResultDismissed && completedResult && (
            <>
              {resultActionsFor(completedResult.outcome, failureCount, game.id).canAdvance && (
                <button
                  type="button"
                  className="ink-button studio-advance-mini-btn"
                  onClick={continueToNext}
                  title={locale === "en" ? "Advance to next level" : "Sonraki seviyeye geç"}
                >
                  {completedResult.outcome === "success"
                    ? (locale === "en" ? "Next Level →" : "Sonraki Seviye →")
                    : (locale === "en" ? "Next Route →" : "Sonraki Rota →")}
                </button>
              )}
              {resultActionsFor(completedResult.outcome, failureCount, game.id).canRetry && !resultActionsFor(completedResult.outcome, failureCount, game.id).canAdvance && (
                <button
                  type="button"
                  className="ink-button studio-advance-mini-btn"
                  onClick={restart}
                  title={locale === "en" ? "Try again" : "Tekrar dene"}
                >
                  {locale === "en" ? "Retry ↺" : "Tekrar Dene ↺"}
                </button>
              )}
            </>
          )}
          <span className="best-score">{locale === "en" ? "BEST" : "EN İYİ"} <b>{highScore.toLocaleString(locale === "en" ? "en-US" : "tr-TR")}</b></span>
          <button className="icon-button" onClick={onToggleSound} aria-label={soundOn ? (locale === "en" ? "Mute sound" : "Sesi kapat") : (locale === "en" ? "Enable sound" : "Sesi aç")}><Volume2 size={18} className={soundOn ? "" : "sound-muted"} /></button>
          <div className="studio-info-wrap">
            <button
              type="button"
              className="icon-button"
              aria-label={locale === "en" ? "Show controls" : "Kontrolleri göster"}
              aria-expanded={infoOpen}
              onClick={() => setInfoOpen(value => !value)}
            >
              <Info size={18} />
            </button>
            {infoOpen && (
              <div className="studio-info-popover" role="dialog" aria-label={locale === "en" ? "Game controls" : "Oyun kontrolleri"}>
                <strong>{locale === "en" ? "HOW TO PLAY" : "NASIL OYNANIR"}</strong>
                <p>{controlHelp(game.id, locale, hasTouchInput)}</p>
                <small>
                  {hasTouchInput
                    ? locale === "en" ? "TOUCH: tap, drag or swipe." : "DOKUNMATİK: dokun, sürükle veya kaydır."
                    : locale === "en" ? "PC: use the keyboard and mouse." : "PC: klavye ve mouse kullanın."}
                </small>
              </div>
            )}
          </div>
          <button className="icon-button" onClick={toggleFullscreen} aria-label={isFullscreen ? (locale === "en" ? "Exit fullscreen" : "Tam ekrandan çık") : (locale === "en" ? "Enter fullscreen" : "Tam ekrana al")}>{isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}</button>
        </div>
      </header>

      <section className={`game-stage-wrap ${dynamicStageActive ? "dynamic-stage-wrap" : ""} ${sparkActive ? "spark-stage-wrap" : ""} ${breaklineStageActive ? "breakline-stage-wrap" : ""} ${coilStageActive ? "coil-stage-wrap" : ""} ${apexStageActive ? "apex-stage-wrap" : ""} ${liftStageActive ? "lift-stage-wrap" : ""}`}>
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
          <div
            className={`game-stage ${dynamicStageActive ? "game-stage-dynamic" : ""} ${sparkActive ? "game-stage-spark" : ""} ${coilStageActive ? "coil-game-stage" : ""} ${apexStageActive ? "apex-game-stage" : ""} ${liftStageActive ? "lift-game-stage" : ""}`}
            onContextMenu={event => { if (!isEditableGameTarget(event.target)) event.preventDefault(); }}
            onCopy={event => { if (!isEditableGameTarget(event.target)) event.preventDefault(); }}
            onCut={event => { if (!isEditableGameTarget(event.target)) event.preventDefault(); }}
            onDragStart={event => { if (!isEditableGameTarget(event.target)) event.preventDefault(); }}
          >
            {isResultDismissed && completedResult && (
              <div className="stage-completion-dock" role="status" aria-live="polite">
                <div className="stage-completion-lead">
                  <span className={`completion-dot ${completedResult.outcome === "success" ? "is-success" : "is-fail"}`}>
                    {completedResult.outcome === "success" ? "✓" : "!"}
                  </span>
                  <div className="completion-copy">
                    <strong>{completedResult.label}</strong>
                    <span>
                      {locale === "en" ? "Score: " : "Skor: "}
                      <b>{completedResult.score.toLocaleString(locale === "en" ? "en-US" : "tr-TR")}</b>
                    </span>
                  </div>
                </div>
                <div className="stage-completion-controls">
                  <button
                    type="button"
                    className="quiet-button dock-btn"
                    onClick={() => {
                      setResult(completedResult);
                      setIsResultDismissed(false);
                    }}
                  >
                    {locale === "en" ? "Scorecard" : "Sonuç Kartı"}
                  </button>
                  {resultActionsFor(completedResult.outcome, failureCount, game.id).canRetry && (
                    <button type="button" className="quiet-button dock-btn" onClick={restart}>
                      <RotateCcw size={14} /> {locale === "en" ? "Retry" : "Tekrar Dene"}
                    </button>
                  )}
                  {resultActionsFor(completedResult.outcome, failureCount, game.id).canAdvance && (
                    <button type="button" className="ink-button dock-btn is-advance" onClick={continueToNext}>
                      {completedResult.outcome === "success"
                        ? (locale === "en" ? "Next Level" : "Sonraki Seviyeye Geç")
                        : (locale === "en" ? "Next Route" : "Sonraki Rota")} <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              </div>
            )}
            <GameRenderer
              key={runKey}
              game={game}
              locale={locale}
              dailySeed={
                game.id === "spark"
                  ? ((dailySeed ^ ((runKey + 1) * 0x1f351f) ^ Math.imul(runKey + 7, 0x9e3779b9)) >>> 0)
                  : game.id === "hane"
                  ? (runKey === 0 ? dailySeed : ((dailySeed ^ ((runKey + 1) * 0x27d4eb2d) ^ Math.imul(runKey + 13, 0x1000193)) >>> 0))
                  : runKey === 0
                  ? dailySeed
                  : ((dailySeed ^ ((runKey + 1) * 0x45d9f3b) ^ Math.imul(runKey + 19, 0x9e3779b9)) >>> 0)
              }
              mastery={runMastery}
              demo={demo}
              soundOn={soundOn}
              onFinish={finish}
              onSparkHudChange={setSparkHud}
              onCoilHudChange={setCoilHud}
              onApexHudChange={setApexHud}
              onLiftHudChange={setLiftHud}
              onBreaklineHudChange={setBreaklineHud}
            />
            {result && (
              <div className="result-panel" role="dialog" aria-modal="true" aria-label={locale === "en" ? "Run result" : "Tur sonucu"}>
                <button className="result-close" onClick={() => { setResult(null); setIsResultDismissed(true); }} aria-label={locale === "en" ? "Close result" : "Sonucu kapat"}><X size={18} /></button>
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
                  <button className="ink-button ink-button-share" onClick={() => setShareOpen(true)}>{locale === "en" ? "Share score" : "Skoru paylaş"} <Share2 size={16} /></button>
                  {!ARCADE_DYNAMIC_GAME_IDS.includes(game.id) && <button className="quiet-button" onClick={onBack}>{locale === "en" ? "Choose a route" : "Rota seç"}</button>}
                </div>
                {result.outcome === "failure" && failureCount >= 3 && resultActionsFor(result.outcome, failureCount, game.id).canAdvance && <p className="result-nudge">{locale === "en" ? "A new route is available after three attempts." : "Üç denemeden sonra yeni rota açıldı."}</p>}
                {/* AdSense disabled on sely.tr (Vercel Hobby's fair-use terms treat ad-monetized
                    deployments as commercial usage). Kept for self-hosters who deploy on their
                    own infra/Pro plan and want it back — uncomment and set the AdSense env vars. */}
                {/* <AdSenseResultUnit locale={locale} /> */}
                {shareOpen && (
                  <ShareResultModal
                    isOpen={shareOpen}
                    onClose={() => setShareOpen(false)}
                    data={{
                      gameId: game.id,
                      gameTitle: game.title,
                      score: result.score,
                      nick: getPlayerNick(locale),
                      outcome: result.outcome === "success" ? "success" : "failure",
                      locale,
                    }}
                  />
                )}
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
const KnotGame = lazy(() => import("@/components/games/KnotGame"));
const CutGame = lazy(() => import("@/components/games/CutGame"));
const ShadowGame = lazy(() => import("@/components/games/ShadowGame"));
const HaneGame = lazy(() => import("@/components/games/HaneGame"));
const SparkCanvasGame = lazy(() => import("@/components/SparkCanvasGame"));
const VakaGame = lazy(() => import("@/components/games/VakaGame"));
const AsteroidsGame = lazy(() => import("@/components/games/AsteroidsGame"));
const SokobanGame = lazy(() => import("@/components/games/SokobanGame"));
const TetrisGame = lazy(() => import("@/components/games/TetrisGame"));
const LanderGame = lazy(() => import("@/components/games/LanderGame"));
const LightsOutGame = lazy(() => import("@/components/games/LightsOutGame"));
const Game2048 = lazy(() => import("@/components/games/Game2048"));
const CoilGame = lazy(() => import("@/components/games/CoilGame"));
const ApexGame = lazy(() => import("@/components/games/ApexGame"));
const LiftGame = lazy(() => import("@/components/games/LiftGame"));
const BreaklineGame = lazy(() => import("@/components/games/BreaklineGame"));

function GameRenderer({ game, locale, dailySeed, mastery, demo, soundOn, onFinish, onSparkHudChange, onCoilHudChange, onApexHudChange, onLiftHudChange, onBreaklineHudChange }: { game: GameMeta; locale: SiteLocale; dailySeed: number; mastery: number; demo?: "spark" | "spark-fail" | "cut-fail"; soundOn: boolean; onFinish: (result: GameResult) => void; onSparkHudChange?: (hud: { score: number; voltage: number; speed: number }) => void; onCoilHudChange?: (hud: CoilHud) => void; onApexHudChange?: (hud: ApexHud) => void; onLiftHudChange?: (hud: LiftHud) => void; onBreaklineHudChange?: (hud: BreaklineHud) => void }) {
  const loading = <div className="game-surface game-loading">{local(locale, "Oyun yükleniyor…", "Loading game…")}</div>;

  return (
    <Suspense fallback={loading}>
      {game.id === "echo" && <EchoRoom3D locale={locale} seed={dailySeed} mastery={mastery} onFinish={onFinish} />}
      {game.id === "knot" && <KnotGame locale={locale} seed={dailySeed} mastery={mastery} soundOn={soundOn} onFinish={onFinish} />}
      {game.id === "cut" && <CutGame locale={locale} seed={dailySeed} mastery={mastery} demo={demo === "cut-fail"} soundOn={soundOn} onFinish={onFinish} />}
      {game.id === "shadow" && <ShadowGame locale={locale} seed={dailySeed} mastery={mastery} soundOn={soundOn} onFinish={onFinish} />}
      {game.id === "hane" && <HaneGame locale={locale} seed={dailySeed} mastery={mastery} onFinish={onFinish} />}
      {game.id === "spark" && <SparkCanvasGame locale={locale} seed={dailySeed} mastery={mastery} demo={demo === "spark" ? "success" : demo === "spark-fail" ? "fail" : undefined} soundOn={soundOn} onFinish={onFinish} onHudChange={onSparkHudChange} />}
      {game.id === "vaka" && <VakaGame locale={locale} seed={dailySeed} mastery={mastery} soundOn={soundOn} onFinish={onFinish} />}
      {game.id === "asteroids" && <AsteroidsGame locale={locale} seed={dailySeed} mastery={mastery} soundOn={soundOn} onFinish={onFinish} />}
      {game.id === "sokoban" && <SokobanGame locale={locale} seed={dailySeed} mastery={mastery} soundOn={soundOn} onFinish={onFinish} />}
      {game.id === "tetris" && <TetrisGame locale={locale} seed={dailySeed} mastery={mastery} soundOn={soundOn} onFinish={onFinish} />}
      {game.id === "lander" && <LanderGame locale={locale} seed={dailySeed} mastery={mastery} soundOn={soundOn} onFinish={onFinish} />}
      {game.id === "lightsout" && <LightsOutGame locale={locale} seed={dailySeed} mastery={mastery} soundOn={soundOn} onFinish={onFinish} />}
      {game.id === "game2048" && <Game2048 locale={locale} seed={dailySeed} mastery={mastery} soundOn={soundOn} onFinish={onFinish} />}
      {game.id === "coil" && <CoilGame locale={locale} seed={dailySeed} mastery={mastery} soundOn={soundOn} onFinish={onFinish} onHudChange={onCoilHudChange} />}
      {game.id === "apex" && <ApexGame locale={locale} seed={dailySeed} mastery={mastery} soundOn={soundOn} onFinish={onFinish} onHudChange={onApexHudChange} />}
      {game.id === "lift" && <LiftGame locale={locale} seed={dailySeed} mastery={mastery} soundOn={soundOn} onFinish={onFinish} onHudChange={onLiftHudChange} />}
      {game.id === "breakline" && <BreaklineGame locale={locale} seed={dailySeed} mastery={mastery} soundOn={soundOn} onFinish={onFinish} onHudChange={onBreaklineHudChange} />}
    </Suspense>
  );
}
