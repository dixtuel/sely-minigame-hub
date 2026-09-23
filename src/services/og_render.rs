//! Server-side SVG -> PNG rasterization for the /api/og social preview card.
//!
//! Most social crawlers (Facebook, Twitter/X, WhatsApp, LinkedIn, Slack, Discord's unfurl)
//! do not render SVG for og:image — they need a real raster image (PNG/JPEG). /api/og
//! previously served raw image/svg+xml, so shared score links showed no preview image on
//! most platforms. resvg + tiny-skia are pure Rust (no system Cairo/Skia/fontconfig), which
//! is what makes this safe to run on Vercel's serverless Rust runtime — the SVG uses generic
//! "monospace"/"sans-serif" font-family names, and a bare Lambda-style container has no
//! system fonts installed for those to resolve to, so the fonts used are embedded directly
//! in the binary and registered as the generic family fallbacks below.

use resvg::tiny_skia;
use resvg::usvg::{self, fontdb};
use std::sync::Arc;

const DM_MONO_REGULAR: &[u8] = include_bytes!("../../assets/fonts/DMMono-Regular.ttf");
const DM_MONO_MEDIUM: &[u8] = include_bytes!("../../assets/fonts/DMMono-Medium.ttf");
const SPACE_GROTESK: &[u8] = include_bytes!("../../assets/fonts/SpaceGrotesk.ttf");

fn build_fontdb() -> fontdb::Database {
    let mut db = fontdb::Database::new();
    db.load_font_data(DM_MONO_REGULAR.to_vec());
    db.load_font_data(DM_MONO_MEDIUM.to_vec());
    db.load_font_data(SPACE_GROTESK.to_vec());
    // The SVG only ever requests the generic families "monospace" and "sans-serif" — map
    // those straight to the embedded faces so resolution never depends on what fonts (if
    // any) happen to be installed in the container.
    db.set_monospace_family("DM Mono");
    db.set_sans_serif_family("Space Grotesk");
    db
}

/// Renders an SVG string to PNG bytes at the given pixel size.
pub fn render_svg_to_png(svg: &str, width: u32, height: u32) -> Result<Vec<u8>, String> {
    let mut options = usvg::Options::default();
    options.fontdb = Arc::new(build_fontdb());

    let tree = usvg::Tree::from_str(svg, &options).map_err(|e| format!("SVG parse failed: {e}"))?;

    let mut pixmap = tiny_skia::Pixmap::new(width, height).ok_or("Failed to allocate pixmap")?;

    let tree_size = tree.size();
    let scale_x = width as f32 / tree_size.width();
    let scale_y = height as f32 / tree_size.height();
    let transform = tiny_skia::Transform::from_scale(scale_x, scale_y);

    resvg::render(&tree, transform, &mut pixmap.as_mut());

    pixmap.encode_png().map_err(|e| format!("PNG encode failed: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_renders_svg_with_turkish_text_to_valid_png() {
        let svg = r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400" height="200">
          <rect width="400" height="200" fill="#F6F0E3" />
          <text x="20" y="60" font-family="sans-serif" font-size="28" fill="#1B1A1B">Işığı Söndür — Şüpheli Çözüldü</text>
          <text x="20" y="120" font-family="monospace" font-size="24" fill="#E9563F">1234 PTS</text>
        </svg>"##;
        let png = render_svg_to_png(svg, 400, 200).expect("should render");
        // PNG signature: 89 50 4E 47 0D 0A 1A 0A
        assert_eq!(&png[0..8], &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        assert!(png.len() > 500, "PNG should have real image data, got {} bytes", png.len());
    }

    #[test]
    fn test_full_og_card_size_renders() {
        let svg = format!(
            r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
              <rect width="1200" height="630" fill="#F6F0E3" />
              <text x="100" y="260" font-family="sans-serif" font-size="74" fill="#1B1A1B">{}</text>
            </svg>"##,
            "GÖKTAŞI"
        );
        let png = render_svg_to_png(&svg, 1200, 630).expect("should render");
        assert_eq!(&png[0..8], &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    }
}
