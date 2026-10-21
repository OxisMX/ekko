import { completeProfileSchema, type CompleteProfileInput, type CompleteProfileValues, ERRORS, type ErrorCode, localToday } from "@ekko/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ComponentRef, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, TextInput } from "react-native";

import { useAuth } from "../auth/AuthProvider";
import { AuthLayout } from "../components/auth";
import { Button, DateField, FormMessage, TextField } from "../components/ui";
import { formatCalendarDate } from "../components/ui/DateField";
import { type MyProfile, useCompleteProfile, useMyProfile, useRegisterDraft } from "../features/auth/account";
import { TextLink } from "../features/auth/TextLink";
import { toAppError } from "../lib/appError";
import { fromIsoDate, toIsoDate } from "../lib/calendarDate";
import { reportError } from "../lib/sentry";
import { colors } from "../theme";

const FIELDS = ["first_name", "last_name", "birth_date"] as const;

// A-04 (RN-02, RN-03, RN-04): fills what the account is missing before entering the app.
export default function CompleteProfileScreen() {
  const { signOut } = useAuth();
  const profile = useMyProfile();
  const draft = useRegisterDraft();
  const signOutLink = (
    <TextLink label="Cerrar sesión" onPress={() => void signOut().catch(reportError)} testID="complete-profile-sign-out" />
  );

  return (
    <AuthLayout testID="complete-profile-screen" title="Completa tu perfil" subtitle="Solo falta un paso." footer={signOutLink}>
      {profile.data ? (
        <CompleteProfileForm profile={profile.data} draft={draft} />
      ) : profile.isError ? (
        <ProfileLoadError key={profile.errorUpdatedAt} error={profile.error} onRetry={() => void profile.refetch()} />
      ) : (
        <ActivityIndicator color={colors.primary} accessibilityLabel="Cargando tu perfil" />
      )}
    </AuthLayout>
  );
}

function ProfileLoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  // WHY: computed once per error (keyed by the parent) so an E-99 is reported once, not on every render.
  const [code] = useState(() => toAppError(error).code);
  return (
    <FormMessage variant="error" message={ERRORS[code].message} actionLabel="Reintentar" onAction={onRetry} testID="complete-profile-load-error" />
  );
}

type FormProps = { profile: MyProfile; draft: Partial<CompleteProfileValues> | undefined };

function CompleteProfileForm({ profile, draft }: FormProps) {
  const { signOut } = useAuth();
  const lastNameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);
  // RN-04: once set, only Oxis support can change it, so it is shown but not editable.
  const birthDateLocked = profile.birth_date !== null;
  const { control, handleSubmit, setError } = useForm<CompleteProfileInput, unknown, CompleteProfileValues>({
    resolver: zodResolver(completeProfileSchema),
    defaultValues: {
      first_name: profile.first_name ?? draft?.first_name ?? "",
      last_name: profile.last_name ?? draft?.last_name ?? "",
      birth_date: profile.birth_date ?? draft?.birth_date ?? "",
    },
  });

  const completeProfile = useCompleteProfile();
  const submit = handleSubmit((values) => {
    setErrorCode(null);
    completeProfile.mutate(values, {
      onError: (error) => {
        const { code, details } = toAppError(error);
        const field = FIELDS.find((name) => name === details?.field);
        if (code === "E-23" && field) setError(field, { message: ERRORS["E-23"].message }, { shouldFocus: true });
        else setErrorCode(code);
      },
    });
  });
  const lockedDate = profile.birth_date ? fromIsoDate(profile.birth_date) : null;
  const signOutAction = { actionLabel: "Cerrar sesión", onAction: () => void signOut().catch(reportError) };
  const retryAction = { actionLabel: "Reintentar", onAction: submit };

  return (
    <>
      <Controller
        control={control}
        name="first_name"
        render={({ field, fieldState }) => (
          <TextField
            label="Nombre"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            textContentType="givenName"
            autoComplete="given-name"
            autoCapitalize="words"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => lastNameRef.current?.focus()}
            testID="complete-profile-first-name"
          />
        )}
      />
      <Controller
        control={control}
        name="last_name"
        render={({ field, fieldState }) => (
          <TextField
            ref={lastNameRef}
            label="Apellido"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            textContentType="familyName"
            autoComplete="family-name"
            autoCapitalize="words"
            returnKeyType="done"
            testID="complete-profile-last-name"
          />
        )}
      />
      {birthDateLocked && lockedDate ? (
        <TextField
          label="Fecha de nacimiento"
          value={formatCalendarDate(lockedDate)}
          editable={false}
          accessibilityHint="Para corregirla, contacta a soporte."
          testID="complete-profile-birth-date-readonly"
        />
      ) : (
        <Controller
          control={control}
          name="birth_date"
          render={({ field, fieldState }) => (
            <DateField
              label="Fecha de nacimiento"
              value={fromIsoDate(field.value)}
              onChange={(date) => field.onChange(toIsoDate(date))}
              maximumDate={fromIsoDate(localToday(new Date())) ?? new Date()}
              error={fieldState.error?.message}
              testID="complete-profile-birth-date"
            />
          )}
        />
      )}
      {errorCode ? (
        <FormMessage
          variant="error"
          message={ERRORS[errorCode].message}
          // F-03: E-07 and E-19 end in "Cerrar sesión"; transient errors offer a retry (RR-5).
          {...(errorCode === "E-07" || errorCode === "E-19" ? signOutAction : errorCode === "E-01" || errorCode === "E-99" ? retryAction : {})}
          testID="complete-profile-error"
        />
      ) : null}
      <Button title="Continuar" onPress={submit} loading={completeProfile.isPending} fullWidth testID="complete-profile-submit" />
    </>
  );
}
