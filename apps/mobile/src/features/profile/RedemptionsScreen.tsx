import { TIMEZONE } from "@ekko/shared";
import { useRouter } from "expo-router";
import { FlatList, Text, View } from "react-native";

import { couponSourceLabel } from "../../components/coupon/CouponCard";
import { formatDate } from "../../components/format";
import { Button, EmptyState, ErrorState, Skeleton } from "../../components/ui";
import { toAppError } from "../../lib/appError";
import { colors, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { type Redemption, useMyRedemptions } from "./redemptions";

const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

// A-21 Historial de canjes (US-06).
export function RedemptionsScreen() {
  const router = useRouter();
  const query = useMyRedemptions();
  const items = query.data?.pages.flat() ?? [];

  let placeholder;
  if (query.data) {
    placeholder = (
      <EmptyState title="Aún no has canjeado cupones" message="Cuando canjees un cupón en un negocio, aparecerá aquí." actionLabel="Explorar comercios" onAction={() => router.navigate("/")} testID="redemptions-empty" />
    );
  } else if (query.isError) {
    placeholder = <LoadError error={query.error} onRetry={() => void query.refetch()} />;
  } else {
    placeholder = (
      <View accessible accessibilityLabel="Cargando historial" testID="redemptions-loading" style={{ gap: spacing.md }}>
        <Skeleton height={80} radius={16} />
        <Skeleton height={80} radius={16} />
        <Skeleton height={80} radius={16} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.surface }}
      data={items}
      keyExtractor={(item) => item.coupon_id}
      renderItem={({ item }) => <RedemptionRow item={item} />}
      contentContainerStyle={{ flexGrow: 1, gap: spacing.md, padding: spacing.lg }}
      onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && void query.fetchNextPage()}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={placeholder}
      ListFooterComponent={
        query.isFetchNextPageError ? (
          <Button title="Reintentar" onPress={() => void query.fetchNextPage()} variant="secondary" testID="redemptions-next-retry" />
        ) : undefined
      }
      testID="redemptions-list"
    />
  );
}

function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return toAppError(error).code === "E-01" ? (
    <ErrorState onRetry={onRetry} testID="redemptions-error" />
  ) : (
    <ErrorState onRetry={onRetry} title="Algo salió mal" message="No pudimos cargar tu historial. Inténtalo de nuevo." testID="redemptions-error" />
  );
}

function RedemptionRow({ item }: { item: Redemption }) {
  return (
    <View accessible style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.card, padding: spacing.lg, gap: spacing.xs }}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.label, { color: colors.textSecondary }]}>
        {couponSourceLabel[item.source]}
      </Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.h2, { color: colors.textPrimary }]}>
        {item.title}
      </Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textPrimary }]}>
        {item.merchant_name}
      </Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
        {`${formatDate(item.redeemed_at)} · ${formatTime(item.redeemed_at)}`}
      </Text>
    </View>
  );
}
