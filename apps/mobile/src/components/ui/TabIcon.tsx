import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

// WHY: brief §4.5 — one linear SVG icon set drawn in code, no icon font in the binary (OD-6).
export type TabIconName = "explore" | "cards" | "profile";

export function TabIcon({ name, color, size = 24 }: { name: TabIconName; color: ColorValue; size?: number }) {
  const stroke = { stroke: color, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {name === "explore" && (
        <>
          <Circle cx={12} cy={12} r={9} {...stroke} />
          <Path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" {...stroke} />
        </>
      )}
      {name === "cards" && (
        <>
          <Rect x={3} y={6} width={18} height={12} rx={2.5} {...stroke} />
          <Path d="M3 10h18M7 14.5h4" {...stroke} />
        </>
      )}
      {name === "profile" && (
        <>
          <Circle cx={12} cy={8.5} r={3.5} {...stroke} />
          <Path d="M5 19.5c1.2-3.2 3.8-5 7-5s5.8 1.8 7 5" {...stroke} />
        </>
      )}
    </Svg>
  );
}
