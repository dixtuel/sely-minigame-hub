//! Share Showcase Bridge Route (/share/:game)
//! Serves neo-brutalist social card page with clipboard PNG copy, download, and instant play.
//! Matches server/og/shareRoute.ts.

use axum::{
    extract::{Path, Query},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::get,
    Router,
};
use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
pub struct ShareQuery {
    pub score: Option<String>,
    pub nick: Option<String>,
    pub outcome: Option<String>,
    pub grade: Option<String>,
    pub locale: Option<String>,
}

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#039;")
}

struct GameMeta {
    tr: &'static str,
    en: &'static str,
}

fn get_game_meta(game: &str) -> GameMeta {
    match game {
        "echo" => GameMeta { tr: "Yankı", en: "Echo" },
        "knot" => GameMeta { tr: "Düğüm", en: "Knot" },
        "cut" => GameMeta { tr: "Kesit", en: "Cutout" },
        "shadow" => GameMeta { tr: "Gölge", en: "Shadow" },
        "hane" => GameMeta { tr: "Hane", en: "Hane" },
        "spark" => GameMeta { tr: "Kıvılcım", en: "Spark" },
        "vaka" => GameMeta { tr: "Vaka", en: "Vaka Mystery" },
        "asteroids" => GameMeta { tr: "Göktaşı", en: "Asteroids" },
        "sokoban" => GameMeta { tr: "İstif", en: "Sokoban" },
        "tetris" => GameMeta { tr: "Dörtyol", en: "Tetris" },
        "lander" => GameMeta { tr: "İniş", en: "Lander" },
        "lightsout" => GameMeta { tr: "Şebeke", en: "Lights Out" },
        "game2048" => GameMeta { tr: "Kare 2048", en: "2048" },
        "coil" => GameMeta { tr: "Coil", en: "Coil" },
        "apex" => GameMeta { tr: "Apex", en: "Apex" },
        "lift" => GameMeta { tr: "Lift", en: "Lift" },
        "breakline" => GameMeta { tr: "Breakline", en: "Breakline" },
        _ => GameMeta { tr: "Yankı", en: "Echo" },
    }
}

fn validated_game_id(game_key: &str) -> &str {
    match game_key {
        "echo" | "knot" | "cut" | "shadow" | "hane" | "spark" | "vaka"
        | "asteroids" | "sokoban" | "tetris" | "lander" | "lightsout"
        | "game2048" | "coil" | "apex" | "lift" | "breakline" => game_key,
        _ => "echo",
    }
}

pub async fn share_bridge_handler(
    Path(game): Path<String>,
    Query(query): Query<ShareQuery>,
    headers: HeaderMap,
) -> Response {
    let game_key = game.to_lowercase();
    let valid_game = validated_game_id(&game_key);

    let is_en = query.locale.as_deref() == Some("en");
    let locale = if is_en { "en" } else { "tr" };
    let meta = get_game_meta(valid_game);
    let game_name = if is_en { meta.en } else { meta.tr };

    let target_play_path = if is_en {
        format!("/en/play/{}", valid_game)
    } else {
        format!("/play/{}", valid_game)
    };

    let raw_score = query.score.as_deref().unwrap_or("");
    let nick = query.nick.as_deref().unwrap_or("");
    let outcome = query.outcome.as_deref().unwrap_or("");
    let grade = query.grade.as_deref().unwrap_or("");

    let mut title = format!("SELY · {}", game_name);
    let mut desc = if is_en {
        format!("Play {} on SELY — minimal rules, lasting echoes.", game_name)
    } else {
        format!("SELY üzerinde {} oyna — Küçük kural, büyük yankı.", game_name)
    };

    if valid_game == "vaka" {
        if outcome == "solved" || outcome == "success" {
            let gr = if !grade.is_empty() { grade } else { "S" };
            title = if is_en {
                format!("SELY Vaka · CASE SOLVED (Grade {})", gr)
            } else {
                format!("SELY Vaka · CİNAYET DOSYASI ÇÖZÜLDÜ (Derece {})", gr)
            };
            let p_nick = if !nick.is_empty() { nick } else { "Player" };
            let p_score = if !raw_score.is_empty() { raw_score } else { "high" };
            desc = if is_en {
                format!("Detective {} uncovered the truth and closed the case with {} points!", p_nick, p_score)
            } else {
                format!("Dedektif {} gizemi aydınlattı ve dosyayı {} puanla kapattı!", p_nick, p_score)
            };
        }
    } else if !raw_score.is_empty() {
        title = if is_en {
            format!("{}{} pts on {} · SELY", if !nick.is_empty() { format!("{} scored ", nick) } else { "".to_string() }, raw_score, game_name)
        } else {
            format!("{}{} turunu {} puanla bitirdi!", if !nick.is_empty() { format!("{} · ", nick) } else { "".to_string() }, game_name, raw_score)
        };
    }

    let host = headers.get("host").and_then(|h| h.to_str().ok()).unwrap_or("sely.tr");
    let proto = headers.get("x-forwarded-proto").and_then(|h| h.to_str().ok()).unwrap_or("https");

    let mut og_params = Vec::new();
    og_params.push(format!("game={}", valid_game));
    if !raw_score.is_empty() { og_params.push(format!("score={}", raw_score)); }
    if !nick.is_empty() { og_params.push(format!("nick={}", urlencoding::encode(nick))); }
    if !outcome.is_empty() { og_params.push(format!("outcome={}", outcome)); }
    if !grade.is_empty() { og_params.push(format!("grade={}", grade)); }
    if is_en { og_params.push("locale=en".to_string()); }

    let og_image_url = format!("{}://{}/api/og?{}", proto, host, og_params.join("&"));
    // Meta tags (og:image/twitter:image) need the real PNG — crawlers don't render SVG. The
    // page's own on-screen preview is just a human looking at a picture, which a plain <img>
    // renders fine from SVG, so it skips server-side rasterization entirely.
    let og_image_svg_url = format!("{}&format=svg", og_image_url);
    let share_page_url = format!("{}://{}/share/{}", proto, host, valid_game);

    let html = format!(
        r#"<!doctype html>
<html lang="{}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{}</title>
  <meta name="description" content="{}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="{}" />
  <meta property="og:site_name" content="SELY MiniGame Hub" />
  <meta property="og:title" content="{}" />
  <meta property="og:description" content="{}" />
  <meta property="og:image" content="{}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@sely_tr" />
  <meta name="twitter:title" content="{}" />
  <meta name="twitter:description" content="{}" />
  <meta name="twitter:image" content="{}" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <style>
    :root {{ --paper: #F6F0E3; --ink: #1B1A1B; --coral: #E9563F; --mustard: #E5B341; font-family: system-ui, sans-serif; }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{ background: var(--paper); color: var(--ink); display: flex; flex-direction: column; align-items: center; justify-content: space-between; min-height: 100vh; padding: 24px 16px; }}
    .top-nav {{ width: 100%; max-width: 960px; display: flex; justify-content: space-between; border-bottom: 2px solid var(--ink); padding-bottom: 12px; margin-bottom: 20px; }}
    .brand {{ font-size: 20px; font-weight: 900; text-decoration: none; color: var(--ink); }}
    .card-wrap {{ width: 100%; max-width: 960px; border: 3px solid var(--ink); box-shadow: 8px 8px 0 var(--ink); aspect-ratio: 1200/630; overflow: hidden; }}
    .card-img {{ width: 100%; height: 100%; object-fit: cover; }}
    .actions-grid {{ width: 100%; max-width: 960px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 20px; }}
    .btn {{ display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; font-weight: 700; text-decoration: none; border: 2px solid var(--ink); box-shadow: 4px 4px 0 var(--ink); cursor: pointer; background: var(--paper); color: var(--ink); }}
    .btn-play {{ background: var(--coral); color: #fff; }}
    .btn-copy {{ background: var(--mustard); }}
  </style>
</head>
<body>
  <nav class="top-nav">
    <a href="/" class="brand">SELY✛</a>
    <span>{}</span>
  </nav>
  <main style="width: 100%; max-width: 960px;">
    <div class="card-wrap">
      <img id="ogImg" src="{}" data-png-src="{}" alt="{}" class="card-img" crossorigin="anonymous" />
    </div>
    <div class="actions-grid">
      <button type="button" class="btn btn-copy" id="btnCopyImg">📋 <b>{}</b></button>
      <button type="button" class="btn" id="btnDownloadImg">💾 {}</button>
      <button type="button" class="btn" id="btnCopyLink">🔗 {}</button>
      <a href="{}" class="btn btn-play">⚡ <b>{}</b></a>
    </div>
  </main>
  <footer style="margin-top: 30px; font-size: 11px; opacity: 0.7;">
    <p>sely.tr · Küçük kural, büyük yankı. · Reklamsız, kayıt gerektirmeyen web oyunları</p>
  </footer>
  <script>
    document.getElementById('btnCopyLink').addEventListener('click', async () => {{
      await navigator.clipboard.writeText(window.location.href);
      alert('{}');
    }});
    document.getElementById('btnDownloadImg').addEventListener('click', async () => {{
      const pngUrl = document.getElementById('ogImg').getAttribute('data-png-src');
      const res = await fetch(pngUrl);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'sely-{}-card.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }});
    document.getElementById('btnCopyImg').addEventListener('click', async () => {{
      const pngUrl = document.getElementById('ogImg').getAttribute('data-png-src');
      try {{
        // Calling clipboard.write() synchronously (Promise-valued ClipboardItem) keeps this
        // tied to the click's user-activation even though the fetch resolves later — some
        // engines (notably Safari) silently drop the write if you await the fetch first.
        await navigator.clipboard.write([
          new ClipboardItem({{ 'image/png': fetch(pngUrl).then(r => r.blob()) }}),
        ]);
      }} catch (e) {{
        const res = await fetch(pngUrl);
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'sely-{}-card.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }}
    }});
  </script>
</body>
</html>"#,
        locale,
        escape_html(&title),
        escape_html(&desc),
        escape_html(&share_page_url),
        escape_html(&title),
        escape_html(&desc),
        escape_html(&og_image_url),
        escape_html(&title),
        escape_html(&desc),
        escape_html(&og_image_url),
        if is_en { "DAILY SHOWCASE" } else { "GÜNÜN KARTI" },
        escape_html(&og_image_svg_url),
        escape_html(&og_image_url),
        escape_html(&title),
        if is_en { "Copy Image" } else { "Görseli Kopyala" },
        if is_en { "Download Image" } else { "Görseli İndir" },
        if is_en { "Copy Link" } else { "Linki Kopyala" },
        escape_html(&target_play_path),
        if is_en { "Play Now →" } else { "Hemen Sen de Oyna →" },
        if is_en { "Link copied!" } else { "Bağlantı kopyalandı!" },
        valid_game,
        valid_game
    );

    let mut resp_headers = HeaderMap::new();
    resp_headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("text/html; charset=utf-8"));
    resp_headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"),
    );

    (StatusCode::OK, resp_headers, Html(html)).into_response()
}

pub async fn share_bridge_en_handler(
    Path(game): Path<String>,
    Query(mut query): Query<ShareQuery>,
    headers: HeaderMap,
) -> Response {
    query.locale = Some("en".to_string());
    share_bridge_handler(Path(game), Query(query), headers).await
}

pub fn share_routes() -> Router {
    Router::new()
        .route("/share/{game}", get(share_bridge_handler))
        .route("/en/share/{game}", get(share_bridge_en_handler))
}

#[cfg(test)]
mod tests {
    use super::{get_game_meta, validated_game_id};

    #[test]
    fn share_bridge_keeps_each_catalogue_game_identity() {
        let games = [
            "echo", "knot", "cut", "shadow", "hane", "spark", "vaka", "asteroids",
            "sokoban", "tetris", "lander", "lightsout", "game2048", "coil", "apex",
            "lift", "breakline",
        ];

        for game in games {
            assert_eq!(validated_game_id(game), game);
            assert!(!get_game_meta(game).en.is_empty());
        }
    }

    #[test]
    fn share_bridge_falls_back_for_unknown_game_ids() {
        assert_eq!(validated_game_id("unknown-game"), "echo");
    }
}
