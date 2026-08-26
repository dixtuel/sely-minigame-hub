import { describe, expect, it, beforeEach } from "vitest";
import express, { type Express } from "express";
import { registerSeoAndVerificationRoutes } from "./seoRoutes";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: "",
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    type(t: string) {
      this.headers["content-type"] = t;
      return this;
    },
    send(data: string) {
      this.body = data;
      return this;
    }
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

  describe("GET /ads.txt", () => {
    it("returns 404 when ADS_TXT is not set", async () => {
      const orig = process.env.ADS_TXT;
      const origVite = process.env.VITE_ADS_TXT;
      delete process.env.ADS_TXT;
      delete process.env.VITE_ADS_TXT;

      const handler = findRouteHandler(app, "get", "/ads.txt");
      const req: any = {};
      const res = createMockRes();

      await handler(req, res);
      expect(res.statusCode).toBe(404);

      if (orig) process.env.ADS_TXT = orig;
      if (origVite) process.env.VITE_ADS_TXT = origVite;
    });

    it("returns 200 and plain text when ADS_TXT is set", async () => {
      process.env.ADS_TXT = "google.com, pub-123456789, DIRECT, f08c47fec0942fa0";
      const handler = findRouteHandler(app, "get", "/ads.txt");
      const req: any = {};
      const res = createMockRes();

      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.body).toContain("pub-123456789");
      delete process.env.ADS_TXT;
    });
  });

  describe("GET /robots.txt and /sitemap.xml", () => {
    it("returns robots.txt with sitemap reference", async () => {
      process.env.PRIMARY_DOMAIN = "example.com";
      const handler = findRouteHandler(app, "get", "/robots.txt");
      const req: any = {};
      const res = createMockRes();

      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain("Sitemap: https://example.com/sitemap.xml");
      delete process.env.PRIMARY_DOMAIN;
    });

    it("returns valid sitemap.xml with domain from env", async () => {
      process.env.PRIMARY_DOMAIN = "example.com";
      const handler = findRouteHandler(app, "get", "/sitemap.xml");
      const req: any = {};
      const res = createMockRes();

      await handler(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("xml");
      expect(res.body).toContain("<loc>https://example.com/</loc>");
      delete process.env.PRIMARY_DOMAIN;
    });
  });

  describe("Search Engine Verification Files", () => {
    it("serves google verification HTML when token matches", async () => {
      process.env.GOOGLE_SITE_VERIFICATION = "testgoogle123";
      const handler = findRouteHandler(app, "get", "/google:token.html");
      const req: any = { params: { token: "testgoogle123" } };
      const res = createMockRes();
      let nextCalled = false;

      await handler(req, res, () => { nextCalled = true; });
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain("google-site-verification: googletestgoogle123.html");
      expect(nextCalled).toBe(false);
      delete process.env.GOOGLE_SITE_VERIFICATION;
    });

    it("calls next() when google token does not match", async () => {
      process.env.GOOGLE_SITE_VERIFICATION = "testgoogle123";
      const handler = findRouteHandler(app, "get", "/google:token.html");
      const req: any = { params: { token: "wrongtoken" } };
      const res = createMockRes();
      let nextCalled = false;

      await handler(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
      delete process.env.GOOGLE_SITE_VERIFICATION;
    });

    it("serves BingSiteAuth.xml when token is set", async () => {
      process.env.BING_SITE_VERIFICATION = "TESTBINGTOKEN123";
      const handler = findRouteHandler(app, "get", "/BingSiteAuth.xml");
      const req: any = {};
      const res = createMockRes();
      let nextCalled = false;

      await handler(req, res, () => { nextCalled = true; });
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain("<user>TESTBINGTOKEN123</user>");
      delete process.env.BING_SITE_VERIFICATION;
    });

    it("serves yandex verification HTML when token matches", async () => {
      process.env.YANDEX_SITE_VERIFICATION = "testyandex123";
      const handler = findRouteHandler(app, "get", "/yandex_:token.html");
      const req: any = { params: { token: "testyandex123" } };
      const res = createMockRes();
      let nextCalled = false;

      await handler(req, res, () => { nextCalled = true; });
      expect(res.statusCode).toBe(200);
      expect(res.body).toContain("Verification: testyandex123");
      delete process.env.YANDEX_SITE_VERIFICATION;
    });
  });
});
