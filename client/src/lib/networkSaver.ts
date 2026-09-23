/**
 * SELY.TR - Network Data Saver & Client Hint Utilities
 * Detects user data-saving preferences (Save-Data, Low Data Mode, metered networks)
 * to prevent high bandwidth egress on constrained mobile environments.
 */

interface NetworkInformation extends EventTarget {
  readonly saveData?: boolean;
  readonly effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
  readonly downlink?: number;
  readonly rtt?: number;
}

declare global {
  interface Navigator {
    readonly connection?: NetworkInformation;
    readonly mozConnection?: NetworkInformation;
    readonly webkitConnection?: NetworkInformation;
  }
}

/**
 * Returns true if the user or browser has explicitly requested reduced data usage
 * via the Save-Data Client Hint or mobile data saver setting.
 */
export function isSaveDataEnabled(): boolean {
  if (typeof navigator === "undefined") return false;

  const conn =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;

  return Boolean(conn?.saveData);
}

/**
 * Returns true if the client is on an extremely constrained network (2G / slow-2G).
 */
export function isSlowNetwork(): boolean {
  if (typeof navigator === "undefined") return false;

  const conn =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;

  return conn?.effectiveType === "2g" || conn?.effectiveType === "slow-2g";
}

/**
 * Determines whether heavy media (large textures, preloaded audio buffers)
 * should be proactively downloaded or deferred until user interaction.
 */
export function shouldLoadHighFidelityMedia(): boolean {
  return !isSaveDataEnabled() && !isSlowNetwork();
}
