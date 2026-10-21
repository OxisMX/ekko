import { Image } from "expo-image";
import { useState } from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, fontFamily, textStyles } from "../../theme";

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

export type MerchantAvatarProps = {
  name: string;
  uri: string | null;
  size: number;
  /** White ring around the circle (logo over a cover). */
  ringWidth?: number;
  grayscale?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Circular merchant logo on white; navy circle with initials when there is no logo or it fails to load.
export function MerchantAvatar({ name, uri, size, ringWidth = 0, grayscale = false, style }: MerchantAvatarProps) {
  // WHY: remember which URI failed (not a boolean) so a recycled cell with a new URI retries.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = uri && uri !== failedUri;
  return (
    <View
      accessible={false}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ringWidth,
          borderColor: colors.surface,
          backgroundColor: showImage ? colors.surface : grayscale ? colors.textSecondary : colors.navy,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      {showImage ? (
        <Image
          source={{ uri }}
          recyclingKey={uri}
          contentFit="cover"
          transition={150}
          onError={() => setFailedUri(uri)}
          // NOTE: CSS filter grayscale only renders on Android; iOS relies on the caller's veil/dim.
          style={{ width: "100%", height: "100%", filter: grayscale ? [{ grayscale: 1 }] : undefined }}
          accessible={false}
        />
      ) : (
        <Text
          testID="merchant-logo-initials"
          maxFontSizeMultiplier={1}
          style={[textStyles.body, { fontFamily: fontFamily.bold, color: colors.surface, fontSize: Math.min(textStyles.body.fontSize ?? 16, size * 0.36) }]}
        >
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}
