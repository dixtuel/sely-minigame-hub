import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Maximize, Minimize, RotateCcw, Share2, Volume2, X } from "lucide-react";
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
  type GameResult,
  type ResultOutcome,
  type Position,
} from "@/components/games/shared";

export { runMasteryFor, resultActionsFor, type GameResult, type ResultOutcome, type Position };

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
    if (next.outcome === "success" || game.id === "spark") onScore(finalScore);
    setFailureCount(current => next.outcome === "failure" ? current + 1 : 0);
    const fullResult = { ...next, score: finalScore };
    setResult(fullResult);
    setCompletedResult(fullResult);
    setIsResultDismissed(false);
    trackEvent("game_finish", { game: game.id, outcome: next.outcome });
  }, [game.id, onScore]);

  return (
    <main ref={shellRef} className={`studio-shell ${sparkActive ? "studio-shell-spark" : ""}`} lang={locale} style={{ "--game-accent": game.accent, "--game-ink": game.ink } as React.CSSProperties}>
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
            <GameRenderer key={runKey} game={game} locale={locale} dailySeed={game.id === "spark" ? ((dailySeed ^ ((runKey + 1) * 0x1f351f) ^ Math.imul(runKey + 7, 0x9e3779b9)) >>> 0) : game.id === "hane" ? (runKey === 0 ? dailySeed : ((dailySeed ^ ((runKey + 1) * 0x27d4eb2d) ^ Math.imul(runKey + 13, 0x1000193)) >>> 0)) : dailySeed} mastery={runMastery} demo={demo} soundOn={soundOn} onFinish={finish} onSparkHudChange={setSparkHud} />
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
                  <button className="quiet-button" onClick={onBack}>{locale === "en" ? "Choose a route" : "Rota seç"}</button>
                </div>
                {game.id !== "spark" && result.outcome === "failure" && failureCount >= 3 && <p className="result-nudge">{locale === "en" ? "A new route is available after three attempts." : "Üç denemeden sonra yeni rota açıldı."}</p>}
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

function GameRenderer({ game, locale, dailySeed, mastery, demo, soundOn, onFinish, onSparkHudChange }: { game: GameMeta; locale: SiteLocale; dailySeed: number; mastery: number; demo?: "spark" | "spark-fail" | "cut-fail"; soundOn: boolean; onFinish: (result: GameResult) => void; onSparkHudChange?: (hud: { score: number; voltage: number; speed: number }) => void }) {
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
    </Suspense>
  );
}
