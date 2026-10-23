import { ERRORS } from "@ekko/shared";
import { useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import { formatDate } from "../../components/format";
import { Button, ErrorState, Skeleton } from "../../components/ui";
import { reportError } from "../../lib/sentry";
import { colors, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { useMyProfile } from "../auth/account";
import { EmailVerificationBanner } from "../auth/EmailVerificationBanner";
import { DevSimulatePush } from "./DevSimulatePush";
import { type PushPermissionState, usePushPermission } from "./notificationsPermission";

const PERMISSION_TEXT: Record<PushPermissionState, { status: string; action?: string }> = {
  loading: { status: "…" },
  granted: { status: "Activadas" },
  askable: { status: "Desactivadas", action: "Activar" },
  blocked: { status: "Desactivadas en el sistema", action: "Abrir ajustes" },
};

const initialsOf = (first: string | null, last: string | null) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";

// A-20 Perfil (US-06). Name and birth date are read-only (RN-08 style: changes go through support).
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
  const { first_name, last_name, birth_date, email, email_verified } = profile.data;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <Header name={[first_name, last_name].filter(Boolean).join(" ")} email={email} initials={initialsOf(first_name, last_name)} />
      <EmailVerificationBanner />
      <Section>
        <Row label="Nombre" value={first_name ?? "—"} testID="profile-first-name" />
        <Row label="Apellido" value={last_name ?? "—"} testID="profile-last-name" />
        <Row
          label="Fecha de nacimiento"
          // WHY: noon UTC keeps the calendar day stable under the business-timezone formatter.
          value={birth_date ? formatDate(`${birth_date}T12:00:00Z`) : "—"}
          note="🔒 No se puede cambiar"
          testID="profile-birth-date"
        />
        <Row label="Correo" value={`${email ?? "—"} · ${email_verified ? "Verificado" : "Sin verificar"}`} testID="profile-email" />
      </Section>
      <PermissionRow />
      <HistoryRow />
      <SignOutButton />
      <DeleteAccountEntry />
      {__DEV__ ? <DevSimulatePush /> : null}
    </ScrollView>
  );
}

function Header({ name, email, initials }: { name: string; email: string | null; initials: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center" }}>
        <Text style={[textStyles.h2, { color: colors.surface }]}>{initials}</Text>
      </View>
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

function Section({ children }: { children: ReactNode }) {
  return <View style={{ backgroundColor: colors.surfaceMuted, borderRadius: radii.card, paddingHorizontal: spacing.lg }}>{children}</View>;
}

function Row({ label, value, note, testID }: { label: string; value: string; note?: string; testID?: string }) {
  return (
    <View accessible testID={testID} style={{ paddingVertical: spacing.md, gap: spacing.xs / 2 }}>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.textPrimary }]}>
        {value}
      </Text>
      {note ? (
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

function PermissionRow() {
  const { state, act } = usePushPermission();
  const { status, action } = PERMISSION_TEXT[state];
  return (
    <Section>
      <View style={{ paddingVertical: spacing.md, gap: spacing.sm }}>
        <Row label="Notificaciones" value={status} testID="profile-notifications" />
        {action ? <Button title={action} onPress={() => void act()} variant="secondary" fullWidth testID="profile-notifications-action" /> : null}
      </View>
    </Section>
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
      style={{ minHeight: 48, justifyContent: "center", backgroundColor: colors.surfaceMuted, borderRadius: radii.card, paddingHorizontal: spacing.lg }}
    >
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.textPrimary }]}>
        Historial de canjes ›
      </Text>
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
