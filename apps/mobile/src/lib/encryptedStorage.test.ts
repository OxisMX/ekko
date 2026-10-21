import { createEncryptedStorage, type KeyValueStore } from "./encryptedStorage";

// WHY: Web Crypto stands in for expo-crypto (same primitives); jest runs on Node, which ships it.
const randomBytes = (count: number) => crypto.getRandomValues(new Uint8Array(count));
const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const sha256Hex = async (data: string) =>
  toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data))));

function memoryStore(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: async (key) => map.get(key) ?? null,
    setItem: async (key, value) => void map.set(key, value),
    removeItem: async (key) => void map.delete(key),
  };
}

function setup() {
  const keyStore = memoryStore();
  const dataStore = memoryStore();
  const storage = createEncryptedStorage({
    keyStore,
    dataStore,
    randomBytes,
    sha256Hex,
  });
  return { storage, keyStore, dataStore };
}

const KEY = "sb-local-auth-token";
const SESSION = JSON.stringify({ access_token: "a.b.c", refresh_token: "r", user: { email: "ñandú@ekko.mx" } });

describe("createEncryptedStorage", () => {
  it("round-trips a value without storing plaintext", async () => {
    const { storage, keyStore, dataStore } = setup();
    await storage.setItem(KEY, SESSION);

    expect(await storage.getItem(KEY)).toBe(SESSION);
    expect(keyStore.map.get(KEY)).toMatch(/^[0-9a-f]{64}$/);
    expect(dataStore.map.get(KEY)).not.toContain("refresh_token");
  });

  it("overwrites with a fresh key", async () => {
    const { storage, keyStore } = setup();
    await storage.setItem(KEY, "first");
    const firstKey = keyStore.map.get(KEY);
    await storage.setItem(KEY, "second");

    expect(await storage.getItem(KEY)).toBe("second");
    expect(keyStore.map.get(KEY)).not.toBe(firstKey);
  });

  it("removes both halves", async () => {
    const { storage, keyStore, dataStore } = setup();
    await storage.setItem(KEY, SESSION);
    await storage.removeItem(KEY);

    expect(await storage.getItem(KEY)).toBeNull();
    expect(keyStore.map.size + dataStore.map.size).toBe(0);
  });

  it("returns null for a missing key", async () => {
    expect(await setup().storage.getItem(KEY)).toBeNull();
  });

  it("returns null and cleans up when the AES key is gone", async () => {
    const { storage, keyStore, dataStore } = setup();
    await storage.setItem(KEY, SESSION);
    keyStore.map.delete(KEY);

    expect(await storage.getItem(KEY)).toBeNull();
    expect(dataStore.map.has(KEY)).toBe(false);
  });

  it.each([
    ["a flipped ciphertext byte", (hex: string) => hex.slice(0, 80) + (hex[80] === "0" ? "1" : "0") + hex.slice(81)],
    ["non-hex garbage", () => "not-hex!"],
    ["a truncated ciphertext", (hex: string) => hex.slice(0, hex.length - 2)],
  ])("returns null and cleans up on %s", async (_label, corrupt) => {
    const { storage, keyStore, dataStore } = setup();
    await storage.setItem(KEY, SESSION);
    dataStore.map.set(KEY, corrupt(dataStore.map.get(KEY)!));

    expect(await storage.getItem(KEY)).toBeNull();
    expect(keyStore.map.has(KEY)).toBe(false);
    expect(dataStore.map.has(KEY)).toBe(false);
  });

  it("returns null when the key belongs to another write", async () => {
    const { storage, keyStore } = setup();
    await storage.setItem(KEY, SESSION);
    keyStore.map.set(KEY, toHex(randomBytes(32)));

    expect(await storage.getItem(KEY)).toBeNull();
  });

  it("stores values well over SecureStore's 2 KB limit", async () => {
    const { storage, keyStore } = setup();
    const big = JSON.stringify({ user: { metadata: "x".repeat(8000) } });
    await storage.setItem(KEY, big);

    expect(await storage.getItem(KEY)).toBe(big);
    expect(keyStore.map.get(KEY)!.length).toBeLessThan(2048);
  });
});
