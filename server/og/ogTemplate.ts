import type { GameId } from "@/lib/catalog";

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

const GAME_META: Record<string, { title: string; titleEn: string; accent: string; bg: string; icon: string }> = {
  echo: { title: "YANKI", titleEn: "ECHO", accent: "#38bdf8", bg: "#0c1929", icon: "◎" },
  knot: { title: "DÜĞÜM", titleEn: "KNOT", accent: "#fbbf24", bg: "#231805", icon: "☍" },
  cut: { title: "KESİT", titleEn: "CUTOUT", accent: "#c084fc", bg: "#1e0c2e", icon: "◧" },
  shadow: { title: "GÖLGE", titleEn: "SHADOW", accent: "#fb923c", bg: "#251205", icon: "◐" },
  hane: { title: "HANE", titleEn: "HANE", accent: "#4ade80", bg: "#082012", icon: "▦" },
  spark: { title: "KIVILCIM", titleEn: "SPARK", accent: "#f87171", bg: "#270808", icon: "⚡" },
  vaka: { title: "VAKA", titleEn: "CASE", accent: "#e2e8f0", bg: "#0f172a", icon: "⚖" },
};

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generates an ultra-crisp, zero-dependency SVG card (1200x630)
 * Works flawlessly in Node.js, Express, Docker, and Edge environments.
 */
export function generateOgSvg(params: OgParams): string {
  const isEn = params.locale === "en";
  const gameKey = (params.game || "hub").toLowerCase();
  const game = GAME_META[gameKey] || {
    title: "SELY",
    titleEn: "SELY",
    accent: "#f59e0b",
    bg: "#111827",
    icon: "❖",
  };

  const gameTitle = isEn ? game.titleEn : game.title;
  const nick = escapeXml(params.nick ? params.nick.toUpperCase() : "OYUNCU");
  const scoreText = typeof params.score === "number" ? params.score.toLocaleString(isEn ? "en-US" : "tr-TR") : "";
  const dateStr = escapeXml(params.date || new Date().toISOString().slice(0, 10));

  // Vaka Özel Tasarımı
  if (gameKey === "vaka") {
    const isSolved = params.outcome === "solved" || params.outcome === "success";
    const statusText = isSolved
      ? isEn ? "CASE SOLVED" : "VAKA ÇÖZÜLDÜ"
      : isEn ? "CASE DISMISSED" : "DAVA DÜŞTÜ";
    const statusColor = isSolved ? "#22c55e" : "#ef4444";
    const grade = params.grade || (isSolved ? "S" : "C");
    const caseName = escapeXml(params.caseTitle || (isEn ? "Confidential Bureau Dossier" : "Büro Gizli Dosyası"));
    const suspectText = params.suspect ? escapeXml(params.suspect) : (isEn ? "Perpetrator Unmasked" : "Şüpheli Sorgulandı");

    return `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="vakaGlow" cx="70%" cy="30%" r="80%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#090d16" />
    </radialGradient>
    <linearGradient id="stampBorder" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${statusColor}" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="${statusColor}" stop-opacity="0.3"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Arka Plan -->
  <rect width="1200" height="630" fill="url(#vakaGlow)"/>

  <!-- Izgara Doku Deseni -->
  <g opacity="0.04" stroke="#ffffff" stroke-width="1">
    <line x1="0" y1="105" x2="1200" y2="105"/>
    <line x1="0" y1="210" x2="1200" y2="210"/>
    <line x1="0" y1="315" x2="1200" y2="315"/>
    <line x1="0" y1="420" x2="1200" y2="420"/>
    <line x1="0" y1="525" x2="1200" y2="525"/>
    <line x1="200" y1="0" x2="200" y2="630"/>
    <line x1="400" y1="0" x2="400" y2="630"/>
    <line x1="600" y1="0" x2="600" y2="630"/>
    <line x1="800" y1="0" x2="800" y2="630"/>
    <line x1="1000" y1="0" x2="1000" y2="630"/>
  </g>

  <!-- Üst Logo & Damga -->
  <g transform="translate(80, 80)">
    <text font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="800" fill="#94a3b8" letter-spacing="4">SELY.TR · POLİS SORGU BÜROSU</text>
    <text y="48" font-family="Courier New, monospace" font-size="44" font-weight="800" fill="#ffffff" letter-spacing="1">DOSYA: ${caseName}</text>
  </g>

  <!-- Mühür Damgası (Karar Rozeti) -->
  <g transform="translate(80, 220)" filter="url(#shadow)">
    <rect width="460" height="240" rx="16" fill="#131c2e" stroke="url(#stampBorder)" stroke-width="3"/>
    
    <text x="32" y="52" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" fill="${statusColor}" letter-spacing="3">${statusText}</text>
    <text x="32" y="110" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="800" fill="#f8fafc">${suspectText}</text>
    
    <g transform="translate(32, 140)">
      <rect width="110" height="64" rx="8" fill="#0f172a" stroke="#334155" stroke-width="1.5"/>
      <text x="55" y="24" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#64748b" letter-spacing="1">DERECE</text>
      <text x="55" y="52" text-anchor="middle" font-family="system-ui, sans-serif" font-size="26" font-weight="900" fill="${statusColor}">${grade}</text>
    </g>

    ${scoreText ? `
    <g transform="translate(160, 140)">
      <rect width="160" height="64" rx="8" fill="#0f172a" stroke="#334155" stroke-width="1.5"/>
      <text x="80" y="24" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#64748b" letter-spacing="1">BÜRO SKORU</text>
      <text x="80" y="52" text-anchor="middle" font-family="Courier New, monospace" font-size="24" font-weight="900" fill="#ffffff">${scoreText}</text>
    </g>
    ` : ""}
  </g>

  <!-- Sağ Taraf: Dedektif Kartı -->
  <g transform="translate(680, 220)" filter="url(#shadow)">
    <rect width="440" height="240" rx="16" fill="#0f172a" stroke="#334155" stroke-width="2"/>
    <text x="36" y="52" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="#64748b" letter-spacing="2">BAŞ DEDEKTİF</text>
    <text x="36" y="105" font-family="Courier New, monospace" font-size="40" font-weight="900" fill="#f1f5f9">${nick}</text>
    
    <path d="M 36 135 L 404 135" stroke="#1e293b" stroke-width="2"/>
    
    <text x="36" y="175" font-family="system-ui, sans-serif" font-size="15" fill="#94a3b8">Kayıt Tarihi: <tspan fill="#f8fafc" font-weight="600">${dateStr}</tspan></text>
    <text x="36" y="205" font-family="system-ui, sans-serif" font-size="14" fill="#64748b">sely.tr/play/vaka · Sorgu Odası</text>
  </g>

  <!-- Alt Bilgi Çubuğu -->
  <g transform="translate(80, 550)">
    <text font-family="system-ui, sans-serif" font-size="16" font-weight="600" fill="#475569">SELY.TR · 7 Özgün Mini Oyun · Küçük Kural, Büyük Yankı</text>
  </g>
</svg>
`;
  }

  // Genel Mini Oyun Tasarımı (Echo, Knot, Cut, Shadow, Hane, Spark)
  return `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="gameGlow" cx="80%" cy="20%" r="75%">
      <stop offset="0%" stop-color="${game.accent}" stop-opacity="0.25" />
      <stop offset="60%" stop-color="${game.bg}" stop-opacity="0.9" />
      <stop offset="100%" stop-color="#0a0a0f" />
    </radialGradient>
    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#000000" flood-opacity="0.7"/>
    </filter>
  </defs>

  <!-- Zemin Rengi -->
  <rect width="1200" height="630" fill="url(#gameGlow)"/>

  <!-- Vurgulu Dekoratif Daireler -->
  <circle cx="1080" cy="120" r="280" fill="${game.accent}" opacity="0.08"/>
  <circle cx="1080" cy="120" r="160" fill="none" stroke="${game.accent}" stroke-width="2" opacity="0.2"/>

  <!-- Üst Logo -->
  <g transform="translate(80, 75)">
    <text font-family="system-ui, -apple-system, sans-serif" font-size="22" font-weight="900" fill="#ffffff" letter-spacing="3">SELY.TR</text>
    <text x="110" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="500" fill="#9ca3af">· MINIGAME HUB</text>
  </g>

  <!-- Ana Skor ve Başarı Kartı -->
  <g transform="translate(80, 160)" filter="url(#cardShadow)">
    <rect width="1040" height="350" rx="24" fill="#141824" fill-opacity="0.85" stroke="#2a3045" stroke-width="2"/>
    
    <!-- Oyun İkonu ve Başlık -->
    <g transform="translate(60, 60)">
      <rect width="64" height="64" rx="14" fill="${game.accent}" fill-opacity="0.2" stroke="${game.accent}" stroke-width="2"/>
      <text x="32" y="44" text-anchor="middle" font-family="system-ui, sans-serif" font-size="34" fill="${game.accent}">${game.icon}</text>
      
      <text x="86" y="28" font-family="system-ui, sans-serif" font-size="15" font-weight="700" fill="${game.accent}" letter-spacing="3">${isEn ? "DAILY RUN COMPLETE" : "GÜNLÜK TUR TAMAMLANDI"}</text>
      <text x="86" y="60" font-family="system-ui, sans-serif" font-size="36" font-weight="900" fill="#ffffff" letter-spacing="1">${gameTitle}</text>
    </g>

    <!-- Skor Bölümü -->
    <g transform="translate(60, 160)">
      <text font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="#64748b" letter-spacing="2">${isEn ? "RECORDED SCORE" : "KAYDEDİLEN SKOR"}</text>
      <text y="70" font-family="system-ui, -apple-system, sans-serif" font-size="76" font-weight="900" fill="#f8fafc">${scoreText || "0"} <tspan font-size="28" font-weight="600" fill="#64748b">${isEn ? "PTS" : "PUAN"}</tspan></text>
    </g>

    <!-- Sağ Taraf: Oyuncu ve Sıralama Bilgisi -->
    <g transform="translate(680, 60)">
      <rect width="300" height="230" rx="16" fill="#0c101c" stroke="#1e2538" stroke-width="1.5"/>
      
      <g transform="translate(30, 35)">
        <text font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="#64748b" letter-spacing="2">${isEn ? "PLAYER" : "OYUNCU"}</text>
        <text y="40" font-family="system-ui, sans-serif" font-size="36" font-weight="900" fill="#f1f5f9">${nick}</text>
      </g>

      <path d="M 30 115 L 270 115" stroke="#1e2538" stroke-width="1.5"/>

      <g transform="translate(30, 145)">
        <text font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="#64748b" letter-spacing="2">${isEn ? "DATE" : "TARİH"}</text>
        <text y="30" font-family="Courier New, monospace" font-size="20" font-weight="700" fill="#94a3b8">${dateStr}</text>
      </g>
    </g>
  </g>

  <!-- Alt Link & İmza -->
  <g transform="translate(80, 560)">
    <text font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="${game.accent}">sely.tr/play/${gameKey}</text>
    <text x="240" font-family="system-ui, sans-serif" font-size="16" font-weight="500" fill="#475569">· Reklamsız, kayıt gerektirmeyen retro web oyunları</text>
  </g>
</svg>
`;
}
