import { TIMEZONE } from "@ekko/shared";
import { useRouter } from "expo-router";
import { FlatList, Text, View } from "react-native";
import { formatDate } from "../../components/format";
import { Check } from "../../components/icons";
import { Button, EmptyState, ErrorState, Skeleton } from "../../components/ui";
import { toAppError } from "../../lib/appError";
import { colors, fontFamily, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
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

// A-68: a past redemption reads as an achievement, with less visual weight than an active coupon.
function RedemptionRow({ item }: { item: Redemption }) {
  const when = `${formatDate(item.redeemed_at)} · ${formatTime(item.redeemed_at)}`;
  return (
    <View
      accessible
      accessibilityLabel={`${item.title}. ${item.merchant_name}. Canjeado ${when}`}
      style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, borderWidth: 1, borderColor: colors.surfaceMuted, borderRadius: radii.card, padding: spacing.md }}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.navyTint, alignItems: "center", justifyContent: "center" }}>
        <Check size={20} color={colors.navy} />
      </View>
      <View style={{ flex: 1, gap: spacing.xs / 2 }}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { fontFamily: fontFamily.semibold, color: colors.textPrimary }]}>
          {item.title}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textPrimary }]}>
          {item.merchant_name}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
          {`Canjeado · ${when}`}
        </Text>
      </View>
    </View>
  );
}
