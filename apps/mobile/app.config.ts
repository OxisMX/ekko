import type { ExpoConfig } from "expo/config";

// TRD §5: one app variant per environment.
const VARIANTS = {
  development: { name: "Ekko (Dev)", id: "mx.oxis.ekko.dev" },
  staging: { name: "Ekko (Staging)", id: "mx.oxis.ekko.staging" },
  production: { name: "Ekko Rewards", id: "mx.oxis.ekko" },
} as const;

const appVariant: keyof typeof VARIANTS =
  process.env.APP_VARIANT && Object.hasOwn(VARIANTS, process.env.APP_VARIANT)
    ? (process.env.APP_VARIANT as keyof typeof VARIANTS)
    : "production";
const variant = VARIANTS[appVariant];

// TRD §9: each variant claims only its own domain (the AASA/assetlinks files list all three apps).
// Development reuses the staging domain; `?mode=developer` makes iOS fetch the AASA straight from the
// server instead of Apple's CDN (SP-2).
const UNIVERSAL_LINK_HOST = {
  development: "staging.ekko.oxis.mx",
  staging: "staging.ekko.oxis.mx",
  production: "ekko.oxis.mx",
} as const;
const linkHost = UNIVERSAL_LINK_HOST[appVariant];
const associatedDomain = `applinks:${linkHost}${appVariant === "development" ? "?mode=developer" : ""}`;

// Filled in by `eas init` (see docs/ekko_despliegue.md). It is an identifier, not a secret.
// Empty = EAS Update stays off, so local dev and CI keep working before the Expo project exists.
const EAS_PROJECT_ID = "";

const config: ExpoConfig = {
  name: variant.name,
  slug: "ekko",
  version: "1.0.0",
  scheme: "ekko",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "light",
  ios: { bundleIdentifier: variant.id, associatedDomains: [associatedDomain], usesAppleSignIn: true },
  android: {
    package: variant.id,
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: linkHost, pathPrefix: "/v/" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
    adaptiveIcon: {
      backgroundImage: "./assets/images/android-icon-background.png",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
  },
  plugins: [
    "expo-router",
    // F-08: QR scanning only; no microphone (we never record video).
    [
      "expo-camera",
      {
        cameraPermission: "Ekko usa la cámara para leer el código QR del cajero y registrar tu visita.",
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    // A-16: push token registration. Handling incoming pushes arrives in Sprint 12.
    "expo-notifications",
    // F-03: Sign in with Apple (iOS only, needs a dev build). expo-web-browser serves the Google OAuth session.
    "expo-apple-authentication",
    "expo-web-browser",
    ["expo-splash-screen", { image: "./assets/images/splash-icon.png", imageWidth: 76, backgroundColor: "#FFFFFF" }],
    // WHY: RNF-01 asks for iOS 15.0, but Expo SDK 58 enforces a 16.4 minimum; revisit if RNF-01 must hold.
    ["expo-build-properties", { ios: { deploymentTarget: "16.4" }, android: { minSdkVersion: 26 } }],
    // NOTE: source-map upload stays off until the Sentry account exists. Then add `organization`
    // and `project` here, set SENTRY_AUTH_TOKEN as an EAS secret, and drop `disableAutoUpload`.
    ["@sentry/react-native/expo", { disableAutoUpload: true }],
  ],
  // WHY appVersion (plan §6.3): an OTA only reaches binaries of the same `version`, so bump `version`
  // on every native change. Fingerprint would be safer against forgetting, but it makes every dependency
  // bump a new runtime and breaks the "one staging OTA, then production" flow the team uses.
  runtimeVersion: { policy: "appVersion" },
  ...(EAS_PROJECT_ID ? { updates: { url: `https://u.expo.dev/${EAS_PROJECT_ID}` } } : {}),
  // Read at runtime via expo-constants (Sentry `environment`).
  extra: { appVariant, ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}) },
  experiments: { typedRoutes: true },
};

export default config;
