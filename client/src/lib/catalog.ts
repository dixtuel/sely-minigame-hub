export type GameId =
  | "echo"
  | "vaka"
  | "hane"
  | "spark"
  | "knot"
  | "cut"
  | "shadow"
  | "asteroids"
  | "sokoban"
  | "tetris"
  | "lander"
  | "lightsout"
  | "game2048"
  | "coil"
  | "apex"
  | "lift"
  | "breakline";

export type GameCategory = "strategy" | "puzzle" | "arcade";

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
  category: GameCategory;
  tags: string[];
};

export const GAME_CATALOG: GameMeta[] = [
  {
    id: "echo",
    number: "01",
    title: "Yankı Odası",
    eyebrow: "Keşif / Risk",
    accent: "#E9563F",
    ink: "#293B75",
    poster: "/storage/yanki-odasi-poster_07ca7169.png",
    motto: "Yolu görme. Onu duy.",
    mechanic: "Üç izi topla, mührü aç ve uzun karanlık koridorda yankı bütçeni koru.",
    controls: "Yön tuşları + Space",
    playTime: "3–5 dk",
    category: "arcade",
    tags: ["arcade", "keşif", "risk", "3d", "labirent", "hayatta kalma", "exploration", "survival", "maze"],
  },
  {
    id: "vaka",
    number: "02",
    title: "Vaka",
    eyebrow: "Dedektiflik / Çıkarım",
    accent: "#E5B341",
    ink: "#1B1A1B",
    poster: "/storage/isaretci-poster_681e174b.png",
    motto: "Sözü değil, kanıtı sun.",
    mechanic: "Şüpheliyi işaretle, sonra ifadesiyle çelişen kanıtı sun; yanlış kanıt vakayı açık bırakır.",
    controls: "Tıkla veya dokun",
    playTime: "3–5 dk",
    category: "strategy",
    tags: ["strateji", "dedektiflik", "çıkarım", "mantık", "kanıt", "soruşturma", "detective", "deduction", "logic", "strategy"],
  },
  {
    id: "tetris",
    number: "03",
    title: "Dörtyol",
    eyebrow: "Geometri / Hız",
    accent: "#296A55",
    ink: "#E9563F",
    poster: "/storage/tetris-poster_184bd73e.jpg",
    motto: "Hatalar üst üste biner, başarılar silinir.",
    mechanic: "Düşen blokları döndürerek tam satırlar oluştur; temizlenen her satırla oyun hızlanır.",
    controls: "Yön tuşları (Yukarı: Döndür, Aşağı: Düşür)",
    playTime: "3–8 dk",
    category: "arcade",
    tags: ["arcade", "tetris", "blok", "geometri", "hız", "refleks", "puzzle", "retro"],
  },
  {
    id: "spark",
    number: "04",
    title: "Kıvılcım",
    eyebrow: "Ark / Kaçış",
    accent: "#E9563F",
    ink: "#293B75",
    poster: "/storage/kivilcim-poster-v2_5ac4584b.png",
    motto: "Kıvılcım sönmez; yerçekimine ve yüksek gerilime diren.",
    mechanic: "Ekrana dokunarak veya boşluk tuşuyla kıvılcımı havada tut, yüksek gerilim direkleri ve plazma arklarının arasından süzül.",
    controls: "Boşluk / Tıkla / Dokun",
    playTime: "Sonsuz uçuş",
    category: "arcade",
    tags: ["arcade", "refleks", "kaçış", "hız", "ark", "sonsuz uçuş", "action", "reflex", "runner", "endless"],
  },
  {
    id: "knot",
    number: "05",
    title: "Düğüm",
    eyebrow: "Akış / Bulmaca",
    accent: "#293B75",
    ink: "#E9563F",
    poster: "/storage/dugum-poster_684e5a01.png",
    motto: "Bir düğüm at; bütün akışı değiştir.",
    mechanic: "Karoları çevir ve kaynağı hedefe bağlayan tek akışı kur.",
    controls: "Tıkla veya Enter",
    playTime: "1–3 dk",
    category: "puzzle",
    tags: ["bulmaca", "akış", "topoloji", "bağlantı", "mantık", "rota", "puzzle", "flow", "topology", "logic"],
  },
  {
    id: "cut",
    number: "06",
    title: "Kırpık",
    eyebrow: "Kesim / Ritim",
    accent: "#654169",
    ink: "#F6F0E3",
    poster: "/storage/kirpik-poster_23817b18.png",
    motto: "Alan açmak için bir şeyi feda et.",
    mechanic: "Tek çizgiyle hareketli şekilleri kes; az enerjiyle büyük zincir kur.",
    controls: "Sürükle ve bırak",
    playTime: "90 sn",
    category: "arcade",
    tags: ["arcade", "kesim", "ritim", "geometri", "beceri", "refleks", "rhythm", "slice", "geometry", "skill"],
  },
  {
    id: "shadow",
    number: "07",
    title: "Gölge Payı",
    eyebrow: "Zaman / Eşleme",
    accent: "#296A55",
    ink: "#E9563F",
    poster: "/storage/golge-payi-poster_1fa19d71.png",
    motto: "Geçmişteki adımın, şimdi kapıyı açar.",
    mechanic: "Gecikmeli gölgeni iki pede hizala; sonra çıkışı kullan.",
    controls: "Yön tuşları / yön pedi",
    playTime: "2 dk",
    category: "strategy",
    tags: ["strateji", "bulmaca", "zaman", "eşleme", "gölge", "koordinasyon", "strategy", "puzzle", "time-travel", "shadow"],
  },
  {
    id: "hane",
    number: "08",
    title: "Hane",
    eyebrow: "Kayıt / Çıkarım",
    accent: "#E5B341",
    ink: "#293B75",
    poster: "/storage/hane-number-logic-poster_9656a8a5.png",
    motto: "Kanıtı say; kayıt türünü sen seç.",
    mechanic: "Sayı veya sözcük kaydını seç; fişlerdeki işaretlerle her satırda seçenekleri azalt.",
    controls: "Klavye veya dokun",
    playTime: "2–4 dk",
    category: "puzzle",
    tags: ["bulmaca", "mantık", "sayı", "kelime", "çıkarım", "kayıt", "puzzle", "wordle", "numbers", "logic"],
  },
  {
    id: "asteroids",
    number: "09",
    title: "Göktaşı",
    eyebrow: "Vektör / Savunma",
    accent: "#E9563F",
    ink: "#1B1A1B",
    poster: "/storage/asteroids-poster_6700a000.jpg",
    motto: "Parçalanan her kaya yeni bir tehdittir.",
    mechanic: "Uzay aracını yönlendir, dev asteroitleri ve akın eden uzaylı gemilerini vurup parçala.",
    controls: "Sol/Sağ: Dön, Yukarı: İtme, Boşluk: Ateş",
    playTime: "3–5 dk",
    category: "arcade",
    tags: ["arcade", "vektör", "uzay", "aksiyon", "göktaşı", "space", "shooter", "asteroids", "retro"],
  },
  {
    id: "sokoban",
    number: "10",
    title: "İstif",
    eyebrow: "Mekan / Mantık",
    accent: "#E5B341",
    ink: "#293B75",
    poster: "/storage/sokoban-poster_c3ef353a.jpg",
    motto: "Köşeye sıkışan kutu geri gelmez.",
    mechanic: "Kutuları iterek hedef noktalarına yerleştir; hiçbir kutuyu çekemezsin, her adımı önceden planla.",
    controls: "Yön tuşları / WASD + U (Geri Al)",
    playTime: "3–6 dk",
    category: "puzzle",
    tags: ["bulmaca", "mantık", "istif", "kutu", "strateji", "sokoban", "warehouse", "puzzle", "undo"],
  },
  {
    id: "lander",
    number: "11",
    title: "İniş",
    eyebrow: "Yerçekimi / İniş",
    accent: "#654169",
    ink: "#1B1A1B",
    poster: "/storage/lander-poster_618faf0f.jpg",
    motto: "Hızını düşür, açını düzelt, zemine usulca dokun.",
    mechanic: "Yerçekimine karşı itiş gücünü kullan, piste nazikçe in.",
    controls: "Yukarı: İtme, Sol/Sağ: Eğim",
    playTime: "2–4 dk",
    category: "strategy",
    tags: ["strateji", "fizik", "iniş", "yerçekimi", "ay", "lander", "moon", "gravity", "thrust"],
  },
  {
    id: "lightsout",
    number: "12",
    title: "Şebeke",
    eyebrow: "Şebeke / Düğüm",
    accent: "#E5B341",
    ink: "#293B75",
    poster: "/storage/lightsout-poster_e388a028.jpg",
    motto: "Bir düğüm yanarsa, komşuları da söner.",
    mechanic: "Düğümlere dokunarak tüm şebekeyi karanlığa kavuştur.",
    controls: "Hücrelere tıkla / dokun",
    playTime: "2–5 dk",
    category: "puzzle",
    tags: ["bulmaca", "mantık", "ışık", "şebeke", "düğüm", "lightsout", "grid", "puzzle", "toggle"],
  },
  {
    id: "game2048",
    number: "13",
    title: "Kare 2048",
    eyebrow: "Birleştir / 2048",
    accent: "#E9563F",
    ink: "#293B75",
    poster: "/storage/2048-poster_da0f7f56.jpg",
    motto: "Aynı sayılar birleşir; alan daralırken sakin kal.",
    mechanic: "Karoları kaydırarak sayıları katla, 2048 karosuna ulaş.",
    controls: "Ok tuşları / Dokunmatik kaydırma",
    playTime: "3–10 dk",
    category: "puzzle",
    tags: ["bulmaca", "sayı", "strateji", "matris", "2048", "puzzle", "merge", "slide"],
  },
  {
    id: "coil",
    number: "14",
    title: "Coil",
    eyebrow: "Rota / Refleks",
    accent: "#296A55",
    ink: "#F6F0E3",
    poster: "/storage/coil-poster.png",
    motto: "Dönüşü önceden gör.",
    mechanic: "Meyveleri toplayıp yılanını büyüt; kenara ve kendi kuyruğuna çarpmadan rekorunu yükselt.",
    controls: "Yön tuşları / WASD / Dört yönde kaydır",
    playTime: "2–5 dk",
    category: "arcade",
    tags: ["arcade", "snake", "refleks", "rota", "touch", "grid"],
  },
  {
    id: "apex",
    number: "15",
    title: "Apex",
    eyebrow: "Yarış / Çizgi",
    accent: "#E9563F",
    ink: "#F6F0E3",
    poster: "/storage/apex-poster.png",
    motto: "Çizgiyi koru, ritmi yükselt.",
    mechanic: "Dört şeritli otobanda trafiğe dal; hızını ayarla ve yakın geçişlerle seri kur.",
    controls: "←/→ veya A/D · W/↑ gaz · S/↓ fren · Dokunmatik: kaydır + gaz/fren",
    playTime: "2–4 dk",
    category: "arcade",
    tags: ["arcade", "race", "reflex", "procedural", "touch", "speed"],
  },
  {
    id: "lift",
    number: "16",
    title: "Lift",
    eyebrow: "Dikey / Ritim",
    accent: "#E5B341",
    ink: "#1B1A1B",
    poster: "/storage/lift-poster.png",
    motto: "Bir sonraki zemini bul.",
    mechanic: "Platformlara sekerek yüksel; ekran kaydıkça daha dar ve hızlı bir rota kurulur.",
    controls: "Sol/Sağ veya A/D / Dokun",
    playTime: "2–5 dk",
    category: "arcade",
    tags: ["arcade", "platform", "jump", "vertical", "touch", "skill"],
  },
  {
    id: "breakline",
    number: "17",
    title: "Breakline",
    eyebrow: "Ark / Kırılma",
    accent: "#654169",
    ink: "#F6F0E3",
    poster: "/storage/breakline-poster.png",
    motto: "Bir hattı kır; zinciri sürdür.",
    mechanic: "Topu çizgide tutup günlük tuğla dizisini temizle; her kırılma yeni bir açı açar.",
    controls: "Sol/Sağ veya imleç / Dokun",
    playTime: "2–6 dk",
    category: "arcade",
    tags: ["arcade", "brick breaker", "reflex", "ball", "touch", "score"],
  },
];

const ENGLISH_GAMES: Record<GameId, Pick<GameMeta, "title" | "eyebrow" | "motto" | "mechanic" | "controls" | "playTime">> = {
  echo: { title: "Echo Room", eyebrow: "Explore / Risk", motto: "Do not see the path. Hear it.", mechanic: "Collect three marks, unseal the way, and protect your echo budget through the longer dark corridor.", controls: "Arrow keys + Space", playTime: "3–5 min" },
  knot: { title: "Knot", eyebrow: "Flow / Puzzle", motto: "Tie one knot; change the whole current.", mechanic: "Rotate the tiles and build one clean flow from the source to the target.", controls: "Click or Enter", playTime: "1–3 min" },
  cut: { title: "Cutout", eyebrow: "Cut / Rhythm", motto: "Give something up to make space.", mechanic: "Cut moving shapes with one line; build a large chain with little energy.", controls: "Drag and release", playTime: "90 sec" },
  shadow: { title: "Shadow Share", eyebrow: "Time / Match", motto: "A step in the past opens a door now.", mechanic: "Align your delayed shadow on two pads, then take the exit.", controls: "Arrow keys / direction pad", playTime: "2 min" },
  vaka: { title: "Case", eyebrow: "Detective / Deduction", motto: "Present the evidence, not the word.", mechanic: "Accuse a suspect, then present the clue that contradicts their statement; the wrong clue leaves the case open.", controls: "Click or tap", playTime: "3–5 min" },
  hane: { title: "Hane", eyebrow: "Record / Inference", motto: "Count the evidence; choose the record type.", mechanic: "Choose a number or word record; use the receipt marks to reduce possibilities on every line.", controls: "Keyboard or tap", playTime: "2–4 min" },
  spark: { title: "Spark", eyebrow: "Traffic / Escape", motto: "There is always one open lane.", mechanic: "Dodge endless traffic and road hazards, spot the lane that's always open before it's too late, and collect bonuses along the way.", controls: "← → change lane / tap", playTime: "Endless route" },
  asteroids: { title: "Asteroids", eyebrow: "Vector / Defense", motto: "Every broken rock is a new threat.", mechanic: "Pilot your ship, blast giant asteroids and dodge alien spacecraft across deep space.", controls: "Left/Right: Turn, Up: Thrust, Space: Fire", playTime: "3–5 min" },
  sokoban: { title: "Sokoban", eyebrow: "Spatial / Logic", motto: "A box pushed into a corner is lost forever.", mechanic: "Push boxes onto their designated storage targets; plan each step carefully with full undo support.", controls: "Arrow keys / WASD + U (Undo)", playTime: "3–6 min" },
  tetris: { title: "Tetris", eyebrow: "Geometry / Pace", motto: "Mistakes pile up, achievements vanish.", mechanic: "Rotate and fit falling polyominoes into complete lines to clear the court and level up.", controls: "Arrow keys (Up: Rotate, Down: Drop)", playTime: "3–8 min" },
  lander: { title: "Lander", eyebrow: "Gravity / Fuel", motto: "Gravity never forgives; fuel is life.", mechanic: "Use angular RCS and main thrusters to guide the delicate lunar module onto the landing pad.", controls: "Left/Right: Attitude, Up: Main Thruster", playTime: "2–4 min" },
  lightsout: { title: "Lights Out", eyebrow: "Matrix / Toggle", motto: "Switch one light, its neighbors toggle.", mechanic: "Every touched node inverts itself and four adjacent cells; switch off the entire electrical grid.", controls: "Click or tap", playTime: "2–5 min" },
  game2048: { title: "2048", eyebrow: "Merge / Order", motto: "Identical numbers unite into exponential power.", mechanic: "Slide tiles across the 4x4 grid in four directions to merge matching powers of two up to 2048.", controls: "Arrow keys or Swipe", playTime: "5–10 min" },
  coil: { title: "Coil", eyebrow: "Route / Reflex", motto: "See the turn before it arrives.", mechanic: "Collect fruit and grow your snake; chase a new high score without hitting the edge or your own tail.", controls: "Arrow keys / WASD / Swipe in any direction", playTime: "2–5 min" },
  apex: { title: "Apex", eyebrow: "Race / Line", motto: "Hold the line and raise the rhythm.", mechanic: "Thread through four lanes of traffic, balance speed and build a clean-pass streak.", controls: "←/→ or A/D · W/↑ throttle · S/↓ brake · Swipe + pedals on touch", playTime: "2–4 min" },
  lift: { title: "Lift", eyebrow: "Vertical / Rhythm", motto: "Find the next floor.", mechanic: "Bounce from platform to platform while the route scrolls upward and tightens.", controls: "Left/Right or A/D / Tap", playTime: "2–5 min" },
  breakline: { title: "Breakline", eyebrow: "Arc / Break", motto: "Break one line and keep the chain.", mechanic: "Keep the ball in play and clear the daily brick pattern one angle at a time.", controls: "Left/Right or cursor / Tap", playTime: "2–6 min" },
};

export function getGameCatalog(locale: "tr" | "en") {
  return locale === "tr" ? GAME_CATALOG : GAME_CATALOG.map(game => ({ ...game, ...ENGLISH_GAMES[game.id] }));
}

export const GAME_BY_ID = Object.fromEntries(
  GAME_CATALOG.map(game => [game.id, game])
) as Record<GameId, GameMeta>;

export const gameIdList = GAME_CATALOG.map(game => game.id);
