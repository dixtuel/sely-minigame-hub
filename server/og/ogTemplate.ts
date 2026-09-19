import { GAME_POSTERS_DATA_URI } from "./postersDataUri";

export type OgParams = {
  game?: string;
  score?: number;
  nick?: string;
  rank?: string;
  outcome?: "success" | "failure" | "solved" | "dismissed";
  grade?: "S" | "A" | "B" | "C";
  caseTitle?: string;
  suspect?: string;
  locale?: "tr" | "en";
  date?: string;
};

type GameTheme = {
  num: string;
  title: string;
  titleEn: string;
  eyebrow: string;
  eyebrowEn: string;
  motto: string;
  mottoEn: string;
  mechanic: string;
  mechanicEn: string;
  controls: string;
  controlsEn: string;
  playTime: string;
  poster: string;
  accent: string;
  ink: string;
  icon: string;
};

const GAME_CATALOG_META: Record<string, GameTheme> = {
  echo: {
    num: "01",
    title: "YANKI ODASI",
    titleEn: "ECHO ROOM",
    eyebrow: "KEŞİF / RİSK",
    eyebrowEn: "EXPLORE / RISK",
    motto: "Yolu görme. Onu duy.",
    mottoEn: "Do not see the path. Hear it.",
    mechanic: "Üç izi topla, mührü aç ve yankı bütçeni koru.",
    mechanicEn: "Collect three marks, unseal the way, preserve echo budget.",
    controls: "Yön tuşları + Space",
    controlsEn: "Arrow keys + Space",
    playTime: "3–5 dk",
    poster: "https://sely.tr/storage/yanki-odasi-poster_07ca7169.png",
    accent: "#E9563F",
    ink: "#293B75",
    icon: "◎",
  },
  knot: {
    num: "02",
    title: "DÜĞÜM",
    titleEn: "KNOT",
    eyebrow: "AKIŞ / BULMACA",
    eyebrowEn: "FLOW / PUZZLE",
    motto: "Bir düğüm at; bütün akışı değiştir.",
    mottoEn: "Tie one knot; change the whole current.",
    mechanic: "Karoları çevir ve kaynağı hedefe bağlayan tek akışı kur.",
    mechanicEn: "Rotate tiles and build clean flow from source to target.",
    controls: "Tıkla veya Enter",
    controlsEn: "Click or Enter",
    playTime: "1–3 dk",
    poster: "https://sely.tr/storage/dugum-poster_684e5a01.png",
    accent: "#293B75",
    ink: "#E9563F",
    icon: "☍",
  },
  cut: {
    num: "03",
    title: "KIRPIK",
    titleEn: "CUTOUT",
    eyebrow: "KESİM / RİTİM",
    eyebrowEn: "CUT / RHYTHM",
    motto: "Alan açmak için bir şeyi feda et.",
    mottoEn: "Give something up to make space.",
    mechanic: "Tek çizgiyle hareketli şekilleri kes; büyük zincir kur.",
    mechanicEn: "Cut moving shapes with one line; build large chain.",
    controls: "Sürükle ve bırak",
    controlsEn: "Drag and release",
    playTime: "90 sn",
    poster: "https://sely.tr/storage/kirpik-poster_23817b18.png",
    accent: "#654169",
    ink: "#1B1A1B",
    icon: "◧",
  },
  shadow: {
    num: "04",
    title: "GÖLGE PAYI",
    titleEn: "SHADOW SHARE",
    eyebrow: "ZAMAN / EŞLEME",
    eyebrowEn: "TIME / MATCH",
    motto: "Geçmişteki adımın, şimdi kapıyı açar.",
    mottoEn: "A step in the past opens a door now.",
    mechanic: "Gecikmeli gölgeni iki pede hizala; sonra çıkışı kullan.",
    mechanicEn: "Align delayed shadow on two pads, then take the exit.",
    controls: "Yön tuşları / yön pedi",
    controlsEn: "Arrow keys / direction pad",
    playTime: "2 dk",
    poster: "https://sely.tr/storage/golge-payi-poster_1fa19d71.png",
    accent: "#296A55",
    ink: "#E9563F",
    icon: "◐",
  },
  vaka: {
    num: "05",
    title: "VAKA",
    titleEn: "CASE",
    eyebrow: "DEDEKTİFLİK / ÇIKARIM",
    eyebrowEn: "DETECTIVE / DEDUCTION",
    motto: "Sözü değil, kanıtı sun.",
    mottoEn: "Present the evidence, not the word.",
    mechanic: "Şüpheliyi işaretle, ifadesiyle çelişen kanıtı sun.",
    mechanicEn: "Accuse suspect, present contradiction evidence.",
    controls: "Tıkla veya dokun",
    controlsEn: "Click or tap",
    playTime: "3–5 dk",
    poster: "https://sely.tr/storage/isaretci-poster_681e174b.png",
    accent: "#E5B341",
    ink: "#1B1A1B",
    icon: "⚖",
  },
  hane: {
    num: "06",
    title: "HANE",
    titleEn: "HANE",
    eyebrow: "KAYIT / ÇIKARIM",
    eyebrowEn: "RECORD / INFERENCE",
    motto: "Kanıtı say; kayıt türünü sen seç.",
    mottoEn: "Count the evidence; choose the record type.",
    mechanic: "Sayı veya sözcük kaydında seçenekleri azalt.",
    mechanicEn: "Deduce number or word patterns from receipt clues.",
    controls: "Klavye veya dokun",
    controlsEn: "Keyboard or tap",
    playTime: "2–4 dk",
    poster: "https://sely.tr/storage/hane-number-logic-poster_9656a8a5.png",
    accent: "#E5B341",
    ink: "#293B75",
    icon: "▦",
  },
  spark: {
    num: "07",
    title: "KIVILCIM",
    titleEn: "SPARK",
    eyebrow: "ARK / KAÇIŞ",
    eyebrowEn: "ARC / ESCAPE",
    motto: "Kıvılcım sönmez; yerçekimine diren.",
    mottoEn: "The spark endures; resist the current.",
    mechanic: "Boşluk tuşuyla süzül, yüksek gerilim direklerinden kaç.",
    mechanicEn: "Dodge obstacles and plasma arcs in endless flight.",
    controls: "Boşluk / Dokun",
    controlsEn: "Space / Tap",
    playTime: "Sonsuz uçuş",
    poster: "https://sely.tr/storage/kivilcim-poster-v2_5ac4584b.png",
    accent: "#E9563F",
    ink: "#293B75",
    icon: "⚡",
  },
};

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getPerformanceNotice(score: number | undefined, isEn: boolean): string {
  if (typeof score !== "number" || score <= 0) {
    return isEn
      ? "· SELY Daily Challenge · Can you beat it?"
      : "· SELY Günün Seviyesi · Bu skoru geçebilir misin?";
  }
  if (score >= 2000) {
    return isEn
      ? "★ Master Score: Flawless run, beat this if you can!"
      : "★ Zirve Skoru: Kusursuz tur, geçebilen çıksın!";
  }
  if (score >= 1000) {
    return isEn
      ? "▲ Sharp Run: High precision finish, pure skill!"
      : "▲ Usta Turu: Kusursuz reflekslerle hedefi aştı!";
  }
  if (score >= 400) {
    return isEn
      ? "◆ Great Run: Cleared today's level clean!"
      : "◆ Başarılı Tur: Günün seviyesini tek nefeste bitirdi!";
  }
  return isEn
    ? "● Solid Finish: Level cleared, your turn now!"
    : "● Temiz Bitiş: Günün turunu tamamladı, sıra sende!";
}

/**
 * Generates an authentic SELY editorial/brutalist SVG card (1200x630).
 * Matches sely.tr's real design system: cream paper (#F6F0E3), deep ink (#1B1A1B),
 * coral accent (#E9563F), game catalog posters, brutalist shadows, and typography.
 * Supports both Daily Level Expedition banners and Finished Run Scorecards.
 */
export function generateOgSvg(params: OgParams): string {
  const isEn = params.locale === "en";
  const gameKey = (params.game || "hub").toLowerCase();
  const theme = GAME_CATALOG_META[gameKey] || {
    num: "00",
    title: "SELY RETRO",
    titleEn: "SELY RETRO",
    eyebrow: "OYUN KATALOĞU",
    eyebrowEn: "GAME CATALOGUE",
    motto: "Küçük kural, büyük yankı.",
    mottoEn: "Minimal rules, lasting echoes.",
    mechanic: "Özgün kurallarla minimalist retro web oyunları.",
    mechanicEn: "Minimalist retro web games with original rules.",
    controls: "Tarayıcıda hemen oyna",
    controlsEn: "Play instantly in browser",
    playTime: "1–5 dk",
    poster: "https://sely.tr/storage/sely-social-card-title_b4649a50.png",
    accent: "#E9563F",
    ink: "#1B1A1B",
    icon: "❖",
  };

  const hasScore = typeof params.score === "number";
  const gameTitle = isEn ? theme.titleEn : theme.title;
  const gameEyebrow = isEn ? theme.eyebrowEn : theme.eyebrow;
  const gameMotto = escapeXml(isEn ? theme.mottoEn : theme.motto);
  const gameMechanic = escapeXml(isEn ? theme.mechanicEn : theme.mechanic);
  const nick = escapeXml(params.nick ? params.nick.toUpperCase() : (isEn ? "PLAYER" : "OYUNCU"));
  const scoreText = hasScore ? params.score!.toLocaleString(isEn ? "en-US" : "tr-TR") : "";
  const dateStr = escapeXml(params.date || new Date().toISOString().slice(0, 10));
  const performanceNotice = escapeXml(getPerformanceNotice(params.score, isEn));
  const posterDataUri = GAME_POSTERS_DATA_URI[gameKey] || theme.poster;

  // ==========================================
  // ÖZEL VAKA GİZEMİ / POLİS ARŞİV DOSYASI
  // ==========================================
  if (gameKey === "vaka") {
    const isSolved = params.outcome === "solved" || params.outcome === "success";
    const grade = params.grade || (isSolved ? "S" : "C");
    const stampColor = isSolved ? "#15803d" : "#b91c1c";
    const stampBg = isSolved ? "#dcfce7" : "#fee2e2";
    const stampBorder = isSolved ? "#16a34a" : "#dc2626";
    const stampText = isSolved
      ? (isEn ? "CASE SOLVED" : "VAKA ÇÖZÜLDÜ")
      : (isEn ? "CASE DISMISSED" : "DAVA DÜŞTÜ");
    const stampSub = isSolved
      ? (isEn ? "PERPETRATOR CONVICTED" : "SUÇLU İTİRAF ETTİ")
      : (isEn ? "INSUFFICIENT EVIDENCE" : "DELİL YETERSİZLİĞİ");

    const caseName = escapeXml(params.caseTitle || (isEn ? "Confidential Bureau Dossier" : "Gizli Büro Dosyası"));
    const suspectText = params.suspect ? escapeXml(params.suspect) : (isEn ? "Key Suspect" : "Asıl Şüpheli");

    // Vaka Günlük Sefer Afişi (Henüz skor yapılmadıysa)
    if (!hasScore) {
      return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="vakaDots" width="16" height="16" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" fill="#1B1A1B" fill-opacity="0.09" />
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="#F4EBD9" />
  <rect width="1200" height="630" fill="url(#vakaDots)" />

  <rect x="24" y="24" width="1152" height="582" fill="none" stroke="#1B1A1B" stroke-width="3" />
  <rect x="32" y="32" width="1136" height="566" fill="none" stroke="#1B1A1B" stroke-width="1" stroke-dasharray="8 4" opacity="0.4" />

  <g transform="translate(72, 60)">
    <rect width="5" height="500" fill="#B91C1C" />
    <text transform="rotate(-90)" x="-470" y="-12" font-family="Courier New, monospace" font-size="10.5" font-weight="700" fill="#1B1A1B" letter-spacing="2">SELY POLİS SORGU BÜROSU · GİZLİ VAKA DEDEKTİF DOSYASI</text>
  </g>

  <g transform="translate(110, 75)">
    <rect x="0" y="0" width="180" height="32" fill="#1B1A1B" />
    <text x="90" y="21" text-anchor="middle" font-family="Courier New, monospace" font-size="13" font-weight="700" fill="#F4EBD9" letter-spacing="2">GÜNÜN DOSYASI #05</text>
    <text x="200" y="22" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="800" fill="#B91C1C" letter-spacing="3">SELY.TR · ADLİ SORUŞTURMA</text>
    <text x="0" y="80" font-family="Courier New, monospace" font-size="40" font-weight="800" fill="#1B1A1B" letter-spacing="-0.5">CİNAYET DOSYASI: ${caseName}</text>
  </g>

  <g transform="translate(110, 195)">
    <rect x="10" y="10" width="400" height="300" fill="#1B1A1B" />
    <rect width="400" height="300" fill="#FFFCF5" stroke="#1B1A1B" stroke-width="2.5" />
    <image href="${posterDataUri}" x="0" y="0" width="400" height="300" preserveAspectRatio="xMidYMid slice" />
    <rect width="400" height="8" fill="#E5B341" />
  </g>

  <g transform="translate(550, 195)">
    <rect x="10" y="10" width="570" height="300" fill="#1B1A1B" />
    <rect width="570" height="300" fill="#FFFCF5" stroke="#1B1A1B" stroke-width="2.5" />
    <rect width="570" height="8" fill="#B91C1C" />

    <text x="40" y="52" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" fill="#B91C1C" letter-spacing="2">GÜNLÜK ADLİ SORUŞTURMA EMRİ</text>
    <text x="40" y="98" font-family="Courier New, monospace" font-size="30" font-weight="800" fill="#1B1A1B">3 ŞÜPHELİ · 1 GERÇEK KATİL</text>
    <text x="40" y="136" font-family="system-ui, sans-serif" font-size="17" line-height="1.4" fill="#334155">${gameMechanic}</text>
    <text x="40" y="180" font-family="system-ui, sans-serif" font-size="15" font-style="italic" font-weight="600" fill="#64748B">“${gameMotto}”</text>

    <g transform="translate(40, 218)">
      <rect width="360" height="46" fill="#F4EBD9" stroke="#1B1A1B" stroke-width="1.5" />
      <rect x="0" y="0" width="10" height="46" fill="#B91C1C" />
      <text x="24" y="20" font-family="Courier New, monospace" font-size="11" font-weight="700" fill="#B91C1C" letter-spacing="1">GÜNÜN DEDEKTİFLİK VAKASI</text>
      <text x="24" y="37" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" fill="#1B1A1B">Şüphelileri sorgula, katili yakala!</text>
    </g>
  </g>

  <g transform="translate(110, 555)">
    <text font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="800" fill="#1B1A1B">sely.tr/play/vaka</text>
    <text x="180" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#475569">· Günlük dedektiflik vakası · Tarih: ${dateStr}</text>
  </g>
  <g transform="translate(920, 555)">
    <text font-family="Courier New, monospace" font-size="12" font-weight="700" fill="#B91C1C">RESMİ MAHKEME DÖKÜMÜ ⚖</text>
  </g>
</svg>`;
    }

    // Vaka Karar ve Mahkeme Hüküm Kartı
    const vakaPerformance = isSolved
      ? (isEn ? "★ Judicial Verdict: Conclusive deduction confirmed by court" : "★ Mahkeme Hükmü: Somut mantık ve kanıtla dava kapatıldı")
      : (isEn ? "✕ Bureau Notice: Charges dismissed due to lack of proof" : "✕ Büro Notu: Yetersiz delil sebebiyle soruşturma kapandı");

    return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="vakaDots" width="16" height="16" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" fill="#1B1A1B" fill-opacity="0.09" />
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="#F4EBD9" />
  <rect width="1200" height="630" fill="url(#vakaDots)" />

  <rect x="24" y="24" width="1152" height="582" fill="none" stroke="#1B1A1B" stroke-width="3" />
  <rect x="32" y="32" width="1136" height="566" fill="none" stroke="#1B1A1B" stroke-width="1" stroke-dasharray="8 4" opacity="0.4" />

  <g transform="translate(72, 60)">
    <rect width="5" height="500" fill="#B91C1C" />
    <text transform="rotate(-90)" x="-470" y="-12" font-family="Courier New, monospace" font-size="10.5" font-weight="700" fill="#1B1A1B" letter-spacing="2">SELY POLİS SORGU BÜROSU · GİZLİ VAKA DEDEKTİF DOSYASI</text>
  </g>

  <g transform="translate(110, 75)">
    <rect x="0" y="0" width="160" height="32" fill="#1B1A1B" />
    <text x="80" y="21" text-anchor="middle" font-family="Courier New, monospace" font-size="13" font-weight="700" fill="#F4EBD9" letter-spacing="2">DOSYA NO: #05</text>
    <text x="180" y="22" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="800" fill="#B91C1C" letter-spacing="3">SELY.TR · ADLİ SORUŞTURMA</text>
    <text x="0" y="80" font-family="Courier New, monospace" font-size="40" font-weight="800" fill="#1B1A1B" letter-spacing="-0.5">CİNAYET DOSYASI: ${caseName}</text>
  </g>

  <g transform="translate(110, 195)">
    <rect x="10" y="10" width="580" height="300" fill="#1B1A1B" />
    <rect width="580" height="300" fill="#FFFCF5" stroke="#1B1A1B" stroke-width="2.5" />
    <rect width="580" height="8" fill="#E5B341" />

    <rect x="30" y="-12" width="24" height="40" rx="6" fill="none" stroke="#1B1A1B" stroke-width="3" />

    <text x="40" y="52" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#64748B" letter-spacing="2">RESMİ MAHKEME KARARI</text>
    <text x="40" y="110" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="900" fill="#1B1A1B" letter-spacing="-0.5">${suspectText}</text>
    <text x="40" y="142" font-family="Courier New, monospace" font-size="14" fill="#475569">Sorgu tamamlandı · Delil çelişkisi kayda geçti</text>

    <g transform="translate(140, 200) rotate(-6)">
      <rect x="-10" y="-10" width="340" height="75" rx="8" fill="${stampBg}" stroke="${stampBorder}" stroke-width="3.5" stroke-dasharray="6 2" />
      <text x="160" y="30" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="900" fill="${stampColor}" letter-spacing="3">${stampText}</text>
      <text x="160" y="52" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="700" fill="${stampColor}" letter-spacing="2">${stampSub}</text>
    </g>
  </g>

  <g transform="translate(730, 195)">
    <rect x="10" y="10" width="390" height="300" fill="#1B1A1B" />
    <rect width="390" height="300" fill="#FFFCF5" stroke="#1B1A1B" stroke-width="2.5" />
    <rect width="390" height="8" fill="#B91C1C" />

    <text x="35" y="46" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#64748B" letter-spacing="2">BAŞ DEDEKTİF</text>
    <text x="35" y="85" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="800" fill="#1B1A1B">${nick}</text>
    <line x1="35" y1="108" x2="355" y2="108" stroke="#1B1A1B" stroke-width="1.5" stroke-dasharray="4 2" />

    <g transform="translate(35, 135)">
      <rect width="130" height="120" fill="#F4EBD9" stroke="#1B1A1B" stroke-width="2" />
      <text x="65" y="32" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#1B1A1B" letter-spacing="1">DERECE</text>
      <text x="65" y="95" text-anchor="middle" font-family="system-ui, sans-serif" font-size="64" font-weight="900" fill="${stampColor}">&gt;${grade}&lt;</text>
    </g>

    <g transform="translate(185, 135)">
      <rect width="170" height="120" fill="#1B1A1B" />
      <text x="85" y="36" text-anchor="middle" font-family="Courier New, monospace" font-size="11" font-weight="700" fill="#E5B341" letter-spacing="2">BÜRO PUANI</text>
      <text x="85" y="85" text-anchor="middle" font-family="system-ui, sans-serif" font-size="44" font-weight="900" fill="#FFFFFF">${scoreText || "0"}</text>
      <text x="85" y="106" text-anchor="middle" font-family="Courier New, monospace" font-size="10" fill="#94A3B8">PUAN TESCİLİ</text>
    </g>
  </g>

  <g transform="translate(110, 555)">
    <text font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="800" fill="#1B1A1B">sely.tr/play/vaka</text>
    <text x="180" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#475569">${vakaPerformance}</text>
  </g>
  <g transform="translate(920, 555)">
    <text font-family="Courier New, monospace" font-size="12" font-weight="700" fill="#B91C1C">RESMİ MAHKEME DÖKÜMÜ ⚖</text>
  </g>
</svg>`;
  }

  // ==========================================
  // 7 MİNİ OYUN: STANDART SELY EDİTORİAL KARTI
  // (Echo, Knot, Cut, Shadow, Hane, Spark)
  // ==========================================
  const accent = theme.accent;
  const ink = theme.ink;
  const nickFontSize = nick.length > 20 ? "19" : nick.length > 15 ? "21" : "23";

  // DURUM 1: GÜNLÜK SEFER VE SEVİYE AFİŞİ (Skorsuz paylaşım / Günlük seviye kartı)
  if (!hasScore) {
    return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="dotGrid" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.1" fill="#1B1A1B" fill-opacity="0.13" />
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="#F6F0E3" />
  <rect width="1200" height="630" fill="url(#dotGrid)" />

  <rect x="28" y="28" width="1144" height="574" fill="none" stroke="#1B1A1B" stroke-width="2.5" />

  <g transform="translate(70, 75)">
    <text font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="900" fill="#1B1A1B" letter-spacing="-1">SELY<tspan fill="#E9563F">✛</tspan></text>
    <text x="115" y="-3" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" fill="#1B1A1B" letter-spacing="2">· GÜNLÜK SEFER KATALOĞU</text>
    
    <g transform="translate(860, -18)">
      <rect width="190" height="34" fill="#1B1A1B" />
      <text x="95" y="22" text-anchor="middle" font-family="Courier New, monospace" font-size="13" font-weight="700" fill="#F6F0E3" letter-spacing="2">№ ${theme.num} · ${dateStr}</text>
    </g>
  </g>

  <line x1="70" y1="108" x2="1120" y2="108" stroke="#1B1A1B" stroke-width="1.5" />

  <g transform="translate(70, 145)">
    <rect x="12" y="12" width="410" height="375" fill="#1B1A1B" />
    <rect width="410" height="375" fill="#1E2033" stroke="#1B1A1B" stroke-width="2.5" />
    <image href="${posterDataUri}" x="0" y="0" width="410" height="375" preserveAspectRatio="xMidYMid slice" />
    <rect width="410" height="8" fill="${accent}" />

    <g transform="translate(18, 305)">
      <text font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="900" fill="#F6F0E3" opacity="0.95" letter-spacing="-2">${theme.num}</text>
    </g>
  </g>

  <g transform="translate(520, 145)">
    <rect x="12" y="12" width="600" height="375" fill="#1B1A1B" />
    <rect width="600" height="375" fill="#FFFAF0" stroke="#1B1A1B" stroke-width="2.5" />
    <rect width="600" height="8" fill="${accent}" />

    <g transform="translate(45, 45)">
      <text font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" fill="${accent}" letter-spacing="3">${gameEyebrow}</text>
      <text y="54" font-family="system-ui, -apple-system, sans-serif" font-size="44" font-weight="900" fill="#1B1A1B" letter-spacing="-1.5">${gameTitle}</text>
      
      <g transform="translate(0, 85)">
        <rect width="500" height="42" fill="#F6F0E3" stroke="#1B1A1B" stroke-width="1.5" stroke-dasharray="4 2" />
        <text x="18" y="26" font-family="system-ui, sans-serif" font-size="16" font-style="italic" font-weight="600" fill="#1B1A1B">“${gameMotto}”</text>
      </g>

      <text y="170" font-family="system-ui, sans-serif" font-size="15" line-height="1.4" font-weight="500" fill="#334155">${gameMechanic}</text>

      <g transform="translate(0, 205)">
        <text font-family="Courier New, monospace" font-size="12" font-weight="700" fill="#64748B">SÜRE: ${theme.playTime} · KONTROL: ${theme.controls}</text>
      </g>

      <g transform="translate(0, 240)">
        <rect width="360" height="46" fill="#F6F0E3" stroke="#1B1A1B" stroke-width="1.5" />
        <rect x="0" y="0" width="10" height="46" fill="${accent}" />
        <text x="24" y="20" font-family="Courier New, monospace" font-size="11" font-weight="700" fill="${accent}" letter-spacing="1">GÜNÜN MEYDAN OKUMASI</text>
        <text x="24" y="37" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" fill="#1B1A1B">Turu tamamla, arkadaşlarına meydan oku!</text>
      </g>
    </g>
  </g>

  <g transform="translate(70, 565)">
    <text font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="800" fill="#1B1A1B">sely.tr/play/${gameKey}</text>
    <text x="200" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#475569">· Günlük mini oyun serisi · Her gün yeni seviye · Sen de dene!</text>
  </g>

  <g transform="translate(860, 565)">
    <text font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" fill="#1B1A1B" letter-spacing="1">KÜÇÜK KURAL, BÜYÜK YANKI ✛</text>
  </g>
</svg>`;
  }

  // DURUM 2: TUR SONU SKOR VE BAŞARI KARTI (Katalog afişli & ferah)
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="dotGrid" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.1" fill="#1B1A1B" fill-opacity="0.13" />
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="#F6F0E3" />
  <rect width="1200" height="630" fill="url(#dotGrid)" />

  <rect x="28" y="28" width="1144" height="574" fill="none" stroke="#1B1A1B" stroke-width="2.5" />

  <g transform="translate(70, 75)">
    <text font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="900" fill="#1B1A1B" letter-spacing="-1">SELY<tspan fill="#E9563F">✛</tspan></text>
    <text x="115" y="-3" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" fill="#1B1A1B" letter-spacing="2">· GÜNLÜK SEFER DÖKÜMÜ</text>
    
    <g transform="translate(860, -18)">
      <rect width="190" height="34" fill="#1B1A1B" />
      <text x="95" y="22" text-anchor="middle" font-family="Courier New, monospace" font-size="13" font-weight="700" fill="#F6F0E3" letter-spacing="2">№ ${theme.num} · ${dateStr}</text>
    </g>
  </g>

  <line x1="70" y1="108" x2="1120" y2="108" stroke="#1B1A1B" stroke-width="1.5" />

  <g transform="translate(70, 145)">
    <rect x="12" y="12" width="280" height="375" fill="#1B1A1B" />
    <rect width="280" height="375" fill="#1E2033" stroke="#1B1A1B" stroke-width="2.5" />
    <image href="${posterDataUri}" x="0" y="0" width="280" height="375" preserveAspectRatio="xMidYMid slice" />
    <rect width="280" height="8" fill="${accent}" />

    <g transform="translate(18, 320)">
      <rect width="64" height="36" fill="#1B1A1B" />
      <text x="32" y="25" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" font-weight="900" fill="#F6F0E3">№ ${theme.num}</text>
    </g>
  </g>

  <g transform="translate(380, 145)">
    <rect x="12" y="12" width="740" height="375" fill="#1B1A1B" />
    <rect width="740" height="375" fill="#FFFAF0" stroke="#1B1A1B" stroke-width="2.5" />
    <rect width="740" height="10" fill="${accent}" />

    <g transform="translate(45, 38)">
      <text font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" fill="${accent}" letter-spacing="3">${gameEyebrow}</text>
      <text y="50" font-family="system-ui, -apple-system, sans-serif" font-size="42" font-weight="900" fill="#1B1A1B" letter-spacing="-1.5">${gameTitle}</text>
      
      <g transform="translate(0, 75)">
        <rect width="650" height="38" fill="#F6F0E3" stroke="#1B1A1B" stroke-width="1.5" stroke-dasharray="4 2" />
        <text x="18" y="24" font-family="system-ui, sans-serif" font-size="15" font-style="italic" font-weight="600" fill="#1B1A1B">“${gameMotto}”</text>
      </g>

      <g transform="translate(0, 135)">
        <text font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" fill="#64748B" letter-spacing="2">KAYDEDİLEN SKOR</text>
        
        <g transform="translate(0, 16)">
          <rect width="310" height="100" fill="#F6F0E3" stroke="#1B1A1B" stroke-width="2" />
          <text x="24" y="72" font-family="system-ui, -apple-system, sans-serif" font-size="62" font-weight="900" fill="#1B1A1B" letter-spacing="-1">${scoreText || "0"}</text>
          <text x="290" y="68" text-anchor="end" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="800" fill="${accent}">PUAN</text>
        </g>
      </g>

      <g transform="translate(340, 135)">
        <g transform="translate(0, 16)">
          <rect width="310" height="100" fill="#1B1A1B" />
          <text x="18" y="30" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="700" fill="#94A3B8" letter-spacing="1.5">GÜNÜN OYUNCUSU</text>
          
          <g transform="translate(195, 10)">
            <rect width="100" height="22" rx="4" fill="${accent}" />
            <text x="50" y="15" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="800" fill="#FFFFFF" letter-spacing="1">GÜNÜN TURU ✓</text>
          </g>
          
          <text x="18" y="74" font-family="system-ui, -apple-system, sans-serif" font-size="${nickFontSize}" font-weight="800" fill="#F6F0E3" letter-spacing="0.5">${nick}</text>
        </g>
      </g>

      <g transform="translate(0, 275)">
        <rect width="650" height="38" fill="${accent}" stroke="#1B1A1B" stroke-width="1.5" />
        <text x="325" y="24" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="900" fill="#FFFFFF" letter-spacing="1.5">TUR TAMAMLANDI · SEN DE SKORUNU DENE →</text>
      </g>
    </g>
  </g>

  <g transform="translate(70, 565)">
    <text font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="800" fill="#1B1A1B">sely.tr/play/${gameKey}</text>
    <text x="200" font-family="system-ui, sans-serif" font-size="14" font-weight="600" fill="#475569">${performanceNotice}</text>
  </g>

  <g transform="translate(860, 565)">
    <text font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" fill="#1B1A1B" letter-spacing="1">KÜÇÜK KURAL, BÜYÜK YANKI ✛</text>
  </g>
</svg>`;
}
