import { ERRORS, resetPasswordSchema, type ResetPasswordValues } from "@ekko/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAuthApiError } from "@supabase/supabase-js";
import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { type ComponentRef, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ActivityIndicator, Text, TextInput } from "react-native";

import { useAuth } from "../auth/AuthProvider";
import { AuthLayout } from "../components/auth";
import { Button, FormMessage, PasswordField } from "../components/ui";
import { parseRecoveryParams } from "../features/auth/recoveryLink";
import { toAppError } from "../lib/appError";
import { supabase } from "../lib/supabase";
import { colors, MAX_FONT_SCALE, textStyles } from "../theme";

type LinkState = "checking" | "ready" | "expired";

/** Turns the F-05 deep link into a session. Without link params, an existing session can still set a password. */
function useRecoverySession(): LinkState {
  const params = useLocalSearchParams();
  const { status } = useAuth();
  const [exchanged, setExchanged] = useState<"ready" | "expired" | null>(null);
  const handled = useRef<string | null>(null);
  const link = parseRecoveryParams(params);
  const linkKey = JSON.stringify(link);

  useEffect(() => {
    // WHY: a PKCE code works once; re-running the effect (re-render, StrictMode) must not spend it again.
    if ((link.kind !== "code" && link.kind !== "tokens") || handled.current === linkKey) return;
    handled.current = linkKey;
    const exchange =
      link.kind === "code"
        ? supabase.auth.exchangeCodeForSession(link.code)
        : supabase.auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
    exchange
      .then(({ error }) => setExchanged(error ? "expired" : "ready"))
      // NOTE: expired, already used, or requested on another device (no PKCE verifier here) are all
      // expected and end in "Este enlace venció" with its way out, so they are not sent to Sentry.
      .catch(() => setExchanged("expired"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `link` is captured through linkKey.
  }, [linkKey]);

  if (link.kind === "invalid") return "expired";
  if (link.kind === "none") return status === "loading" ? "checking" : status === "signedIn" ? "ready" : "expired";
  return exchanged ?? "checking";
}

// F-05 "Nueva contraseña" (EN-06).
export default function ResetPasswordScreen() {
  const router = useRouter();
  const state = useRecoverySession();

  return (
    <AuthLayout testID="reset-password-screen" title={state === "expired" ? "Este enlace venció" : "Nueva contraseña"}>
      {state === "checking" ? <ActivityIndicator color={colors.primary} accessibilityLabel="Revisando el enlace" /> : null}
      {state === "expired" ? (
        <>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.textPrimary }]}>
            Pide un enlace nuevo para restablecer tu contraseña. Cada enlace vence en 1 hora y solo funciona una vez.
          </Text>
          <Button title="Pedir otro enlace" onPress={() => router.replace("/recover")} fullWidth testID="reset-password-request-new" />
        </>
      ) : null}
      {state === "ready" ? <NewPasswordForm onDone={() => router.replace("/")} /> : null}
    </AuthLayout>
  );
}

function NewPasswordForm({ onDone }: { onDone: () => void }) {
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [errorMessage, setErrorMessage] = useState<{ text: string; retry: boolean } | null>(null);
  const { control, handleSubmit } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const update = useMutation({
    mutationFn: async ({ password }: ResetPasswordValues) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onMutate: () => setErrorMessage(null),
    onError: (error) => {
      if (isAuthApiError(error) && error.code === "same_password") {
        setErrorMessage({ text: "Usa una contraseña distinta a la anterior.", retry: false });
        return;
      }
      const { code } = toAppError(error);
      setErrorMessage({ text: ERRORS[code].message, retry: code === "E-01" || code === "E-99" });
    },
  });
  const submit = handleSubmit((values) => update.mutate(values));

  if (update.isSuccess) {
    return (
      <>
        <FormMessage variant="success" message="Tu contraseña se actualizó." testID="reset-password-done" />
        {/* The gate decides where "/" lands: the app, or A-04 if the profile is incomplete. */}
        <Button title="Continuar" onPress={onDone} fullWidth testID="reset-password-continue" />
      </>
    );
  }

  return (
    <>
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <PasswordField
            label="Nueva contraseña"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            placeholder="Mínimo 8 caracteres"
            accessibilityHint="Mínimo 8 caracteres"
            textContentType="newPassword"
            autoComplete="new-password"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => confirmRef.current?.focus()}
            testID="reset-password-password"
          />
        )}
      />
      <Controller
        control={control}
        name="confirm"
        render={({ field, fieldState }) => (
          <PasswordField
            ref={confirmRef}
            label="Confirmar contraseña"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            textContentType="newPassword"
            autoComplete="new-password"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            testID="reset-password-confirm"
          />
        )}
      />
      {errorMessage ? (
        <FormMessage
          variant="error"
          message={errorMessage.text}
          actionLabel={errorMessage.retry ? "Reintentar" : undefined}
          onAction={errorMessage.retry ? submit : undefined}
          testID="reset-password-error"
        />
      ) : null}
      <Button title="Guardar contraseña" onPress={submit} loading={update.isPending} fullWidth testID="reset-password-submit" />
    </>
  );
}
