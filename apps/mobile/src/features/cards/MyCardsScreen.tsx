import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { FlatList, type ListRenderItem, RefreshControl, View } from "react-native";

import { CardRow } from "../../components/card";
import { CouponCard } from "../../components/coupon";
import { Button, EmptyState, ErrorState, SegmentedTabs, Skeleton } from "../../components/ui";
import { toAppError } from "../../lib/appError";
import { colors, spacing } from "../../theme";
import { imageUri } from "../merchant/merchantDetail";
import { wheelHref, wheelIsOffered } from "../wheel/wheel";
import { type MyCoupon, useMyCoupons } from "../coupons/myCoupons";
import { type MyCard, useMyCards } from "./myCards";

const TABS = [
  { key: "cards", label: "Tarjetas" },
  { key: "coupons", label: "Cupones" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

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
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg }}>
        <Button title="Registrar visita" onPress={() => router.push("/scan")} fullWidth testID="cards-scan" />
      </View>
      <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} testID="cards-tabs" />
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

function CardsList() {
  const router = useRouter();
  const cards = useMyCards();
  const { refetch } = cards;
  useRefetchOnFocus(refetch);
  const refreshControl = usePullToRefresh(refetch);

  const renderItem = useCallback<ListRenderItem<MyCard>>(
    ({ item }) => (
      <CardRow
        merchantName={item.merchant_name}
        logoUri={imageUri(item.logo_path, "logo")}
        stampsCount={item.stamps_count}
        stampsRequired={item.stamps_required}
        cycleExpiresAt={item.cycle_expires_at}
        rewardAvailable={item.reward_available}
        wheelAvailable={wheelIsOffered(item.wheel_status)}
        onWheelPress={() => router.push(wheelHref(item.merchant_id))}
        available={item.merchant_available}
        onPress={() => router.push({ pathname: "/merchant/[id]", params: { id: item.merchant_id, name: item.merchant_name } })}
        testID={`my-card-${item.merchant_id}`}
      />
    ),
    [router]
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
      <View accessible accessibilityLabel="Cargando tarjetas" testID="cards-loading" style={{ gap: spacing.lg }}>
        <Skeleton height={96} radius={16} />
        <Skeleton height={96} radius={16} />
        <Skeleton height={96} radius={16} />
      </View>
    );
  }

  return (
    <FlatList
      data={cards.data ?? []}
      keyExtractor={(item) => item.merchant_id}
      renderItem={renderItem}
      contentContainerStyle={{ flexGrow: 1, gap: spacing.md, padding: spacing.lg }}
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
        merchantName={item.merchant_available ? item.merchant_name : `${item.merchant_name} · No disponible por ahora`}
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
