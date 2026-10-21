import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** No-op without EXPO_PUBLIC_SENTRY_DSN (local dev, CI, forks). */
export function initSentry(): void {
  if (!dsn) return;
  const appVariant: unknown = Constants.expoConfig?.extra?.appVariant;
  Sentry.init({
    dsn,
    environment: typeof appVariant === "string" ? appVariant : "production",
    sendDefaultPii: false,
  });
}

export function reportError(error: unknown): void {
  // NOTE: captureException is a no-op when Sentry was not initialised, so keep a dev trace.
  if (__DEV__) console.warn(error);
  Sentry.captureException(error);
}

// NOTE: without a DSN Sentry.wrap only logs "wrap was called before init" on every start.
export const wrapRootComponent: typeof Sentry.wrap = (component) => (dsn ? Sentry.wrap(component) : component);
