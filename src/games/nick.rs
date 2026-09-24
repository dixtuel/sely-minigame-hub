//! SELY Player Procedural Nickname and Signature Generator
//! Matches client/src/lib/playerNick.ts and RUSTGEC.MD Section 10.2.

use sha2::{Digest, Sha256};

pub const TR_ADJECTIVES: &[&str] = &[
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

pub const EN_ADJECTIVES: &[&str] = &[
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

pub const TR_NOUNS: &[&str] = &[
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

pub const EN_NOUNS: &[&str] = &[
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

/// FNV-1a 32-bit hash algorithm matching client/src/lib/playerNick.ts
pub fn fnv1a(input: &str) -> u32 {
    let mut hash: u32 = 2166136261;
    for b in input.bytes() {
        hash ^= b as u32;
        hash = hash.wrapping_add(
            (hash << 1)
                .wrapping_add(hash << 4)
                .wrapping_add(hash << 7)
                .wrapping_add(hash << 8)
                .wrapping_add(hash << 24),
        );
    }
    hash
}

/// Generates a deterministic procedural player nickname for a given anon_id, date, and locale.
pub fn get_player_nick(locale: &str, date_str: &str, anon_id: &str) -> String {
    let seed = format!("{anon_id}::sely_nick_v2::{date_str}");
    let h1 = fnv1a(&seed);
    let h2 = fnv1a(&format!("{seed}::secondary"));
    let h3 = fnv1a(&format!("{seed}::tertiary"));

    let is_en = locale == "en";
    let adjectives = if is_en { EN_ADJECTIVES } else { TR_ADJECTIVES };
    let nouns = if is_en { EN_NOUNS } else { TR_NOUNS };

    let adj = adjectives[(h1 as usize) % adjectives.len()];
    let noun = nouns[(h2 as usize) % nouns.len()];
    let pin = 1000 + (h3 % 9000);

    format!("{adj} {noun} #{pin}")
}

/// Computes a one-way cryptographic SHA-256 signature (first 20 hex characters).
pub fn get_player_signature(game_id: &str, date_str: &str, anon_id: &str) -> String {
    let raw = format!("{anon_id}:{game_id}:{date_str}:sely_leaderboard_v2");
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    let result = hasher.finalize();
    let hex_full: String = result.iter().map(|b| format!("{b:02x}")).collect();
    hex_full[..20].to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_player_nick_determinism() {
        let nick1 = get_player_nick("tr", "2026-09-20", "ply_test_123");
        let nick2 = get_player_nick("tr", "2026-09-20", "ply_test_123");
        assert_eq!(nick1, nick2);
    }

    #[test]
    fn test_player_signature_length() {
        let sig = get_player_signature("echo", "2026-09-20", "ply_test_123");
        assert_eq!(sig.len(), 20);
    }
}
