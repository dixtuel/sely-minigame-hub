import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, History, Layers, Search, Sparkles, X } from "lucide-react";
import type { GameMeta, GameId, GameCategory } from "@/lib/catalog";
import { copy, type SiteLocale } from "@/lib/i18n";
import { masteryBand } from "@/lib/levelGenerators";
import { trackEvent } from "@/lib/analytics";

interface ArchiveHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: SiteLocale;
  games: GameMeta[];
  scores: Record<GameId, number>;
  onPlayGame: (game: GameMeta) => void;
}

type FilterCategory = "all" | GameCategory;

export default function ArchiveHubModal({
  isOpen,
  onClose,
  locale,
  games,
  scores,
  onPlayGame,
}: ArchiveHubModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const words = copy[locale];
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<FilterCategory>("all");

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (searchQuery) {
          setSearchQuery("");
        } else if (activeCategory !== "all") {
          setActiveCategory("all");
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, searchQuery, activeCategory]);

  // Lock body scroll when modal is open and reset search & category
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      trackEvent("view_archive_hub", { game_count: games.length });
    } else {
      document.body.style.overflow = "";
      setSearchQuery("");
      setActiveCategory("all");
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, games.length]);

  // Filter games based on search query and active category
  const filteredGames = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase(locale === "en" ? "en-US" : "tr-TR");
    return games.filter((game) => {
      // 1. Category check
      if (activeCategory !== "all") {
        const matchesCategory =
          game.category === activeCategory ||
          game.tags?.some((t) => t.toLowerCase() === activeCategory);
        if (!matchesCategory) return false;
      }

      // 2. Query check
      if (!q) return true;
      const title = game.title.toLocaleLowerCase(locale === "en" ? "en-US" : "tr-TR");
      const eyebrow = game.eyebrow.toLocaleLowerCase(locale === "en" ? "en-US" : "tr-TR");
      const mechanic = game.mechanic.toLocaleLowerCase(locale === "en" ? "en-US" : "tr-TR");
      const motto = game.motto.toLocaleLowerCase(locale === "en" ? "en-US" : "tr-TR");
      const num = game.number;
      const matchesTags = game.tags?.some((t) =>
        t.toLocaleLowerCase(locale === "en" ? "en-US" : "tr-TR").includes(q)
      );

      return (
        title.includes(q) ||
        eyebrow.includes(q) ||
        mechanic.includes(q) ||
        motto.includes(q) ||
        num.includes(q) ||
        Boolean(matchesTags)
      );
    });
  }, [games, searchQuery, activeCategory, locale]);

  if (!isOpen) return null;

  return (
    <div
      className="archive-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-hub-title"
    >
      <div className="archive-modal" ref={modalRef}>
        {/* Header */}
        <header className="archive-header">
          <div className="archive-header-left">
            <div className="archive-eyebrow-row">
              <span className="archive-tag">{words.archiveBadge}</span>
              <span>SELY / {locale === "en" ? "ARCHIVE DOSSIER" : "ARŞİV DOSYASI"}</span>
            </div>
            <h2 id="archive-hub-title">{words.archiveTitle}</h2>
            <p>{words.archiveDesc}</p>
          </div>
          <button
            type="button"
            className="archive-close-btn"
            onClick={onClose}
            aria-label={words.archiveClose}
          >
            <X size={18} />
          </button>
        </header>

        {/* Search & Category Toolbar */}
        <div className="archive-search-toolbar">
          <div className="archive-search-input-wrap">
            <Search size={16} className="archive-search-icon" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={words.searchPlaceholder}
              className="archive-search-input"
              aria-label={words.searchGames}
            />
            {searchQuery ? (
              <button
                type="button"
                className="archive-search-clear-btn"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                title={words.clearSearch}
                aria-label={words.clearSearch}
              >
                <X size={15} />
              </button>
            ) : null}
          </div>

          {/* Category Filter Chips */}
          <div className="archive-category-chips" role="tablist" aria-label="Game categories">
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === "all"}
              className={`archive-category-chip ${activeCategory === "all" ? "is-active" : ""}`}
              onClick={() => {
                setActiveCategory("all");
                trackEvent("filter_archive_category", { category: "all" });
              }}
            >
              {words.categoryAll}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === "strategy"}
              className={`archive-category-chip ${activeCategory === "strategy" ? "is-active" : ""}`}
              onClick={() => {
                setActiveCategory("strategy");
                trackEvent("filter_archive_category", { category: "strategy" });
              }}
            >
              {words.categoryStrategy}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === "puzzle"}
              className={`archive-category-chip ${activeCategory === "puzzle" ? "is-active" : ""}`}
              onClick={() => {
                setActiveCategory("puzzle");
                trackEvent("filter_archive_category", { category: "puzzle" });
              }}
            >
              {words.categoryPuzzle}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === "arcade"}
              className={`archive-category-chip ${activeCategory === "arcade" ? "is-active" : ""}`}
              onClick={() => {
                setActiveCategory("arcade");
                trackEvent("filter_archive_category", { category: "arcade" });
              }}
            >
              {words.categoryArcade}
            </button>
          </div>

          <div className="archive-search-counter">
            <span>
              <b>{filteredGames.length}</b>/{games.length} {locale === "en" ? "GAMES" : "OYUN"}
            </span>
          </div>
        </div>

        {/* Scrollable Games List */}
        <div className="archive-body">
          {filteredGames.length === 0 ? (
            <div className="archive-empty-state">
              <div className="archive-empty-icon" aria-hidden="true">
                <Search size={32} />
              </div>
              <h4>{words.noGamesFound}</h4>
              <p>{words.noGamesFoundDesc}</p>
              <button
                type="button"
                className="archive-empty-reset-btn"
                onClick={() => {
                  setSearchQuery("");
                  setActiveCategory("all");
                  searchInputRef.current?.focus();
                }}
              >
                <X size={14} />
                <span>{words.clearSearch}</span>
              </button>
            </div>
          ) : (
            <div className="archive-games-grid">
              {filteredGames.map((game) => {
                const score = scores[game.id] ?? 0;
                const mastery = masteryBand(score);
                // Daily featured games occupy 01–04 on the home catalogue;
                // archive entries continue from 05 while retaining catalog order.
                const archiveNumber = String(games.findIndex((item) => item.id === game.id) + 5).padStart(2, "0");
                return (
                  <article
                    key={game.id}
                    className={`archive-game-item card-${game.id}`}
                    style={{ "--card-accent": game.accent } as React.CSSProperties}
                  >
                    <div className="archive-game-poster-wrap">
                      <img
                        src={game.poster}
                        alt={`${game.title} poster`}
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="archive-game-num">{archiveNumber}</span>
                    </div>
                    <div className="archive-game-details">
                      <div className="archive-game-meta-top">
                        <span className="archive-game-eyebrow">{game.eyebrow}</span>
                        <h3>{game.title}</h3>
                        <p className="archive-game-motto">“{game.motto}”</p>
                        <p className="archive-game-mechanic">{game.mechanic}</p>
                      </div>
                      <div className="archive-game-bottom">
                        <div className="archive-game-stats">
                          <span>{game.playTime} · {game.controls}</span>
                          <span>
                            {words.mastery} {mastery}/4 · {words.best}{" "}
                            {score.toLocaleString(locale === "en" ? "en-US" : "tr-TR")}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="archive-play-btn"
                          onClick={() => {
                            trackEvent("play_from_archive", { game: game.id });
                            onClose();
                            onPlayGame(game);
                          }}
                        >
                          {words.playLabel} <ArrowUpRight size={14} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <footer className="archive-footer">
          <div className="archive-footer-note">
            <i />
            <span>
              {locale === "en"
                ? `${games.length} additional experiments preserved in current edition`
                : `Güncel edisyonda korunan ${games.length} ek deney`}
            </span>
          </div>
          <span>SELY.TR · 2026</span>
        </footer>
      </div>
    </div>
  );
}
