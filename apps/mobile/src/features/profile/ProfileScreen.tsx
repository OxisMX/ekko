import { completeProfileSchema, ERRORS } from "@ekko/shared";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { type ReactNode, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { z } from "zod";

import { useAuth } from "../../auth/AuthProvider";
import { formatDate } from "../../components/format";
import { Button, ErrorState, FormMessage, Skeleton, TextField } from "../../components/ui";
import { toAppError } from "../../lib/appError";
import { reportError } from "../../lib/sentry";
import { colors, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";
import { type MyProfile, useMyProfile } from "../auth/account";
import { EmailVerificationBanner } from "../auth/EmailVerificationBanner";
import { DevSimulatePush } from "./DevSimulatePush";
import { AvatarPermissionError, avatarUrl, pickAvatar, useUpdateProfile } from "./profileEdit";
import { type PushPermissionState, usePushPermission } from "./notificationsPermission";

const PERMISSION_TEXT: Record<PushPermissionState, { status: string; action?: string }> = {
  loading: { status: "…" },
  granted: { status: "Activadas" },
  askable: { status: "Desactivadas", action: "Activar" },
  blocked: { status: "Desactivadas en el sistema", action: "Abrir ajustes" },
};

const initialsOf = (first: string | null, last: string | null) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";

const LOCKED_NOTE = "🔒 No se puede cambiar";
const AVATAR_SIZE = 72;
const nameFieldsSchema = completeProfileSchema.pick({ first_name: true, last_name: true });
const PERMISSION_DENIED_MESSAGE = "Para elegir una foto, permite el acceso a tus fotos en los ajustes del teléfono.";

// A-20 Perfil (US-06). Name, photo and notification preference are editable; birth date and email are not (RN-04).
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
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
      <EditableProfile profile={profile.data} />
      <EmailVerificationBanner />
      <PermissionRow />
      <HistoryRow />
      <SignOutButton />
      <DeleteAccountEntry />
      {__DEV__ ? <DevSimulatePush /> : null}
    </ScrollView>
  );
}

type Notice = { variant: "error" | "success"; message: string };

function EditableProfile({ profile }: { profile: MyProfile }) {
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
          setNotice({ variant: "success", message: "Guardamos tus cambios." });
        },
        onError: (error) => setNotice({ variant: "error", message: ERRORS[toAppError(error).code].message }),
      }
    );
  };

  return (
    <>
      <Header name={[first_name, last_name].filter(Boolean).join(" ")} email={email} initials={initialsOf(first_name, last_name)} avatarUri={photoUri ?? avatarUrl(avatar_path)} />
      <View style={{ gap: spacing.lg }}>
        <Button title={avatar_path || photoUri ? "Cambiar foto de perfil" : "Agregar foto de perfil"} onPress={choosePhoto} variant="secondary" fullWidth testID="profile-photo-change" />
        <TextField label="Nombre" value={first} onChangeText={setFirst} error={errors.first_name?.[0]} autoCapitalize="words" autoComplete="given-name" testID="profile-first-name" />
        <TextField label="Apellido" value={last} onChangeText={setLast} error={errors.last_name?.[0]} autoCapitalize="words" autoComplete="family-name" testID="profile-last-name" />
        <NotificationPreference value={optIn} onChange={setOptIn} />
        {notice ? <FormMessage variant={notice.variant} message={notice.message} testID="profile-notice" /> : null}
        <Button
          title={update.isPending ? "Guardando…" : "Guardar cambios"}
          onPress={save}
          disabled={!dirty || !parsed.success || update.isPending}
          loading={update.isPending}
          fullWidth
          testID="profile-save"
        />
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

function NotificationPreference({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 48 }}>
      <View style={{ flex: 1, gap: spacing.xs / 2 }}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.textPrimary }]}>
          Preferencias de notificaciones
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
          Recibir promociones y avisos de tus negocios
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel="Preferencias de notificaciones"
        trackColor={{ true: colors.navy, false: colors.surfaceMuted }}
        thumbColor={colors.surface}
        testID="profile-push-opt-in"
      />
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
