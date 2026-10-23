import { completeProfileSchema, ERRORS } from "@ekko/shared";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { z } from "zod";

import { useAuth } from "../../auth/AuthProvider";
import { formatDate } from "../../components/format";
import { ChevronRight, Gift, Lock } from "../../components/icons";
import { Button, ErrorState, FormMessage, Skeleton, TextField, Toast } from "../../components/ui";
import { toAppError } from "../../lib/appError";
import { reportError } from "../../lib/sentry";
import { colors, fontFamily, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { type MyProfile, useMyProfile } from "../auth/account";
import { useMyCards } from "../cards/myCards";
import { EmailVerificationBanner } from "../auth/EmailVerificationBanner";
import { DevSimulatePush } from "./DevSimulatePush";
import { AvatarPermissionError, avatarUrl, pickAvatar, useUpdateProfile } from "./profileEdit";
import { usePushPermission } from "./notificationsPermission";
import { useMyRedemptions } from "./redemptions";

const initialsOf = (first: string | null, last: string | null) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";

const LOCKED_NOTE = "No se puede cambiar";
const AVATAR_SIZE = 72;
const nameFieldsSchema = completeProfileSchema.pick({ first_name: true, last_name: true });
const PERMISSION_DENIED_MESSAGE = "Para elegir una foto, permite el acceso a tus fotos en los ajustes del teléfono.";

// A-20 Perfil (US-06). Name, photo and notification preference are editable; birth date and email are not (RN-04).
export function ProfileScreen() {
  const profile = useMyProfile();
  const [saved, setSaved] = useState(false);
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
        <EditableProfile profile={profile.data} onSaved={() => setSaved(true)} />
        <EmailVerificationBanner />
        <HistoryRow />
        <SignOutButton />
        <DeleteAccountEntry />
        {__DEV__ ? <DevSimulatePush /> : null}
      </ScrollView>
      {/* A-79: success is a transient toast, not a message that lingers in the form. */}
      {saved ? <Toast title="Cambios guardados" message="Actualizamos tu perfil." onDismiss={() => setSaved(false)} testID="profile-saved-toast" /> : null}
    </View>
  );
}

type Notice = { variant: "error"; message: string };

function EditableProfile({ profile, onSaved }: { profile: MyProfile; onSaved: () => void }) {
  const { first_name, last_name, birth_date, email, email_verified, avatar_path, push_opt_in } = profile;
  const [first, setFirst] = useState(first_name ?? "");
  const [last, setLast] = useState(last_name ?? "");
  const [optIn, setOptIn] = useState(push_opt_in);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const update = useUpdateProfile();

  const parsed = nameFieldsSchema.safeParse({ first_name: first, last_name: last });
  const errors = parsed.success ? {} : z.flattenError(parsed.error).fieldErrors;
  const dirty = first.trim() !== (first_name ?? "") || last.trim() !== (last_name ?? "") || optIn !== push_opt_in || photoUri !== null;

  const choosePhoto = () => {
    setNotice(null);
    pickAvatar().then(
      (uri) => uri && setPhotoUri(uri),
      (error: unknown) => {
        if (error instanceof AvatarPermissionError) setNotice({ variant: "error", message: PERMISSION_DENIED_MESSAGE });
        else setNotice({ variant: "error", message: ERRORS[toAppError(error).code].message });
      }
    );
  };

  const save = () => {
    if (!parsed.success || update.isPending) return;
    setNotice(null);
    update.mutate(
      { changes: { first_name: parsed.data.first_name, last_name: parsed.data.last_name, push_opt_in: optIn, avatar_path }, newPhotoUri: photoUri },
      {
        onSuccess: () => {
          setPhotoUri(null);
          onSaved();
        },
        onError: (error) => setNotice({ variant: "error", message: ERRORS[toAppError(error).code].message }),
      }
    );
  };

  return (
    <>
      <Header name={[first_name, last_name].filter(Boolean).join(" ")} email={email} initials={initialsOf(first_name, last_name)} avatarUri={photoUri ?? avatarUrl(avatar_path)} />
      <StatsStrip />
      <View style={{ gap: spacing.lg }}>
        <Button title={avatar_path || photoUri ? "Cambiar foto de perfil" : "Agregar foto de perfil"} onPress={choosePhoto} variant="secondary" fullWidth testID="profile-photo-change" />
        <TextField label="Nombre" value={first} onChangeText={setFirst} error={errors.first_name?.[0]} autoCapitalize="words" autoComplete="given-name" testID="profile-first-name" />
        <TextField label="Apellido" value={last} onChangeText={setLast} error={errors.last_name?.[0]} autoCapitalize="words" autoComplete="family-name" testID="profile-last-name" />
        <NotificationsSection value={optIn} onChange={setOptIn} />
        {notice ? <FormMessage variant={notice.variant} message={notice.message} testID="profile-notice" /> : null}
        {dirty ? (
          <Button
            title={update.isPending ? "Guardando…" : "Guardar cambios"}
            onPress={save}
            disabled={!parsed.success || update.isPending}
            loading={update.isPending}
            fullWidth
            testID="profile-save"
          />
        ) : null}
      </View>
      <Section>
        <Row
          label="Fecha de nacimiento"
          // WHY: noon UTC keeps the calendar day stable under the business-timezone formatter.
          value={birth_date ? formatDate(`${birth_date}T12:00:00Z`) : "—"}
          note={LOCKED_NOTE}
          testID="profile-birth-date"
        />
        <Row label="Correo electrónico" value={`${email ?? "—"} · ${email_verified ? "Verificado" : "Sin verificar"}`} note={LOCKED_NOTE} testID="profile-email" />
      </Section>
    </>
  );
}

// A-76: one section for both controls; the system row only appears when the OS permission needs attention.
function NotificationsSection({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  const { state, act } = usePushPermission();
  const systemAction = state === "blocked" ? "Abrir ajustes" : state === "askable" ? "Activar" : null;
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 48 }}>
        <View style={{ flex: 1, gap: spacing.xs / 2 }}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.textPrimary }]}>
            Notificaciones
          </Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
            Recibir promociones y avisos de tus negocios
          </Text>
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          accessibilityLabel="Notificaciones"
          trackColor={{ true: colors.navy, false: colors.surfaceMuted }}
          thumbColor={colors.surface}
          testID="profile-push-opt-in"
        />
      </View>
      {systemAction ? (
        <Pressable
          onPress={() => void act()}
          accessibilityRole="button"
          accessibilityLabel={`Desactivadas en el sistema. ${systemAction}`}
          testID="profile-notifications-action"
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
            Desactivadas en el sistema ·{" "}
            <Text style={{ fontFamily: fontFamily.semibold, color: colors.navy, textDecorationLine: "underline" }}>{systemAction}</Text>
          </Text>
        </Pressable>
      ) : null}
    </View>
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

function Avatar({ uri, initials }: { uri: string | null; initials: string }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showImage = uri && uri !== failedUri;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center", overflow: "hidden" }}
    >
      {showImage ? (
        <Image source={{ uri }} recyclingKey={uri} contentFit="cover" onError={() => setFailedUri(uri)} style={{ width: "100%", height: "100%" }} testID="profile-avatar-image" />
      ) : (
        <Text style={[textStyles.h2, { color: colors.surface }]}>{initials}</Text>
      )}
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          <Lock size={14} color={colors.textSecondary} />
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
            {note}
          </Text>
        </View>
      ) : null}
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
