import { Pressable, Text } from "react-native";
import { colors, fontFamily, MAX_FONT_SCALE, spacing, textStyles } from "../../theme";

const VISUAL_HEIGHT = 36;
// WHY: RT-04 asks for 44×44 pt touch areas; hitSlop extends the 36 pt pill without growing it visually.
const HIT_SLOP = (44 - VISUAL_HEIGHT) / 2;

export type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

export function Chip({ label, selected, onPress, testID }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
      hitSlop={{ top: HIT_SLOP, bottom: HIT_SLOP }}
      style={({ pressed }) => ({
        minHeight: VISUAL_HEIGHT,
        minWidth: 44,
        justifyContent: "center",
        paddingHorizontal: spacing.lg,
        borderRadius: VISUAL_HEIGHT / 2,
        borderWidth: 1.5,
        borderColor: selected ? colors.navy : colors.textSecondary,
        backgroundColor: selected ? colors.navy : colors.surface,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[textStyles.secondary, { fontFamily: fontFamily.semibold, color: selected ? colors.surface : colors.textPrimary }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
