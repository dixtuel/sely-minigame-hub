import type { Express } from "express";

export function registerSeoAndVerificationRoutes(app: Express) {
  // 1. ads.txt (env-driven)
  app.get("/ads.txt", (_req, res) => {
    const adsTxt = process.env.ADS_TXT || process.env.VITE_ADS_TXT;
    if (adsTxt) {
      res.type("text/plain; charset=utf-8").send(adsTxt.trim() + "\n");
    } else {
      res.status(404).send("Not Found");
    }
  });

  // 2. robots.txt (env-driven)
  app.get("/robots.txt", (_req, res) => {
    const domain = process.env.PRIMARY_DOMAIN || process.env.VITE_PRIMARY_DOMAIN;
    const sitemapUrl = domain ? `https://${domain}/sitemap.xml` : "/sitemap.xml";
    res.type("text/plain; charset=utf-8").send(`User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`);
  });

  // 3. sitemap.xml (env-driven)
  app.get("/sitemap.xml", (_req, res) => {
    const domain = process.env.PRIMARY_DOMAIN || process.env.VITE_PRIMARY_DOMAIN;
    const base = domain ? `https://${domain}` : "";
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${base}/privacy</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
  <url><loc>${base}/terms</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
  <url><loc>${base}/accessibility</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>
</urlset>`;
    res.type("application/xml; charset=utf-8").send(sitemap);
  });

  // 4. Google Site Verification file (e.g. /google61d3ec281c4494d1.html)
  app.get("/google:token.html", (req, res, next) => {
    const token = req.params.token;
    const expected = process.env.GOOGLE_SITE_VERIFICATION || process.env.VITE_GOOGLE_SITE_VERIFICATION;
    if (expected && expected === token) {
      return res.type("text/html; charset=utf-8").send(`google-site-verification: google${token}.html\n`);
    }
    next();
  });

  // 5. Bing Site Verification XML (/BingSiteAuth.xml)
  app.get("/BingSiteAuth.xml", (_req, res, next) => {
    const token = process.env.BING_SITE_VERIFICATION || process.env.VITE_BING_SITE_VERIFICATION;
    if (token) {
      return res.type("application/xml; charset=utf-8").send(`<?xml version="1.0"?>\n<users>\n\t<user>${token}</user>\n</users>\n`);
    }
    next();
  });

  // 6. Yandex Verification file (e.g. /yandex_7c2bdf89df802f62.html)
  app.get("/yandex_:token.html", (req, res, next) => {
    const token = req.params.token;
    const expected = process.env.YANDEX_SITE_VERIFICATION || process.env.VITE_YANDEX_SITE_VERIFICATION;
    if (expected && expected === token) {
      return res.type("text/html; charset=utf-8").send(`<html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"></head><body>Verification: ${token}</body></html>\n`);
    }
    next();
  });
}
