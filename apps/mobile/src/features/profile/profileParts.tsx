import { Image } from "expo-image";
import { type ReactNode, useState } from "react";
import { Text, View } from "react-native";

import { Lock } from "../../components/icons";
import { colors, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";

export const initialsOf = (first: string | null, last: string | null) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";

const AVATAR_SIZE = 72;

export function Avatar({ uri, initials }: { uri: string | null; initials: string }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = uri && uri !== failedUri;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center", overflow: "hidden" }}
    >
      {showImage ? (
        <Image source={{ uri }} recyclingKey={uri} contentFit="cover" onError={() => setFailedUri(uri)} style={{ width: "100%", height: "100%" }} testID="profile-avatar-image" />
      ) : (
        <Text style={[textStyles.h2, { color: colors.surface }]}>{initials}</Text>
      )}
    </View>
  );
}

export function Section({ children }: { children: ReactNode }) {
  return <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.card, paddingHorizontal: spacing.lg }}>{children}</View>;
}

export function Row({ label, value, note, testID }: { label: string; value: string; note?: string; testID?: string }) {
  return (
    <View accessible testID={testID} style={{ paddingVertical: spacing.md, gap: spacing.xs / 2 }}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.textPrimary }]}>
        {value}
      </Text>
      {note ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <Lock size={14} color={colors.textSecondary} />
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
            {note}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
