import { ERRORS, PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from "@ekko/shared";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import { formatDate } from "../../components/format";
import { ChevronRight, Gift } from "../../components/icons";
import { Button, ErrorState, Skeleton } from "../../components/ui";
import { reportError } from "../../lib/sentry";
import { colors, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { type MyProfile, useMyProfile } from "../auth/account";
import { useMyCards } from "../cards/myCards";
import { EmailVerificationBanner } from "../auth/EmailVerificationBanner";
import { DevSimulatePush } from "./DevSimulatePush";
import { avatarUrl } from "./profileEdit";
import { Avatar, initialsOf, Row, Section } from "./profileParts";
import { useMyRedemptions } from "./redemptions";

// A-20 Perfil (US-06): read-only info, stats and account actions; editing lives in /edit-profile.
export function ProfileScreen() {
  const profile = useMyProfile();
  if (profile.isError) return <ErrorState onRetry={() => void profile.refetch()} title="Algo salió mal" message="No pudimos cargar tu perfil. Inténtalo de nuevo." testID="profile-error" />;
  if (!profile.data) {
    return (
      <View accessible accessibilityLabel="Cargando perfil" testID="profile-loading" style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Skeleton height={72} radius={16} />
        <Skeleton height={160} radius={16} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
        <ProfileInfo profile={profile.data} />
        <EmailVerificationBanner />
        <HistoryRow />
        <LinkRows />
        <SignOutButton />
        <DeleteAccountEntry />
        {__DEV__ ? <DevSimulatePush /> : null}
      </ScrollView>
    </View>
  );
}

function ProfileInfo({ profile }: { profile: MyProfile }) {
  const router = useRouter();
  const { first_name, last_name, birth_date, email, avatar_path } = profile;
  return (
    <>
      <Header name={[first_name, last_name].filter(Boolean).join(" ")} email={email} initials={initialsOf(first_name, last_name)} avatarUri={avatarUrl(avatar_path)} />
      <Section>
        <Row
          label="Fecha de nacimiento"
          // WHY: noon UTC keeps the calendar day stable under the business-timezone formatter.
          value={birth_date ? formatDate(`${birth_date}T12:00:00Z`) : "—"}
          testID="profile-birth-date"
        />
      </Section>
      <StatsStrip />
      <Button title="Editar perfil" onPress={() => router.push("/edit-profile")} variant="secondary" fullWidth testID="profile-edit" />
    </>
  );
}

// A-78: achievements from the cached lists; hidden until both are known so it never shows wrong zeros.
function StatsStrip() {
  const cards = useMyCards().data;
  const redemptions = useMyRedemptions();
  if (!cards || !redemptions.data) return null;
  const redeemed = redemptions.data.pages.flat().length;
  const stats = [
    { label: "Sellos", value: String(cards.reduce((sum, card) => sum + card.stamps_count, 0)) },
    { label: "Tarjetas", value: String(cards.length) },
    // WHY: the history is paged; past the first page the exact count isn't known, so it reads "20+".
    { label: "Canjes", value: redemptions.hasNextPage ? `${redeemed}+` : String(redeemed) },
  ];
  return (
    <View testID="profile-stats" style={{ flexDirection: "row", backgroundColor: colors.surfaceMuted, borderRadius: radii.card, paddingVertical: spacing.md }}>
      {stats.map(({ label, value }) => (
        <View key={label} accessible accessibilityLabel={`${label}: ${value}`} style={{ flex: 1, alignItems: "center" }}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.h2, { color: colors.navy, fontVariant: ["tabular-nums"] }]}>
            {value}
          </Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Header({ name, email, initials, avatarUri }: { name: string; email: string | null; initials: string; avatarUri: string | null }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      {/* NOTE: shown by the name next to it; decorative for screen readers. A failed image falls back to the initials. */}
      <Avatar uri={avatarUri} initials={initials} />
      <View style={{ flex: 1 }}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.h2, { color: colors.textPrimary }]} testID="profile-name">
          {name}
        </Text>
        {email ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
            {email}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function HistoryRow() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Historial de canjes"
      onPress={() => router.push("/redemptions")}
      testID="profile-history"
      style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceMuted, borderRadius: radii.card, paddingHorizontal: spacing.lg }}
    >
      <Gift size={20} color={colors.navy} />
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { flex: 1, color: colors.textPrimary }]}>
        Historial de canjes
      </Text>
      <ChevronRight size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

// Apple 5.1.1(i) / 1.5: privacy, terms and support must be reachable inside the app.
function LinkRows() {
  const open = (url: string) => () => void Linking.openURL(url).catch(reportError);
  return (
    <View style={{ gap: spacing.sm }}>
      <LinkRow label="Ayuda y soporte" onPress={open(`mailto:${SUPPORT_EMAIL}`)} testID="profile-support" />
      <LinkRow label="Aviso de privacidad" onPress={open(PRIVACY_URL)} testID="profile-privacy" />
      <LinkRow label="Términos y condiciones" onPress={open(TERMS_URL)} testID="profile-terms" />
    </View>
  );
}

// NOTE: same look as HistoryRow minus the leading icon (no new icon for a legal link).
function LinkRow({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      testID={testID}
      style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceMuted, borderRadius: radii.card, paddingHorizontal: spacing.lg }}
    >
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { flex: 1, color: colors.textPrimary }]}>
        {label}
      </Text>
      <ChevronRight size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

// F-16: confirm, then AuthProvider.signOut releases the device, drops the session and clears the cache.
function SignOutButton() {
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const confirm = () =>
    Alert.alert("¿Cerrar sesión?", "Tendrás que iniciar sesión de nuevo para ver tus tarjetas.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: () => {
          setSigningOut(true);
          signOut().catch((error: unknown) => {
            reportError(error);
            setSigningOut(false);
            Alert.alert("No pudimos cerrar tu sesión", ERRORS["E-99"].message);
          });
        },
      },
    ]);

  return (
    <Button
      title={signingOut ? "Cerrando sesión…" : "Cerrar sesión"}
      onPress={confirm}
      variant="secondary"
      disabled={signingOut}
      fullWidth
      testID="profile-sign-out"
    />
  );
}

// F-15 entry: deliberately low-key (text link, not a button) so it is not tapped by accident.
function DeleteAccountEntry() {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push("/delete-account")}
      testID="profile-delete-account"
      style={{ minHeight: 48, justifyContent: "center", alignItems: "center" }}
    >
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.error }]}>
        Eliminar mi cuenta
      </Text>
    </Pressable>
  );
}
