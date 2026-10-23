import { typography } from "@ekko/shared";
import type { TextStyle } from "react-native";
import { fontFamily } from "./fonts";

export { colors, motion, radii, spacing } from "@ekko/shared";
export { fontAssets, fontFamily } from "./fonts";

// §4.4: respect system font scaling up to 130%.
export const MAX_FONT_SCALE = 1.3;

const familyByWeight = { "400": fontFamily.regular, "600": fontFamily.semibold, "700": fontFamily.bold } as const;

type TextStyleName = keyof typeof typography;

// WHY: Android ignores fontWeight for custom families, so weight is chosen via fontFamily and fontWeight is omitted.
function toTextStyle({ fontWeight, ...rest }: (typeof typography)[TextStyleName]): TextStyle {
  return {
    ...rest,
    fontFamily: familyByWeight[fontWeight],
    ...("fontVariant" in rest && { fontVariant: [...rest.fontVariant] }),
  };
}

export const textStyles = Object.fromEntries(
  Object.entries(typography).map(([name, value]) => [name, toTextStyle(value)]),
) as Record<TextStyleName, TextStyle>;
