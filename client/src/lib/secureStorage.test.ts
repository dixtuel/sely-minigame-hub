import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  compressString,
  decompressString,
  encryptPayload,
  decryptPayload,
  secureStorage,
} from "./secureStorage";

// In-memory mock for localStorage in non-browser test runner
const memoryStore = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => memoryStore.get(key) ?? null,
  setItem: (key: string, val: string) => memoryStore.set(key, String(val)),
  removeItem: (key: string) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
  get length() { return memoryStore.size; },
  key: (i: number) => Array.from(memoryStore.keys())[i] ?? null,
};

describe("secureStorage - Compression, Encryption & Anti-Tampering Engine", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.stubGlobal("window", { localStorage: localStorageMock });
    vi.stubGlobal("localStorage", localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("compresses and decompresses text losslessly with significant size reduction", () => {
    // Realistic repetitive dialogue JSON from Vaka Interrogation
    const sampleDialogue = JSON.stringify({
      messages: [
        { id: "1", role: "detective", text: "Kompartımana girdiğinizde saat kaçtı?", timestamp: 1726000000 },
        { id: "2", role: "suspect", text: "Kesinlikle hatırlamıyorum, Bay Victor ile çay içiyordum.", timestamp: 1726000005 },
        { id: "3", role: "detective", text: "Bay Victor bunu yalanladı, yalan söylüyorsunuz.", timestamp: 1726000010 },
        { id: "4", role: "suspect", text: "Yalan mı? Asla! Ben masumum!", timestamp: 1726000015 },
      ],
      stress: { pavel: 45, elena: 12 },
    });

    const compressed = compressString(sampleDialogue);
    const restored = decompressString(compressed);

    expect(restored).toBe(sampleDialogue);
    // Compression should reduce character length on repetitive JSON
    expect(compressed.length).toBeLessThan(sampleDialogue.length);
  });

  it("encrypts data with prefix and verifies round-trip decryption", () => {
    const key = "sely_mini_scores_v1";
    const data = JSON.stringify({ echo: 1200, knot: 450, spark: 890 });

    const encrypted = encryptPayload(data, key);
    expect(encrypted.startsWith("sely_sec_v1:")).toBe(true);
    expect(encrypted).not.toContain("1200"); // Plaintext numbers should not be visible

    const decrypted = decryptPayload(encrypted, key);
    expect(decrypted).toBe(data);
  });

  it("detects tampering and rejects modified payload", () => {
    const key = "sely_mini_scores_v1";
    const data = JSON.stringify({ echo: 1200 });

    const encrypted = encryptPayload(data, key);
    // Tamper with the ciphertext by altering the last character
    const tampered = encrypted.slice(0, -2) + "ZZ";

    const decrypted = decryptPayload(tampered, key);
    expect(decrypted).toBeNull();
  });

  it("seamlessly reads legacy plaintext data (100% backward compatibility)", () => {
    const key = "sely_mini_scores_v1";
    const legacyPlaintext = JSON.stringify({ echo: 2400, knot: 1100 });

    // Store directly in window.localStorage without encryption (as from an earlier version)
    localStorage.setItem(key, legacyPlaintext);

    // Reading with secureStorage.getJSON should work seamlessly
    const parsed = secureStorage.getJSON(key, {});
    expect(parsed).toEqual({ echo: 2400, knot: 1100 });
  });

  it("automatically writes in encrypted format with setJSON and reads back with getJSON", () => {
    const key = "sely_mini_scores_v1";
    const scores = { echo: 3100, knot: 1500, spark: 990 };

    secureStorage.setJSON(key, scores);

    // Inspect underlying raw localStorage to confirm it is encrypted
    const rawStored = localStorage.getItem(key);
    expect(rawStored).toBeTruthy();
    expect(rawStored!.startsWith("sely_sec_v1:")).toBe(true);

    // Read back through secureStorage
    const loaded = secureStorage.getJSON(key, {});
    expect(loaded).toEqual(scores);
  });

  it("falls back to default value when item does not exist or fails", () => {
    const fallback = { echo: 0 };
    const result = secureStorage.getJSON("non_existent_key", fallback);
    expect(result).toBe(fallback);

    const stringFallback = secureStorage.getItem("non_existent_key", "default_str");
    expect(stringFallback).toBe("default_str");
  });

  it("handles empty string and primitive strings gracefully", () => {
    const key = "sely_vaka_active_case";
    secureStorage.setItem(key, "express_case_01");

    const retrieved = secureStorage.getItem(key);
    expect(retrieved).toBe("express_case_01");
  });
});
