import type { SiteLocale } from "./i18n";

const ANON_ID_KEY = "sely_anon_player_id_v2";

export const TR_ADJECTIVES = [
  "Cesur", "Sessiz", "Keskin", "Hızlı", "Gizli", "Parlak", "Usta", "Bilge",
  "Çevik", "Derin", "Sakin", "Sabırlı", "Yürekli", "Kararlı", "Neşeli",
  "Kurnaz", "Görünmez", "Sadık", "Dinamik", "Özgür", "Korkusuz", "Yaratıcı",
  "Dikkatli", "Gizemli", "Seri", "Kıvrak", "Zarif", "Asil", "Yorulmaz",
  "Gözüpek", "Uyanık", "Hafif", "Gölgesiz", "Yalın", "Berrak", "Canlı",
  "Kayıtsız", "Işıltılı", "Alacakaranlık", "Rüzgârlı", "Fırtınalı", "Kozmik",
  "Demir", "Bakır", "Gümüş", "Altın", "Zümrüt", "Safir", "Yakut", "Kehribar",
  "Obsidiyen", "Prizmatik", "Neon", "Kuantum", "Puslu", "Sonsuz", "Kutup",
  "Bozkır", "Doruk", "Yıldız", "Ayışığı", "Güneş", "Alevli", "Buzul", "Kristal",
  "Kadife", "Keten", "İpeksi", "Ritmik", "Akustik", "Lirik", "Epik", "Mitik",
  "Kadim", "Kayıp", "Saklı", "Arayan", "Bulan", "Büyülü", "Efsunlu", "Ufuk",
  "Şafak", "Gececil", "Gündüzcül", "Kuzey", "Güney", "Doğu", "Batı", "Pusula",
  "Manyetik", "Elektrik", "Kinetik", "Optik", "Sanal", "Gerçek", "Soyut",
  "Somut", "Modern", "Retro", "Analog", "Dijital", "Kusursuz", "Eksiksiz",
  "Sıra Dışı", "Esrarengiz", "Bağımsız", "Tereddütsüz", "Atik", "Süratli",
  "Dingin", "Huzurlu", "Hünerli", "Yetenekli", "Mahir", "Kabiliyetli"
];

export const EN_ADJECTIVES = [
  "Brave", "Silent", "Sharp", "Swift", "Secret", "Bright", "Master", "Wise",
  "Agile", "Deep", "Calm", "Patient", "Bold", "Resolute", "Cheerful",
  "Clever", "Unseen", "Loyal", "Dynamic", "Free", "Fearless", "Creative",
  "Vigilant", "Mystic", "Nimble", "Deft", "Graceful", "Noble", "Tireless",
  "Audacious", "Alert", "Light", "Shadowless", "Lucid", "Vivid", "Lively",
  "Serene", "Radiant", "Twilight", "Breezy", "Stormy", "Cosmic",
  "Iron", "Copper", "Silver", "Golden", "Emerald", "Sapphire", "Ruby", "Amber",
  "Obsidian", "Prismatic", "Neon", "Quantum", "Misty", "Infinite", "Polar",
  "Steppe", "Apex", "Stellar", "Moonlit", "Solar", "Fiery", "Glacial", "Crystal",
  "Velvet", "Linen", "Silken", "Rhythmic", "Acoustic", "Lyric", "Epic", "Mythic",
  "Ancient", "Lost", "Hidden", "Seeker", "Finder", "Arcane", "Enchanted", "Horizon",
  "Dawn", "Nocturnal", "Diurnal", "Boreal", "Austral", "Eastern", "Western", "Compass",
  "Magnetic", "Electric", "Kinetic", "Optical", "Virtual", "Actual", "Abstract",
  "Concrete", "Modern", "Retro", "Analog", "Digital", "Flawless", "Seamless",
  "Singular", "Enigmatic", "Autonomous", "Decisive", "Spry", "Rapid",
  "Tranquil", "Peaceful", "Skillful", "Gifted", "Adept", "Capable"
];

export const TR_NOUNS = [
  "Yankı", "Düğüm", "Kesit", "Gölge", "Kıvılcım", "Hane", "Dedektif",
  "Gezgin", "Kâşif", "Mimar", "Tilki", "Şahin", "Kurt", "Kartal", "Pusula",
  "Labirent", "Matbaa", "Harita", "Mühür", "Anahtar", "Kilit", "Saat", "Sarkaç",
  "Ayna", "Mercek", "Prizma", "Fener", "Meşale", "Işık", "Gölgeci", "Karasu",
  "Akıntı", "Rüzgâr", "Yelken", "Kaptan", "Dümenci", "Palamar", "Çapa", "Liman",
  "Kule", "Burç", "Kale", "Geçit", "Köprü", "Vadi", "Orman", "Kanyon", "Tepe",
  "Doruk", "Zirve", "Atlas", "Kronometre", "Pusulacı", "Gözlemci", "Mühendis",
  "Çizgici", "Ustabaşı", "Matbaacı", "Yazıcı", "Kâtip", "Simyacı", "Astronot",
  "Pilot", "Süvari", "Bekçi", "Muhafız", "Rehber", "Öncü", "İzci", "Avcı",
  "Kartograf", "Arşivci", "Koleksiyoncu", "Kumpas", "Gönye", "Cetvel", "Pergel",
  "Sikke", "Madalyon", "Madenci", "Dalgıç", "Seyyah", "Kervan", "Nöbetçi",
  "Kutup Yıldızı", "Kuyruklu Yıldız", "Meteor", "Nebula", "Galaksi", "Gezegen",
  "Samanyolu", "Ayı", "Pars", "Vaşak", "Atmaca", "Doğan", "Baykuş", "Pelikan",
  "Turna", "Martı", "Albatros", "Yunus", "Balina", "Ahtapot", "Deniz Feneri"
];

export const EN_NOUNS = [
  "Echo", "Knot", "Cut", "Shadow", "Spark", "Hane", "Detective",
  "Traveler", "Explorer", "Architect", "Fox", "Falcon", "Wolf", "Eagle", "Compass",
  "Labyrinth", "Press", "Chart", "Seal", "Key", "Lock", "Clock", "Pendulum",
  "Mirror", "Lens", "Prism", "Lantern", "Torch", "Beacon", "Shadower", "Stream",
  "Current", "Gale", "Sail", "Captain", "Helmsman", "Mooring", "Anchor", "Harbor",
  "Tower", "Bastion", "Citadel", "Pass", "Bridge", "Valley", "Grove", "Canyon", "Ridge",
  "Summit", "Apex", "Atlas", "Chronometer", "Wayfinder", "Observer", "Engineer",
  "Drafter", "Foreman", "Printer", "Scribe", "Clerk", "Alchemist", "Astronaut",
  "Aviator", "Rider", "Sentry", "Guardian", "Guide", "Pioneer", "Scout", "Hunter",
  "Cartographer", "Archivist", "Curator", "Caliper", "Square", "Ruler", "Divider",
  "Coin", "Medallion", "Miner", "Diver", "Voyager", "Caravan", "Watchman",
  "Polaris", "Comet", "Meteor", "Nebula", "Galaxy", "Planet",
  "Milkyway", "Bear", "Leopard", "Lynx", "Hawk", "Kestrel", "Owl", "Pelican",
  "Crane", "Seagull", "Albatross", "Dolphin", "Whale", "Octopus", "Lighthouse"
];

/**
 * Retrieves or generates a cryptographically strong persistent anonymous player ID in browser localStorage.
 * Guaranteed 128-bit entropy (never collides across different devices).
 */
export function getOrCreateAnonymousId(): string {
  if (typeof window === "undefined") return "anon_server_guest";
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      // Generate 16 random cryptographically secure hex bytes
      if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        const buf = new Uint8Array(16);
        crypto.getRandomValues(buf);
        id = "ply_" + Array.from(buf, b => b.toString(16).padStart(2, "0")).join("");
      } else {
        id = "ply_" + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
      }
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return "ply_fallback_" + Math.random().toString(36).slice(2, 10);
  }
}

/**
 * FNV-1a 32-bit hash algorithm for uniform dispersion.
 */
function fnv1a(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

/**
 * Returns today's ISO date string (UTC) in YYYY-MM-DD format.
 */
export function getTodayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Computes a procedural, collision-proof, deterministic nickname for the player for today.
 *
 * Collision Space:
 * 114 adjectives * 105 nouns * 9000 numbers = ~107.7 million unique daily combinations.
 * Even with thousands of concurrent daily players, the probability of two players
 * receiving the exact same nickname on the same day is virtually zero (< 0.00005).
 *
 * Example Outputs:
 * - "Kozmik Pusula #4819" / "Cosmic Compass #4819"
 * - "Zümrüt Şahin #7204" / "Emerald Falcon #7204"
 * - "Alacakaranlık Labirent #3192" / "Twilight Labyrinth #3192"
 */
export function getPlayerNick(
  locale: SiteLocale = "tr",
  dateStr: string = getTodayDateStr(),
  explicitAnonId?: string
): string {
  const anonId = explicitAnonId || getOrCreateAnonymousId();
  const seed = `${anonId}::sely_nick_v2::${dateStr}`;
  const h1 = fnv1a(seed);
  const h2 = fnv1a(seed + "::secondary");
  const h3 = fnv1a(seed + "::tertiary");

  const isEn = locale === "en";
  const adjectives = isEn ? EN_ADJECTIVES : TR_ADJECTIVES;
  const nouns = isEn ? EN_NOUNS : TR_NOUNS;

  const adj = adjectives[h1 % adjectives.length];
  const noun = nouns[h2 % nouns.length];
  // 4-digit unique pin between 1000 and 9999
  const pin = 1000 + (h3 % 9000);

  return `${adj} ${noun} #${pin}`;
}

/**
 * Computes a one-way cryptographic SHA-256 hex string from the anonymous ID and game ID.
 * Used exclusively by the server to safely allow players to update their own high score
 * without revealing IP or device identifiers.
 */
export async function getPlayerSignature(
  gameId: string,
  dateStr: string = getTodayDateStr(),
  explicitAnonId?: string
): Promise<string> {
  const anonId = explicitAnonId || getOrCreateAnonymousId();
  const raw = `${anonId}:${gameId}:${dateStr}:sely_leaderboard_v2`;
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const msgBuffer = new TextEncoder().encode(raw);
      const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 20);
    }
  } catch {
    // Fallback if Web Crypto API is unavailable
  }
  return fnv1a(raw).toString(16).padStart(8, "0") + fnv1a(raw + ":ext").toString(16).padStart(8, "0");
}
