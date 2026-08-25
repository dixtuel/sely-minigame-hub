export type SiteLocale = "tr" | "en";

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
    games: "Oyunlar", daily: "Günlük baskı", catalog: "Katalogu aç", today: "Bugünün baskısı", best: "EN İYİ", open: "Oyunu aç", enter: "Oyuna gir", language: "EN",
    mastheadKicker: "KÜÇÜK KURAL. BÜYÜK YANKI.", mastheadLead: "Oynamak için", mastheadEmphasis: "bir sebep", mastheadEnd: "daha.", mastheadDescription: "Yedi bağımsız oyun deneyi; kısa turlar, net kararlar ve tekrar dönmek isteyeceğin ritimler.",
    dailyCopy: "Her sabah yedi oyunun her biri için yeni bir baskı gelir. Dünkü set katalogdan çekilir; bugün hangi ritmi açacağını sen seçersin.", dailyReady: "Bugünün yedili seti hazır", dailyLoading: "Bugün için sayfalar açılıyor", todayStart: "BUGÜNÜN BAŞLANGICI", dailySet: "BUGÜN 7 YENİ SEVİYE", dailyPlay: "Günlüğü oyna", personalPlay: "Kendi rotan", personalKicker: "USTALIĞINA GÖRE YENİ ROTA", personalDescription: "En iyi skorun yükseldikçe oyun daha yoğun bir rota kurar. Her giriş yeni, ama çözülebilir bir baskıdır.", mastery: "USTALIK",
    catalogKicker: "SEÇ VE BAŞLA", catalogLead: "Yedi küçük", catalogEmphasis: "dünya", catalogDescription: "Her oyun tek bir kuralın peşinden gider. Kartı kaldır, kuralı öğren, turu başlat.",
    rhythmKicker: "OYUN RİTMİ", rhythmLead: "Kuralı hızlı öğren.", rhythmBottom: "Ustalığı yavaş kur.", rhythmDescription: "Her deney, ilk hamlede anlaşılır; ama iyi bir tur için dikkat, ritim ve doğru zamanda verilen karar gerekir.", backToDaily: "Bugünün serisine dön",
    footerDescription: "Bağımsız mini oyun kataloğu.", privacy: "Gizlilik ve KVKK", terms: "Kullanım Koşulları", accessibility: "Erişilebilirlik Bildirimi", titleSuffix: "Küçük oyunlar, uzun yankılar.",
  },
  en: {
    games: "Games", daily: "Daily edition", catalog: "Open catalogue", today: "Today’s edition", best: "BEST", open: "Open game", enter: "Enter game", language: "TR",
    mastheadKicker: "SMALL RULE. BIG ECHO.", mastheadLead: "One more", mastheadEmphasis: "reason", mastheadEnd: "to play.", mastheadDescription: "Seven independent game experiments; short runs, clear choices, and rhythms worth returning to.",
    dailyCopy: "Every morning, each of the seven games receives a new edition. Yesterday’s set leaves the catalogue; you choose which rhythm to open today.", dailyReady: "Today’s set of seven is ready", dailyLoading: "Pages are opening for today", todayStart: "TODAY’S START", dailySet: "7 NEW LEVELS TODAY", dailyPlay: "Play daily", personalPlay: "Your route", personalKicker: "A NEW ROUTE FOR YOUR MASTERY", personalDescription: "As your best score rises, the game builds a denser route. Every entry is new, but still solvable.", mastery: "MASTERY",
    catalogKicker: "CHOOSE AND BEGIN", catalogLead: "Seven small", catalogEmphasis: "worlds", catalogDescription: "Each game follows one rule. Lift the card, learn the rule, begin the run.",
    rhythmKicker: "GAME RHYTHM", rhythmLead: "Learn the rule fast.", rhythmBottom: "Build mastery slowly.", rhythmDescription: "Each experiment is clear on the first move, but a good run asks for attention, rhythm, and decisions made at the right time.", backToDaily: "Return to today’s edition",
    footerDescription: "Independent mini game catalogue.", privacy: "Privacy & KVKK", terms: "Terms of use", accessibility: "Accessibility statement", titleSuffix: "Small games, long echoes.",
  },
} as const;
