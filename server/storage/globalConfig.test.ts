import { describe, it, expect } from "vitest";
import { fetchGlobalConfig } from "./globalConfig";

describe("Global Config Service", () => {
  it("provides safe fallback configuration when env variables are missing or empty", async () => {
    delete process.env.GLOBAL_CONFIG;
    delete process.env.EDGE_CONFIG;

    const config = await fetchGlobalConfig();
    expect(config).toBeDefined();
    expect(config.maintenance).toBe(false);
    expect(config.announcement).toBeNull();
    expect(config.source).toBe("fallback");

    process.env.GLOBAL_CONFIG = "";
    const emptyEnvConfig = await fetchGlobalConfig();
    expect(emptyEnvConfig).toBeDefined();
    expect(emptyEnvConfig.maintenance).toBe(false);
  });
});
