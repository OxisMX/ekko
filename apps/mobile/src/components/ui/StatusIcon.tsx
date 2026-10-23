import type { ColorValue } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

export type StatusIconVariant = "error" | "info" | "success";

// WHY: the icon shape (not the colour) tells the variants apart, so no prefix word is needed (§9).
const GLYPHS: Record<StatusIconVariant, string> = {
  error: "M12 7v6M12 16.5v.01",
  info: "M12 11v5.5M12 7.5v.01",
  success: "M8 12.5l2.7 2.7L16 9.5",
};

export function StatusIcon({ variant, color, size = 20 }: { variant: StatusIconVariant; color: ColorValue; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no" testID={`status-icon-${variant}`}>
      <Circle cx={12} cy={12} r={9.5} stroke={color} strokeWidth={1.8} fill="none" />
      <Path d={GLYPHS[variant]} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
