import { ERRORS, merchantCategoryLabel } from "@ekko/shared";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, type ScrollViewInstance, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { HEADER_EXPANDED_HEIGHT, MerchantHeader, StampCardSkeleton } from "../../components/merchant";
import { EmptyState, ErrorState, SEGMENTED_TABS_HEIGHT, SegmentedTabs, Skeleton } from "../../components/ui";
import { CardTab, MenuTab, MERCHANT_TABS, type MerchantTabKey, PromosTab, ReviewTab } from "../../features/merchant/MerchantTabs";
import { useToggleFavorite } from "../../features/favorites/favorites";
import { couponsHref } from "../../features/notifications/pushNavigation";
import { maybeShowPushExplainer } from "../../features/notifications/pushExplainer";
import { imageUri, useAddCard, useMerchantDetail } from "../../features/merchant/merchantDetail";
import { wheelHref } from "../../features/wheel/wheel";
import { toAppError } from "../../lib/appError";
import { openExternalUrl } from "../../lib/openExternal";
import { CloudOff } from "../../components/icons";
import { colors, spacing } from "../../theme";

// F-06 J: the catalogue message without the "sellos guardados" part, which only applies with a relation.
const UNAVAILABLE_MESSAGE = "Este negocio no está disponible por ahora.";
const BACK_SIZE = 44; // RT-04

// A-08..A-11 Detalle de comercio (US-08..US-10, US-12, F-06 H–K, DA-2, DA-4).
export default function MerchantScreen() {
  // tab/coupon/highlight arrive from A-15 (visit result) via router.dismissTo.
  const params = useLocalSearchParams<{ id: string; tab?: string; coupon?: string; highlight?: string; from?: string }>();
  const { id } = params;
  const merchantId = typeof id === "string" ? id : "";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const detail = useMerchantDetail(merchantId);
  const addCard = useAddCard(merchantId);
  const toggleFavorite = useToggleFavorite();
  const linkTab: MerchantTabKey = params.tab === "promos" ? "promos" : "card";
  const linkCoupon = typeof params.coupon === "string" ? params.coupon : null;
  const [tab, setTab] = useState<MerchantTabKey>(linkTab);
  const [highlightCouponId, setHighlightCouponId] = useState<string | null>(linkCoupon);
  // WHY: dismissTo reuses this screen with new params; adjust state during render, not in an effect.
  const linkKey = `${linkTab}|${linkCoupon}|${params.highlight}`;
  const [seenLinkKey, setSeenLinkKey] = useState(linkKey);
  if (seenLinkKey !== linkKey) {
    setSeenLinkKey(linkKey);
    setTab(linkTab);
    setHighlightCouponId(linkCoupon);
  }
  const [scrollY] = useState(() => new Animated.Value(0));
  const scrollRef = useRef<ScrollViewInstance>(null);

  const goBack = useCallback(() => (router.canGoBack() ? router.back() : router.replace("/")), [router]);

  // WHY: memoized per error object so an E-99 is reported to Sentry once.
  const errorCode = useMemo(() => (detail.error ? toAppError(detail.error).code : null), [detail.error]);
  const addErrorCode = useMemo(() => (addCard.error ? toAppError(addCard.error).code : null), [addCard.error]);

  // F-06 J / A-26: E-05 (hidden merchant without relation, or inactive on add_card) is explained in the screen itself.
  // F-13: a push for a merchant that is gone leads to Mis cupones instead of Explorar.
  const fromPush = params.from === "push";
  const unavailable = errorCode === "E-05" || addErrorCode === "E-05";
  // Reward available → Promociones with the reward coupon highlighted (RN-27). Coupons are the last section.
  useEffect(() => {
    if (tab !== "promos" || !highlightCouponId) return;
    const frame = requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    return () => cancelAnimationFrame(frame);
  }, [tab, highlightCouponId]);

  const changeTab = (key: MerchantTabKey) => {
    setHighlightCouponId(null);
    setTab(key);
  };

  const data = detail.data;
  let body;
  if (data) {
    const { merchant } = data;
    let content;
    if (tab === "card") {
      content = (
        <CardTab
          detail={data}
          adding={addCard.isPending}
          addErrorMessage={addErrorCode && addErrorCode !== "E-05" ? (ERRORS[addErrorCode as keyof typeof ERRORS]?.message ?? ERRORS["E-99"].message) : null}
          onAddCard={() => {
            if (!addCard.isPending) addCard.mutate(undefined, {
              onSuccess: (result) => {
                if (!result.created) return;
                // WHY: A-16 and A-12 can't be stacked reliably; the wheel goes first and opens A-16 when closed.
                if (result.wheel.status === "available") router.push(wheelHref(merchantId, true));
                else void maybeShowPushExplainer(router);
              },
            });
          }}
          onViewReward={() => {
            setTab("promos");
            setHighlightCouponId(data.card.reward_coupon_id);
          }}
          onRegisterVisit={() => router.push("/scan")}
          onSpinWheel={() => router.push(wheelHref(merchantId))}
          highlightLastStamp={params.highlight === "last"}
        />
      );
    } else if (tab === "menu") {
      content = <MenuTab menu={data.menu} onShowCard={() => changeTab("card")} />;
    } else if (tab === "promos") {
      content = (
        <PromosTab
          detail={data}
          highlightCouponId={highlightCouponId}
          onShowMenu={() => changeTab("menu")}
          onShowCode={(couponId) => router.push({ pathname: "/coupon/[id]", params: { id: couponId, merchantId } })}
        />
      );
    } else {
      content = <ReviewTab reviewsUrl={merchant.reviews_url} />;
    }
    body = (
      <>
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          scrollEventThrottle={16}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: insets.top + HEADER_EXPANDED_HEIGHT + SEGMENTED_TABS_HEIGHT + spacing.lg,
            paddingHorizontal: spacing.lg,
            paddingBottom: insets.bottom + spacing.xl,
          }}
          testID="merchant-scroll"
        >
          {content}
        </Animated.ScrollView>
        <MerchantHeader
          name={merchant.name}
          categoryLabel={merchantCategoryLabel[merchant.category]}
          coverUri={imageUri(merchant.cover_path, "cover")}
          logoUri={imageUri(merchant.logo_path, "logo")}
          isFavorite={merchant.is_favorite}
          progressLabel={data.card.has_relation ? `${data.card.stamps.length} de ${data.card.stamps_required} sellos` : undefined}
          onToggleFavorite={() => toggleFavorite.mutate({ merchantId, isFavorite: merchant.is_favorite })}
          onOpenMap={() => openExternalUrl(merchant.maps_url, "No pudimos abrir la ubicación de este negocio.")}
          scrollY={scrollY}
          testID="merchant-header"
        >
          <SegmentedTabs tabs={MERCHANT_TABS} value={tab} onChange={changeTab} testID="merchant-tabs" />
        </MerchantHeader>
      </>
    );
  } else if (unavailable) {
    body = (
      <View style={{ flex: 1, justifyContent: "center", padding: spacing.lg, paddingTop: insets.top + BACK_SIZE }}>
        <EmptyState
          icon={<CloudOff size={48} />}
          title="Negocio no disponible"
          message={UNAVAILABLE_MESSAGE}
          actionLabel={fromPush ? "Ver mis cupones" : "Volver a Explorar"}
          onAction={() => router.replace(fromPush ? couponsHref : "/")}
          testID="merchant-unavailable"
        />
      </View>
    );
  } else if (detail.isError && errorCode) {
    body = (
      <View style={{ flex: 1, justifyContent: "center", padding: spacing.lg, paddingTop: insets.top + BACK_SIZE }}>
        {errorCode === "E-01" ? (
          <ErrorState onRetry={() => void detail.refetch()} testID="merchant-error" />
        ) : (
          <ErrorState onRetry={() => void detail.refetch()} title="Algo salió mal" message="No pudimos cargar este negocio. Inténtalo de nuevo." testID="merchant-error" />
        )}
      </View>
    );
  } else {
    body = (
      <View accessible accessibilityLabel="Cargando comercio" testID="merchant-loading" style={{ gap: spacing.lg }}>
        <Skeleton height={insets.top + HEADER_EXPANDED_HEIGHT} radius={0} />
        <View style={{ gap: spacing.lg, paddingHorizontal: spacing.lg }}>
          <Skeleton height={SEGMENTED_TABS_HEIGHT} />
          <StampCardSkeleton />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {body}
      {/* Own back button: the native header is hidden so the cover can sit under the status bar (DA-4).
          When compact it covers the decorative mini logo, leaving the merchant name readable. */}
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel="Volver"
        hitSlop={4}
        testID="merchant-back"
        style={({ pressed }) => ({
          position: "absolute",
          zIndex: 2,
          top: insets.top + 6,
          left: spacing.sm,
          width: BACK_SIZE,
          height: BACK_SIZE,
          borderRadius: BACK_SIZE / 2,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
          <Path d="M15 5l-7 7 7 7" stroke={colors.navy} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </Pressable>
    </View>
  );
}
