import type { Request, Response } from "express";
import { generateOgSvg, type OgParams } from "./ogTemplate";
import { logger } from "../_core/logger";

/**
 * Validates and sanitizes incoming OG query parameters.
 */
function parseOgParams(query: Record<string, any>): OgParams {
  const game = typeof query.game === "string" ? query.game.toLowerCase().slice(0, 20) : "hub";
  const rawScore = query.score ? parseInt(String(query.score), 10) : undefined;
  const score = typeof rawScore === "number" && !isNaN(rawScore) && rawScore >= 0 && rawScore <= 10_000_000 ? rawScore : undefined;
  const nick = typeof query.nick === "string" ? query.nick.slice(0, 16).replace(/[^\w\s-]/g, "") : undefined;
  const rank = typeof query.rank === "string" ? query.rank.slice(0, 8) : undefined;
  const outcome = query.outcome === "solved" || query.outcome === "dismissed" || query.outcome === "success" || query.outcome === "failure" ? query.outcome : undefined;
  const grade = query.grade === "S" || query.grade === "A" || query.grade === "B" || query.grade === "C" ? query.grade : undefined;
  const caseTitle = typeof query.caseTitle === "string" ? query.caseTitle.slice(0, 60) : undefined;
  const suspect = typeof query.suspect === "string" ? query.suspect.slice(0, 40) : undefined;
  const locale = query.locale === "en" ? "en" : "tr";
  const date = typeof query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : undefined;

  return {
    game,
    score,
    nick,
    rank,
    outcome,
    grade,
    caseTitle,
    suspect,
    locale,
    date,
  };
}

/**
 * Express handler for /api/og (Self-hosted Node.js / VDS / Local)
 * Emits vector SVG directly with zero external C++/Rust binary dependencies.
 */
export function handleOgImageRequest(req: Request, res: Response) {
  try {
    const params = parseOgParams(req.query);
    const svg = generateOgSvg(params);

    // High performance CDN caching: 24h client, 7 days edge CDN
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400"
    );
    res.status(200).send(svg.trim());
  } catch (err: any) {
    logger.error("og", "Failed to generate OG image", err);
    // Safe fallback: redirect to static social card
    res.redirect(302, "/storage/sely-social-card-title_b4649a50.png");
  }
}
