// Encrypted session storage for Supabase (TRD §3.1 "sesión segura con expo-secure-store").
// No native imports: the native stores, randomness and hashing are injected so jest can run it.
import { Counter, ModeOfOperation, utils } from "aes-js";

// WHY: SecureStore values are capped at ~2 KB and a Supabase session (JWT + user) exceeds that.
// So only a random AES-256 key lives in SecureStore; the AES-CTR ciphertext goes to AsyncStorage.
// The key is regenerated on every write, so the fixed CTR counter never reuses a keystream.
// A SHA-256 of the plaintext is encrypted alongside it: AES-CTR alone has no integrity, and a
// key/ciphertext mismatch (crash between the two writes, reinstall) must read as "no session".

export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type EncryptedStorageDeps = {
  /** Holds the per-key AES key (hex). Backed by expo-secure-store. */
  keyStore: KeyValueStore;
  /** Holds the ciphertext (hex). Backed by AsyncStorage. */
  dataStore: KeyValueStore;
  randomBytes: (count: number) => Uint8Array;
  sha256Hex: (data: string) => Promise<string>;
};

const KEY_BYTES = 32;
const DIGEST_HEX_LENGTH = 64;
const HEX_PATTERN = /^(?:[0-9a-f]{2})+$/;

function ctr(keyHex: string) {
  return new ModeOfOperation.ctr(utils.hex.toBytes(keyHex), new Counter(1));
}

export function createEncryptedStorage({ keyStore, dataStore, randomBytes, sha256Hex }: EncryptedStorageDeps) {
  async function removeItem(key: string): Promise<void> {
    await Promise.all([keyStore.removeItem(key), dataStore.removeItem(key)]);
  }

  async function decrypt(keyHex: string, cipherHex: string): Promise<string | null> {
    if (!HEX_PATTERN.test(keyHex) || keyHex.length !== KEY_BYTES * 2 || !HEX_PATTERN.test(cipherHex)) return null;
    const payload = utils.utf8.fromBytes(ctr(keyHex).decrypt(utils.hex.toBytes(cipherHex)));
    const digest = payload.slice(0, DIGEST_HEX_LENGTH);
    const value = payload.slice(DIGEST_HEX_LENGTH);
    return digest === (await sha256Hex(value)) ? value : null;
  }

  async function getItem(key: string): Promise<string | null> {
    const [keyHex, cipherHex] = await Promise.all([keyStore.getItem(key), dataStore.getItem(key)]);
    if (keyHex === null && cipherHex === null) return null;
    const value = keyHex !== null && cipherHex !== null ? await decrypt(keyHex, cipherHex) : null;
    // NOTE: half-written or undecryptable entries are dropped so Supabase sees "no session" (F-01).
    if (value === null) await removeItem(key);
    return value;
  }

  async function setItem(key: string, value: string): Promise<void> {
    const keyHex = utils.hex.fromBytes(randomBytes(KEY_BYTES));
    const payload = utils.utf8.toBytes((await sha256Hex(value)) + value);
    const cipherHex = utils.hex.fromBytes(ctr(keyHex).encrypt(payload));
    await keyStore.setItem(key, keyHex);
    await dataStore.setItem(key, cipherHex);
  }

  return { getItem, setItem, removeItem };
}
