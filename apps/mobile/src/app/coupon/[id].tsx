import { ERRORS } from "@ekko/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { AppState, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

import { formatDate } from "../../components/format";
import { Button, EmptyState, ErrorState, Skeleton } from "../../components/ui";
import { myCardsKey } from "../../features/cards/myCards";
import { myCouponsKey } from "../../features/coupons/myCoupons";
import { useRevealedCoupon } from "../../features/coupons/revealCoupon";
import { merchantDetailKey } from "../../features/merchant/merchantDetail";
import { toAppError } from "../../lib/appError";
import {
  colors,
  fontFamily,
  MAX_FONT_SCALE,
  spacing,
  textStyles,
} from "../../theme";

// A-19 Código de canje (US-13, F-11): the cashier validates the code; the redeem shows up on the next refresh.
export default function CouponCodeScreen() {
  const params = useLocalSearchParams<{ id: string; merchantId?: string }>();
  const couponId = typeof params.id === "string" ? params.id : "";
  const merchantId =
    typeof params.merchantId === "string" ? params.merchantId : "";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const reveal = useRevealedCoupon(couponId);

  const refreshLists = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: myCouponsKey });
    void queryClient.invalidateQueries({ queryKey: myCardsKey });
    if (merchantId)
      void queryClient.invalidateQueries({
        queryKey: merchantDetailKey(merchantId),
      });
  }, [queryClient, merchantId]);

  // F-11: coming back from the cashier counter, the coupon may already be redeemed.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshLists();
    });
    return () => sub.remove();
  }, [refreshLists]);

  const close = useCallback(() => {
    refreshLists();
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [refreshLists, router]);

  // WHY: memoized per error object so an E-99 is reported to Sentry once.
  const errorCode = useMemo(
    () => (reveal.error ? toAppError(reveal.error).code : null),
    [reveal.error],
  );

  let body;
  if (reveal.data) {
    body = <CodeView {...reveal.data} />;
  } else if (errorCode === "E-06") {
    body = (
      <EmptyState
        title="Verifica tu correo"
        message={ERRORS["E-06"].message}
        actionLabel="Verificar correo"
        onAction={() => router.push("/verify-email")}
        testID="coupon-unverified"
      />
    );
  } else if (errorCode === "E-10" || errorCode === "E-11") {
    body = (
      <EmptyState
        title="Cupón no disponible"
        message={ERRORS[errorCode].message}
        actionLabel="Actualizar lista"
        onAction={close}
        testID="coupon-unavailable"
      />
    );
  } else if (errorCode === "E-01") {
    body = (
      <ErrorState onRetry={() => void reveal.refetch()} testID="coupon-error" />
    );
  } else if (errorCode) {
    body = (
      <ErrorState
        onRetry={() => void reveal.refetch()}
        title="Algo salió mal"
        message="No pudimos mostrar el código de este cupón. Inténtalo de nuevo."
        testID="coupon-error"
      />
    );
  } else {
    body = (
      <View
        accessible
        accessibilityLabel="Cargando código"
        testID="coupon-loading"
        style={{ gap: spacing.lg }}
      >
        <Skeleton height={24} radius={8} />
        <Skeleton height={96} radius={16} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          padding: spacing.lg,
        }}
      >
        {body}
      </ScrollView>
      <View
        style={{
          padding: spacing.lg,
          paddingBottom: spacing.lg + insets.bottom,
        }}
      >
        <Button title="Listo" onPress={close} fullWidth testID="coupon-done" />
      </View>
    </View>
  );
}

function CodeView({
  code,
  title,
  merchant_name,
  expires_at,
}: {
  code: string;
  title: string;
  merchant_name: string;
  expires_at: string;
}) {
  const groups = [code.slice(0, 3), code.slice(3)];
  return (
    <View style={{ alignItems: "center", gap: spacing.lg }}>
      <Text
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[textStyles.secondary, { color: colors.textSecondary }]}
      >
        {merchant_name}
      </Text>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[
          textStyles.h2,
          { color: colors.textPrimary, textAlign: "center" },
        ]}
      >
        {title}
      </Text>
      <View
        accessible
        accessibilityLabel={`Código de canje: ${code.split("").join(", ")}`}
        testID="coupon-code"
        style={{
          flexDirection: "row",
          gap: spacing.lg,
          backgroundColor: colors.surfaceMuted,
          borderRadius: 16,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.xl,
        }}
      >
        {groups.map((group) => (
          <Text
            key={group}
            importantForAccessibility="no"
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={{
              fontFamily: fontFamily.bold,
              fontSize: 48,
              lineHeight: 56,
              letterSpacing: 8,
              color: colors.textPrimary,
            }}
          >
            {group}
          </Text>
        ))}
      </View>
      <Text
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[
          textStyles.body,
          { color: colors.textPrimary, textAlign: "center" },
        ]}
      >
        Muestra este código al cajero
      </Text>
      <Text
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        style={[textStyles.secondary, { color: colors.textSecondary }]}
      >
        Vence el {formatDate(expires_at)}
      </Text>
    </View>
  );
}
