import { ERRORS } from "@ekko/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useReduceMotion } from "../../components/useReduceMotion";
import { Button, EmptyState, ErrorState, FormMessage, Skeleton } from "../../components/ui";
import { WheelDisc } from "../../components/wheel";
import { maybeShowPushExplainer } from "../../features/notifications/pushExplainer";
import { type SpinResult, useSpinWheel, useWheel } from "../../features/wheel/wheel";
import { toAppError } from "../../lib/appError";
import { colors, MAX_FONT_SCALE, spacing, textStyles } from "../../theme";

const MAX_DISC = 320;

function prizeAnnouncement(result: SpinResult): string {
  return result.prize_type === "coupon" ? `¡Ganaste ${result.label}!` : "¡Sello extra! Se suma en tu próxima visita";
}

// A-12 Ruleta de bienvenida (F-07, US-15). Presented as a modal over the card / Mis Tarjetas.
export default function WheelScreen() {
  const params = useLocalSearchParams<{ merchantId: string; explainer?: string }>();
  const merchantId = typeof params.merchantId === "string" ? params.merchantId : "";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const wheel = useWheel(merchantId);
  const spin = useSpinWheel(merchantId);
  const [settled, setSettled] = useState(false);
  // WHY: the mutation's isPending reaches the UI a tick late; the ref stops a double tap in between.
  const spinStarted = useRef(false);
  const startSpin = () => {
    if (spinStarted.current) return;
    spinStarted.current = true;
    spin.mutate(undefined, { onError: () => (spinStarted.current = false) });
  };

  // WHY: memoized per error object so an E-99 is reported to Sentry once.
  const loadCode = useMemo(() => (wheel.error ? toAppError(wheel.error).code : null), [wheel.error]);
  const spinCode = useMemo(() => (spin.error ? toAppError(spin.error).code : null), [spin.error]);

  const result = spin.data ?? null;
  const revealed = result !== null && settled;

  useEffect(() => {
    if (revealed) AccessibilityInfo.announceForAccessibility(prizeAnnouncement(result));
  }, [revealed, result]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
    // WHY: A-16 and A-12 can't be stacked reliably, so after a first card/visit A-12 goes first
    // and the notifications explainer opens once it is closed.
    if (params.explainer === "1") void maybeShowPushExplainer(router);
  };
  const verify = () => router.push("/verify-email");
  const done = (title: string, message: string, testID: string) => <EmptyState title={title} message={message} actionLabel="Cerrar" onAction={close} testID={testID} />;
  const unverified = (
    <EmptyState title="Verifica tu correo" message="Verifica tu correo para girar la ruleta." actionLabel="Verificar correo" onAction={verify} testID="wheel-unverified" />
  );

  let body;
  if (revealed) {
    body = <PrizeView result={result} onClose={close} onViewCoupon={() => result.coupon_id && router.replace({ pathname: "/coupon/[id]", params: { id: result.coupon_id, merchantId } })} />;
  } else if (loadCode === "E-05" || spinCode === "E-05") {
    body = done("Ruleta no disponible", ERRORS["E-05"].message, "wheel-unavailable");
  } else if (spinCode === "E-06") {
    body = unverified;
  } else if (spinCode === "E-09") {
    body = done("Ya usaste el giro de este comercio", ERRORS["E-09"].message, "wheel-spun");
  } else if (loadCode) {
    body = <ErrorState onRetry={() => void wheel.refetch()} testID="wheel-error" />;
  } else if (!wheel.data) {
    body = (
      <View accessible accessibilityLabel="Cargando ruleta" testID="wheel-loading" style={{ gap: spacing.lg }}>
        <Skeleton height={MAX_DISC} radius={MAX_DISC / 2} />
        <Skeleton height={48} />
      </View>
    );
  } else if (wheel.data.status === "spun") {
    body = done("Ya usaste el giro de este comercio", ERRORS["E-09"].message, "wheel-spun");
  } else if (wheel.data.status === "needs_verification") {
    body = unverified;
  } else if (wheel.data.status === "unavailable" || wheel.data.status === "no_relation" || wheel.data.segments.length === 0) {
    body = done("Ruleta no disponible", "Este negocio no tiene ruleta disponible por ahora.", "wheel-unavailable");
  } else {
    const spinning = spin.isPending || (result !== null && !settled);
    const segments = [...wheel.data.segments].sort((a, b) => a.index - b.index);
    body = (
      <View style={{ alignItems: "center", gap: spacing.xl }}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.h1, { color: colors.textPrimary, textAlign: "center" }]}>
          Tu giro de bienvenida
        </Text>
        <WheelDisc
          labels={segments.map((s) => s.label)}
          size={Math.min(width - spacing.lg * 2, MAX_DISC)}
          targetIndex={result ? segments.findIndex((s) => s.index === result.segment_index) : null}
          reduceMotion={reduceMotion === true}
          onSettled={() => setSettled(true)}
        />
        {spinCode ? <FormMessage variant="error" message={ERRORS[spinCode as keyof typeof ERRORS]?.message ?? ERRORS["E-99"].message} testID="wheel-spin-error" /> : null}
        <Button
          title={spinning ? "Girando…" : "Girar"}
          onPress={startSpin}
          disabled={spinning}
          fullWidth
          testID="wheel-spin"
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.lg, paddingBottom: spacing.lg + insets.bottom }}>{body}</ScrollView>
    </View>
  );
}

function PrizeView({ result, onClose, onViewCoupon }: { result: SpinResult; onClose: () => void; onViewCoupon: () => void }) {
  const isCoupon = result.prize_type === "coupon" && result.coupon_id !== null;
  return (
    <View accessible accessibilityLiveRegion="polite" accessibilityLabel={prizeAnnouncement(result)} testID="wheel-result" style={{ alignItems: "center", gap: spacing.lg }}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.display, { color: colors.textPrimary, textAlign: "center" }]}>
        {isCoupon ? `¡Ganaste ${result.label}!` : "¡Sello extra!"}
      </Text>
      {isCoupon ? null : (
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.textSecondary, textAlign: "center" }]}>
          Se suma en tu próxima visita
        </Text>
      )}
      <View style={{ alignSelf: "stretch", gap: spacing.md }}>
        {isCoupon ? <Button title="Ver mi cupón" onPress={onViewCoupon} fullWidth testID="wheel-view-coupon" /> : null}
        <Button title="Cerrar" onPress={onClose} variant={isCoupon ? "secondary" : "primary"} fullWidth testID="wheel-close" />
      </View>
    </View>
  );
}
