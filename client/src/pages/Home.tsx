import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CircleHelp, Cookie, Gamepad2, History, Layers, Menu, ShieldCheck, Sparkles, Trophy, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useCookieConsent } from "@/contexts/CookieConsentContext";
import { trpc } from "@/lib/trpc";
import { getGameCatalog, type GameId, type GameMeta } from "@/lib/catalog";
import { copy, localePath, rememberLocale, type SiteLocale } from "@/lib/i18n";
import { masteryBand, personalSeed, runInstanceKey } from "@/lib/levelGenerators";
import { trackEvent } from "@/lib/analytics";
import { getPlayerNick, getPlayerSignature, getTodayDateStr } from "@/lib/playerNick";
import { secureStorage } from "@/lib/secureStorage";
import LeaderboardModal from "@/components/LeaderboardModal";
import ArchiveHubModal from "@/components/ArchiveHubModal";
import GlobalAnnouncementBanner from "@/components/GlobalAnnouncementBanner";
import PwaInstallBanner from "@/components/PwaInstallBanner";

const GameStudio = lazy(() => import("@/components/GameStudio"));
const SCORE_KEY = "sely-scorebook-v1";
type ScoreBook = Record<GameId, number>;
type RunSource = "daily" | "personal";
const FEATURED_GAME_IDS: GameId[] = ["echo", "vaka", "tetris", "spark"];
type SelectedRun = { game: GameMeta; source: RunSource; attempt: number; autoStart?: boolean; demo?: "spark" | "spark-fail" | "cut-fail"; mastery: number };
const blankScores: ScoreBook = {
  echo: 0,
  knot: 0,
  cut: 0,
  shadow: 0,
  vaka: 0,
  hane: 0,
  spark: 0,
  asteroids: 0,
  sokoban: 0,
  tetris: 0,
  lander: 0,
  lightsout: 0,
  game2048: 0,
  coil: 0,
  apex: 0,
  lift: 0,
  breakline: 0,
};

export default function Home({ locale = "tr", directGameId }: { locale?: SiteLocale; directGameId?: string }) {
  const words = copy[locale];
  const catalog = getGameCatalog(locale);
  // The daily-content cron is the source of truth. Fetch again only when the
  // cached package is stale; never poll the serverless function continuously.
  const daily = trpc.daily.today.useQuery(undefined, {
    staleTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 1,
  });
  const dailyFeaturedIds = daily.data?.featuredGameIds?.length ? daily.data.featuredGameIds : FEATURED_GAME_IDS;
  const recommendedGame = catalog.find((game) => game.id === dailyFeaturedIds[0]) ?? catalog[0];
  const featuredGames = useMemo(
    () => {
      const rotatingGames = dailyFeaturedIds
        .slice(1)
        .map(id => catalog.find(game => game.id === id))
        .filter(Boolean) as GameMeta[];
      const fillerGame = catalog.find(
        game => game.id !== recommendedGame.id && !dailyFeaturedIds.includes(game.id),
      );
      return [...rotatingGames, ...(fillerGame ? [fillerGame] : [])];
    },
    [catalog, dailyFeaturedIds, recommendedGame.id]
  );
  const otherGames = useMemo(
    () => catalog.filter(game => !featuredGames.some(featured => featured.id === game.id)),
    [catalog, featuredGames]
  );
  const [, navigate] = useLocation();
  const { openBanner } = useCookieConsent();
  const [selected, setSelected] = useState<SelectedRun | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scores, setScores] = useState<ScoreBook>(blankScores);
  const [personalAttempts, setPersonalAttempts] = useState<ScoreBook>(blankScores);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = secureStorage.getJSON(SCORE_KEY, blankScores);
      if (stored) setScores({ ...blankScores, ...stored });
    } catch { /* Local scores are optional. */ }
  }, []);
  useEffect(() => {
    if (!daily.data || selected) return;
    const query = new URLSearchParams(window.location.search);
    const requestedId = directGameId ?? (query.get("play") === "daily" ? query.get("game") : null);
    const game = catalog.find(item => item.id === requestedId);
    const demo = game?.id === "spark" && query.get("demo") === "1" ? "spark" : game?.id === "spark" && query.get("demo") === "fail" ? "spark-fail" : game?.id === "cut" && query.get("demo") === "fail" ? "cut-fail" : undefined;
    if (game) setSelected({ game, source: "personal", attempt: 0, autoStart: true, demo, mastery: masteryBand(scores[game.id] ?? 0) });
  }, [catalog, daily.data, directGameId, scores, selected]);

  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const todayStr = useMemo(() => getTodayDateStr(), []);
  const playerNick = useMemo(() => getPlayerNick(locale, todayStr), [locale, todayStr]);

  const saveScore = useCallback((gameId: GameId, score: number) => {
    let updatedScores: Record<GameId, number> | null = null;
    setScores(previous => {
      const next = { ...previous, [gameId]: Math.max(previous[gameId], score) };
      updatedScores = next;
      try { secureStorage.setJSON(SCORE_KEY, next); } catch { /* Local storage may be disabled. */ }
      return next;
    });

    // 1. Submit individual game score
    getPlayerSignature(gameId, todayStr).then(signature => {
      fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gameId,
          score,
          nick: playerNick,
          signature,
        }),
      }).catch(() => {});
    });

    // 2. Submit overall cumulative score to 'all' leaderboard
    setTimeout(() => {
      const currentSnapshot = updatedScores || scores;
      const totalScore = Object.values(currentSnapshot).reduce((sum, val) => sum + (typeof val === "number" ? val : 0), 0);
      if (totalScore > 0) {
        getPlayerSignature("all" as GameId, todayStr).then(allSig => {
          fetch("/api/leaderboard", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              gameId: "all",
              score: totalScore,
              nick: playerNick,
              signature: allSig,
            }),
          }).catch(() => {});
        });
      }
    }, 200);
  }, [playerNick, scores, todayStr]);

  // Günlük/kişisel rota ayrımı UI'dan kaldırıldı — tek "Oyna" akışı, ilk denemenin seed tabanı
  // olarak yine günün paketini (dailyPack?.seed) kullanır, böylece gün-be-gün çeşitlilik sürer.
  const dailyPack = selected ? daily.data?.games.find(game => game.gameId === selected.game.id) : undefined;
  const selectedMastery = selected ? selected.mastery : 1;
  const activeSeed = selected ? personalSeed(dailyPack?.seed ?? 618_071, selected.game.id, selectedMastery, selected.attempt) : 0;
  const activeDifficulty = selected ? selectedMastery : 1;
  const totalBest = useMemo(() => Object.values(scores).reduce((total, value) => total + value, 0), [scores]);
  const otherLocale: SiteLocale = locale === "tr" ? "en" : "tr";
  const startGame = (game: GameMeta) => {
    const attempt = (personalAttempts[game.id] ?? 0) + 1;
    setPersonalAttempts(previous => ({ ...previous, [game.id]: attempt }));
    setSelected({ game, source: "personal", attempt, mastery: masteryBand(scores[game.id] ?? 0) });
    navigate(locale === "en" ? `/en/play/${game.id}` : `/play/${game.id}`);
    trackEvent("play_game", { game: game.id });
  };
  const continueToNextLevel = () => {
    if (!selected) return;
    const attempt = Math.max(1, selected.attempt + 1);
    setPersonalAttempts(previous => ({ ...previous, [selected.game.id]: Math.max(previous[selected.game.id], attempt) }));
    setSelected({ ...selected, source: "personal", attempt, autoStart: true, demo: undefined, mastery: masteryBand(scores[selected.game.id] ?? 0) });
    trackEvent("next_level", { game: selected.game.id });
  };

  const handleScore = useCallback((score: number) => {
    if (selected) saveScore(selected.game.id, score);
  }, [selected, saveScore]);

  if (selected) {
    const runIdentity = runInstanceKey(selected.game.id, selected.source, selected.attempt, activeSeed);
    return <Suspense fallback={<main className="hub-page game-loading" aria-live="polite">{locale === "en" ? "Opening edition…" : "Baskı açılıyor…"}</main>}><GameStudio key={runIdentity} game={selected.game} locale={locale} autoStart={selected.autoStart} demo={selected.demo} dailySeed={activeSeed} dailyDifficulty={activeDifficulty} highScore={scores[selected.game.id]} soundOn={soundOn} onToggleSound={() => setSoundOn(value => !value)} onBack={() => { setSelected(null); navigate(localePath(locale)); trackEvent("back_to_catalog", { game: selected.game.id }); }} onNextLevel={continueToNextLevel} onScore={handleScore} /></Suspense>;
  }

  return <main className="hub-page" lang={locale}>
    <GlobalAnnouncementBanner locale={locale} />
    <header className="hub-nav">
      <a className="brand-lockup" href="#top" aria-label="SELY.TR home"><img src="/storage/sely-mark_de9c08a5.png" alt="" width="31" height="31" decoding="async" /><span>SELY<span className="brand-dot">.</span>TR</span></a>
      <nav className={menuOpen ? "nav-links is-open" : "nav-links"} aria-label={locale === "en" ? "Main navigation" : "Ana gezinme"}><a href="#games" onClick={() => setMenuOpen(false)}>{words.games}</a><a href="#daily" onClick={() => setMenuOpen(false)}>{words.daily}</a></nav>
      <div className="nav-actions">
        <button
          type="button"
          className="player-codetag-btn"
          onClick={() => { setIsLeaderboardOpen(true); trackEvent("open_leaderboard_from_nick"); }}
          title={locale === "en" ? "Today's anonymous codename (Click to view leaderboard)" : "Günün anonim kod adı (Liderlik tablosunu gör)"}
        >
          <span className="player-codetag-icon">●</span>
          <span className="player-codetag-name">{playerNick}</span>
        </button>
        <button
          type="button"
          className="nav-score-btn"
          onClick={() => { setIsLeaderboardOpen(true); trackEvent("open_leaderboard_from_score"); }}
          title={locale === "en" ? "Total score (Click to view leaderboard)" : "Toplam puan (Liderlik tablosunu gör)"}
        >
          <Trophy size={13} className="nav-score-trophy" />
          <span>{totalBest.toLocaleString(locale === "en" ? "en-US" : "tr-TR")}</span>
        </button>
        <button className="locale-button" onClick={() => { rememberLocale(otherLocale); navigate(localePath(otherLocale)); trackEvent("change_locale", { locale: otherLocale }); }}>{words.language}</button>
        <button className="menu-button" onClick={() => setMenuOpen(value => !value)} aria-label={locale === "en" ? "Open or close menu" : "Menüyü aç veya kapat"}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
      </div>
    </header>
    <section className="masthead" id="top"><div className="masthead-rail"><span>SELY / {locale === "en" ? "MINI GAME CATALOGUE" : "MİNİ OYUN KATALOĞU"}</span><i /><span>EDITION 01</span></div><div className="masthead-copy"><span className="studio-kicker">{words.mastheadKicker}</span><h1>{words.mastheadLead}<br /><em>{words.mastheadEmphasis}</em> {words.mastheadEnd}</h1><p>{words.mastheadDescription}</p><a className="hero-link" href="#games">{words.catalog} <ArrowUpRight size={18} /></a></div><div className="masthead-stamp"><img src="/storage/sely-mark_de9c08a5.png" alt="" width="68" height="68" loading="lazy" decoding="async" /><span>{locale === "en" ? <>ORIGINAL<br />GAME<br />EXPERIMENTS</> : <>ÖZGÜN<br />OYUN<br />DENEYLERİ</>}</span></div></section>
    <section className="featured-block" id="daily"><div className="section-index"><span>{words.today}</span><b>{daily.data?.date ?? "…"}</b></div><article className="featured-poster"><img src={recommendedGame.poster} alt={`${recommendedGame.title} game poster`} fetchPriority="high" decoding="async" /><div className="featured-overlay"><span>{recommendedGame.number} / {words.todayStart}</span><h2>{recommendedGame.title}</h2><p>{recommendedGame.mechanic}</p><button onClick={() => startGame(recommendedGame)}>{words.enter} <ArrowUpRight size={18} /></button></div><div className="poster-number">{recommendedGame.number}</div></article><aside className="daily-note"><span className="note-mark">✳</span><span className="daily-set-label">{words.dailySet}</span><h3 className="daily-recommendation-title">{recommendedGame.title}</h3><p className="daily-recommendation-motto">{recommendedGame.motto}</p><p className="daily-recommendation-mechanic">{recommendedGame.mechanic}</p><button className="daily-play-button" onClick={() => startGame(recommendedGame)}>{words.enter} <ArrowUpRight size={16} /></button><div><History size={16} /><span>{daily.isLoading ? words.dailyLoading : `${recommendedGame.playTime} · ${daily.data?.date ?? words.dailyReady}`}</span></div></aside></section>
    <section className="catalog-section" id="games"><div className="catalog-heading"><span className="studio-kicker">{words.catalogKicker}</span><h2>{words.catalogLead}<br /><em>{words.catalogEmphasis}</em></h2><p>{words.catalogDescription}</p><div className="personal-note"><span>{words.personalKicker}</span><p>{words.personalDescription}</p></div></div><div className="catalog-grid">{featuredGames.map((game, index) => <GameCard key={game.id} game={game} locale={locale} score={scores[game.id]} mastery={masteryBand(scores[game.id])} index={index} displayNumber={String(index + 1).padStart(2, "0")} onPlay={() => startGame(game)} />)}<MoreGamesCard count={otherGames.length} games={otherGames} locale={locale} index={featuredGames.length} onOpen={() => { setIsArchiveOpen(true); trackEvent("open_archive_from_card"); }} /></div></section>
    <section className="principles"><div className="principle-icon"><Gamepad2 size={26} /></div><div><span className="studio-kicker">{words.rhythmKicker}</span><h2>{words.rhythmLead}<br />{words.rhythmBottom}</h2></div><p>{words.rhythmDescription}</p><a href="#daily">{words.backToDaily} <ArrowUpRight size={17} /></a></section>
    <footer className="hub-footer"><div><a className="brand-lockup" href="#top"><img src="/storage/sely-mark_de9c08a5.png" alt="" width="31" height="31" loading="lazy" decoding="async" /><span>SELY<span className="brand-dot">.</span>TR</span></a><p>{words.footerDescription}</p></div><div className="footer-links"><Link href={localePath(locale, "/privacy")}><ShieldCheck size={15} /> {words.privacy}</Link><Link href={localePath(locale, "/terms")}><CircleHelp size={15} /> {words.terms}</Link><Link href={localePath(locale, "/accessibility")}>{words.accessibility}</Link><button type="button" className="footer-link-button" onClick={() => { openBanner(); trackEvent("open_cookie_settings"); }}><Cookie size={14} /> {locale === "en" ? "Cookie Settings" : "Çerez Ayarları"}</button></div><div className="footer-credit"><a href="https://dixtuel.tr/" target="_blank" rel="noreferrer">Made by <strong>dixtuel</strong> + <em>kiyici ;)</em><ArrowUpRight size={14} /></a><small>© 2026 SELY.TR · {words.titleSuffix}</small></div></footer>
    <LeaderboardModal
      isOpen={isLeaderboardOpen}
      onClose={() => setIsLeaderboardOpen(false)}
      locale={locale}
      userScores={scores}
    />
    <ArchiveHubModal
      isOpen={isArchiveOpen}
      onClose={() => setIsArchiveOpen(false)}
      locale={locale}
      games={otherGames}
      scores={scores}
      onPlayGame={startGame}
    />
    {/* PWA Install Banner is ready with cross-platform support (Desktop Chromium, Windows/Linux Firefox, iOS Safari, Android) but kept disabled by default */}
    <PwaInstallBanner locale={locale} enabled={false} />
  </main>;
}

function GameCard({ game, score, mastery, index, displayNumber, locale, onPlay }: { game: GameMeta; score: number; mastery: number; index: number; displayNumber: string; locale: SiteLocale; onPlay: () => void }) {
  const words = copy[locale];
  return <article className={`game-card card-${game.id}`} style={{ "--card-accent": game.accent, "--stagger": `${index * 0.04}s` } as React.CSSProperties}><div className="card-art"><img src={game.poster} alt={`${game.title} game poster`} loading="lazy" decoding="async" /><span className="card-number">{displayNumber}</span><span className="card-edge" /></div><div className="card-content"><div><span className="card-eyebrow">{game.eyebrow}</span><h3>{game.title}</h3></div><p>{game.mechanic}</p><div className="card-meta"><span>{game.playTime}</span><span>{words.mastery} {mastery}/4</span><span>{words.best} {score.toLocaleString(locale === "en" ? "en-US" : "tr-TR")}</span></div><div className="card-actions"><button onClick={onPlay}>{words.playLabel} <ArrowUpRight size={16} /></button></div></div></article>;
}

function MoreGamesCard({
  count,
  games,
  locale,
  index,
  onOpen,
}: {
  count: number;
  games: GameMeta[];
  locale: SiteLocale;
  index: number;
  onOpen: () => void;
}) {
  const words = copy[locale];
  return (
    <article
      className="game-card card-more-games"
      style={{ "--card-accent": "var(--indigo)", "--stagger": `${index * 0.04}s` } as React.CSSProperties}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`${words.moreGames}: +${count}`}
    >
      <div className="card-art">
        <img
          src="/storage/more-games-poster_e274e5a3.jpg"
          alt="More games collection poster"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
        <div className="card-more-badge-overlay">
          <Layers size={13} />
          <span>+{count} {locale === "en" ? "GAMES" : "OYUN"}</span>
        </div>
        <span className="card-number card-more-number">+{count}</span>
        <span className="card-edge" />
      </div>
      <div className="card-content">
        <div>
          <span className="card-eyebrow">{words.moreGamesEyebrow}</span>
          <h3>{words.moreGames}</h3>
        </div>
        <p>{words.moreGamesDesc}</p>
        <div className="card-meta card-more-meta">
          <span className="card-more-chip">
            <Sparkles size={11} /> {count} {locale === "en" ? "EXPERIMENTS" : "DENEY"}
          </span>
          <span className="card-more-games-list">{games.map((g) => g.title).join(" · ")}</span>
        </div>
        <div className="card-actions">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            {words.moreGamesAction} <ArrowUpRight size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}
