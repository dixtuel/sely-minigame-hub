import { useEffect, useState, useMemo } from "react";
import { Trophy, X, Sparkles, RefreshCw, User, Flame, Clock } from "lucide-react";
export type GameId = "echo" | "knot" | "cut" | "shadow" | "marker" | "hane" | "spark" | "vaka";

export interface LeaderboardEntry {
  rank: number;
  nick: string;
  score: number;
  signature: string;
  timestamp: number;
}

export interface LeaderboardResponse {
  gameId: GameId;
  date: string;
  top: LeaderboardEntry[];
  totalPlayers: number;
  source: "upstash" | "vds-redis" | "turso" | "memory";
}
import { getPlayerNick, getPlayerSignature, getTodayDateStr } from "@/lib/playerNick";
import { trackEvent } from "@/lib/analytics";
import type { SiteLocale } from "@/lib/i18n";

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: SiteLocale;
  initialGameId?: GameId;
  userScores: Record<string, number>;
}

const GAME_TABS: Array<{ id: GameId; labelTr: string; labelEn: string; accent: string }> = [
  { id: "echo", labelTr: "Yankı", labelEn: "Echo", accent: "#e9563f" },
  { id: "knot", labelTr: "Düğüm", labelEn: "Knot", accent: "#293b75" },
  { id: "cut", labelTr: "Kesit", labelEn: "Cut", accent: "#654169" },
  { id: "shadow", labelTr: "Gölge", labelEn: "Shadow", accent: "#296a55" },
  { id: "marker", labelTr: "İz", labelEn: "Marker", accent: "#e5b341" },
  { id: "hane", labelTr: "Hane", labelEn: "Hane", accent: "#293b75" },
  { id: "spark", labelTr: "Kıvılcım", labelEn: "Spark", accent: "#e9563f" },
];

export default function LeaderboardModal({
  isOpen,
  onClose,
  locale,
  initialGameId = "echo",
  userScores,
}: LeaderboardModalProps) {
  const isEn = locale === "en";
  const [selectedGame, setSelectedGame] = useState<GameId>(initialGameId);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [userSignature, setUserSignature] = useState<string>("");

  const todayStr = useMemo(() => getTodayDateStr(), []);
  const playerNick = useMemo(() => getPlayerNick(locale, todayStr), [locale, todayStr]);

  // Load signature once on mount
  useEffect(() => {
    getPlayerSignature(selectedGame, todayStr).then(setUserSignature);
  }, [selectedGame, todayStr]);

  // Sync initial game ID when opened
  useEffect(() => {
    if (isOpen && initialGameId) {
      setSelectedGame(initialGameId);
    }
  }, [isOpen, initialGameId]);

  // Fetch leaderboard data
  useEffect(() => {
    if (!isOpen) return;

    trackEvent("view_leaderboard", { game: selectedGame });

    let active = true;
    setLoading(true);

    fetch(`/api/leaderboard?game=${selectedGame}&date=${todayStr}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: LeaderboardResponse | null) => {
        if (active && data) {
          setLeaderboardData(data);
        }
      })
      .catch(() => {
        // Graceful error fallback
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, selectedGame, todayStr]);

  // Keyboard escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const activeTab = GAME_TABS.find((t) => t.id === selectedGame) || GAME_TABS[0];
  const userScoreForGame = userScores[selectedGame] || 0;

  // Find user's entry in top 10 if present
  const userInTop = useMemo(() => {
    if (!leaderboardData || !userSignature) return null;
    return leaderboardData.top.find((entry) => entry.signature === userSignature);
  }, [leaderboardData, userSignature]);

  if (!isOpen) return null;

  return (
    <div
      className="leaderboard-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-title"
    >
      <div
        className="leaderboard-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ "--active-accent": activeTab.accent } as React.CSSProperties}
      >
        {/* Header */}
        <header className="leaderboard-header">
          <div className="leaderboard-title-wrap">
            <span className="leaderboard-tag">
              <Clock size={12} /> {isEn ? "DAILY REFRESH · UTC 00:00" : "GÜNLÜK YARIŞ · UTC 00:00"}
            </span>
            <h2 id="leaderboard-title" className="leaderboard-title">
              <Trophy size={20} className="trophy-icon" />
              {isEn ? "Daily Leaderboard" : "Günün En İyileri"}
            </h2>
          </div>
          <button
            type="button"
            className="leaderboard-close"
            onClick={onClose}
            aria-label={isEn ? "Close" : "Kapat"}
          >
            <X size={18} />
          </button>
        </header>

        {/* Player Profile Banner */}
        <div className="player-identity-card">
          <div className="player-avatar">
            <User size={16} />
          </div>
          <div className="player-identity-info">
            <span className="player-label">{isEn ? "TODAY'S CODENAME" : "GÜNKÜ KOD ADINIZ"}</span>
            <strong className="player-nick">{playerNick}</strong>
          </div>
          <div className="player-anonymity-badge">
            <Sparkles size={13} /> {isEn ? "100% Anonymous" : "Tamamen Anonim"}
          </div>
        </div>

        {/* Game Tabs */}
        <div className="leaderboard-tabs" role="tablist">
          {GAME_TABS.map((tab) => {
            const isSelected = tab.id === selectedGame;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isSelected}
                className={`leaderboard-tab ${isSelected ? "is-active" : ""}`}
                style={
                  isSelected
                    ? { borderColor: tab.accent, color: "var(--ink)", background: "var(--card)" }
                    : undefined
                }
                onClick={() => setSelectedGame(tab.id)}
              >
                {isEn ? tab.labelEn : tab.labelTr}
              </button>
            );
          })}
        </div>

        {/* Top Scores List */}
        <div className="leaderboard-content">
          {loading ? (
            <div className="leaderboard-loading">
              <RefreshCw size={20} className="animate-spin" />
              <span>{isEn ? "Fetching today's records..." : "Günün kayıtları getiriliyor..."}</span>
            </div>
          ) : !leaderboardData || leaderboardData.top.length === 0 ? (
            <div className="leaderboard-empty">
              <Flame size={32} className="empty-flame" />
              <h3>{isEn ? "No records yet today!" : "Bugün henüz skor girilmedi!"}</h3>
              <p>
                {isEn
                  ? `Be the very first player to conquer ${activeTab.labelEn} today.`
                  : `Günün ilk rekorunu kırarak ${activeTab.labelTr} masasına adını yazdır.`}
              </p>
            </div>
          ) : (
            <ol className="leaderboard-list">
              {leaderboardData.top.map((entry: LeaderboardEntry) => {
                const isCurrentUser = userSignature && entry.signature === userSignature;
                return (
                  <li
                    key={`${entry.rank}-${entry.signature}`}
                    className={`leaderboard-item rank-${entry.rank} ${isCurrentUser ? "is-current-user" : ""}`}
                  >
                    <span className="rank-badge">
                      {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
                    </span>
                    <span className="entry-nick">
                      {entry.nick}
                      {isCurrentUser && (
                        <span className="you-pill">{isEn ? "YOU" : "SEN"}</span>
                      )}
                    </span>
                    <strong className="entry-score">
                      {entry.score.toLocaleString(isEn ? "en-US" : "tr-TR")}
                    </strong>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Current User Standings Footer */}
        <footer className="leaderboard-footer">
          <div className="user-score-highlight">
            <div className="user-score-details">
              <span>{isEn ? `Your Best in ${activeTab.labelEn}:` : `${activeTab.labelTr} Rekorunuz:`}</span>
              <strong>{userScoreForGame > 0 ? userScoreForGame.toLocaleString(isEn ? "en-US" : "tr-TR") : "—"}</strong>
            </div>
            {userInTop && (
              <span className="user-rank-status">
                🏆 {isEn ? `Ranked #${userInTop.rank} today!` : `Günün #${userInTop.rank}. sırasındasınız!`}
              </span>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
