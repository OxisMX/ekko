import { type Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../auth/AuthProvider";
import { VisitResult, type VisitResultKind, type VisitResultProps } from "../components/visit";
import { useClaimVisit, visitErrorKind } from "../features/visit/claimVisit";
import { setPendingVisit } from "../features/visit/pendingVisit";
import { isVisitToken } from "../features/visit/visitToken";
import { toAppError } from "../lib/appError";
import { colors, MAX_FONT_SCALE, spacing, textStyles } from "../theme";

// A-15 Resultado de visita (F-08, F-09 M, F-10, US-11).
export default function VisitResultScreen() {
  const { token, expired } = useLocalSearchParams<{ token?: string; expired?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { endSession } = useAuth();
  const claim = useClaimVisit();
  const { mutate } = claim;
  const [retried, setRetried] = useState(false);
  const started = useRef(false);
  const claimable = expired !== "1" && isVisitToken(token);

  useEffect(() => {
    // WHY: once per screen, also under StrictMode's double effects; retries are explicit (E-01).
    if (!claimable || started.current) return;
    started.current = true;
    mutate(token);
  }, [claimable, token, mutate]);

  // WHY: memoized per error object so an E-99 is reported to Sentry once.
  const errorCode = useMemo(() => (claim.error ? toAppError(claim.error).code : null), [claim.error]);

  // RR-3: an expired session keeps the token so the claim resumes right after logging in again.
  useEffect(() => {
    if ((errorCode === "E-18" || errorCode === "E-19") && isVisitToken(token)) {
      setPendingVisit(token);
      endSession(errorCode);
    }
  }, [errorCode, token, endSession]);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));
  const rescan = () => router.replace("/scan");
  const retry = () => {
    if (!isVisitToken(token) || claim.isPending) return;
    setRetried(true);
    mutate(token);
  };

  let props: Omit<VisitResultProps, "testID"> | null = null;
  const data = claim.data;
  if (data) {
    // Back to the merchant's card (popping to it when the scan started there), newest stamp animated.
    const openMerchant = (params: Record<string, string>) =>
      router.dismissTo({ pathname: "/merchant/[id]", params: { id: data.merchant_id, ...params } } as Href);
    // TODO(S6/S8): relation_created → F-07 (notifications permission, then the welcome wheel) after closing.
    const common = { merchantName: data.merchant_name, stampsCount: data.stamps_count, stampsRequired: data.stamps_required, stampsAdded: data.stamps_added };
    props = data.cycle_completed
      ? {
          ...common,
          kind: "completed",
          onPrimary: () => openMerchant(data.reward_coupon_id ? { tab: "promos", coupon: data.reward_coupon_id } : { tab: "promos" }),
          onSecondary: () => openMerchant({}),
          secondaryLabel: "Cerrar",
        }
      : { ...common, kind: "stamped", onPrimary: () => openMerchant({ highlight: "last" }) };
  } else if (!claimable || errorCode) {
    // F-08 note: without the token's expiry, an offline claim is retried once, then treated as E-02.
    const kind: VisitResultKind = !claimable ? (expired === "1" ? "expired_or_used" : "not_ekko") : errorCode === "E-01" && retried ? "expired_or_used" : visitErrorKind(errorCode!);
    if (kind === "offline") props = { kind, onPrimary: retry, onSecondary: close, secondaryLabel: "Cerrar" };
    else if (kind === "expired_or_used" || kind === "not_ekko") props = { kind, onPrimary: rescan, onSecondary: close, secondaryLabel: "Cerrar" };
    else props = { kind, onPrimary: close };
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      {props ? (
        <VisitResult {...props} testID="visit-result" />
      ) : (
        <View accessible accessibilityLabel="Registrando tu visita" testID="visit-result-loading" style={{ alignItems: "center", gap: spacing.md }}>
          <ActivityIndicator color={colors.navy} />
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.textSecondary }]}>
            Registrando tu visita…
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
