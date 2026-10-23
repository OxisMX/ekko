import { Pressable, Text, View } from "react-native";
import { colors, fontFamily, MAX_FONT_SCALE, spacing, textStyles } from "../../theme";

// RT-04: 52 pt targets (larger than the 44 pt minimum, easier to hit) + 3 pt underline.
const TAB_MIN_HEIGHT = 52;
export const SEGMENTED_TABS_HEIGHT = TAB_MIN_HEIGHT + 4;
const UNDERLINE = 3;

export type SegmentedTab<K extends string = string> = { key: K; label: string };

export type SegmentedTabsProps<K extends string = string> = {
  tabs: readonly SegmentedTab<K>[];
  value: K;
  onChange: (key: K) => void;
  testID?: string;
};

// DA-2: tabs under the merchant header. No animation on switch (tabs are peers); navy underline, never accent (OD-3).
export function SegmentedTabs<K extends string>({ tabs, value, onChange, testID }: SegmentedTabsProps<K>) {
  return (
    <View testID={testID} style={{ height: SEGMENTED_TABS_HEIGHT, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.surfaceMuted }}>
      {/* WHY: segments share the full width (flex 1) instead of scrolling; labels shrink before they clip. */}
      <View accessibilityRole="tablist" style={{ flex: 1, flexDirection: "row" }}>
        {tabs.map((tab) => {
          const selected = tab.key === value;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={tab.label}
              testID={testID && `${testID}-${tab.key}`}
              onPress={() => {
                if (!selected) onChange(tab.key);
              }}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: TAB_MIN_HEIGHT,
                paddingHorizontal: spacing.xs,
                justifyContent: "center",
                alignItems: "center",
                borderBottomWidth: UNDERLINE,
                borderBottomColor: selected ? colors.navy : "transparent",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                maxFontSizeMultiplier={MAX_FONT_SCALE}
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[textStyles.body, { fontFamily: selected ? fontFamily.semibold : fontFamily.regular, color: selected ? colors.navy : colors.textSecondary }]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
