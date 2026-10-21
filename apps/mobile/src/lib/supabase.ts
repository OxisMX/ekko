import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Database } from "@ekko/shared";
import { createClient } from "@supabase/supabase-js";
import { CryptoDigestAlgorithm, digest, digestStringAsync, getRandomBytes, getRandomValues } from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";

import { createEncryptedStorage } from "./encryptedStorage";
import { installWebCrypto } from "./webCrypto";

// WHY: must run before createClient so PKCE uses S256 and a CSPRNG verifier (see webCrypto.ts).
installWebCrypto(globalThis as { crypto?: unknown }, {
  digest: (_algorithm, data) => digest(CryptoDigestAlgorithm.SHA256, data),
  getRandomValues: getRandomValues as Parameters<typeof installWebCrypto>[1]["getRandomValues"],
});

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Set them in apps/mobile/.env (or the EAS environment) and restart Metro."
  );
}

// Also the base of public Storage URLs (merchant logos and covers, backend §7).
export const supabaseUrl: string = url;

const sessionStorage = createEncryptedStorage({
  keyStore: {
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    removeItem: (key) => SecureStore.deleteItemAsync(key),
  },
  dataStore: AsyncStorage,
  randomBytes: getRandomBytes,
  sha256Hex: (data) => digestStringAsync(CryptoDigestAlgorithm.SHA256, data),
});

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // WHY: F-05 recovery links come back as ?code= (no tokens in the URL); the verifier stays in
    // this device's encrypted storage. Password sign-in and signUp are unaffected.
    flowType: "pkce",
  },
});

// WHY: React Native has no visibility events; refresh only while foregrounded (Supabase RN guide).
AppState.addEventListener("change", (state) => {
  if (state === "active") void supabase.auth.startAutoRefresh();
  else void supabase.auth.stopAutoRefresh();
});
