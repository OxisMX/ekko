import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors } from "../../theme";

// §4.5: overlapping navy circles drawn in code, no bitmap. Varying opacity makes the overlaps read.
const CIRCLES = [
  { cx: 40, cy: 30, r: 90, opacity: 0.9 },
  { cx: 150, cy: -20, r: 70, opacity: 0.55 },
  { cx: 330, cy: 60, r: 110, opacity: 0.8 },
  { cx: 90, cy: 210, r: 60, opacity: 0.65 },
] as const;

// A-10: one circle becomes a 2 pt accent ring (no fill) — a stamp, tying the brand to the reward.
const RING = { cx: 250, cy: 190, r: 80 } as const;

export function BrandPattern() {
  return (
    <View
      // Decorative only.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      testID="brand-pattern"
      style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.bgBrand }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 375 240" preserveAspectRatio="xMidYMid slice">
        {CIRCLES.map((c) => (
          <Circle key={`${c.cx}-${c.cy}`} cx={c.cx} cy={c.cy} r={c.r} fill={colors.pattern} fillOpacity={c.opacity} />
        ))}
        <Circle {...RING} fill="none" stroke={colors.accent} strokeWidth={2} />
      </Svg>
    </View>
  );
}
