import type { ExpoConfig } from "expo/config";

// TRD §5: one app variant per environment.
const VARIANTS = {
  development: { name: "Ekko (Dev)", id: "mx.oxis.ekko.dev" },
  staging: { name: "Ekko (Staging)", id: "mx.oxis.ekko.staging" },
  production: { name: "Ekko Rewards", id: "mx.oxis.ekko" },
} as const;

const variant = VARIANTS[process.env.APP_VARIANT as keyof typeof VARIANTS] ?? VARIANTS.production;

const config: ExpoConfig = {
  name: variant.name,
  slug: "ekko",
  version: "1.0.0",
  scheme: "ekko",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  userInterfaceStyle: "light",
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
    ["expo-splash-screen", { image: "./assets/images/splash-icon.png", imageWidth: 76, backgroundColor: "#FFFFFF" }],
    // WHY: RNF-01 asks for iOS 15.0, but Expo SDK 58 enforces a 16.4 minimum; revisit if RNF-01 must hold.
    ["expo-build-properties", { ios: { deploymentTarget: "16.4" }, android: { minSdkVersion: 26 } }],
  ],
  experiments: { typedRoutes: true },
};

export default config;
