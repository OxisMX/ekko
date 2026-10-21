import { Text, View } from "react-native";
import { colors, MAX_FONT_SCALE, spacing, textStyles } from "../../theme";
import { Button } from "./Button";

export type EmptyStateProps = {
  title: string;
  message: string;
  // PX-7: no dead ends, so the action is required.
  actionLabel: string;
  onAction: () => void;
  // Set by ErrorState so the message is announced.
  role?: "alert";
  testID?: string;
};

export function EmptyState({ title, message, actionLabel, onAction, role, testID }: EmptyStateProps) {
  return (
    <View testID={testID} style={{ alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing["2xl"] }}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} accessibilityRole="header" style={[textStyles.h2, { color: colors.textPrimary, textAlign: "center" }]}>
        {title}
      </Text>
      <Text
        selectable
        accessibilityRole={role}
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[textStyles.body, { color: colors.textSecondary, textAlign: "center" }]}
      >
        {message}
      </Text>
      <Button title={actionLabel} onPress={onAction} style={{ marginTop: spacing.sm }} />
    </View>
  );
}
