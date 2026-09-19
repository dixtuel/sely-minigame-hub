/**
 * SELY.TR - Device Performance, Battery Saver & Hardware Adaptation Engine
 *
 * Provides intelligent power-tier detection, battery status monitoring,
 * adaptive DPR scaling, visibility-based audio/render pausing, and
 * graceful degradation for low-end mobile devices and legacy WebViews.
 */

import { isSaveDataEnabled } from "./networkSaver";

interface BatteryManager extends EventTarget {
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  level: number;
  onchargingchange: ((this: BatteryManager, ev: Event) => void) | null;
  onlevelchange: ((this: BatteryManager, ev: Event) => void) | null;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManager>;
  deviceMemory?: number;
}

let batteryInstance: BatteryManager | null = null;
let isBatteryLow = false;
let isMonitoringInitialized = false;
const registeredAudioContexts = new Set<AudioContext>();
const changeListeners = new Set<(isLowPower: boolean) => void>();

export type WebViewInfo = {
  isWebView: boolean;
  platform: "android" | "ios" | "other" | null;
  engineVersion: number | null;
  isLegacyWebView: boolean;
};

/**
 * Detects whether the current page is running inside a mobile WebView container
 * (such as Android System WebView, Instagram in-app browser, or iOS WKWebView)
 * and extracts the underlying rendering engine version.
 */
export function getWebViewInfo(): WebViewInfo {
  if (typeof navigator === "undefined") {
    return { isWebView: false, platform: null, engineVersion: null, isLegacyWebView: false };
  }
  const ua = navigator.userAgent || "";

  // Android WebView indicators: "; wv" or "Version/X.X Chrome/XX"
  const isAndroid = /Android/i.test(ua);
  const isAndroidWebView =
    isAndroid && (/;\s*wv\b/.test(ua) || /Version\/[0-9.]+\s+Chrome\//.test(ua));

  // iOS WebView indicators: iOS device without standalone Safari flag or matching in-app patterns
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isIOSWebView =
    isIOS && (!/Safari/i.test(ua) || /Mobile\/\S+$/.test(ua) || /FBAN|FBAV|Instagram/i.test(ua));

  let engineVersion: number | null = null;
  if (isAndroid) {
    const match = ua.match(/Chrome\/(\d+)/);
    if (match) engineVersion = parseInt(match[1], 10);
  } else if (isIOS) {
    const match = ua.match(/OS (\d+)_/);
    if (match) engineVersion = parseInt(match[1], 10);
  }

  // Legacy WebViews: Chrome WebView < 95 or iOS < 15
  const isLegacyWebView = Boolean(
    (isAndroidWebView && engineVersion !== null && engineVersion < 95) ||
    (isIOSWebView && engineVersion !== null && engineVersion < 15)
  );

  return {
    isWebView: isAndroidWebView || isIOSWebView,
    platform: isAndroidWebView ? "android" : isIOSWebView ? "ios" : null,
    engineVersion,
    isLegacyWebView,
  };
}

/**
 * Checks if the system prefers reduced motion or power conservation.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Returns true if the device has constrained CPU cores or low system RAM.
 * Useful for budget Android devices and older WebViews.
 */
export function isConstrainedHardware(): boolean {
  if (typeof navigator === "undefined") return false;

  const nav = navigator as NavigatorWithBattery;
  const cores = nav.hardwareConcurrency;
  const ram = nav.deviceMemory;

  // Quad-core or lower often struggles with high fill-rates and multi-layer blurs
  if (typeof cores === "number" && cores > 0 && cores <= 4) return true;

  // 4GB RAM or lower indicates an entry-level or legacy device
  if (typeof ram === "number" && ram > 0 && ram <= 4) return true;

  return false;
}

/**
 * Returns whether the device is currently in a low power condition:
 * - Battery <= 20% and not charging
 * - Running in a legacy / resource-constrained WebView
 * - User requested reduced motion
 * - Device has constrained hardware (<=4 cores or <=4GB RAM)
 * - User enabled Save-Data / low data mode
 */
export function isLowPowerMode(): boolean {
  return (
    isBatteryLow ||
    getWebViewInfo().isLegacyWebView ||
    prefersReducedMotion() ||
    isConstrainedHardware() ||
    isSaveDataEnabled()
  );
}

/**
 * Calculates the optimal Device Pixel Ratio (DPR) for canvas & WebGL rendering.
 *
 * High-density displays (2x, 3x) on low-end devices can cause severe thermal throttling,
 * battery drain, and memory pressure in WebViews.
 *
 * - Low power / constrained: 1.0 (eliminates 4x-9x pixel fill-rate overhead)
 * - Standard mobile: capped at 1.5
 * - Desktop: capped at maxAllowed (default 2.0)
 */
export function getAdaptiveDpr(maxAllowed = 2.0): number {
  if (typeof window === "undefined") return 1.0;

  const rawDpr = window.devicePixelRatio || 1.0;

  if (isLowPowerMode()) {
    return 1.0;
  }

  const isCoarse =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

  if (isCoarse) {
    return Math.max(1.0, Math.min(rawDpr, Math.min(1.5, maxAllowed)));
  }

  return Math.max(1.0, Math.min(rawDpr, maxAllowed));
}

/**
 * Synchronizes the `.low-power-mode` CSS class on `<html>` so stylesheets
 * can disable heavy blurs, reduce layer compositing, and save GPU cycles.
 */
function syncDomClass() {
  if (typeof document === "undefined") return;

  const active = isLowPowerMode();
  if (active) {
    document.documentElement.classList.add("low-power-mode");
  } else {
    document.documentElement.classList.remove("low-power-mode");
  }

  changeListeners.forEach((listener) => {
    try {
      listener(active);
    } catch {
      // Ignore listener errors
    }
  });
}

/**
 * Registers an AudioContext to be suspended when the document/tab is hidden
 * and resumed when it becomes visible again.
 */
export function registerAudioContextForVisibility(ctx: AudioContext): () => void {
  registeredAudioContexts.add(ctx);
  return () => {
    registeredAudioContexts.delete(ctx);
  };
}

/**
 * Handles tab/window visibility changes:
 * Pauses Web Audio contexts to eliminate hardware audio subsystem drain when backgrounded.
 */
function handleVisibilityChange() {
  if (typeof document === "undefined") return;

  const isHidden = document.hidden;
  registeredAudioContexts.forEach((ctx) => {
    try {
      if (isHidden && ctx.state === "running") {
        ctx.suspend().catch(() => {});
      } else if (!isHidden && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    } catch {
      // Ignore audio state errors
    }
  });
}

/**
 * Initializes global device performance, battery monitoring, and visibility handlers.
 * Safe to call multiple times (idempotent).
 */
export function initDevicePerformanceMonitoring(): () => void {
  if (isMonitoringInitialized || typeof window === "undefined") {
    return () => {};
  }
  isMonitoringInitialized = true;

  syncDomClass();

  // 1. Battery Status API
  const nav = navigator as NavigatorWithBattery;
  if (typeof nav.getBattery === "function") {
    nav.getBattery().then((battery) => {
      batteryInstance = battery;

      const updateBattery = () => {
        const wasLow = isBatteryLow;
        // Battery is considered low if <= 20% and not currently plugged in
        isBatteryLow = !battery.charging && battery.level <= 0.20;
        if (wasLow !== isBatteryLow) {
          syncDomClass();
        }
      };

      updateBattery();
      battery.addEventListener("levelchange", updateBattery);
      battery.addEventListener("chargingchange", updateBattery);
    }).catch(() => {
      // Battery API unavailable or blocked by permissions policy
    });
  }

  // 2. Prefers Reduced Motion listener
  let motionMedia: MediaQueryList | null = null;
  const handleMotionChange = () => syncDomClass();
  if (typeof window.matchMedia === "function") {
    try {
      motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
      motionMedia.addEventListener?.("change", handleMotionChange);
    } catch {
      // Legacy browsers without MediaQueryList.addEventListener
    }
  }

  // 3. Page Visibility API listener
  document.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    isMonitoringInitialized = false;
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    if (motionMedia && typeof motionMedia.removeEventListener === "function") {
      motionMedia.removeEventListener("change", handleMotionChange);
    }
  };
}

/**
 * Subscribes to power mode changes.
 */
export function onPowerModeChange(callback: (isLowPower: boolean) => void): () => void {
  changeListeners.add(callback);
  return () => {
    changeListeners.delete(callback);
  };
}
