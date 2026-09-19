import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  getWebViewInfo,
  getAdaptiveDpr,
  isLowPowerMode,
  isConstrainedHardware,
  prefersReducedMotion,
} from "./devicePerformance";

describe("Device Performance & WebView Optimization Engine", () => {
  const originalNavigator = globalThis.navigator;
  const originalWindow = globalThis.window;

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  describe("getWebViewInfo", () => {
    it("identifies legacy Android WebView and extracts Chrome engine version", () => {
      const legacyAndroidUa =
        "Mozilla/5.0 (Linux; U; Android 8.0.0; en-us; SM-G930F Build/R16NW; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/80.0.3987.162 Mobile Safari/537.36";

      Object.defineProperty(globalThis, "navigator", {
        value: { userAgent: legacyAndroidUa },
        configurable: true,
        writable: true,
      });

      const info = getWebViewInfo();
      expect(info.isWebView).toBe(true);
      expect(info.platform).toBe("android");
      expect(info.engineVersion).toBe(80);
      expect(info.isLegacyWebView).toBe(true);
    });

    it("identifies modern Android WebView without flagging as legacy", () => {
      const modernAndroidUa =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro Build/UD1A.231105.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.113 Mobile Safari/537.36";

      Object.defineProperty(globalThis, "navigator", {
        value: { userAgent: modernAndroidUa },
        configurable: true,
        writable: true,
      });

      const info = getWebViewInfo();
      expect(info.isWebView).toBe(true);
      expect(info.platform).toBe("android");
      expect(info.engineVersion).toBe(124);
      expect(info.isLegacyWebView).toBe(false);
    });

    it("identifies legacy iOS in-app WebView", () => {
      const legacyIosUa =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/18D52 Instagram 180.0.0.31.119";

      Object.defineProperty(globalThis, "navigator", {
        value: { userAgent: legacyIosUa },
        configurable: true,
        writable: true,
      });

      const info = getWebViewInfo();
      expect(info.isWebView).toBe(true);
      expect(info.platform).toBe("ios");
      expect(info.engineVersion).toBe(14);
      expect(info.isLegacyWebView).toBe(true);
    });

    it("identifies regular desktop browsers as non-webview", () => {
      const desktopUa =
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

      Object.defineProperty(globalThis, "navigator", {
        value: { userAgent: desktopUa },
        configurable: true,
        writable: true,
      });

      const info = getWebViewInfo();
      expect(info.isWebView).toBe(false);
      expect(info.isLegacyWebView).toBe(false);
    });
  });

  describe("getAdaptiveDpr & isLowPowerMode", () => {
    it("clamps DPR to 1.0 when running in a legacy WebView to protect GPU fill-rate", () => {
      const legacyAndroidUa =
        "Mozilla/5.0 (Linux; Android 9; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/83.0.4103.106 Mobile Safari/537.36";

      Object.defineProperty(globalThis, "navigator", {
        value: { userAgent: legacyAndroidUa, hardwareConcurrency: 8, deviceMemory: 8 },
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, "window", {
        value: {
          ...originalWindow,
          devicePixelRatio: 3.0,
          matchMedia: () => ({ matches: true }),
        },
        configurable: true,
        writable: true,
      });

      expect(isLowPowerMode()).toBe(true);
      expect(getAdaptiveDpr(2.0)).toBe(1.0);
    });

    it("flags constrained hardware when CPU cores <= 4 or deviceMemory <= 4", () => {
      Object.defineProperty(globalThis, "navigator", {
        value: {
          userAgent: "Mozilla/5.0",
          hardwareConcurrency: 4,
          deviceMemory: 2,
        },
        configurable: true,
        writable: true,
      });

      expect(isConstrainedHardware()).toBe(true);
      expect(isLowPowerMode()).toBe(true);
      expect(getAdaptiveDpr(2.0)).toBe(1.0);
    });
  });
});
