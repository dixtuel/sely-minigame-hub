import type { Request, Response } from "express";

const CRAWLER_USER_AGENTS = [
  "twitterbot",
  "facebookexternalhit",
  "facebot",
  "discordbot",
  "telegrambot",
  "whatsapp",
  "slackbot",
  "linkedinbot",
  "pinterest",
  "skypeuripreview",
  "applebot",
  "bingpreview",
];

function isSocialCrawler(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some((bot) => ua.includes(bot));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const GAME_NAMES: Record<string, { tr: string; en: string; eyebrow: string }> = {
  echo: { tr: "Yankı", en: "Echo", eyebrow: "LABİRENT / SES" },
  knot: { tr: "Düğüm", en: "Knot", eyebrow: "AKIŞ / BULMACA" },
  cut: { tr: "Kesit", en: "Cutout", eyebrow: "GEOMETRİ / KESİM" },
  shadow: { tr: "Gölge", en: "Shadow", eyebrow: "IŞIK / SİLÜET" },
  hane: { tr: "Hane", en: "Hane", eyebrow: "KELİME / SAYI" },
  spark: { tr: "Kıvılcım", en: "Spark", eyebrow: "REFLEKS / GERİLİM" },
  vaka: { tr: "Vaka", en: "Vaka Mystery", eyebrow: "GİZEM / DEDEKTİF" },
};

/**
 * Handles /share/:game
 * Serves a lightweight, ultra-cacheable editorial showcase page for both humans and crawler bots.
 * Features 1-click clipboard PNG image copying, PNG download, and instant play redirection.
 */
export function handleShareBridgeRequest(req: Request, res: Response) {
  const gameKey = (req.params.game || "").toLowerCase();
  const validGame = GAME_NAMES[gameKey] ? gameKey : "echo";
  const userAgent = req.headers["user-agent"] || "";
  const isCrawler = isSocialCrawler(userAgent);
  const locale = req.query.locale === "en" ? "en" : "tr";
  const isEn = locale === "en";

  const targetPlayPath = isEn ? `/en/play/${validGame}` : `/play/${validGame}`;
  const meta = GAME_NAMES[validGame];
  const gameName = isEn ? meta.en : meta.tr;
  const rawScore = req.query.score ? String(req.query.score).replace(/[^\d]/g, "") : "";
  const nick = req.query.nick ? String(req.query.nick).slice(0, 32) : "";
  const outcome = req.query.outcome === "solved" || req.query.outcome === "success" ? "solved" : req.query.outcome === "failure" ? "failed" : "";
  const grade = req.query.grade ? String(req.query.grade).slice(0, 2) : "";

  // Dynamic social copy
  let title = `SELY · ${gameName}`;
  let desc = isEn
    ? `Play ${gameName} on SELY — minimal rules, lasting echoes.`
    : `SELY üzerinde ${gameName} oyna — Küçük kural, büyük yankı.`;

  if (validGame === "vaka") {
    if (outcome === "solved") {
      title = isEn ? `SELY Vaka · CASE SOLVED (Grade ${grade || "S"})` : `SELY Vaka · CİNAYET DOSYASI ÇÖZÜLDÜ (Derece ${grade || "S"})`;
      desc = isEn
        ? `Detective ${nick || "Player"} uncovered the truth and closed the case with ${rawScore || "high"} points!`
        : `Dedektif ${nick || "Oyuncu"} gizemi aydınlattı ve dosyayı ${rawScore || "yüksek"} puanla kapattı!`;
    } else {
      title = isEn ? `SELY Vaka · Murder Mystery Case` : `SELY Vaka · Günün Dedektiflik Dosyası`;
      desc = isEn
        ? `Can you solve today's case? Interrogate suspects and uncover the truth.`
        : `Günün cinayet dosyasını çözebilir misin? Şüphelileri sorgula ve katili bul.`;
    }
  } else if (rawScore) {
    const formattedScore = parseInt(rawScore, 10).toLocaleString(isEn ? "en-US" : "tr-TR");
    title = isEn
      ? `${nick ? nick + " scored " : ""}${formattedScore} pts on ${gameName} · SELY`
      : `${nick ? nick + " · " : ""}${gameName} turunu ${formattedScore} puanla bitirdi!`;
    desc = isEn
      ? `Can you beat this score in today's daily run? Challenge now on sely.tr.`
      : `Günün seviyesinde bu skoru geçebilir misin? Hemen sely.tr üzerinde meydan oku.`;
  }

  // Construct OG Image URL passing through all incoming query params
  const ogSearchParams = new URLSearchParams(req.query as Record<string, string>);
  ogSearchParams.set("game", validGame);
  const host = req.headers.host || "sely.tr";
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const ogImageUrl = `${protocol}://${host}/api/og?${ogSearchParams.toString()}`;
  const canonicalUrl = `${protocol}://${host}${targetPlayPath}`;
  const sharePageUrl = `${protocol}://${host}${req.originalUrl || req.url}`;

  // Minimalist, high performance, neo-brutalist showcase HTML
  const html = `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(desc)}" />
  
  <!-- Open Graph & Social Cards -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(sharePageUrl)}" />
  <meta property="og:site_name" content="SELY MiniGame Hub" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(desc)}" />
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeHtml(title)}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@sely_tr" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(desc)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />

  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <style>
    :root {
      --paper: #F6F0E3;
      --ink: #1B1A1B;
      --coral: #E9563F;
      --mustard: #E5B341;
      --card-bg: #FFFAF0;
      --font-mono: "DM Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--paper);
      color: var(--ink);
      font-family: var(--font-sans);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      padding: 24px 16px 36px;
      background-image: radial-gradient(var(--ink) 1px, transparent 1px);
      background-size: 16px 16px;
    }
    .top-nav {
      width: 100%;
      max-width: 960px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid var(--ink);
      padding-bottom: 14px;
      margin-bottom: 24px;
    }
    .brand {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -1px;
      text-decoration: none;
      color: var(--ink);
    }
    .brand span { color: var(--coral); }
    .nav-tag {
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      background: var(--ink);
      color: var(--paper);
      padding: 4px 10px;
    }
    .showcase-container {
      width: 100%;
      max-width: 960px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }
    .card-wrap {
      width: 100%;
      position: relative;
      background: var(--ink);
      border: 3px solid var(--ink);
      box-shadow: 10px 10px 0 var(--ink);
      aspect-ratio: 1200 / 630;
      overflow: hidden;
      border-radius: 2px;
    }
    .card-img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }
    .actions-grid {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px 18px;
      font-family: var(--font-mono);
      font-size: 12.5px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-decoration: none;
      cursor: pointer;
      border: 2px solid var(--ink);
      box-shadow: 4px 4px 0 var(--ink);
      transition: transform 70ms ease, box-shadow 70ms ease, background-color 70ms ease;
      background: var(--paper);
      color: var(--ink);
      user-select: none;
    }
    .btn:hover { background: #fffdf8; }
    .btn:active {
      transform: translate(2px, 2px);
      box-shadow: 2px 2px 0 var(--ink);
    }
    .btn-play {
      background: var(--coral);
      color: #FFFFFF;
    }
    .btn-play:hover { background: #d9452f; color: #FFFFFF; }
    .btn-copy { background: var(--mustard); }
    .status-toast {
      position: fixed;
      bottom: 24px;
      background: var(--ink);
      color: var(--paper);
      font-family: var(--font-mono);
      font-size: 12px;
      padding: 10px 18px;
      box-shadow: 4px 4px 0 var(--coral);
      opacity: 0;
      pointer-events: none;
      transform: translateY(12px);
      transition: opacity 200ms ease, transform 200ms ease;
      z-index: 100;
    }
    .status-toast.visible {
      opacity: 1;
      transform: translateY(0);
    }
    footer {
      font-family: var(--font-mono);
      font-size: 11px;
      color: rgba(27, 26, 27, 0.7);
      margin-top: 28px;
      text-align: center;
    }
    @media (max-width: 640px) {
      body { padding: 16px 12px 24px; }
      .card-wrap { box-shadow: 6px 6px 0 var(--ink); }
      .btn { padding: 12px 14px; font-size: 11.5px; }
    }
  </style>
</head>
<body>
  <nav class="top-nav">
    <a href="/" class="brand">SELY<span>✛</span></a>
    <span class="nav-tag">${isEn ? "DAILY SHOWCASE" : "GÜNÜN KARTI"}</span>
  </nav>

  <main class="showcase-container">
    <div class="card-wrap">
      <img id="ogImg" src="${escapeHtml(ogImageUrl)}" alt="${escapeHtml(title)}" class="card-img" crossorigin="anonymous" />
    </div>

    <div class="actions-grid">
      <button type="button" class="btn btn-copy" id="btnCopyImg">
        <span>📋</span> <b>${isEn ? "Copy Image (PNG)" : "Görseli Kopyala"}</b>
      </button>
      <button type="button" class="btn" id="btnDownloadImg">
        <span>💾</span> <span>${isEn ? "Download Image" : "Görseli İndir"}</span>
      </button>
      <button type="button" class="btn" id="btnCopyLink">
        <span>🔗</span> <span>${isEn ? "Copy Link" : "Linki Kopyala"}</span>
      </button>
      <a href="${escapeHtml(targetPlayPath)}" class="btn btn-play">
        <span>⚡</span> <b>${isEn ? "Play Now →" : "Hemen Sen de Oyna →"}</b>
      </a>
    </div>
  </main>

  <div id="toast" class="status-toast" role="status" aria-live="polite"></div>

  <footer>
    <p>sely.tr · Küçük kural, büyük yankı. · Reklamsız, kayıt gerektirmeyen web oyunları</p>
  </footer>

  <script>
    const toast = document.getElementById('toast');
    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add('visible');
      setTimeout(() => toast.classList.remove('visible'), 2600);
    }

    // 1. Resim Panoya Kopyalama (Clipboard API & Canvas Rasterization)
    document.getElementById('btnCopyImg').addEventListener('click', async () => {
      const img = document.getElementById('ogImg');
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1200;
        canvas.height = 630;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 1200, 630);
        
        canvas.toBlob(async (blob) => {
          if (!blob) throw new Error("Rasterization failed");
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            showToast('${isEn ? "✓ Image copied to clipboard! Ready to paste." : "✓ Görsel panoya kopyalandı! (Ctrl+V ile yapıştır)"}');
          } catch (e) {
            // Fallback link copy if browser blocks image clipboard
            await navigator.clipboard.writeText(window.location.href);
            showToast('${isEn ? "Link copied to clipboard" : "Bağlantı panoya kopyalandı"}');
          }
        }, 'image/png');
      } catch (err) {
        navigator.clipboard.writeText(window.location.href);
        showToast('${isEn ? "Link copied to clipboard" : "Bağlantı panoya kopyalandı"}');
      }
    });

    // 2. PNG Olarak İndirme
    document.getElementById('btnDownloadImg').addEventListener('click', () => {
      const img = document.getElementById('ogImg');
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 630;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, 1200, 630);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sely-${validGame}-card.png';
        a.click();
        URL.revokeObjectURL(url);
        showToast('${isEn ? "✓ Image download started" : "✓ Görsel indiriliyor"}');
      }, 'image/png');
    });

    // 3. Bağlantıyı Kopyalama
    document.getElementById('btnCopyLink').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(window.location.href);
        showToast('${isEn ? "✓ Link copied to clipboard" : "✓ Bağlantı kopyalandı"}');
      } catch (e) {
        showToast('${isEn ? "Failed to copy" : "Kopyalanamadı"}');
      }
    });
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Long term CDN and client cache: 24h browser, 7 days edge CDN
  res.setHeader(
    "Cache-Control",
    "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
  );
  res.status(200).send(html);
}
