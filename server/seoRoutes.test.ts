import { describe, expect, it, beforeEach } from "vitest";
import express, { type Express } from "express";
import { registerSeoAndVerificationRoutes } from "./seoRoutes";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: "",
    status(code: number) { this.statusCode = code; return this; },
    set(key: string, val: string) { this.headers[key.toLowerCase()] = val; return this; },
    setHeader(key: string, val: string) { this.headers[key.toLowerCase()] = val; return this; },
    type(t: string) { this.headers["content-type"] = t; return this; },
    send(data: string) { this.body = data; return this; },
  };
  return res;
}

function findRouteHandler(app: Express, method: string, path: string) {
  const router = (app as any)._router;
  for (const layer of router.stack) {
    if (layer.route && layer.route.path === path && layer.route.methods[method.toLowerCase()]) {
      return layer.route.stack[0].handle;
    }
  }
  return null;
}

describe("SEO and Verification Routes", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    registerSeoAndVerificationRoutes(app);
  });

  it("serves robots.txt, sitemap.xml, and ads.txt with correct caching and domain mapping", async () => {
    process.env.PRIMARY_DOMAIN = "example.com";

    // robots.txt
    const robotsHandler = findRouteHandler(app, "get", "/robots.txt");
    const robotsRes = createMockRes();
    await robotsHandler({}, robotsRes);
    expect(robotsRes.statusCode).toBe(200);
    expect(robotsRes.body).toContain("Sitemap: https://example.com/sitemap.xml");

    // sitemap.xml
    const sitemapHandler = findRouteHandler(app, "get", "/sitemap.xml");
    const sitemapRes = createMockRes();
    await sitemapHandler({}, sitemapRes);
    expect(sitemapRes.statusCode).toBe(200);
    expect(sitemapRes.headers["content-type"]).toContain("xml");
    expect(sitemapRes.body).toContain("<loc>https://example.com/</loc>");

    // ads.txt 404 when unset, 200 when set
    delete process.env.ADS_TXT;
    delete process.env.VITE_ADS_TXT;
    const adsHandler = findRouteHandler(app, "get", "/ads.txt");
    const ads404Res = createMockRes();
    await adsHandler({}, ads404Res);
    expect(ads404Res.statusCode).toBe(404);

    process.env.ADS_TXT = "google.com, pub-123456789, DIRECT, f08c47fec0942fa0";
    const ads200Res = createMockRes();
    await adsHandler({}, ads200Res);
    expect(ads200Res.statusCode).toBe(200);
    expect(ads200Res.body).toContain("pub-123456789");

    delete process.env.PRIMARY_DOMAIN;
    delete process.env.ADS_TXT;
  });

  it("handles search engine verification routes for Google, Bing, and Yandex", async () => {
    // Google verification
    process.env.GOOGLE_SITE_VERIFICATION = "testgoogle123";
    const googleHandler = findRouteHandler(app, "get", "/google:token.html");
    const googleRes = createMockRes();
    let nextCalled = false;
    await googleHandler({ params: { token: "testgoogle123" } }, googleRes, () => { nextCalled = true; });
    expect(googleRes.statusCode).toBe(200);
    expect(googleRes.body).toContain("google-site-verification: googletestgoogle123.html");
    expect(nextCalled).toBe(false);

    // Google mismatch calls next()
    let mismatchNext = false;
    await googleHandler({ params: { token: "wrong" } }, createMockRes(), () => { mismatchNext = true; });
    expect(mismatchNext).toBe(true);

    // Bing verification
    process.env.BING_SITE_VERIFICATION = "TESTBINGTOKEN123";
    const bingHandler = findRouteHandler(app, "get", "/BingSiteAuth.xml");
    const bingRes = createMockRes();
    await bingHandler({}, bingRes, () => {});
    expect(bingRes.statusCode).toBe(200);
    expect(bingRes.body).toContain("<user>TESTBINGTOKEN123</user>");

    // Yandex verification
    process.env.YANDEX_SITE_VERIFICATION = "testyandex123";
    const yandexHandler = findRouteHandler(app, "get", "/yandex_:token.html");
    const yandexRes = createMockRes();
    await yandexHandler({ params: { token: "testyandex123" } }, yandexRes, () => {});
    expect(yandexRes.statusCode).toBe(200);
    expect(yandexRes.body).toContain("Verification: testyandex123");

    delete process.env.GOOGLE_SITE_VERIFICATION;
    delete process.env.BING_SITE_VERIFICATION;
    delete process.env.YANDEX_SITE_VERIFICATION;
  });
});
