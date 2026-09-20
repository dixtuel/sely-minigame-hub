//! Hane game level generation (Number & Word mode) and feedback
//! Matches client/src/lib/levelGenerators/hane.ts.

use serde::{Deserialize, Serialize};
use super::rng::Mulberry32;
use super::shadow::index_for;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct HaneLevel {
    pub digits: usize,
    pub max_guesses: usize,
    pub target: String,
    pub allows_repeats: bool,
    pub lesson: String,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum HaneMark {
    #[serde(rename = "exact")]
    Exact,
    #[serde(rename = "present")]
    Present,
    #[serde(rename = "absent")]
    Absent,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct HaneFeedback {
    pub marks: Vec<HaneMark>,
    pub exact: usize,
    pub present: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct HaneWordLevel {
    pub length: usize,
    pub max_guesses: usize,
    pub target: String,
    pub category: String,
    pub category_en: String,
    pub lesson: String,
}

#[derive(Clone, Debug)]
pub struct HaneWordEntry {
    pub word: &'static str,
    pub category: &'static str,
    pub category_en: &'static str,
}

pub const HANE_WORD_POOL_TR_4: &[HaneWordEntry] = &[
    HaneWordEntry { word: "boya", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "çivi", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "harç", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "deri", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "keçe", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "kutu", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "ağaç", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "kaya", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "tepe", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "vadi", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "dere", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "hava", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "yurt", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "kıyı", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "araç", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "rota", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "adım", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "tren", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "gemi", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "yaya", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "akış", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "kapı", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "kule", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "plan", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "ışık", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "koku", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "ufuk", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "akıl", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "izin", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "konu", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "süre", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "soru", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "yazı", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "veri", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "ders", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "oyun", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "nota", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "dans", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "film", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "kupa", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "şiir", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "peri", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "eser", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "şans", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "kira", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "masa", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "saat", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "ayna", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "çatı", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "tava", category: "Gündelik", category_en: "Everyday" },
];

pub const HANE_WORD_POOL_TR_5: &[HaneWordEntry] = &[
    HaneWordEntry { word: "baskı", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "kağıt", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "damga", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "çizgi", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "kalem", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "fırça", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "bahçe", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "çiçek", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "deniz", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "nehir", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "bulut", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "bahar", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "şafak", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "çınar", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "köprü", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "durak", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "yolcu", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "vapur", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "tünel", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "geçit", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "mühür", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "yankı", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "gölge", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "fener", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "izlek", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "bilet", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "çözüm", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "cevap", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "neden", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "anlam", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "işlem", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "metin", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "bilim", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "radyo", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "müzik", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "sahne", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "takım", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "kitap", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "kahve", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "limon", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "şeker", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "ekmek", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "tatlı", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "sayfa", category: "Gündelik", category_en: "Everyday" },
];

pub const HANE_WORD_POOL_EN_4: &[HaneWordEntry] = &[
    HaneWordEntry { word: "tool", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "gear", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "iron", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "wood", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "clay", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "wire", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "rain", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "wind", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "leaf", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "tree", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "rock", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "star", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "moon", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "wave", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "path", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "road", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "gate", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "port", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "ship", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "lane", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "walk", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "dock", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "clue", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "mark", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "code", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "lens", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "mask", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "glow", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "echo", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "sign", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "word", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "page", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "idea", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "fact", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "mind", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "book", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "data", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "read", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "song", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "poem", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "drum", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "myth", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "epic", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "tune", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "arts", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "band", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "desk", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "door", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "time", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "bell", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "card", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "lamp", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "soap", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "home", category: "Gündelik", category_en: "Everyday" },
];

pub const HANE_WORD_POOL_EN_5: &[HaneWordEntry] = &[
    HaneWordEntry { word: "print", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "paper", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "stamp", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "brush", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "forge", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "craft", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "anvil", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "blade", category: "Atölye", category_en: "Workshop" },
    HaneWordEntry { word: "river", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "cloud", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "bloom", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "ocean", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "grove", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "frost", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "earth", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "flame", category: "Doğa", category_en: "Nature" },
    HaneWordEntry { word: "trail", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "route", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "track", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "ferry", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "train", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "canal", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "guide", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "cabin", category: "Yol", category_en: "Journey" },
    HaneWordEntry { word: "trace", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "crypt", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "relic", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "torch", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "spark", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "prism", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "vault", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "quest", category: "Keşif", category_en: "Discovery" },
    HaneWordEntry { word: "logic", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "proof", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "truth", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "query", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "sense", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "study", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "brain", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "focus", category: "Bilgi", category_en: "Knowledge" },
    HaneWordEntry { word: "music", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "radio", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "stage", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "novel", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "dance", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "choir", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "story", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "actor", category: "Kültür", category_en: "Culture" },
    HaneWordEntry { word: "bread", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "sugar", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "lemon", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "clock", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "water", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "fruit", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "glass", category: "Gündelik", category_en: "Everyday" },
    HaneWordEntry { word: "table", category: "Gündelik", category_en: "Everyday" },
];

pub fn to_tr_uppercase(s: &str) -> String {
    s.trim()
        .chars()
        .map(|c| match c {
            'i' => 'İ',
            'ı' => 'I',
            'ç' => 'Ç',
            'ğ' => 'Ğ',
            'ö' => 'Ö',
            'ş' => 'Ş',
            'ü' => 'Ü',
            other => other.to_ascii_uppercase(),
        })
        .collect()
}

pub fn to_en_uppercase(s: &str) -> String {
    s.trim().to_ascii_uppercase()
}

pub fn hane_letters(value: &str, locale: &str) -> Vec<char> {
    if locale == "tr" {
        to_tr_uppercase(value).chars().collect()
    } else {
        to_en_uppercase(value).chars().collect()
    }
}

pub fn generate_hane_level(seed: u32, mastery: u32) -> HaneLevel {
    let mut random = Mulberry32::new(seed ^ (((mastery as i32 + 17).wrapping_mul(0x45d9f3b)) as u32));
    let digits = if mastery >= 4 { 5 } else { 4 };
    let allows_repeats = mastery >= 3;
    let mut values: Vec<char> = Vec::with_capacity(digits);

    while values.len() < digits {
        let d = (random.next_f64() * 10.0).floor() as u32;
        let d_char = char::from_digit(d, 10).unwrap_or('0');
        if values.is_empty() && d_char == '0' {
            continue;
        }
        if !allows_repeats && values.contains(&d_char) {
            continue;
        }
        values.push(d_char);
    }

    let lesson = if allows_repeats {
        "Yerinde işareti doğru hane ve doğru sırayı; izde işareti doğru haneyi ama başka sırayı gösterir. Aynı hane birden fazla kez sayılabilir.".to_string()
    } else {
        "Yerinde işareti doğru hane ve doğru sırayı; izde işareti doğru haneyi ama başka sırayı gösterir. Günün kaydında haneler tekrar etmez.".to_string()
    };

    HaneLevel {
        digits,
        max_guesses: std::cmp::max(4, 7 - mastery as usize),
        target: values.into_iter().collect(),
        allows_repeats,
        lesson,
    }
}

pub fn is_hane_guess_valid(guess: &str, digits: usize) -> bool {
    let bytes = guess.as_bytes();
    if bytes.len() != digits {
        return false;
    }
    if bytes[0] < b'1' || bytes[0] > b'9' {
        return false;
    }
    for &b in &bytes[1..] {
        if b < b'0' || b > b'9' {
            return false;
        }
    }
    true
}

pub fn compare_hane_number_guess(target: &str, guess: &str) -> HaneFeedback {
    let target_digits: Vec<char> = target.chars().collect();
    let guess_digits: Vec<char> = guess.chars().collect();
    let len = target_digits.len();

    let mut marks = vec![HaneMark::Absent; len];
    let mut remaining_target: Vec<char> = Vec::new();
    let mut pending: Vec<usize> = Vec::new();
    let mut exact = 0;

    for i in 0..len {
        if i < guess_digits.len() && target_digits[i] == guess_digits[i] {
            marks[i] = HaneMark::Exact;
            exact += 1;
        } else {
            remaining_target.push(target_digits[i]);
            pending.push(i);
        }
    }

    let mut present = 0;
    for &i in &pending {
        if i < guess_digits.len() {
            let ch = guess_digits[i];
            if let Some(pos) = remaining_target.iter().position(|&x| x == ch) {
                marks[i] = HaneMark::Present;
                present += 1;
                remaining_target.remove(pos);
            }
        }
    }

    HaneFeedback { marks, exact, present }
}

pub fn generate_hane_word_level(seed: u32, mastery: u32, locale: &str) -> HaneWordLevel {
    const HANE_WORD_LENGTHS: [usize; 2] = [4, 5];
    let length = HANE_WORD_LENGTHS[index_for(seed, 991, HANE_WORD_LENGTHS.len())];

    let pool: &[HaneWordEntry] = if locale == "en" {
        if length == 4 { HANE_WORD_POOL_EN_4 } else { HANE_WORD_POOL_EN_5 }
    } else {
        if length == 4 { HANE_WORD_POOL_TR_4 } else { HANE_WORD_POOL_TR_5 }
    };

    let salt = 71 + mastery * 19;
    let mixed_seed = seed ^ (((mastery as i32 + 31).wrapping_mul(0x27d4eb2d)) as u32);
    let entry = &pool[index_for(mixed_seed, salt, pool.len())];

    let target = hane_letters(entry.word, locale).into_iter().collect();

    let lesson = if locale == "en" {
        "Read each mark in context with previous slips. A letter leaves a trace only as many times as it appears in the target.".to_string()
    } else {
        "Her işareti tek başına değil, önceki fişlerle birlikte oku. Aynı harf hedefte bulunduğu kadar iz bırakır.".to_string()
    };

    HaneWordLevel {
        length,
        max_guesses: std::cmp::max(4, 7 - mastery as usize),
        target,
        category: entry.category.to_string(),
        category_en: entry.category_en.to_string(),
        lesson,
    }
}

pub fn compare_hane_word_guess(target: &str, guess: &str, locale: &str) -> HaneFeedback {
    let target_letters = hane_letters(target, locale);
    let guess_letters = hane_letters(guess, locale);
    let len = target_letters.len();

    let mut marks = vec![HaneMark::Absent; len];
    let mut remaining_target: Vec<char> = Vec::new();
    let mut pending: Vec<usize> = Vec::new();
    let mut exact = 0;

    for i in 0..len {
        if i < guess_letters.len() && target_letters[i] == guess_letters[i] {
            marks[i] = HaneMark::Exact;
            exact += 1;
        } else {
            remaining_target.push(target_letters[i]);
            pending.push(i);
        }
    }

    let mut present = 0;
    for &i in &pending {
        if i < guess_letters.len() {
            let ch = guess_letters[i];
            if let Some(pos) = remaining_target.iter().position(|&x| x == ch) {
                marks[i] = HaneMark::Present;
                present += 1;
                remaining_target.remove(pos);
            }
        }
    }

    HaneFeedback { marks, exact, present }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hane_number_level_generation() {
        let level = generate_hane_level(42, 1);
        assert_eq!(level.digits, 4);
        assert_eq!(level.target.len(), 4);
        assert!(!level.allows_repeats);
        assert!(is_hane_guess_valid(&level.target, 4));
    }

    #[test]
    fn test_compare_hane_number_guess() {
        let target = "1234";
        let guess = "1325";
        let feedback = compare_hane_number_guess(target, guess);
        assert_eq!(feedback.exact, 1); // '1' is exact
        assert_eq!(feedback.present, 2); // '3' and '2' are present
        assert_eq!(feedback.marks, vec![HaneMark::Exact, HaneMark::Present, HaneMark::Present, HaneMark::Absent]);
    }

    #[test]
    fn test_compare_hane_number_repeated_digits() {
        let target = "1123";
        let guess = "1214";
        let feedback = compare_hane_number_guess(target, guess);
        assert_eq!(feedback.exact, 1); // index 0: '1' is exact
        assert_eq!(feedback.present, 2); // '2' and '1' are present
        assert_eq!(feedback.marks[3], HaneMark::Absent);
    }

    #[test]
    fn test_hane_word_level_tr() {
        let level = generate_hane_word_level(1234, 1, "tr");
        assert!(level.length == 4 || level.length == 5);
        assert_eq!(level.target.chars().count(), level.length);
        assert!(!level.category.is_empty());
    }

    #[test]
    fn test_hane_turkish_uppercase() {
        assert_eq!(to_tr_uppercase("çivi"), "ÇİVİ");
        assert_eq!(to_tr_uppercase("ışık"), "IŞIK");
        assert_eq!(to_tr_uppercase("baskı"), "BASKI");
    }
}
