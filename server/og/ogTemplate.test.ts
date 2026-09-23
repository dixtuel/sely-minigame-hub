import { describe, expect, it } from "vitest";
import { generateOgSvg } from "./ogTemplate";

describe("share card poster embedding", () => {
  it.each(["coil", "apex", "lift", "breakline"])('%s embeds its existing banner inline', (game) => {
    const svg = generateOgSvg({ game, score: 120 });

    expect(svg).toContain('<image href="data:image/jpeg;base64,');
    expect(svg).not.toContain(`href="https://sely.tr/storage/${game}-poster.png"`);
  });
});
