/**
 * Shared URL/header construction for calls to the Forge (WebDevService) API.
 * Used by notification.ts, heartbeat.ts, and dataApi.ts — each independently
 * built the same endpoint URL and header shape before this was extracted.
 * Callers keep their own env-var validation/error handling as before; this
 * only removes the duplicated construction logic.
 */
const FORGE_SERVICE = "webdevtoken.v1.WebDevService";

export function buildForgeEndpointUrl(baseUrl: string, rpc: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(`${FORGE_SERVICE}/${rpc}`, normalizedBase).toString();
}

export function getForgeHeaders(apiKey: string, extra?: Record<string, string>): Record<string, string> {
  return {
    accept: "application/json",
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
    "connect-protocol-version": "1",
    ...extra,
  };
}
