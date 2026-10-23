import { Pressable, ScrollView, Text, View } from "react-native";
import { colors, fontFamily, MAX_FONT_SCALE, spacing, textStyles } from "../../theme";

// RT-04: 44 pt targets + 3 pt underline + hairline.
export const SEGMENTED_TABS_HEIGHT = 48;
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={{ paddingHorizontal: spacing.sm }}>
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
                minWidth: 44,
                minHeight: 44,
                paddingHorizontal: spacing.md,
                justifyContent: "center",
                borderBottomWidth: UNDERLINE,
                borderBottomColor: selected ? colors.navy : "transparent",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                maxFontSizeMultiplier={MAX_FONT_SCALE}
                numberOfLines={1}
                style={[textStyles.secondary, { fontFamily: selected ? fontFamily.semibold : fontFamily.regular, color: selected ? colors.navy : colors.textSecondary }]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
