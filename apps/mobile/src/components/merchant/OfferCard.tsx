import { Image } from "expo-image";
import { useState } from "react";
import { Text, View } from "react-native";
import { colors, fontFamily, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { isoWeekdayInMexico } from "../format";

// ISO weekday (1 = lunes), as stored in weekly_offers.weekday.
export const WEEKDAY_LABEL = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;

export type OfferCardProps = {
  /** ISO weekday: 1 = lunes … 7 = domingo. */
  weekday: number;
  title: string;
  description: string;
  imageUri?: string | null;
  /** Injected for tests; defaults to the current time. */
  now?: Date;
  testID?: string;
};

export function OfferCard({ weekday, title, description, imageUri, now = new Date(), testID }: OfferCardProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const isToday = isoWeekdayInMexico(now) === weekday;
  const day = WEEKDAY_LABEL[weekday] ?? "";
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${isToday ? "Hoy, " : ""}${day}: ${title}. ${description}`}
      style={{
        borderRadius: radii.card,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceMuted,
        // §5.5: today's offer is highlighted with a navy outline plus the "Hoy" word (not color alone).
        borderWidth: 2,
        borderColor: isToday ? colors.navy : colors.surfaceMuted,
        overflow: "hidden",
      }}
    >
      {imageUri && imageUri !== failedUri ? (
        <Image
          source={{ uri: imageUri }}
          recyclingKey={imageUri}
          contentFit="cover"
          transition={150}
          onError={() => setFailedUri(imageUri)}
          style={{ aspectRatio: 16 / 9, width: "100%" }}
          accessible={false}
        />
      ) : null}
      <View style={{ padding: spacing.lg, gap: spacing.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.label, { color: isToday ? colors.navy : colors.textSecondary }]}>
            {day}
          </Text>
          {isToday ? (
            <View testID="offer-today" style={{ backgroundColor: colors.navy, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs / 2 }}>
              <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.label, { color: colors.surface }]}>
                Hoy
              </Text>
            </View>
          ) : null}
        </View>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { fontFamily: fontFamily.semibold, color: colors.textPrimary }]}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textPrimary }]}>
          {description}
        </Text>
      </View>
    </View>
  );
}
