import { useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { StampCard } from "../../components/card";
import { CouponCard } from "../../components/coupon";
import { OfferCard, ProductCard } from "../../components/merchant";
import { Button, Chip, EmptyState, FormMessage } from "../../components/ui";
import { openExternalUrl } from "../../lib/openExternal";
import { colors, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { wheelIsOffered } from "../wheel/wheel";
import { imageUri, menuChips, type MerchantDetail, previewExpiry, productsFor } from "./merchantDetail";

export type MerchantTabKey = "card" | "menu" | "promos" | "review";

// DA-2: Tarjeta first.
export const MERCHANT_TABS = [
  { key: "card", label: "Tarjeta" },
  { key: "menu", label: "Menú" },
  { key: "promos", label: "Promociones" },
  { key: "review", label: "Reseña" },
] as const satisfies readonly { key: MerchantTabKey; label: string }[];

function SectionTitle({ children }: { children: string }) {
  return (
    <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.h2, { color: colors.textPrimary }]}>
      {children}
    </Text>
  );
}

function Paragraph({ children, muted = false, testID }: { children: string; muted?: boolean; testID?: string }) {
  return (
    <Text testID={testID} maxFontSizeMultiplier={MAX_FONT_SCALE} style={[muted ? textStyles.secondary : textStyles.body, { color: muted ? colors.textSecondary : colors.textPrimary }]}>
      {children}
    </Text>
  );
}

type CardTabProps = {
  detail: MerchantDetail;
  adding: boolean;
  addErrorMessage: string | null;
  onAddCard: () => void;
  onViewReward: () => void;
  onRegisterVisit: () => void;
  onSpinWheel: () => void;
  /** The visit just stamped (A-15 → A-09): animate the newest stamp. */
  highlightLastStamp?: boolean;
};

// A-09 Tarjeta (US-08, US-09, RN-27, RN-71).
export function CardTab({ detail, adding, addErrorMessage, onAddCard, onViewReward, onRegisterVisit, onSpinWheel, highlightLastStamp = false }: CardTabProps) {
  const { merchant, card } = detail;
  const rewardAvailable = card.reward_coupon_id !== null;
  return (
    <View style={{ gap: spacing.lg }}>
      <StampCard
        stampsRequired={card.stamps_required}
        stamps={card.stamps.map((s) => ({ grantedAt: s.granted_at, isBonus: s.is_bonus }))}
        logoUri={imageUri(merchant.logo_path, "logo")}
        merchantName={merchant.name}
        stampImageUri={imageUri(card.stamp_image_path, "logo")}
        backgroundUri={imageUri(card.background_path, "card")}
        rewardTitle={card.reward_title}
        cycleExpiresAt={card.cycle_expires_at ?? previewExpiry(card.cycle_months)}
        pendingExtraStamps={card.pending_extra_stamps}
        rewardAvailable={rewardAvailable}
        available={merchant.available}
        highlightLast={highlightLastStamp}
        onViewReward={rewardAvailable ? onViewReward : undefined}
        testID="merchant-stamp-card"
      />
      {card.has_relation ? null : (
        <View style={{ gap: spacing.sm }}>
          <Button
            title="Agregar a mis tarjetas"
            onPress={onAddCard}
            // WHY: "Registrar visita" is the primary action here; one primary button per screen.
            variant="secondary"
            loading={adding}
            disabled={adding || !merchant.available}
            fullWidth
            testID="merchant-add-card"
          />
          {addErrorMessage ? <FormMessage variant="error" message={addErrorMessage} testID="merchant-add-card-error" /> : null}
        </View>
      )}
      {/* A-13..A-15 (F-08): hidden while the merchant is unavailable — claim_visit would answer E-05. */}
      {merchant.available ? <Button title="Registrar visita" onPress={onRegisterVisit} fullWidth testID="merchant-register-visit" /> : null}
      {/* F-07: A-12 itself explains the unverified case (E-06). */}
      {merchant.available && wheelIsOffered(detail.wheel.status) ? <Button title="Gira tu ruleta" onPress={onSpinWheel} variant="secondary" fullWidth testID="merchant-spin-wheel" /> : null}
      {card.reward_description ? <Paragraph>{card.reward_description}</Paragraph> : null}
      {card.terms ? (
        <View style={{ gap: spacing.xs }}>
          <SectionTitle>Términos y condiciones</SectionTitle>
          <Paragraph muted testID="merchant-terms">
            {card.terms}
          </Paragraph>
        </View>
      ) : null}
    </View>
  );
}

// A-10 Menú (US-10, RN-53..RN-56).
export function MenuTab({ menu, onShowCard }: { menu: MerchantDetail["menu"]; onShowCard: () => void }) {
  const chips = menuChips(menu);
  const [chip, setChip] = useState<string | null>(chips[0]?.key ?? null);
  if (menu.products.length === 0) {
    return (
      <EmptyState
        title="Menú"
        message="Este negocio aún no publica su menú"
        actionLabel="Ver tarjeta"
        onAction={onShowCard}
        testID="merchant-menu-empty"
      />
    );
  }
  return (
    <View style={{ gap: spacing.lg }}>
      {chips.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xs }}>
          {chips.map(({ key, label }) => (
            <Chip key={key} label={label} selected={chip === key} onPress={() => setChip(key)} testID={`menu-chip-${key}`} />
          ))}
        </ScrollView>
      ) : null}
      {productsFor(menu, chips.length > 0 ? chip : null).map((product) => (
        <ProductCard
          key={product.id}
          name={product.name}
          description={product.description}
          price={product.price}
          imageUri={imageUri(product.image_path, "product")}
          featured={product.is_featured}
          soldOut={product.is_sold_out}
          testID={`product-${product.id}`}
        />
      ))}
    </View>
  );
}

// A-11 Promociones y cupones (US-12, RN-57..RN-59).
export function PromosTab({
  detail,
  highlightCouponId,
  onShowMenu,
  onShowCode,
}: {
  detail: MerchantDetail;
  highlightCouponId: string | null;
  onShowMenu: () => void;
  onShowCode: (couponId: string) => void;
}) {
  const { offers, coupons } = detail;
  if (offers.length === 0 && coupons.length === 0) {
    return (
      <EmptyState
        title="Sin promociones por ahora"
        message="Este negocio aún no tiene promociones ni cupones para ti."
        actionLabel="Ver menú"
        onAction={onShowMenu}
        testID="merchant-promos-empty"
      />
    );
  }
  return (
    <View style={{ gap: spacing.lg }}>
      <SectionTitle>Promociones de la semana</SectionTitle>
      {offers.length === 0 ? <Paragraph muted>Este negocio aún no publica promociones.</Paragraph> : null}
      {offers.map((offer) => (
        <OfferCard
          key={offer.id}
          weekday={offer.weekday}
          title={offer.title}
          description={offer.description ?? ""}
          imageUri={imageUri(offer.image_path, "offer")}
          testID={`offer-${offer.id}`}
        />
      ))}
      <SectionTitle>Tus cupones</SectionTitle>
      {coupons.length === 0 ? <Paragraph muted>Aún no tienes cupones de este negocio.</Paragraph> : null}
      {coupons.map((coupon) => {
        const highlighted = coupon.id === highlightCouponId;
        return (
          <View
            key={coupon.id}
            testID={highlighted ? "coupon-highlighted" : undefined}
            style={highlighted ? { borderRadius: radii.card, borderWidth: 3, borderColor: colors.accent } : undefined}
          >
            <CouponCard
              title={coupon.title}
              source={coupon.source}
              expiresAt={coupon.expires_at}
              terms={coupon.terms ?? undefined}
              onShowCode={() => onShowCode(coupon.id)}
              testID={`coupon-${coupon.id}`}
            />
          </View>
        );
      })}
    </View>
  );
}

// Reseña (SA-02): the review lives on Google Maps.
export function ReviewTab({ reviewsUrl }: { reviewsUrl: string | null }) {
  return (
    <View style={{ gap: spacing.lg }}>
      <Paragraph>¿Ya visitaste este negocio? Tu reseña ayuda a otros clientes y al negocio a mejorar.</Paragraph>
      <Button
        title="Dejar una reseña en Google Maps"
        onPress={() => openExternalUrl(reviewsUrl, "No pudimos abrir las reseñas de este negocio.")}
        fullWidth
        testID="merchant-review"
      />
    </View>
  );
}
