import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CircleHelp, Gamepad2, History, Menu, ShieldCheck, Sparkles, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { getGameCatalog, type GameId, type GameMeta } from "@/lib/catalog";
import { copy, localePath, rememberLocale, type SiteLocale } from "@/lib/i18n";
import { masteryBand, personalSeed } from "@/lib/levelGenerators";

const GameStudio = lazy(() => import("@/components/GameStudio"));
const SCORE_KEY = "sely-scorebook-v1";
type ScoreBook = Record<GameId, number>;
type RunSource = "daily" | "personal";
type SelectedRun = { game: GameMeta; source: RunSource; attempt: number; autoStart?: boolean; demo?: "spark" | "cut-fail" };
const blankScores: ScoreBook = { echo: 0, knot: 0, cut: 0, shadow: 0, marker: 0, hane: 0, spark: 0 };

export default function Home({ locale = "tr", directGameId }: { locale?: SiteLocale; directGameId?: string }) {
  const words = copy[locale];
  const catalog = getGameCatalog(locale);
  const [, navigate] = useLocation();
  const [selected, setSelected] = useState<SelectedRun | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scores, setScores] = useState<ScoreBook>(blankScores);
  const [personalAttempts, setPersonalAttempts] = useState<ScoreBook>(blankScores);
  const daily = trpc.daily.today.useQuery(undefined, { staleTime: 60 * 60 * 1000, retry: 1 });

  useEffect(() => {
    try { const stored = localStorage.getItem(SCORE_KEY); if (stored) setScores({ ...blankScores, ...JSON.parse(stored) }); } catch { /* Local scores are optional. */ }
  }, []);
  useEffect(() => {
    if (!daily.data || selected) return;
    const query = new URLSearchParams(window.location.search);
    const requestedId = directGameId ?? (query.get("play") === "daily" ? query.get("game") : null);
    const game = catalog.find(item => item.id === requestedId);
    const demo = game?.id === "spark" && query.get("demo") === "1" ? "spark" : game?.id === "cut" && query.get("demo") === "fail" ? "cut-fail" : undefined;
    if (game) setSelected({ game, source: "daily", attempt: 0, autoStart: true, demo });
  }, [catalog, daily.data, directGameId, selected]);
  const saveScore = (gameId: GameId, score: number) => setScores(previous => {
    const next = { ...previous, [gameId]: Math.max(previous[gameId], score) };
    try { localStorage.setItem(SCORE_KEY, JSON.stringify(next)); } catch { /* Local storage may be disabled. */ }
    return next;
  });
  const dailyPack = selected ? daily.data?.games.find(game => game.gameId === selected.game.id) : undefined;
  const selectedMastery = selected ? masteryBand(scores[selected.game.id]) : 1;
  const activeSeed = selected ? (selected.source === "daily" && selected.attempt === 0 ? dailyPack?.seed ?? 0 : personalSeed(dailyPack?.seed ?? 618_071, selected.game.id, selectedMastery, selected.attempt)) : 0;
  const activeDifficulty = selected ? (selected.source === "daily" ? dailyPack?.difficulty ?? 1 : selectedMastery) : 1;
  const totalBest = useMemo(() => Object.values(scores).reduce((total, value) => total + value, 0), [scores]);
  const otherLocale: SiteLocale = locale === "tr" ? "en" : "tr";
  const startDaily = (game: GameMeta) => setSelected({ game, source: "daily", attempt: 0 });
  const startPersonal = (game: GameMeta) => {
    const attempt = personalAttempts[game.id] + 1;
    setPersonalAttempts(previous => ({ ...previous, [game.id]: attempt }));
    setSelected({ game, source: "personal", attempt });
  };
  const continueToNextLevel = () => {
    if (!selected) return;
    const attempt = Math.max(1, selected.attempt + 1);
    setPersonalAttempts(previous => ({ ...previous, [selected.game.id]: Math.max(previous[selected.game.id], attempt) }));
    setSelected({ ...selected, source: "personal", attempt, autoStart: true, demo: undefined });
  };

  if (selected) return <Suspense fallback={<main className="hub-page game-loading" aria-live="polite">{locale === "en" ? "Opening edition…" : "Baskı açılıyor…"}</main>}><GameStudio game={selected.game} locale={locale} runSource={selected.source} autoStart={selected.autoStart} demo={selected.demo} dailySeed={activeSeed} dailyDifficulty={activeDifficulty} highScore={scores[selected.game.id]} soundOn={soundOn} onToggleSound={() => setSoundOn(value => !value)} onBack={() => { setSelected(null); if (selected.autoStart) navigate(localePath(locale)); }} onNextLevel={continueToNextLevel} onScore={score => saveScore(selected.game.id, score)} /></Suspense>;

  return <main className="hub-page" lang={locale}>
    <header className="hub-nav">
      <a className="brand-lockup" href="#top" aria-label="SELY.TR home"><img src="/manus-storage/sely-mark_de9c08a5.png" alt="" /><span>SELY<span className="brand-dot">.</span>TR</span></a>
      <nav className={menuOpen ? "nav-links is-open" : "nav-links"} aria-label={locale === "en" ? "Main navigation" : "Ana gezinme"}><a href="#games" onClick={() => setMenuOpen(false)}>{words.games}</a><a href="#daily" onClick={() => setMenuOpen(false)}>{words.daily}</a></nav>
      <div className="nav-actions"><span className="nav-score"><Sparkles size={15} /> {totalBest.toLocaleString(locale === "en" ? "en-US" : "tr-TR")}</span><button className="locale-button" onClick={() => { rememberLocale(otherLocale); navigate(localePath(otherLocale)); }}>{words.language}</button><button className="menu-button" onClick={() => setMenuOpen(value => !value)} aria-label={locale === "en" ? "Open or close menu" : "Menüyü aç veya kapat"}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button></div>
    </header>
    <section className="masthead" id="top"><div className="masthead-rail"><span>SELY / {locale === "en" ? "MINI GAME CATALOGUE" : "MİNİ OYUN KATALOĞU"}</span><i /><span>EDITION 01</span></div><div className="masthead-copy"><span className="studio-kicker">{words.mastheadKicker}</span><h1>{words.mastheadLead}<br /><em>{words.mastheadEmphasis}</em> {words.mastheadEnd}</h1><p>{words.mastheadDescription}</p><a className="hero-link" href="#games">{words.catalog} <ArrowUpRight size={18} /></a></div><div className="masthead-stamp"><img src="/manus-storage/sely-mark_de9c08a5.png" alt="" /><span>{locale === "en" ? <>ORIGINAL<br />GAME<br />EXPERIMENTS</> : <>ÖZGÜN<br />OYUN<br />DENEYLERİ</>}</span></div></section>
    <section className="featured-block" id="daily"><div className="section-index"><span>{words.today}</span><b>{daily.data?.date ?? "…"}</b></div><article className="featured-poster"><img src={catalog[0].poster} alt={`${catalog[0].title} game poster`} /><div className="featured-overlay"><span>01 / {words.todayStart}</span><h2>{catalog[0].title}</h2><p>{catalog[0].mechanic}</p><button onClick={() => startDaily(catalog[0])}>{words.enter} <ArrowUpRight size={18} /></button></div><div className="poster-number">01</div></article><aside className="daily-note"><span className="note-mark">✳</span><span className="daily-set-label">{words.dailySet}</span><p>{words.dailyCopy}</p><div className="daily-edition-list">{catalog.map(game => <button key={game.id} onClick={() => startDaily(game)}><span>{game.number}</span>{game.title}</button>)}</div><div><History size={16} /><span>{daily.isLoading ? words.dailyLoading : words.dailyReady}</span></div></aside></section>
    <section className="catalog-section" id="games"><div className="catalog-heading"><span className="studio-kicker">{words.catalogKicker}</span><h2>{words.catalogLead}<br /><em>{words.catalogEmphasis}</em></h2><p>{words.catalogDescription}</p><div className="personal-note"><span>{words.personalKicker}</span><p>{words.personalDescription}</p></div></div><div className="catalog-grid">{catalog.map((game, index) => <GameCard key={game.id} game={game} locale={locale} score={scores[game.id]} mastery={masteryBand(scores[game.id])} index={index} onDaily={() => startDaily(game)} onPersonal={() => startPersonal(game)} />)}</div></section>
    <section className="principles"><div className="principle-icon"><Gamepad2 size={26} /></div><div><span className="studio-kicker">{words.rhythmKicker}</span><h2>{words.rhythmLead}<br />{words.rhythmBottom}</h2></div><p>{words.rhythmDescription}</p><a href="#daily">{words.backToDaily} <ArrowUpRight size={17} /></a></section>
    <footer className="hub-footer"><div><a className="brand-lockup" href="#top"><img src="/manus-storage/sely-mark_de9c08a5.png" alt="" /><span>SELY<span className="brand-dot">.</span>TR</span></a><p>{words.footerDescription}</p></div><div className="footer-links"><Link href={localePath(locale, "/privacy")}><ShieldCheck size={15} /> {words.privacy}</Link><Link href={localePath(locale, "/terms")}><CircleHelp size={15} /> {words.terms}</Link><Link href={localePath(locale, "/accessibility")}>{words.accessibility}</Link><a href="/ads.txt">ads.txt</a></div><div className="footer-credit"><a href="https://dixtuel.tr/" target="_blank" rel="noreferrer">Made by <strong>dixtuel</strong> + <em>kiyici ;)</em><ArrowUpRight size={14} /></a><small>© 2026 SELY.TR · {words.titleSuffix}</small></div></footer>
  </main>;
}

function GameCard({ game, score, mastery, index, locale, onDaily, onPersonal }: { game: GameMeta; score: number; mastery: number; index: number; locale: SiteLocale; onDaily: () => void; onPersonal: () => void }) {
  const words = copy[locale];
  return <article className={`game-card card-${game.id}`} style={{ "--card-accent": game.accent, "--stagger": `${index * 0.04}s` } as React.CSSProperties}><div className="card-art"><img src={game.poster} alt={`${game.title} game poster`} /><span className="card-number">{game.number}</span><span className="card-edge" /></div><div className="card-content"><div><span className="card-eyebrow">{game.eyebrow}</span><h3>{game.title}</h3></div><p>{game.mechanic}</p><div className="card-meta"><span>{game.playTime}</span><span>{words.mastery} {mastery}/4</span><span>{words.best} {score.toLocaleString(locale === "en" ? "en-US" : "tr-TR")}</span></div><div className="card-actions"><button onClick={onDaily}>{words.dailyPlay} <ArrowUpRight size={16} /></button><button className="personal-play" onClick={onPersonal}>{words.personalPlay} <span>✦</span></button></div></div></article>;
}
