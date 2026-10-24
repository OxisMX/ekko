import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, type ListRenderItem, Pressable, RefreshControl, View } from "react-native";

import { StampCard, STAMP_CARD_HEADER_HEIGHT, WalletCardSkeleton } from "../../components/card";
import { formatDate } from "../../components/format";
import { CouponCard } from "../../components/coupon";
import { Button, EmptyState, ErrorState, SegmentedTabs, Skeleton } from "../../components/ui";
import { toAppError } from "../../lib/appError";
import { colors, spacing } from "../../theme";
import { imageUri } from "../merchant/merchantDetail";
import { wheelIsOffered } from "../wheel/wheel";
import { type MyCoupon, useMyCoupons } from "../coupons/myCoupons";
import { sortCards } from "./cardOrder";
import { type MyCard, useMyCards } from "./myCards";

type TabKey = "cards" | "coupons";

// A-12 Mis Tarjetas (US-10, RN-71).
export function MyCardsScreen() {
  const router = useRouter();
  // F-12: the birthday greeting opens this screen straight on the coupons tab.
  const { tab: initialTab } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<TabKey>(initialTab === "coupons" ? "coupons" : "cards");
  // The tab screen stays mounted, so a later navigation with ?tab=coupons must also switch (adjust state during render).
  const [seenParam, setSeenParam] = useState(initialTab);
  if (initialTab !== seenParam) {
    setSeenParam(initialTab);
    if (initialTab === "coupons") setTab("coupons");
  }
  // A-54: the count builds expectation; it comes from the same cached query as the coupons list.
  const couponCount = useMyCoupons().data?.length ?? 0;
  const tabs = [
    { key: "cards", label: "Tarjetas" },
    { key: "coupons", label: couponCount > 0 ? `Cupones · ${couponCount}` : "Cupones" },
  ] as const;
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg }}>
        <Button title="Registrar visita" onPress={() => router.push("/scan")} fullWidth testID="cards-scan" />
      </View>
      <SegmentedTabs tabs={tabs} value={tab} onChange={setTab} testID="cards-tabs" />
      {tab === "cards" ? <CardsList /> : <CouponsList />}
    </View>
  );
}

// Refetch each time the tab regains focus, but not on the first focus (the query just started).
function useRefetchOnFocus(refetch: () => unknown) {
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) firstFocus.current = false;
      else void refetch();
    }, [refetch])
  );
}

function usePullToRefresh(refetch: () => Promise<unknown>) {
  const [pulling, setPulling] = useState(false);
  const onRefresh = useCallback(() => {
    setPulling(true);
    void refetch().finally(() => setPulling(false));
  }, [refetch]);
  return <RefreshControl refreshing={pulling} onRefresh={onRefresh} colors={[colors.navy]} tintColor={colors.navy} />;
}

// Pill text (never colour alone) for the strip of a stacked card; not interactive, the whole card opens the merchant.
function badgeFor(card: MyCard): string | undefined {
  if (!card.merchant_available) return "No disponible";
  if (card.reward_available) return "Premio listo";
  return wheelIsOffered(card.wheel_status) ? "Gira tu ruleta" : undefined;
}

// Wallet stack: every card but the last is cut to its header strip, and the next card paints over the rest.
function WalletCard({ card, isLast, onPress }: { card: MyCard; isLast: boolean; onPress: () => void }) {
  const header = { logoUri: imageUri(card.logo_path, "logo"), name: card.merchant_name, badge: badgeFor(card) };
  const expires = formatDate(card.cycle_expires_at);
  const label = [
    `${card.merchant_name}, ${card.stamps_count} de ${card.stamps_required} sellos`,
    `premio ${card.reward_title}`,
    `vence el ${expires}`,
    header.badge,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <View style={isLast ? undefined : { height: STAMP_CARD_HEADER_HEIGHT }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={`my-card-${card.merchant_id}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      >
        <StampCard
          stampsRequired={card.stamps_required}
          stamps={card.stamps.map((s) => ({ grantedAt: s.granted_at, isBonus: s.is_bonus }))}
          logoUri={header.logoUri}
          stampImageUri={imageUri(card.stamp_image_path, "logo")}
          merchantName={card.merchant_name}
          backgroundUri={imageUri(card.background_path, "card")}
          rewardTitle={card.reward_title}
          cycleExpiresAt={card.cycle_expires_at}
          pendingExtraStamps={card.pending_extra_stamps}
          rewardAvailable={card.reward_available}
          available={card.merchant_available}
          header={header}
        />
      </Pressable>
    </View>
  );
}

function CardsList() {
  const router = useRouter();
  const cards = useMyCards();
  const { refetch } = cards;
  useRefetchOnFocus(refetch);
  const refreshControl = usePullToRefresh(refetch);
  const sorted = useMemo(() => sortCards(cards.data ?? []), [cards.data]);

  const lastIndex = sorted.length - 1;
  const renderItem = useCallback<ListRenderItem<MyCard>>(
    ({ item, index }) => (
      <WalletCard
        card={item}
        isLast={index === lastIndex}
        onPress={() => router.push({ pathname: "/merchant/[id]", params: { id: item.merchant_id, name: item.merchant_name } })}
      />
    ),
    [router, lastIndex]
  );

  let emptyState;
  if (cards.data) {
    emptyState = (
      <EmptyState
        title="Aún no tienes tarjetas"
        message="Agrega la tarjeta de un negocio o registra tu primera visita para empezar a ganar sellos."
        actionLabel="Explorar comercios"
        onAction={() => router.navigate("/")}
        testID="cards-empty"
      />
    );
  } else if (cards.isError) {
    emptyState = <CardsError key={cards.errorUpdatedAt} error={cards.error} onRetry={() => void refetch()} />;
  } else {
    emptyState = (
      <View accessible accessibilityLabel="Cargando tarjetas" testID="cards-loading">
        {[0, 1, 2].map((i) => (
          <View key={i} style={i < 2 ? { height: STAMP_CARD_HEADER_HEIGHT } : undefined}>
            <WalletCardSkeleton />
          </View>
        ))}
      </View>
    );
  }

  return (
    <FlatList
      data={sorted}
      keyExtractor={(item) => item.merchant_id}
      renderItem={renderItem}
      contentContainerStyle={{ flexGrow: 1, padding: spacing.lg }}
      refreshControl={refreshControl}
      ListEmptyComponent={emptyState}
      testID="cards-list"
    />
  );
}

// A-18 Cupones (US-13, RN-71): an unavailable merchant's coupon is still usable.
function CouponsList() {
  const router = useRouter();
  const coupons = useMyCoupons();
  const { refetch } = coupons;
  useRefetchOnFocus(refetch);
  const refreshControl = usePullToRefresh(refetch);

  const renderItem = useCallback<ListRenderItem<MyCoupon>>(
    ({ item }) => (
      <CouponCard
        title={item.title}
        merchantName={item.merchant_name}
        merchantUnavailable={!item.merchant_available}
        source={item.source}
        expiresAt={item.expires_at}
        terms={item.terms ?? undefined}
        onShowCode={() => router.push({ pathname: "/coupon/[id]", params: { id: item.id, merchantId: item.merchant_id } })}
        testID={`my-coupon-${item.id}`}
      />
    ),
    [router]
  );

  let emptyState;
  if (coupons.data) {
    emptyState = (
      <EmptyState
        title="Aún no tienes cupones"
        message="Gánalos al completar tu tarjeta de sellos, girar la ruleta de bienvenida o recibir promociones de tus negocios."
        actionLabel="Explorar comercios"
        onAction={() => router.navigate("/")}
        testID="coupons-empty"
      />
    );
  } else if (coupons.isError) {
    emptyState = <CardsError key={coupons.errorUpdatedAt} error={coupons.error} onRetry={() => void refetch()} what="tus cupones" testID="coupons-error" />;
  } else {
    emptyState = (
      <View accessible accessibilityLabel="Cargando cupones" testID="coupons-loading" style={{ gap: spacing.lg }}>
        <Skeleton height={140} radius={16} />
        <Skeleton height={140} radius={16} />
      </View>
    );
  }

  return (
    <FlatList
      data={coupons.data ?? []}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={{ flexGrow: 1, gap: spacing.md, padding: spacing.lg }}
      refreshControl={refreshControl}
      ListEmptyComponent={emptyState}
      testID="coupons-list"
    />
  );
}

function CardsError({ error, onRetry, what = "tus tarjetas", testID = "cards-error" }: { error: unknown; onRetry: () => void; what?: string; testID?: string }) {
  // WHY: computed once per error (keyed by the parent) so an E-99 is reported to Sentry once.
  const [code] = useState(() => toAppError(error).code);
  return code === "E-01" ? (
    <ErrorState onRetry={onRetry} testID={testID} />
  ) : (
    <ErrorState onRetry={onRetry} title="Algo salió mal" message={`No pudimos cargar ${what}. Inténtalo de nuevo.`} testID={testID} />
  );
}
