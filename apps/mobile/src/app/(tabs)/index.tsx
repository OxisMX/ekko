import { ERRORS, MERCHANT_CATEGORIES, type MerchantCategory, merchantCategoryLabel } from "@ekko/shared";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, type ListRenderItem, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";

import { MerchantCard } from "../../components/catalog";
import { Chip, EmptyState, ErrorState, FormMessage, MerchantCardSkeleton } from "../../components/ui";
import { fieldBoxStyle } from "../../components/ui/TextField";
import { BirthdayGreeting } from "../../features/birthday/BirthdayGreeting";
import { EmailVerificationBanner } from "../../features/auth/EmailVerificationBanner";
import { type MerchantListItem, toMerchantCard, useMerchants } from "../../features/catalog/catalog";
import { toAppError } from "../../lib/appError";
import { openExternalUrl } from "../../lib/openExternal";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { colors, MAX_FONT_SCALE, spacing, textStyles } from "../../theme";

const SEARCH_DELAY_MS = 300; // F-06

// A-07 Explorar (US-07, F-06).
export default function ExploreScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<MerchantCategory | null>(null);
  const query = useDebouncedValue(search.trim(), SEARCH_DELAY_MS);
  const merchants = useMerchants({ query, category });
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, refetch } = merchants;
  const [pulling, setPulling] = useState(false);
  const items = useMemo(() => merchants.data?.pages.flatMap((page) => page.items) ?? [], [merchants.data]);
  const filtered = query !== "" || category !== null;

  const clearFilters = useCallback(() => {
    setSearch("");
    setCategory(null);
  }, []);

  // RR-4: pull-to-refresh. Same query key, so the same session seed and order.
  const onRefresh = useCallback(() => {
    setPulling(true);
    void refetch().finally(() => setPulling(false));
  }, [refetch]);

  const onEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  const renderItem = useCallback<ListRenderItem<MerchantListItem>>(
    ({ item }) => (
      <MerchantCard
        merchant={toMerchantCard(item)}
        onPress={() => router.push({ pathname: "/merchant/[id]", params: { id: item.id, name: item.name } })}
        onOpenMap={() => openExternalUrl(item.maps_url, "No pudimos abrir la ubicación de este negocio.")}
        testID={`merchant-card-${item.id}`}
      />
    ),
    [router]
  );

  let emptyState;
  if (merchants.data) {
    emptyState = filtered ? (
      <EmptyState
        title="Sin resultados"
        message="No encontramos negocios con esa búsqueda o categoría."
        actionLabel="Limpiar búsqueda"
        onAction={clearFilters}
        testID="explore-empty"
      />
    ) : (
      <EmptyState
        title="Aún no hay negocios"
        message="Pronto verás aquí los negocios afiliados."
        actionLabel="Actualizar"
        onAction={onRefresh}
        testID="explore-empty"
      />
    );
  } else if (merchants.isError) {
    emptyState = <CatalogError key={merchants.errorUpdatedAt} error={merchants.error} onRetry={() => void refetch()} />;
  } else {
    emptyState = (
      // One announcement for the whole placeholder instead of three "Cargando".
      <View accessible accessibilityLabel="Cargando comercios" testID="explore-loading" style={{ gap: spacing.lg }}>
        <MerchantCardSkeleton />
        <MerchantCardSkeleton />
        <MerchantCardSkeleton />
      </View>
    );
  }

  // WHY: the banner, search and chips scroll away with the list (ListHeaderComponent). The FlatList stays
  // mounted in every state (loading/error live in ListEmptyComponent) so the search field never remounts
  // and keeps focus while a new query loads.
  const listHeader = (
    <View style={{ marginHorizontal: -spacing.lg }} testID="explore-header">
      <EmailVerificationBanner />
      <BirthdayGreeting />
    <View style={{ gap: spacing.md, paddingTop: spacing.md }}>
      <View style={[fieldBoxStyle(false), { marginHorizontal: spacing.lg, paddingHorizontal: spacing.lg }]}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Busca un negocio"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Buscar negocios"
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          style={[textStyles.body, { flex: 1, minHeight: 48, color: colors.textPrimary }]}
          testID="explore-search"
        />
      </View>
      {/* RN-51 / brief §4.2: the 9 categories in one scrollable row. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}
      >
        <Chip label="Todos" selected={category === null} onPress={() => setCategory(null)} testID="explore-chip-all" />
        {MERCHANT_CATEGORIES.map((value) => (
          <Chip
            key={value}
            label={merchantCategoryLabel[value]}
            selected={category === value}
            onPress={() => setCategory(value)}
            testID={`explore-chip-${value}`}
          />
        ))}
      </ScrollView>
    </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        // WHY: NF-04 — a card is ~1/3 of a screen; the defaults (10 initial, window 21) decode every cover of the
        // first page at once and keep ~20 screens of images mounted. These render what is visible first.
        initialNumToRender={4}
        windowSize={7}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ flexGrow: 1, gap: spacing.lg, padding: spacing.lg, paddingTop: 0 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onRefresh} colors={[colors.navy]} tintColor={colors.navy} />}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyState}
        ListFooterComponent={
          items.length === 0 ? undefined : (
            <ListFooter
              loadingMore={isFetchingNextPage}
              failed={isFetchNextPageError}
              done={!hasNextPage}
              onRetry={() => void fetchNextPage()}
            />
          )
        }
        testID="explore-list"
      />
    </View>
  );
}

function CatalogError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  // WHY: computed once per error (keyed by the parent) so an E-99 is reported to Sentry once.
  const [code] = useState(() => toAppError(error).code);
  return code === "E-01" ? (
    <ErrorState onRetry={onRetry} testID="explore-error" />
  ) : (
    <ErrorState onRetry={onRetry} title="Algo salió mal" message="No pudimos cargar los negocios. Inténtalo de nuevo." testID="explore-error" />
  );
}

type ListFooterProps = { loadingMore: boolean; failed: boolean; done: boolean; onRetry: () => void };

function ListFooter({ loadingMore, failed, done, onRetry }: ListFooterProps) {
  if (loadingMore) return <MerchantCardSkeleton testID="explore-loading-more" />;
  if (failed) return <FormMessage variant="error" message={ERRORS["E-01"].message} actionLabel="Reintentar" onAction={onRetry} testID="explore-more-error" />;
  if (!done) return null;
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      style={[textStyles.secondary, { color: colors.textSecondary, textAlign: "center", paddingVertical: spacing.md }]}
      testID="explore-end"
    >
      No hay más comercios
    </Text>
  );
}
