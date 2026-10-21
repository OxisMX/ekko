// WHY: per-weight subpath imports; the package root index requires all 18 TTFs (~1 MB) into the bundle.
// NOTE: @expo-google-fonts/dm-sans ships static instances (no variable `fvar`), ~55 KB each.
import { DMSans_400Regular } from "@expo-google-fonts/dm-sans/400Regular";
import { DMSans_600SemiBold } from "@expo-google-fonts/dm-sans/600SemiBold";
import { DMSans_700Bold } from "@expo-google-fonts/dm-sans/700Bold";

export const fontFamily = {
  regular: "DMSans_400Regular",
  semibold: "DMSans_600SemiBold",
  bold: "DMSans_700Bold",
} as const;

// Pass to `useFonts(fontAssets)` in the root layout.
export const fontAssets = {
  [fontFamily.regular]: DMSans_400Regular,
  [fontFamily.semibold]: DMSans_600SemiBold,
  [fontFamily.bold]: DMSans_700Bold,
};
