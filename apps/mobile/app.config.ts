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

const config: ExpoConfig = {
  name: variant.name,
  slug: "ekko",
  version: "1.0.0",
  scheme: "ekko",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "light",
  // TODO(DEP-01/DEP-09): universal/app links for /v/:token — ios.associatedDomains
  // (applinks:ekko.oxis.mx, applinks:staging.ekko.oxis.mx) and android.intentFilters (autoVerify).
  ios: { bundleIdentifier: variant.id },
  android: {
    package: variant.id,
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
    ["expo-splash-screen", { image: "./assets/images/splash-icon.png", imageWidth: 76, backgroundColor: "#FFFFFF" }],
    // WHY: RNF-01 asks for iOS 15.0, but Expo SDK 58 enforces a 16.4 minimum; revisit if RNF-01 must hold.
    ["expo-build-properties", { ios: { deploymentTarget: "16.4" }, android: { minSdkVersion: 26 } }],
    // NOTE: source-map upload stays off until the Sentry account exists. Then add `organization`
    // and `project` here, set SENTRY_AUTH_TOKEN as an EAS secret, and drop `disableAutoUpload`.
    ["@sentry/react-native/expo", { disableAutoUpload: true }],
  ],
  // Read at runtime via expo-constants (Sentry `environment`).
  extra: { appVariant },
  experiments: { typedRoutes: true },
};

export default config;
