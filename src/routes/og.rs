//! OG Social Preview Image Generator (Pure SVG)
//! Renders 1200x630 neo-brutalist social cards directly without binary dependencies.
//! Matches server/og/ogRoute.ts and server/og/ogTemplate.ts.

use axum::{
    extract::Query,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
pub struct OgQuery {
    pub game: Option<String>,
    pub score: Option<i64>,
    pub nick: Option<String>,
    pub rank: Option<String>,
    pub outcome: Option<String>,
    pub grade: Option<String>,
    pub case_title: Option<String>,
    pub suspect: Option<String>,
    pub locale: Option<String>,
    pub date: Option<String>,
}

fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

pub fn generate_og_svg(params: &OgQuery) -> String {
    let game = params.game.as_deref().unwrap_or("echo").to_lowercase();
    let is_en = params.locale.as_deref() == Some("en");
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let date_str = params.date.as_deref().unwrap_or(&today);

    let (title, eyebrow, accent) = match game.as_str() {
        "echo" => (if is_en { "ECHO ROOM" } else { "YANKI ODASI" }, if is_en { "EXPLORE / RISK" } else { "KEŞİF / RİSK" }, "#E9563F"),
        "knot" => (if is_en { "KNOT" } else { "DÜĞÜM" }, if is_en { "FLOW / PUZZLE" } else { "AKIŞ / BULMACA" }, "#293B75"),
        "cut" => (if is_en { "CUTOUT" } else { "KIRPIK" }, if is_en { "CUT / RHYTHM" } else { "KESİM / RİTİM" }, "#654169"),
        "shadow" => (if is_en { "SHADOW SHARE" } else { "GÖLGE PAYI" }, if is_en { "TIME / MATCH" } else { "ZAMAN / EŞLEME" }, "#1B1A1B"),
        "hane" => (if is_en { "HANE" } else { "HANE" }, if is_en { "WORD / NUMBER" } else { "KELİME / SAYI" }, "#E5B341"),
        "spark" => (if is_en { "SPARK" } else { "KIVILCIM" }, if is_en { "REFLEX / TENSION" } else { "REFLEKS / GERİLİM" }, "#D9381E"),
        "vaka" => (if is_en { "VAKA MYSTERY" } else { "VAKA DEDEKTİFLİK" }, if is_en { "CASE FILE / DETECTIVE" } else { "CİNAYET / DEDEKTİF" }, "#B83227"),
        _ => ("SELY MINIGAME HUB", "ARCADE / PROTOCOL", "#E9563F"),
    };

    let score_section = if let Some(sc) = params.score {
        let label = if is_en { "FINAL SCORE" } else { "SKOR KAYDI" };
        format!(
            concat!(
                "<g transform=\"translate(100, 420)\">\n",
                "  <rect x=\"0\" y=\"0\" width=\"300\" height=\"90\" fill=\"#1B1A1B\" stroke=\"#1B1A1B\" stroke-width=\"2\" />\n",
                "  <text x=\"20\" y=\"32\" font-family=\"monospace\" font-size=\"14\" fill=\"#F6F0E3\" font-weight=\"700\">{}</text>\n",
                "  <text x=\"20\" y=\"72\" font-family=\"monospace\" font-size=\"38\" fill=\"{}\" font-weight=\"900\">{} PTS</text>\n",
                "</g>"
            ),
            label, accent, sc
        )
    } else {
        String::new()
    };

    let nick_text = params.nick.as_deref().unwrap_or("Anonim Gezgin");
    let rank_text = params.rank.as_deref().map(|r| format!("· RANK #{}", r)).unwrap_or_default();

    let template = concat!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1200 630\" width=\"1200\" height=\"630\">\n",
        "  <defs>\n",
        "    <pattern id=\"dot-grid\" x=\"0\" y=\"0\" width=\"24\" height=\"24\" patternUnits=\"userSpaceOnUse\">\n",
        "      <circle cx=\"2\" cy=\"2\" r=\"1.5\" fill=\"#1B1A1B\" opacity=\"0.12\" />\n",
        "    </pattern>\n",
        "  </defs>\n\n",
        "  <rect width=\"1200\" height=\"630\" fill=\"#F6F0E3\" />\n",
        "  <rect width=\"1200\" height=\"630\" fill=\"url(#dot-grid)\" />\n\n",
        "  <!-- Outer Frame -->\n",
        "  <rect x=\"36\" y=\"36\" width=\"1128\" height=\"558\" fill=\"none\" stroke=\"#1B1A1B\" stroke-width=\"6\" />\n\n",
        "  <!-- Top bar -->\n",
        "  <rect x=\"36\" y=\"36\" width=\"1128\" height=\"52\" fill=\"#1B1A1B\" />\n",
        "  <text x=\"60\" y=\"68\" font-family=\"monospace\" font-size=\"16\" fill=\"#F6F0E3\" font-weight=\"900\" letter-spacing=\"2\">SELY PROTOCOL // __DATE__</text>\n",
        "  <text x=\"1140\" y=\"68\" font-family=\"monospace\" font-size=\"15\" fill=\"#F6F0E3\" text-anchor=\"end\">__EYEBROW__</text>\n\n",
        "  <!-- Title & Eyebrow -->\n",
        "  <text x=\"100\" y=\"170\" font-family=\"monospace\" font-size=\"18\" fill=\"__ACCENT__\" font-weight=\"900\" letter-spacing=\"3\">__EYEBROW__</text>\n",
        "  <text x=\"100\" y=\"260\" font-family=\"sans-serif\" font-size=\"74\" fill=\"#1B1A1B\" font-weight=\"900\" letter-spacing=\"-2\">__TITLE__</text>\n\n",
        "  <!-- Player Info -->\n",
        "  <g transform=\"translate(100, 310)\">\n",
        "    <text x=\"0\" y=\"24\" font-family=\"monospace\" font-size=\"22\" fill=\"#1B1A1B\" font-weight=\"700\">👤 __NICK__ __RANK__</text>\n",
        "  </g>\n\n",
        "  __SCORE_SECTION__\n\n",
        "  <!-- Bottom Brand -->\n",
        "  <text x=\"100\" y=\"550\" font-family=\"sans-serif\" font-size=\"16\" fill=\"#1B1A1B\" opacity=\"0.65\" font-weight=\"600\">sely.tr · Küçük kural, büyük yankı. · Reklamsız, kayıt gerektirmeyen bağımsız oyunlar</text>\n",
        "</svg>"
    );

    template
        .replace("__DATE__", date_str)
        .replace("__EYEBROW__", eyebrow)
        .replace("__ACCENT__", accent)
        .replace("__TITLE__", &escape_xml(title))
        .replace("__NICK__", &escape_xml(nick_text))
        .replace("__RANK__", &escape_xml(&rank_text))
        .replace("__SCORE_SECTION__", &score_section)
}

pub async fn og_image_handler(Query(query): Query<OgQuery>) -> Response {
    let svg = generate_og_svg(&query);

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("image/svg+xml; charset=utf-8"));
    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, HeaderValue::from_static("*"));
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"),
    );

    (StatusCode::OK, headers, svg).into_response()
}

pub fn og_routes() -> Router {
    Router::new().route("/api/og", get(og_image_handler))
}
