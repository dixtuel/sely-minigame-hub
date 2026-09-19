import { describe, expect, it, beforeEach } from "vitest";
import express, { type Express } from "express";
import { handleOgImageRequest } from "./ogRoute";
import { handleShareBridgeRequest } from "./shareRoute";
import { generateOgSvg } from "./ogTemplate";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: "",
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(key: string, val: string) {
      this.headers[key.toLowerCase()] = val;
      return this;
    },
    set(key: string, val: string) {
      this.headers[key.toLowerCase()] = val;
      return this;
    },
    type(t: string) {
      this.headers["content-type"] = t;
      return this;
    },
    send(data: string) {
      this.body = data;
      return this;
    },
    redirect(statusOrUrl: number | string, url?: string) {
      if (typeof statusOrUrl === "number") {
        this.statusCode = statusOrUrl;
        this.headers["location"] = url || "";
      } else {
        this.statusCode = 302;
        this.headers["location"] = statusOrUrl;
      }
      return this;
    },
  };
  return res;
}

describe("OG Image and Dynamic Social Sharing Routes", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.get("/api/og", handleOgImageRequest);
    app.get("/share/:game", handleShareBridgeRequest);
  });

  it("renders pure SVG vector image for standard games via generateOgSvg", () => {
    const svg = generateOgSvg({
      game: "echo",
      score: 2450,
      nick: "Karakalem",
      outcome: "success",
      locale: "en",
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("2,450");
    expect(svg).toContain("ECHO ROOM");
    expect(svg).toContain("KARAKALEM");
    // Ensure no XML comment syntax exists that could break strict XML parsers
    expect(svg).not.toContain("<!--");
    expect(svg).not.toContain("-->");
  });

  it("handles complex player nicknames with hash and numbers without XML parse errors", () => {
    const svg = generateOgSvg({
      game: "knot",
      score: 360,
      nick: "Elektrik Akıntı #7906",
      outcome: "success",
      locale: "tr",
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("360");
    expect(svg).toContain("DÜĞÜM");
    expect(svg).toContain("ELEKTRIK AKINTI #7906");
    expect(svg).not.toContain("--ink");
    expect(svg).not.toContain("<!--");
  });

  it("renders daily level expedition banner when score is not provided", () => {
    const svg = generateOgSvg({
      game: "knot",
      locale: "tr",
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("GÜNLÜK SEFER KATALOĞU");
    expect(svg).toContain("DÜĞÜM");
    expect(svg).toContain("GÜNÜN TURUNA BAŞLA");
    expect(svg).toContain("dugum-poster_684e5a01.png");
    expect(svg).not.toContain("<!--");
  });

  it("renders custom court dossier dossier & seal for Vaka Mystery", () => {
    const svg = generateOgSvg({
      game: "vaka",
      score: 950,
      outcome: "solved",
      grade: "S",
      caseTitle: "Gece Vardiyası",
      suspect: "Kerem",
      locale: "tr",
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain("POLİS SORGU BÜROSU");
    expect(svg).toContain("Gece Vardiyası");
    expect(svg).toContain("DERECE");
    expect(svg).toContain("&gt;S&lt;");
    expect(svg).toContain("VAKA ÇÖZÜLDÜ");
    expect(svg).toContain("Kerem");
  });

  it("serves /api/og with image/svg+xml and immutable cache headers", () => {
    const req: any = {
      query: { game: "knot", score: "890" },
      headers: {},
      get: () => "sely.tr",
      protocol: "https",
    };
    const res = createMockRes();

    handleOgImageRequest(req, res);

    expect(res.headers["content-type"]).toBe("image/svg+xml; charset=utf-8");
    expect(res.headers["cache-control"]).toContain("public, max-age=86400");
    expect(res.body).toContain("<svg");
    expect(res.body).toContain("890");
  });

  it("serves rich HTML with dynamic OG tags to social crawler bots on /share/:game", () => {
    const crawlerAgents = [
      "Twitterbot/1.0",
      "Discordbot/2.0",
      "facebookexternalhit/1.1",
      "WhatsApp/2.21",
      "TelegramBot (like TwitterBot)",
    ];

    for (const agent of crawlerAgents) {
      const req: any = {
        params: { game: "vaka" },
        query: { score: "900", grade: "A", caseTitle: "Lab Gizemi", outcome: "solved" },
        headers: { "user-agent": agent },
        get: () => "sely.tr",
        protocol: "https",
      };
      const res = createMockRes();

      handleShareBridgeRequest(req, res);

      expect(res.headers["content-type"]).toBe("text/html; charset=utf-8");
      expect(res.body).toContain('property="og:image"');
      expect(res.body).toContain('name="twitter:card" content="summary_large_image"');
      expect(res.body).toContain("SELY Vaka");
    }
  });

  it("redirects regular human browsers to the playable game route /play/:game with 302", () => {
    const req: any = {
      params: { game: "spark" },
      query: {},
      headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      get: () => "sely.tr",
      protocol: "https",
    };
    const res = createMockRes();

    handleShareBridgeRequest(req, res);

    expect(res.statusCode).toBe(302);
    expect(res.headers["location"]).toBe("/play/spark");
  });
});
