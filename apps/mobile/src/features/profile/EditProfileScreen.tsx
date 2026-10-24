import { completeProfileSchema, ERRORS } from "@ekko/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { z } from "zod";

import { formatDate } from "../../components/format";
import { Button, ErrorState, FormMessage, Skeleton, TextField, Toast } from "../../components/ui";
import { toAppError } from "../../lib/appError";
import { colors, fontFamily, MAX_FONT_SCALE, spacing, textStyles } from "../../theme";
import { type MyProfile, useMyProfile } from "../auth/account";
import { usePushPermission } from "./notificationsPermission";
import { AvatarPermissionError, avatarUrl, pickAvatar, useUpdateProfile } from "./profileEdit";
import { Avatar, initialsOf, Row, Section } from "./profileParts";

const LOCKED_NOTE = "No se puede cambiar";
const SAVED_TOAST_MS = 1500;
const nameFieldsSchema = completeProfileSchema.pick({ first_name: true, last_name: true });
const PERMISSION_DENIED_MESSAGE = "Para elegir una foto, permite el acceso a tus fotos en los ajustes del teléfono.";

// Editar perfil (US-06). Name, photo and notification preference are editable; birth date and email are not (RN-04).
export function EditProfileScreen() {
  const profile = useMyProfile();
  if (profile.isError) return <ErrorState onRetry={() => void profile.refetch()} title="Algo salió mal" message="No pudimos cargar tu perfil. Inténtalo de nuevo." testID="edit-profile-error" />;
  if (!profile.data) {
    return (
      <View accessible accessibilityLabel="Cargando perfil" testID="edit-profile-loading" style={{ padding: spacing.lg, gap: spacing.lg }}>
        <Skeleton height={72} radius={16} />
        <Skeleton height={160} radius={16} />
      </View>
    );
  }
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
      <EditableProfile profile={profile.data} />
    </ScrollView>
  );
}

type Notice = { variant: "error"; message: string };

function EditableProfile({ profile }: { profile: MyProfile }) {
  const router = useRouter();
  const { first_name, last_name, birth_date, email, email_verified, avatar_path, push_opt_in } = profile;
  const [first, setFirst] = useState(first_name ?? "");
  const [last, setLast] = useState(last_name ?? "");
  const [optIn, setOptIn] = useState(push_opt_in);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saved, setSaved] = useState(false);
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
        onSuccess: () => setSaved(true),
        onError: (error) => setNotice({ variant: "error", message: ERRORS[toAppError(error).code].message }),
      }
    );
  };

  return (
    <>
      <View style={{ alignItems: "center", gap: spacing.md }}>
        <Avatar uri={photoUri ?? avatarUrl(avatar_path)} initials={initialsOf(first_name, last_name)} />
        <Button title={avatar_path || photoUri ? "Cambiar foto de perfil" : "Agregar foto de perfil"} onPress={choosePhoto} variant="secondary" fullWidth testID="profile-photo-change" />
      </View>
      <TextField label="Nombre" value={first} onChangeText={setFirst} error={errors.first_name?.[0]} autoCapitalize="words" autoComplete="given-name" testID="profile-first-name" />
      <TextField label="Apellido" value={last} onChangeText={setLast} error={errors.last_name?.[0]} autoCapitalize="words" autoComplete="family-name" testID="profile-last-name" />
      <NotificationsSection value={optIn} onChange={setOptIn} />
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
      {notice ? <FormMessage variant={notice.variant} message={notice.message} testID="profile-notice" /> : null}
      {dirty ? (
        <Button
          title={update.isPending ? "Guardando…" : "Guardar cambios"}
          onPress={save}
          disabled={!parsed.success || update.isPending || saved}
          loading={update.isPending}
          fullWidth
          testID="profile-save"
        />
      ) : null}
      {/* A-79: success is a transient toast; going back afterwards shows the refreshed profile. */}
      {saved ? <Toast title="Cambios guardados" message="Actualizamos tu perfil." durationMs={SAVED_TOAST_MS} onDismiss={() => router.back()} testID="profile-saved-toast" /> : null}
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
