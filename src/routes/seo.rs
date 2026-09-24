//! SEO, Robots, Sitemap, and Search Engine Verification Routes
//! Matches server/seoRoutes.ts.

use axum::{
    extract::Path,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use std::env;
use super::domain::configured_origin;

const CACHE_1DAY: &str = "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800";
const CACHE_1WEEK: &str = "public, max-age=604800, s-maxage=604800, stale-while-revalidate=2592000";

pub async fn ads_txt_handler() -> Response {
    let ads_txt = env::var("ADS_TXT")
        .or_else(|_| env::var("VITE_ADS_TXT"))
        .unwrap_or_default();

    if !ads_txt.is_empty() {
        let mut headers = HeaderMap::new();
        headers.insert(header::CACHE_CONTROL, HeaderValue::from_static(CACHE_1DAY));
        headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("text/plain; charset=utf-8"));
        (StatusCode::OK, headers, format!("{}\n", ads_txt.trim())).into_response()
    } else {
        (StatusCode::NOT_FOUND, "Not Found").into_response()
    }
}

pub async fn robots_txt_handler(headers: HeaderMap) -> Response {
    let host = headers.get("host").and_then(|value| value.to_str().ok());
    let proto = headers.get("x-forwarded-proto").and_then(|value| value.to_str().ok());
    let sitemap_line = configured_origin(host, proto)
        .map(|origin| format!("\nSitemap: {origin}/sitemap.xml\n"))
        .unwrap_or_else(|| "\n".to_string());
    let body = format!("User-agent: *\nAllow: /\nDisallow: /api/{}", sitemap_line);

    let mut headers = HeaderMap::new();
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static(CACHE_1DAY));
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("text/plain; charset=utf-8"));
    (StatusCode::OK, headers, body).into_response()
}

pub async fn sitemap_xml_handler(headers: HeaderMap) -> Response {
    let host = headers.get("host").and_then(|value| value.to_str().ok());
    let proto = headers.get("x-forwarded-proto").and_then(|value| value.to_str().ok());
    let entries = configured_origin(host, proto)
        .map(|origin| format!("  <url><loc>{origin}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n"))
        .unwrap_or_default();
    let sitemap = format!(
        "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n{entries}</urlset>"
    );

    let mut headers = HeaderMap::new();
    headers.insert(header::CACHE_CONTROL, HeaderValue::from_static(CACHE_1DAY));
    headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("application/xml; charset=utf-8"));
    (StatusCode::OK, headers, sitemap).into_response()
}

pub async fn seo_verification_handler(Path(file): Path<String>) -> Response {
    if file.starts_with("google") && file.ends_with(".html") {
        let token = file.trim_start_matches("google").trim_end_matches(".html");
        let expected = env::var("GOOGLE_SITE_VERIFICATION")
            .or_else(|_| env::var("VITE_GOOGLE_SITE_VERIFICATION"))
            .unwrap_or_default();

        if !expected.is_empty() && expected == token {
            let mut headers = HeaderMap::new();
            headers.insert(header::CACHE_CONTROL, HeaderValue::from_static(CACHE_1WEEK));
            headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("text/html; charset=utf-8"));
            (StatusCode::OK, headers, format!("google-site-verification: google{}.html\n", token)).into_response()
        } else {
            (StatusCode::NOT_FOUND, "Not Found").into_response()
        }
    } else if file.starts_with("yandex_") && file.ends_with(".html") {
        let token = file.trim_start_matches("yandex_").trim_end_matches(".html");
        let expected = env::var("YANDEX_SITE_VERIFICATION")
            .or_else(|_| env::var("VITE_YANDEX_SITE_VERIFICATION"))
            .unwrap_or_default();

        if !expected.is_empty() && expected == token {
            let body = format!(
                "<html><head><meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\"></head><body>Verification: {}</body></html>\n",
                token
            );
            let mut headers = HeaderMap::new();
            headers.insert(header::CACHE_CONTROL, HeaderValue::from_static(CACHE_1WEEK));
            headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("text/html; charset=utf-8"));
            (StatusCode::OK, headers, body).into_response()
        } else {
            (StatusCode::NOT_FOUND, "Not Found").into_response()
        }
    } else {
        (StatusCode::NOT_FOUND, "Not Found").into_response()
    }
}

pub async fn bing_verification_handler() -> Response {
    let token = env::var("BING_SITE_VERIFICATION")
        .or_else(|_| env::var("VITE_BING_SITE_VERIFICATION"))
        .unwrap_or_default();

    if !token.is_empty() {
        let body = format!("<?xml version=\"1.0\"?>\n<users>\n\t<user>{}</user>\n</users>\n", token);
        let mut headers = HeaderMap::new();
        headers.insert(header::CACHE_CONTROL, HeaderValue::from_static(CACHE_1WEEK));
        headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("application/xml; charset=utf-8"));
        (StatusCode::OK, headers, body).into_response()
    } else {
        (StatusCode::NOT_FOUND, "Not Found").into_response()
    }
}

pub fn seo_routes() -> Router {
    Router::new()
        .route("/ads.txt", get(ads_txt_handler))
        .route("/robots.txt", get(robots_txt_handler))
        .route("/sitemap.xml", get(sitemap_xml_handler))
        .route("/BingSiteAuth.xml", get(bing_verification_handler))
        .route("/{file}", get(seo_verification_handler))
}
