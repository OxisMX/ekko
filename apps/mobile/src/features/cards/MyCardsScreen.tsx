import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { FlatList, type ListRenderItem, RefreshControl, View } from "react-native";

import { CardRow } from "../../components/card";
import { Button, EmptyState, ErrorState, Skeleton } from "../../components/ui";
import { toAppError } from "../../lib/appError";
import { colors, spacing } from "../../theme";
import { imageUri } from "../merchant/merchantDetail";
import { type MyCard, useMyCards } from "./myCards";

// A-12 Mis Tarjetas (US-10, RN-71).
export function MyCardsScreen() {
  const router = useRouter();
  const cards = useMyCards();
  const { refetch } = cards;
  const [pulling, setPulling] = useState(false);

  // Refetch each time the tab regains focus, but not on the first focus (the query just started).
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) firstFocus.current = false;
      else void refetch();
    }, [refetch])
  );

  const onRefresh = useCallback(() => {
    setPulling(true);
    void refetch().finally(() => setPulling(false));
  }, [refetch]);

  const renderItem = useCallback<ListRenderItem<MyCard>>(
    ({ item }) => (
      <CardRow
        merchantName={item.merchant_name}
        logoUri={imageUri(item.logo_path, "logo")}
        stampsCount={item.stamps_count}
        stampsRequired={item.stamps_required}
        cycleExpiresAt={item.cycle_expires_at}
        rewardAvailable={item.reward_available}
        wheelAvailable={item.wheel_status === "available"}
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
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <FlatList
        data={cards.data ?? []}
        keyExtractor={(item) => item.merchant_id}
        renderItem={renderItem}
        contentContainerStyle={{ flexGrow: 1, gap: spacing.md, padding: spacing.lg }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onRefresh} colors={[colors.navy]} tintColor={colors.navy} />}
        ListHeaderComponent={
          <Button title="Registrar visita" onPress={() => router.push("/scan")} fullWidth style={{ marginBottom: spacing.sm }} testID="cards-scan" />
        }
        ListEmptyComponent={emptyState}
        testID="cards-list"
      />
    </View>
  );
}

function CardsError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  // WHY: computed once per error (keyed by the parent) so an E-99 is reported to Sentry once.
  const [code] = useState(() => toAppError(error).code);
  return code === "E-01" ? (
    <ErrorState onRetry={onRetry} testID="cards-error" />
  ) : (
    <ErrorState onRetry={onRetry} title="Algo salió mal" message="No pudimos cargar tus tarjetas. Inténtalo de nuevo." testID="cards-error" />
  );
}
