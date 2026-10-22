import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { MAX_FONT_SCALE, colors, spacing, textStyles } from "../../theme";
import type { MyCard } from "../cards/myCards";
import { myCardsKey } from "../cards/myCards";
import type { MyCoupon } from "../coupons/myCoupons";
import { myCouponsKey } from "../coupons/myCoupons";
import { requestPushPermission } from "../notifications/pushToken";

// F-13 in Expo Go: remote push is unsupported there, local notifications go through the same listeners.
// NOTE: reads the already-loaded caches (open Mis Tarjetas / Cupones first); behind __DEV__ at the call site.
export function DevSimulatePush() {
  const client = useQueryClient();
  const [note, setNote] = useState<string | null>(null);

  const simulate = async () => {
    const card = client.getQueryData<MyCard[]>(myCardsKey)?.[0];
    if (!card) return setNote("Sin tarjetas cargadas: abre Mis Tarjetas primero.");
    if (!(await requestPushPermission())) return setNote("Permiso de notificaciones denegado.");
    const coupon = client.getQueryData<MyCoupon[]>(myCouponsKey)?.find((c) => c.merchant_id === card.merchant_id);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${card.merchant_name}: cupón para ti`,
        body: "Tienes una promoción nueva. Tócala para verla.",
        data: { merchant_id: card.merchant_id, coupon_id: coupon?.id ?? null },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
    });
    setNote("Programada en 5 s (para ver el toast, deja la app abierta; para el toque, ponla en segundo plano).");
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <Pressable onPress={() => void simulate()} accessibilityRole="button" testID="profile-dev-push" style={{ minHeight: 44, justifyContent: "center" }}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary, textDecorationLine: "underline" }]}>
          Simular notificación (dev)
        </Text>
      </Pressable>
      {note ? (
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]} testID="profile-dev-push-note">
          {note}
        </Text>
      ) : null}
    </View>
  );
}
