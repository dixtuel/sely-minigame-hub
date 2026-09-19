import { describe, it, expect } from "vitest";
import { fetchGlobalConfig } from "./globalConfig";

describe("Global Config Service (Zero Downtime & Safe Fallback)", () => {
  it("should return safe fallback config when GLOBAL_CONFIG is not configured", async () => {
    delete process.env.GLOBAL_CONFIG;
    delete process.env.EDGE_CONFIG;

    const config = await fetchGlobalConfig();
    expect(config).toBeDefined();
    expect(config.maintenance).toBe(false);
    expect(config.announcement).toBeNull();
    expect(config.source).toBe("fallback");
  });

  it("should not crash when environment variable contains empty string", async () => {
    process.env.GLOBAL_CONFIG = "";
    const config = await fetchGlobalConfig();
    expect(config).toBeDefined();
    expect(config.maintenance).toBe(false);
  });
});
