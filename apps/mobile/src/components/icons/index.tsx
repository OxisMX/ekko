import type { ReactNode } from "react";
import type { ColorValue } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { colors } from "../../theme";

export type IconProps = { color?: ColorValue; size?: number; testID?: string };

// WHY: same linear style as TabIcon (stroke 1.8, round caps) so every icon in the app reads as one family.
function makeIcon(render: (stroke: object) => ReactNode) {
  return function Icon({ color = colors.navy, size = 24, testID }: IconProps) {
    const stroke = { stroke: color, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
    return (
      <Svg testID={testID} width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
        {render(stroke)}
      </Svg>
    );
  };
}

export const Search = makeIcon((s) => (
  <>
    <Circle cx={11} cy={11} r={6.5} {...s} />
    <Path d="M16 16l4.5 4.5" {...s} />
  </>
));
export const Close = makeIcon((s) => <Path d="M6 6l12 12M18 6L6 18" {...s} />);
export const Lock = makeIcon((s) => (
  <>
    <Rect x={5} y={10.5} width={14} height={9.5} rx={2} {...s} />
    <Path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" {...s} />
  </>
));
export const ChevronRight = makeIcon((s) => <Path d="M9.5 5l7 7-7 7" {...s} />);
export const Check = makeIcon((s) => <Path d="M5 12.5l4.5 4.5L19 7.5" {...s} />);
export const Gift = makeIcon((s) => (
  <>
    <Rect x={4} y={10} width={16} height={10} rx={1.5} {...s} />
    <Rect x={3} y={7} width={18} height={3} rx={1} {...s} />
    <Path d="M12 7v13M12 7c-1.5-3-5-3.5-5-1.2C7 7 9.5 7 12 7zM12 7c1.5-3 5-3.5 5-1.2C17 7 14.5 7 12 7z" {...s} />
  </>
));
export const Star = makeIcon((s) => <Path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z" {...s} />);
export const Megaphone = makeIcon((s) => (
  <>
    <Path d="M4 10v4h3l8 4.5v-13L7 10H4z" {...s} />
    <Path d="M18.5 9.5a4 4 0 0 1 0 5" {...s} />
  </>
));
export const Cake = makeIcon((s) => (
  <>
    <Path d="M4 20v-6.5a1.5 1.5 0 0 1 1.5-1.5h13a1.5 1.5 0 0 1 1.5 1.5V20M3 20h18" {...s} />
    <Path d="M4 16c2 1.5 3.5 1.5 5.3 0 1.8 1.5 3.6 1.5 5.4 0 1.8 1.5 3.2 1.5 5.3 0" {...s} />
    <Path d="M12 12V8M12 5.5v.01" {...s} />
  </>
));
export const Bell = makeIcon((s) => (
  <>
    <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.500h-15L6 16.500z" {...s} />
    <Path d="M10 20.5a2 2 0 0 0 4 0" {...s} />
  </>
));
export const Flashlight = makeIcon((s) => (
  <>
    <Path d="M8 3h8v4l-2 2.500v11a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-11L8 7V3z" {...s} />
    <Path d="M8 7h8" {...s} />
  </>
));
export const MapPin = makeIcon((s) => (
  <>
    <Path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z" {...s} />
    <Circle cx={12} cy={10} r={2.5} {...s} />
  </>
));
export const CloudOff = makeIcon((s) => (
  <>
    <Path d="M7 18h10.500a3.5 3.5 0 0 0 1.5-6.600A5.5 5.5 0 0 0 8.5 8.500M5.5 9.500A4.5 4.5 0 0 0 7 18" {...s} />
    <Path d="M3.5 3.500l17 17" {...s} />
  </>
));
export const Trophy = makeIcon((s) => (
  <>
    <Path d="M8 4h8v5a4 4 0 0 1-8 0V4z" {...s} />
    <Path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M9.5 17h5v3h-5z" {...s} />
  </>
));
