import { View } from "react-native";
import { colors } from "../../theme";

export type ProgressBarProps = {
  value: number;
  total: number;
  /** Reward colour, used when only one stamp is missing. */
  accent?: boolean;
  height?: number;
  testID?: string;
};

// Decorative: the numbers next to it carry the information for screen readers.
export function ProgressBar({ value, total, accent = false, height = 4, testID }: ProgressBarProps) {
  const ratio = total > 0 ? Math.min(value / total, 1) : 0;
  return (
    <View
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height, borderRadius: height / 2, backgroundColor: colors.navyTint, overflow: "hidden" }}
    >
      <View style={{ width: `${ratio * 100}%`, height, borderRadius: height / 2, backgroundColor: accent ? colors.accent : colors.navy }} />
    </View>
  );
}
