import type { ReactNode } from "react";
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
  /** Illustration above the title (48 pt icon inside a soft circle). */
  icon?: ReactNode;
  testID?: string;
};

export function EmptyState({ title, message, actionLabel, onAction, role, icon, testID }: EmptyStateProps) {
  return (
    <View testID={testID} style={{ alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing["2xl"] }}>
      {icon ? (
        <View testID={testID && `${testID}-icon`} style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" }}>
          {icon}
        </View>
      ) : null}
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
      <Button title={actionLabel} onPress={onAction} style={{ marginTop: spacing.sm }} testID={testID && `${testID}-action`} />
    </View>
  );
}
