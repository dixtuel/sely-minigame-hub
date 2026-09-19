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
    accent: "#E9563F", // Coral
    ink: "#293B75",   // Indigo
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
    accent: "#293B75", // Indigo
    ink: "#E9563F",   // Coral
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
    accent: "#654169", // Plum
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
    accent: "#296A55", // Green
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
    accent: "#E5B341", // Mustard
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
    accent: "#E5B341", // Mustard
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
    accent: "#E9563F", // Coral
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

/**
 * Generates an authentic SELY editorial/brutalist SVG card (1200x630).
 * Matches sely.tr's real design system: cream paper (#F6F0E3), deep ink (#1B1A1B),
 * coral accent (#E9563F), harsh neo-brutalist shadows, and typography.
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
    accent: "#E9563F",
    ink: "#1B1A1B",
    icon: "❖",
  };

  const gameTitle = isEn ? theme.titleEn : theme.title;
  const gameEyebrow = isEn ? theme.eyebrowEn : theme.eyebrow;
  const gameMotto = isEn ? theme.mottoEn : theme.motto;
  const nick = escapeXml(params.nick ? params.nick.toUpperCase() : (isEn ? "PLAYER" : "OYUNCU"));
  const scoreText = typeof params.score === "number" ? params.score.toLocaleString(isEn ? "en-US" : "tr-TR") : "";
  const dateStr = escapeXml(params.date || new Date().toISOString().slice(0, 10));

  // ==========================================
  // ÖZEL VAKA GİZEMİ / POLİS ARŞİV DOSYASI ŞABLONU
  // ==========================================
  if (gameKey === "vaka") {
    const isSolved = params.outcome === "solved" || params.outcome === "success";
    const grade = params.grade || (isSolved ? "S" : "C");
    const stampColor = isSolved ? "#15803d" : "#b91c1c"; // Resmi yeşil mühür veya kırmızı ret mührü
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

    return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Noktalı Saman Kağıdı Deseni -->
    <pattern id="vakaDots" width="16" height="16" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1" fill="#1B1A1B" fill-opacity="0.09" />
    </pattern>
  </defs>

  <!-- Saman/Kraft Kağıt Zemin (Sely Kağıdı) -->
  <rect width="1200" height="630" fill="#F4EBD9" />
  <rect width="1200" height="630" fill="url(#vakaDots)" />

  <!-- Dış Çerçeve (Çift Çizgili Klasör Bordürü) -->
  <rect x="24" y="24" width="1152" height="582" fill="none" stroke="#1B1A1B" stroke-width="3" />
  <rect x="32" y="32" width="1136" height="566" fill="none" stroke="#1B1A1B" stroke-width="1" stroke-dasharray="8 4" opacity="0.4" />

  <!-- Sol Dikey Polis Arşivi Şeridi -->
  <g transform="translate(64, 60)">
    <rect width="6" height="510" fill="#B91C1C" />
    <text transform="rotate(-90)" x="-490" y="-14" font-family="Courier New, monospace" font-size="12" font-weight="700" fill="#1B1A1B" letter-spacing="3">SELY POLİS SORGU BÜROSU · GİZLİ VAKA DEDEKTİF DOSYASI</text>
  </g>

  <!-- Üst Başlık & Dosya Numarası -->
  <g transform="translate(110, 75)">
    <rect x="0" y="0" width="160" height="32" fill="#1B1A1B" />
    <text x="80" y="21" text-anchor="middle" font-family="Courier New, monospace" font-size="13" font-weight="700" fill="#F4EBD9" letter-spacing="2">DOSYA NO: #05</text>
    
    <text x="180" y="24" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="800" fill="#B91C1C" letter-spacing="3">SELY.TR · ADLİ SORUŞTURMA</text>
    <text x="0" y="82" font-family="Courier New, monospace" font-size="44" font-weight="800" fill="#1B1A1B" letter-spacing="-1">CİNAYET DOSYASI: ${caseName}</text>
  </g>

  <!-- İki Parçalı Delil ve Karar Masası (Brutalist Kağıt Blokları) -->
  <!-- 1. SOL BLOK: Resmi Mahkeme Hükmü ve Suçlu -->
  <g transform="translate(110, 195)">
    <!-- Brutalist Sert Siyah Gölge -->
    <rect x="10" y="10" width="580" height="300" fill="#1B1A1B" />
    <!-- Ana Beyaz Kart -->
    <rect width="580" height="300" fill="#FFFCF5" stroke="#1B1A1B" stroke-width="2.5" />
    <rect width="580" height="8" fill="#E5B341" />

    <!-- Ataş Simgesi -->
    <rect x="30" y="-12" width="24" height="40" rx="6" fill="none" stroke="#1B1A1B" stroke-width="3" />

    <text x="40" y="55" font-family="Courier New, monospace" font-size="12" font-weight="700" fill="#64748B" letter-spacing="2">RESMİ MAHKEME KARARI</text>
    <text x="40" y="115" font-family="system-ui, -apple-system, sans-serif" font-size="34" font-weight="900" fill="#1B1A1B" letter-spacing="-0.5">${suspectText}</text>
    <text x="40" y="145" font-family="Courier New, monospace" font-size="14" fill="#475569">Sorgu tamamlandı · Delil çelişkisi kayda geçti</text>

    <!-- Büyük Eğimli Mühür Damgası (Rubber Stamp Effect) -->
    <g transform="translate(140, 200) rotate(-6)">
      <rect x="-10" y="-10" width="340" height="75" rx="8" fill="${stampBg}" stroke="${stampBorder}" stroke-width="3.5" stroke-dasharray="6 2" />
      <text x="160" y="30" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="900" fill="${stampColor}" letter-spacing="3">${stampText}</text>
      <text x="160" y="52" text-anchor="middle" font-family="Courier New, monospace" font-size="11" font-weight="700" fill="${stampColor}" letter-spacing="2">${stampSub}</text>
    </g>
  </g>

  <!-- 2. SAĞ BLOK: Dedektiflik Derecesi & Büro Puanı -->
  <g transform="translate(730, 195)">
    <!-- Brutalist Sert Siyah Gölge -->
    <rect x="10" y="10" width="390" height="300" fill="#1B1A1B" />
    <!-- Ana Krem Kart -->
    <rect width="390" height="300" fill="#FFFCF5" stroke="#1B1A1B" stroke-width="2.5" />
    <rect width="390" height="8" fill="#B91C1C" />

    <text x="35" y="48" font-family="Courier New, monospace" font-size="12" font-weight="700" fill="#64748B" letter-spacing="2">BAŞ DEDEKTİF</text>
    <text x="35" y="90" font-family="Courier New, monospace" font-size="36" font-weight="900" fill="#1B1A1B">${nick}</text>
    <line x1="35" y1="110" x2="355" y2="110" stroke="#1B1A1B" stroke-width="1.5" stroke-dasharray="4 2" />

    <!-- Derece Rozeti -->
    <g transform="translate(35, 135)">
      <rect width="130" height="120" fill="#F4EBD9" stroke="#1B1A1B" stroke-width="2" />
      <text x="65" y="32" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#1B1A1B" letter-spacing="1">DERECE</text>
      <text x="65" y="95" text-anchor="middle" font-family="system-ui, sans-serif" font-size="64" font-weight="900" fill="${stampColor}">&gt;${grade}&lt;</text>
    </g>

    <!-- Puan Kutusu -->
    <g transform="translate(185, 135)">
      <rect width="170" height="120" fill="#1B1A1B" />
      <text x="85" y="36" text-anchor="middle" font-family="Courier New, monospace" font-size="11" font-weight="700" fill="#E5B341" letter-spacing="2">BÜRO PUANI</text>
      <text x="85" y="85" text-anchor="middle" font-family="system-ui, sans-serif" font-size="44" font-weight="900" fill="#FFFFFF">${scoreText || "0"}</text>
      <text x="85" y="106" text-anchor="middle" font-family="Courier New, monospace" font-size="10" fill="#94A3B8">PUAN TESCİLİ</text>
    </g>
  </g>

  <!-- Alt Bilgi / Sely İmzası -->
  <g transform="translate(110, 555)">
    <text font-family="Courier New, monospace" font-size="15" font-weight="700" fill="#1B1A1B">sely.tr/play/vaka</text>
    <text x="180" font-family="system-ui, sans-serif" font-size="14" font-weight="500" fill="#64748B">· “Sözü değil, kanıtı sun.” · Tarih: ${dateStr}</text>
  </g>
  <g transform="translate(920, 555)">
    <text font-family="Courier New, monospace" font-size="12" font-weight="700" fill="#B91C1C">RESMİ MAHKEME DÖKÜMÜ ⚖</text>
  </g>
</svg>`;
  }

  // ==========================================
  // 7 MİNİ OYUN STANDART SELY EDİTORİAL KARTI
  // (Echo, Knot, Cut, Shadow, Hane, Spark)
  // ==========================================
  const accent = theme.accent;
  const ink = theme.ink;

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Sely Orijinal Noktalı Kağıt Deseni (background-image: radial-gradient) -->
    <pattern id="dotGrid" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.1" fill="#1B1A1B" fill-opacity="0.13" />
    </pattern>
  </defs>

  <!-- Sely Orijinal Sıcak Kağıt Zemin (#F6F0E3) -->
  <rect width="1200" height="630" fill="#F6F0E3" />
  <rect width="1200" height="630" fill="url(#dotGrid)" />

  <!-- Dış Keskin Mürekkep Çerçevesi -->
  <rect x="28" y="28" width="1144" height="574" fill="none" stroke="#1B1A1B" stroke-width="2.5" />

  <!-- ÜST MASTHEAD ÇUBUĞU (Brand Lockup) -->
  <g transform="translate(70, 75)">
    <!-- SELY.TR Logo & Coral Artı Simgesi -->
    <text font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="900" fill="#1B1A1B" letter-spacing="-1">SELY<tspan fill="#E9563F">✛</tspan></text>
    <text x="115" y="-3" font-family="Courier New, monospace" font-size="13" font-weight="700" fill="#1B1A1B" letter-spacing="2">· GÜNLÜK SEFER DÖKÜMÜ</text>
    
    <!-- Sağ Pul / Tarih ve Oyun No -->
    <g transform="translate(870, -18)">
      <rect width="180" height="34" fill="#1B1A1B" />
      <text x="90" y="22" text-anchor="middle" font-family="Courier New, monospace" font-size="13" font-weight="700" fill="#F6F0E3" letter-spacing="2">№ ${theme.num} · ${dateStr}</text>
    </g>
  </g>

  <!-- İnce Ayırıcı Mürekkep Çizgisi -->
  <line x1="70" y1="108" x2="1120" y2="108" stroke="#1B1A1B" stroke-width="1.5" />

  <!-- ORTA BÖLÜM: Sely Neo-Brutalist Oyun Kartı -->
  <g transform="translate(70, 145)">
    <!-- 1. Brutalist Sert Siyah Gölge (box-shadow: 10px 10px 0 var(--ink)) -->
    <rect x="12" y="12" width="1050" height="375" fill="#1B1A1B" />
    
    <!-- 2. Kartın Kendisi (Card Paper: #FFFAF0) -->
    <rect width="1050" height="375" fill="#FFFAF0" stroke="#1B1A1B" stroke-width="2.5" />
    
    <!-- 3. Üst Oyun Vurgu Şeridi -->
    <rect width="1050" height="10" fill="${accent}" />

    <!-- SOL KOLON: Oyun Başlığı, İkon ve Motto -->
    <g transform="translate(55, 55)">
      <!-- Oyun İkon Rozeti -->
      <rect width="56" height="56" fill="${accent}" stroke="#1B1A1B" stroke-width="2" />
      <text x="28" y="41" text-anchor="middle" font-family="system-ui, sans-serif" font-size="32" fill="#FFFFFF">${theme.icon}</text>

      <!-- Eyebrow & Oyun Adı -->
      <text x="76" y="24" font-family="Courier New, monospace" font-size="13" font-weight="700" fill="${ink}" letter-spacing="3">${gameEyebrow}</text>
      <text x="76" y="68" font-family="system-ui, -apple-system, sans-serif" font-size="48" font-weight="900" fill="#1B1A1B" letter-spacing="-1.5">${gameTitle}</text>
      
      <!-- Motto -->
      <g transform="translate(0, 120)">
        <rect width="460" height="42" fill="#F6F0E3" stroke="#1B1A1B" stroke-width="1.5" stroke-dasharray="4 2" />
        <text x="20" y="26" font-family="system-ui, sans-serif" font-size="16" font-style="italic" font-weight="600" fill="#1B1A1B">“${gameMotto}”</text>
      </g>

      <!-- Durum Rozeti -->
      <g transform="translate(0, 195)">
        <rect width="180" height="44" fill="${accent}" stroke="#1B1A1B" stroke-width="2" />
        <text x="90" y="27" text-anchor="middle" font-family="Courier New, monospace" font-size="13" font-weight="800" fill="#FFFFFF" letter-spacing="1">TUR TAMAMLANDI</text>
      </g>
    </g>

    <!-- Dikey Ayırıcı Çizgi -->
    <line x1="570" y1="40" x2="570" y2="340" stroke="#1B1A1B" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.5" />

    <!-- SAĞ KOLON: Skor Plakası ve Oyuncu Kartı -->
    <g transform="translate(620, 50)">
      <!-- Skor Bölümü -->
      <text font-family="Courier New, monospace" font-size="13" font-weight="700" fill="#64748B" letter-spacing="2">KAYDEDİLEN SKOR</text>
      
      <g transform="translate(0, 20)">
        <rect width="380" height="110" fill="#F6F0E3" stroke="#1B1A1B" stroke-width="2" />
        <!-- Skor Sayısı (Bricolage Grotesque / Bold Display) -->
        <text x="30" y="78" font-family="system-ui, -apple-system, sans-serif" font-size="64" font-weight="900" fill="#1B1A1B" letter-spacing="-1">${scoreText || "0"}</text>
        <text x="350" y="74" text-anchor="end" font-family="Courier New, monospace" font-size="20" font-weight="700" fill="${accent}">PUAN</text>
      </g>

      <!-- Oyuncu Rumuzu ve Tescil Damgası -->
      <g transform="translate(0, 160)">
        <rect width="380" height="95" fill="#1B1A1B" />
        <text x="25" y="34" font-family="Courier New, monospace" font-size="11" font-weight="700" fill="#94A3B8" letter-spacing="2">SEFERİ TAMAMLAYAN OYUNCU</text>
        <text x="25" y="75" font-family="Courier New, monospace" font-size="34" font-weight="900" fill="#F6F0E3" letter-spacing="1">${nick}</text>
        <!-- Onay Rozeti -->
        <circle cx="335" cy="48" r="24" fill="${accent}" />
        <text x="335" y="55" text-anchor="middle" font-family="system-ui, sans-serif" font-size="20" font-weight="900" fill="#FFFFFF">✓</text>
      </g>
    </g>
  </g>

  <!-- ALT BİLGİ & FOOTER (Editorial Footer) -->
  <g transform="translate(70, 565)">
    <text font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" fill="#1B1A1B">sely.tr/play/${gameKey}</text>
    <text x="220" font-family="system-ui, sans-serif" font-size="14" font-weight="500" fill="#64748B">· Reklamsız, kayıt gerektirmeyen retro web oyunları</text>
  </g>

  <g transform="translate(850, 565)">
    <text font-family="Courier New, monospace" font-size="12" font-weight="700" fill="#1B1A1B">KÜÇÜK KURAL, BÜYÜK YANKI ✛</text>
  </g>
</svg>`;
}
