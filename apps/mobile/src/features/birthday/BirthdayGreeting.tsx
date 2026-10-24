import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { Cake, Close } from "../../components/icons";
import { Button } from "../../components/ui";
import { useAuth } from "../../auth/AuthProvider";
import { colors, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { useMyProfile } from "../auth/account";
import { useBirthdayGreeting } from "./birthdayCoupons";

// F-12: shown on Explorar once per app start when the birthday gifts were just created.
export function BirthdayGreeting() {
  const router = useRouter();
  const { session } = useAuth();
  const profile = useMyProfile();
  const { count, dismiss } = useBirthdayGreeting(session?.user.id ?? null);
  if (count === 0) return null;
  const name = profile.data?.first_name;
  return (
    <View
      testID="birthday-greeting"
      style={{
        marginHorizontal: spacing.lg,
        marginTop: spacing.md,
        padding: spacing.lg,
        gap: spacing.md,
        borderRadius: radii.card,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceCard,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
        {/* Accent only as the circle behind the icon: a reward moment, never text (OD-3). */}
        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>
          <Cake size={26} color={colors.navy} />
        </View>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.h2, { color: colors.textPrimary }]}>
            {name ? `¡Feliz cumpleaños, ${name}!` : "¡Feliz cumpleaños!"}
          </Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.textPrimary }]}>
            {count === 1 ? "Tienes 1 regalo de cumpleaños" : `Tienes ${count} regalos de cumpleaños`}
          </Text>
        </View>
        <Pressable
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Cerrar felicitación"
          hitSlop={8}
          style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: -spacing.sm, marginRight: -spacing.sm }}
          testID="birthday-dismiss"
        >
          <Close size={20} color={colors.textPrimary} />
        </Pressable>
      </View>
      <Button
        title="Ver mis cupones"
        onPress={() => {
          dismiss();
          router.navigate({ pathname: "/cards", params: { tab: "coupons" } });
        }}
        fullWidth
        testID="birthday-view-coupons"
      />
    </View>
  );
}
