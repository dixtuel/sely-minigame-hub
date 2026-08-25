export type GameId = "echo" | "knot" | "cut" | "shadow" | "vaka" | "hane" | "spark";

export type GameMeta = {
  id: GameId;
  number: string;
  title: string;
  eyebrow: string;
  accent: string;
  ink: string;
  poster: string;
  motto: string;
  mechanic: string;
  controls: string;
  playTime: string;
};

export const GAME_CATALOG: GameMeta[] = [
  {
    id: "echo",
    number: "01",
    title: "Yankı Odası",
    eyebrow: "Keşif / Risk",
    accent: "#E9563F",
    ink: "#293B75",
    poster: "/manus-storage/yanki-odasi-poster_07ca7169.png",
    motto: "Yolu görme. Onu duy.",
    mechanic: "Üç izi topla, mührü aç ve uzun karanlık koridorda yankı bütçeni koru.",
    controls: "Yön tuşları + Space",
    playTime: "3–5 dk",
  },
  {
    id: "knot",
    number: "02",
    title: "Düğüm",
    eyebrow: "Akış / Bulmaca",
    accent: "#293B75",
    ink: "#E9563F",
    poster: "/manus-storage/dugum-poster_684e5a01.png",
    motto: "Bir düğüm at; bütün akışı değiştir.",
    mechanic: "Karoları çevir ve kaynağı hedefe bağlayan tek akışı kur.",
    controls: "Tıkla veya Enter",
    playTime: "1–3 dk",
  },
  {
    id: "cut",
    number: "03",
    title: "Kırpık",
    eyebrow: "Kesim / Ritim",
    accent: "#654169",
    ink: "#F6F0E3",
    poster: "/manus-storage/kirpik-poster_23817b18.png",
    motto: "Alan açmak için bir şeyi feda et.",
    mechanic: "Tek çizgiyle hareketli şekilleri kes; az enerjiyle büyük zincir kur.",
    controls: "Sürükle ve bırak",
    playTime: "90 sn",
  },
  {
    id: "shadow",
    number: "04",
    title: "Gölge Payı",
    eyebrow: "Zaman / Eşleme",
    accent: "#296A55",
    ink: "#E9563F",
    poster: "/manus-storage/golge-payi-poster_1fa19d71.png",
    motto: "Geçmişteki adımın, şimdi kapıyı açar.",
    mechanic: "Gecikmeli gölgeni iki pede hizala; sonra çıkışı kullan.",
    controls: "Yön tuşları / yön pedi",
    playTime: "2 dk",
  },
  {
    id: "vaka",
    number: "05",
    title: "Vaka",
    eyebrow: "Dedektiflik / Çıkarım",
    accent: "#E5B341",
    ink: "#1B1A1B",
    poster: "/manus-storage/isaretci-poster_681e174b.png",
    motto: "Sözü değil, kanıtı sun.",
    mechanic: "Şüpheliyi işaretle, sonra ifadesiyle çelişen kanıtı sun; yanlış kanıt vakayı açık bırakır.",
    controls: "Tıkla veya dokun",
    playTime: "3–5 dk",
  },
  {
    id: "spark",
    number: "07",
    title: "Kıvılcım",
    eyebrow: "Ritim / Kaçış",
    accent: "#E9563F",
    ink: "#293B75",
    poster: "/manus-storage/kivilcim-poster-v2_5ac4584b.png",
    motto: "Rüzgârı değil, aralığı oku.",
    mechanic: "Bölümler halinde akan baskı koridorunda planörü yönlendir, eşikleri aş ve güvenli damga ritmini kur.",
    controls: "← → yön · ↑ itki · ↓ fren / dokun",
    playTime: "Sonsuz rota",
  },
  {
    id: "hane",
    number: "06",
    title: "Hane",
    eyebrow: "Kayıt / Çıkarım",
    accent: "#E5B341",
    ink: "#293B75",
    poster: "/manus-storage/hane-number-logic-poster_9656a8a5.png",
    motto: "Kanıtı say; kayıt türünü sen seç.",
    mechanic: "Sayı veya sözcük kaydını seç; fişlerdeki işaretlerle her satırda seçenekleri azalt.",
    controls: "Klavye veya dokun",
    playTime: "2–4 dk",
  },
];

const ENGLISH_GAMES: Record<GameId, Pick<GameMeta, "title" | "eyebrow" | "motto" | "mechanic" | "controls" | "playTime">> = {
  echo: { title: "Echo Room", eyebrow: "Explore / Risk", motto: "Do not see the path. Hear it.", mechanic: "Collect three marks, unseal the way, and protect your echo budget through the longer dark corridor.", controls: "Arrow keys + Space", playTime: "3–5 min" },
  knot: { title: "Knot", eyebrow: "Flow / Puzzle", motto: "Tie one knot; change the whole current.", mechanic: "Rotate the tiles and build one clean flow from the source to the target.", controls: "Click or Enter", playTime: "1–3 min" },
  cut: { title: "Cutout", eyebrow: "Cut / Rhythm", motto: "Give something up to make space.", mechanic: "Cut moving shapes with one line; build a large chain with little energy.", controls: "Drag and release", playTime: "90 sec" },
  shadow: { title: "Shadow Share", eyebrow: "Time / Match", motto: "A step in the past opens a door now.", mechanic: "Align your delayed shadow on two pads, then take the exit.", controls: "Arrow keys / direction pad", playTime: "2 min" },
  vaka: { title: "Case", eyebrow: "Detective / Deduction", motto: "Present the evidence, not the word.", mechanic: "Accuse a suspect, then present the clue that contradicts their statement; the wrong clue leaves the case open.", controls: "Click or tap", playTime: "3–5 min" },
  hane: { title: "Hane", eyebrow: "Record / Inference", motto: "Count the evidence; choose the record type.", mechanic: "Choose a number or word record; use the receipt marks to reduce possibilities on every line.", controls: "Keyboard or tap", playTime: "2–4 min" },
  spark: { title: "Spark", eyebrow: "Rhythm / Escape", motto: "Read the gaps, not the wind.", mechanic: "Guide the paper glider through repeating print corridors, clear thresholds on time, and build a safe stamp rhythm.", controls: "← → steer · ↑ thrust · ↓ brake / tap", playTime: "Endless route" },
};

export function getGameCatalog(locale: "tr" | "en") {
  return locale === "tr" ? GAME_CATALOG : GAME_CATALOG.map(game => ({ ...game, ...ENGLISH_GAMES[game.id] }));
}

export const GAME_BY_ID = Object.fromEntries(
  GAME_CATALOG.map(game => [game.id, game])
) as Record<GameId, GameMeta>;

export const gameIdList = GAME_CATALOG.map(game => game.id);
