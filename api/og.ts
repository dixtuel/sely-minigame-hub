import { generateOgSvg, type OgParams } from "../server/og/ogTemplate";

export const config = {
  runtime: "edge",
};

export default async function handler(req: Request) {
  try {
    const url = new URL(req.url);
    const searchParams = url.searchParams;

    const game = searchParams.get("game") || "hub";
    const rawScore = searchParams.get("score");
    const score = rawScore ? parseInt(rawScore, 10) : undefined;
    const nick = searchParams.get("nick") || undefined;
    const rank = searchParams.get("rank") || undefined;
    const outcome = (searchParams.get("outcome") as any) || undefined;
    const grade = (searchParams.get("grade") as any) || undefined;
    const caseTitle = searchParams.get("caseTitle") || undefined;
    const suspect = searchParams.get("suspect") || undefined;
    const locale = (searchParams.get("locale") as any) || "tr";
    const date = searchParams.get("date") || undefined;

    const params: OgParams = {
      game,
      score: typeof score === "number" && !isNaN(score) ? score : undefined,
      nick: nick ? nick.slice(0, 32).replace(/[^\w\s\-#çğıöşüÇĞİÖŞÜ]/g, "") : undefined,
      rank: rank ? rank.slice(0, 8) : undefined,
      outcome,
      grade,
      caseTitle: caseTitle ? caseTitle.slice(0, 60) : undefined,
      suspect: suspect ? suspect.slice(0, 40) : undefined,
      locale,
      date,
    };

    const svg = generateOgSvg(params);

    return new Response(svg.trim(), {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    // Graceful fallback to static social card
    return Response.redirect(new URL("/storage/sely-social-card-46f07260.jpg", req.url), 302);
  }
}
