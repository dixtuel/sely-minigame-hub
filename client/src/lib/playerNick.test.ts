import { describe, expect, it } from "vitest";
import {
  EN_ADJECTIVES,
  EN_NOUNS,
  getPlayerNick,
  TR_ADJECTIVES,
  TR_NOUNS,
} from "./playerNick";

describe("Player nicknames", () => {
  it("is deterministic for an anonymous ID and formats names in the selected locale", () => {
    const date = "2026-09-19";
    const anonymousId = "ply_test_stable_id";
    const trNick = getPlayerNick("tr", date, anonymousId);
    const enNick = getPlayerNick("en", date, anonymousId);

    expect(getPlayerNick("tr", date, anonymousId)).toBe(trNick);
    expect(getPlayerNick("en", date, anonymousId)).toBe(enNick);

    const trName = trNick.match(/^(.+) #(\d{4})$/)?.[1];
    const enName = enNick.match(/^([A-Za-z ]+) #(\d{4})$/)?.[1];
    expect(trName).toBeDefined();
    expect(enName).toBeDefined();
    expect(
      TR_ADJECTIVES.some(adj =>
        TR_NOUNS.some(noun => trName === `${adj} ${noun}`)
      )
    ).toBe(true);
    expect(
      EN_ADJECTIVES.some(adj =>
        EN_NOUNS.some(noun => enName === `${adj} ${noun}`)
      )
    ).toBe(true);
    expect(trNick).not.toBe(enNick);
  });
});
