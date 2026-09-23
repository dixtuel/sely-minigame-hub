export type SiteLocale = "tr" | "en";

/** Picks the Turkish or English variant of a string pair for the given locale. */
export function local(locale: SiteLocale | undefined, tr: string, en: string): string {
  return locale === "en" ? en : tr;
}

const turkicPrefixes = ["tr", "az"];
const preferenceKey = "sely-locale";

export function localeFromLanguages(languages: readonly string[]): SiteLocale {
  return languages.some(language => turkicPrefixes.includes(language.toLowerCase().split("-")[0])) ? "tr" : "en";
}

export function browserLocale(): SiteLocale {
  if (typeof navigator === "undefined") return "tr";
  const saved = window.localStorage.getItem(preferenceKey);
  if (saved === "tr" || saved === "en") return saved;
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
  return localeFromLanguages(languages);
}

export function rememberLocale(locale: SiteLocale) {
  if (typeof window !== "undefined") window.localStorage.setItem(preferenceKey, locale);
}

export function localePath(locale: SiteLocale, path = "") {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return locale === "en" ? `/en${clean === "/" ? "" : clean}` : clean;
}

export const copy = {
  tr: {
    games: "Oyunlar", daily: "Bugünün önerisi", catalog: "Katalogu aç", today: "Bugünün önerisi", best: "EN İYİ", open: "Oyunu aç", enter: "Oyuna gir", language: "EN",
    mastheadKicker: "KÜÇÜK KURAL. BÜYÜK YANKI.", mastheadLead: "Oynamak için", mastheadEmphasis: "bir sebep", mastheadEnd: "daha.", mastheadDescription: "Yedi bağımsız oyun deneyi; kısa turlar, net kararlar ve tekrar dönmek isteyeceğin ritimler.",
    dailyCopy: "Her gün farklı bir oyunla yeni bir ritim keşfet.", dailyReady: "Bugünün önerisi hazır", dailyLoading: "Bugünün önerisi hazırlanıyor", todayStart: "BUGÜNÜN ÖNERİSİ", dailySet: "BUGÜNÜN ÖNERİSİ", playLabel: "Oyna", personalKicker: "USTALIĞINA GÖRE YENİ ROTA", personalDescription: "En iyi skorun yükseldikçe oyun daha yoğun bir rota kurar. Her giriş yeni, ama çözülebilir bir baskıdır.", mastery: "USTALIK",
    catalogKicker: "SEÇ VE BAŞLA", catalogLead: "Öne çıkan", catalogEmphasis: "dört dünya", catalogDescription: "Her oyun tek bir kuralın peşinden gider. Kartı kaldır, kuralı öğren, turu başlat.",
    rhythmKicker: "OYUN RİTMİ", rhythmLead: "Kuralı hızlı öğren.", rhythmBottom: "Ustalığı yavaş kur.", rhythmDescription: "Her deney, ilk hamlede anlaşılır; ama iyi bir tur için dikkat, ritim ve doğru zamanda verilen karar gerekir.", backToDaily: "Bugünün serisine dön",
    moreGames: "Diğer Oyunlar", moreGamesEyebrow: "KOLEKSİYON / ARŞİV", moreGamesDesc: "Listede gözükmeyen diğer oyunları görmek ve oynamak için tıklayın.", moreGamesAction: "Koleksiyonu Aç",
    archiveTitle: "ARŞİV OYUNLARI", archiveLead: "Özgün Deneyler", archiveDesc: "Ana akışta yer almayan, bağımsız mekaniklere sahip mini oyun deneyleri. İstediğin oyunu doğrudan başlatabilirsin.", archiveBadge: "ARŞİV EDİSYONU", archiveClose: "Kapat",
    searchGames: "Oyun Ara", searchPlaceholder: "Oyun ara (başlık, mekanik, etiket)...", clearSearch: "Temizle", noGamesFound: "Eşleşen oyun bulunamadı", noGamesFoundDesc: "Aramanızla eşleşen bir arşiv oyunu bulunamadı.",
    categoryAll: "Tümü", categoryStrategy: "Strateji", categoryPuzzle: "Bulmaca", categoryArcade: "Arcade",
    footerDescription: "Bağımsız mini oyun kataloğu.", privacy: "Gizlilik ve KVKK", terms: "Kullanım Koşulları", accessibility: "Erişilebilirlik Bildirimi", titleSuffix: "Küçük oyunlar, uzun yankılar.",
  },
  en: {
    games: "Games", daily: "Today’s recommendation", catalog: "Open catalogue", today: "Today’s recommendation", best: "BEST", open: "Open game", enter: "Enter game", language: "TR",
    mastheadKicker: "SMALL RULE. BIG ECHO.", mastheadLead: "One more", mastheadEmphasis: "reason", mastheadEnd: "to play.", mastheadDescription: "Seven independent game experiments; short runs, clear choices, and rhythms worth returning to.",
    dailyCopy: "A different game, a new rhythm, every day.", dailyReady: "Today’s recommendation is ready", dailyLoading: "Preparing today’s recommendation", todayStart: "TODAY’S RECOMMENDATION", dailySet: "TODAY’S RECOMMENDATION", playLabel: "Play", personalKicker: "A NEW ROUTE FOR YOUR MASTERY", personalDescription: "As your best score rises, the game builds a denser route. Every entry is new, but still solvable.", mastery: "MASTERY",
    catalogKicker: "CHOOSE AND BEGIN", catalogLead: "Four featured", catalogEmphasis: "worlds", catalogDescription: "Each game follows one rule. Lift the card, learn the rule, begin the run.",
    rhythmKicker: "GAME RHYTHM", rhythmLead: "Learn the rule fast.", rhythmBottom: "Build mastery slowly.", rhythmDescription: "Each experiment is clear on the first move, but a good run asks for attention, rhythm, and decisions made at the right time.", backToDaily: "Return to today’s edition",
    moreGames: "Other Games", moreGamesEyebrow: "COLLECTION / VAULT", moreGamesDesc: "Click to explore and play other games in the archive.", moreGamesAction: "Open Archive",
    archiveTitle: "ARCHIVE GAMES", archiveLead: "Original Experiments", archiveDesc: "Mini game experiments with independent mechanics outside the main roster. Launch any game directly.", archiveBadge: "ARCHIVE EDITION", archiveClose: "Close",
    searchGames: "Search Games", searchPlaceholder: "Search games (title, mechanic, tag)...", clearSearch: "Clear", noGamesFound: "No matching games found", noGamesFoundDesc: "No games matched your search criteria.",
    categoryAll: "All", categoryStrategy: "Strategy", categoryPuzzle: "Puzzle", categoryArcade: "Arcade",
    footerDescription: "Independent mini game catalogue.", privacy: "Privacy & KVKK", terms: "Terms of use", accessibility: "Accessibility statement", titleSuffix: "Small games, long echoes.",
  },
} as const;
