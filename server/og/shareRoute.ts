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

const GAME_NAMES: Record<string, { tr: string; en: string }> = {
  echo: { tr: "Yankı", en: "Echo" },
  knot: { tr: "Düğüm", en: "Knot" },
  cut: { tr: "Kesit", en: "Cutout" },
  shadow: { tr: "Gölge", en: "Shadow" },
  hane: { tr: "Hane", en: "Hane" },
  spark: { tr: "Kıvılcım", en: "Spark" },
  vaka: { tr: "Vaka", en: "Vaka Mystery" },
};

/**
 * Handles /share/:game
 * - If called by social media crawler: Returns dynamic Open Graph HTML with /api/og image preview.
 * - If called by human visitor: Instantly redirects (302) to the playable game route (/play/:game).
 */
export function handleShareBridgeRequest(req: Request, res: Response) {
  const gameKey = (req.params.game || "").toLowerCase();
  const validGame = GAME_NAMES[gameKey] ? gameKey : "echo";
  const userAgent = req.headers["user-agent"] || "";
  const locale = req.query.locale === "en" ? "en" : "tr";
  const isEn = locale === "en";

  // Build target game redirect URL
  const targetPlayPath = isEn ? `/en/play/${validGame}` : `/play/${validGame}`;

  // If a human visitor clicks the share link, redirect straight to the game
  if (!isSocialCrawler(userAgent)) {
    return res.redirect(302, targetPlayPath);
  }

  // Social media bot detected: Build rich Open Graph HTML payload
  const gameName = isEn ? GAME_NAMES[validGame].en : GAME_NAMES[validGame].tr;
  const rawScore = req.query.score ? String(req.query.score).replace(/[^\d]/g, "") : "";
  const nick = req.query.nick ? String(req.query.nick).slice(0, 16) : "";
  const outcome = req.query.outcome === "solved" || req.query.outcome === "success" ? "solved" : req.query.outcome === "failure" ? "failed" : "";
  const grade = req.query.grade ? String(req.query.grade).slice(0, 2) : "";

  // Dynamic titles and descriptions
  let title = `SELY.TR · ${gameName}`;
  let desc = isEn
    ? `Play ${gameName} on SELY.TR — 7 distinctive retro mini games with pure rules.`
    : `SELY.TR üzerinde ${gameName} oyna — Küçük kural, büyük yankı.`;

  if (validGame === "vaka") {
    if (outcome === "solved") {
      title = isEn ? `SELY Vaka · CASE SOLVED (Grade ${grade || "S"})` : `SELY Vaka · CİNAYET DOSYASI ÇÖZÜLDÜ (Derece ${grade || "S"})`;
      desc = isEn
        ? `Detective ${nick || "Player"} uncovered the truth and closed the case with ${rawScore || "high"} points!`
        : `Dedektif ${nick || "Oyuncu"} gizemi aydınlattı ve dosyayı ${rawScore || "yüksek"} puanla kapattı!`;
    } else {
      title = isEn ? `SELY Vaka · Murder Mystery Investigation` : `SELY Vaka · Polis Sorgu Bürosu`;
      desc = isEn
        ? `Can you solve the case? Interrogate suspects and find contradictions.`
        : `Katili bulabilir misin? Şüphelileri sorgula ve çelişkileri yakala.`;
    }
  } else if (rawScore) {
    const formattedScore = parseInt(rawScore, 10).toLocaleString(isEn ? "en-US" : "tr-TR");
    title = isEn
      ? `${nick ? nick + " scored " : ""}${formattedScore} pts on ${gameName} · SELY.TR`
      : `${nick ? nick + " · " : ""}${gameName} turunu ${formattedScore} puanla tamamladı!`;
    desc = isEn
      ? `Can you beat this score in today's daily seed? Play now on sely.tr.`
      : `Günün seviyesinde bu skoru geçebilir misin? Hemen sely.tr üzerinde oyna.`;
  }

  // Construct OG Image URL passing through all incoming query params
  const ogSearchParams = new URLSearchParams(req.query as Record<string, string>);
  ogSearchParams.set("game", validGame);
  const host = req.headers.host || "sely.tr";
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const ogImageUrl = `${protocol}://${host}/api/og?${ogSearchParams.toString()}`;
  const canonicalUrl = `${protocol}://${host}${targetPlayPath}`;

  const html = `<!doctype html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(desc)}" />
  
  <!-- Open Graph / Facebook / Discord / WhatsApp -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:site_name" content="SELY.TR MiniGame Hub" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(desc)}" />
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeHtml(title)}" />

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@sely_tr" />
  <meta name="twitter:url" content="${escapeHtml(canonicalUrl)}" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(desc)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />

  <!-- Fallback client redirect if a human browser loads this page -->
  <meta http-equiv="refresh" content="0; url=${escapeHtml(targetPlayPath)}" />
</head>
<body>
  <p>Redirecting to <a href="${escapeHtml(targetPlayPath)}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400");
  res.status(200).send(html);
}
