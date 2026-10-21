import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Database } from "@ekko/shared";
import { createClient } from "@supabase/supabase-js";
import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytes } from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { AppState } from "react-native";

import { createEncryptedStorage } from "./encryptedStorage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Set them in apps/mobile/.env (or the EAS environment) and restart Metro."
  );
}

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
  },
});

// WHY: React Native has no visibility events; refresh only while foregrounded (Supabase RN guide).
AppState.addEventListener("change", (state) => {
  if (state === "active") void supabase.auth.startAutoRefresh();
  else void supabase.auth.stopAutoRefresh();
});
