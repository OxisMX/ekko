import { Image } from "expo-image";
import { useState } from "react";
import { Text, View } from "react-native";
import { colors, fontFamily, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { formatMXN } from "../format";

export type ProductCardProps = {
  name: string;
  description?: string | null;
  price: number;
  imageUri?: string | null;
  featured?: boolean;
  /** Caller derives it from `sold_out_on === localToday(now)` (RN-56). */
  soldOut?: boolean;
  testID?: string;
};

const PHOTO_SIZE = 88;

function Pill({ label, testID, dark }: { label: string; testID: string; dark: boolean }) {
  return (
    <View
      testID={testID}
      style={{
        alignSelf: "flex-start",
        backgroundColor: dark ? colors.textPrimary : colors.surface,
        borderRadius: 999,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs / 2,
      }}
    >
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.label, { color: dark ? colors.surface : colors.navy }]}>
        {label}
      </Text>
    </View>
  );
}

export function ProductCard({ name, description, price, imageUri, featured = false, soldOut = false, testID }: ProductCardProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const priceText = formatMXN(price);
  const label = [name, priceText, featured ? "Más pedidos" : null, soldOut ? "Agotado por hoy" : null, description].filter(Boolean).join(". ");
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={label}
      style={{
        flexDirection: "row",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radii.card,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceMuted,
      }}
    >
      {imageUri && imageUri !== failedUri ? (
        <Image
          source={{ uri: imageUri }}
          recyclingKey={imageUri}
          contentFit="cover"
          transition={150}
          onError={() => setFailedUri(imageUri)}
          // NOTE: CSS filter grayscale renders on Android only; the opacity + "Agotado por hoy" label carry the state on iOS.
          style={{
            width: PHOTO_SIZE,
            aspectRatio: 1,
            borderRadius: radii.button,
            opacity: soldOut ? 0.5 : 1,
            filter: soldOut ? [{ grayscale: 1 }] : undefined,
          }}
          accessible={false}
        />
      ) : (
        // A-35: same 88 pt slot as a photo, so cards with and without picture line up.
        <View testID="product-photo-placeholder" style={{ width: PHOTO_SIZE, aspectRatio: 1, borderRadius: radii.button, backgroundColor: colors.navyTint }} />
      )}
      <View style={{ flex: 1, gap: spacing.xs }}>
        {featured ? <Pill label="Más pedidos" testID="product-featured" dark={false} /> : null}
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { fontFamily: fontFamily.semibold, color: colors.textPrimary }]}>
          {name}
        </Text>
        {description ? (
          <Text numberOfLines={2} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
            {description}
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm }}>
          <Text
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={[textStyles.body, { fontFamily: fontFamily.semibold, color: colors.textPrimary, fontVariant: ["tabular-nums"] }]}
          >
            {priceText}
          </Text>
          {soldOut ? <Pill label="Agotado por hoy" testID="product-sold-out" dark /> : null}
        </View>
      </View>
    </View>
  );
}
