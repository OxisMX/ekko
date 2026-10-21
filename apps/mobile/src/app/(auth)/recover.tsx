import { ERRORS, recoverSchema, type RecoverValues } from "@ekko/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { AuthLayout } from "../../components/auth";
import { Button, FormMessage, TextField } from "../../components/ui";
import { TextLink } from "../../features/auth/TextLink";
import { toAppError } from "../../lib/appError";
import { supabase } from "../../lib/supabase";

const COOLDOWN_SECONDS = 60;
const GENERIC_SENT = "Si el correo existe, recibirás un enlace para restablecer tu contraseña.";

function useCooldown() {
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);
  return { secondsLeft, start: () => setSecondsLeft(COOLDOWN_SECONDS) };
}

// A-06 / F-05 (US-03).
export default function RecoverScreen() {
  const router = useRouter();
  const cooldown = useCooldown();
  const [result, setResult] = useState<"sent" | "offline" | null>(null);
  const { control, handleSubmit } = useForm<RecoverValues>({
    resolver: zodResolver(recoverSchema),
    defaultValues: { email: "" },
  });

  const request = useMutation({
    mutationFn: async ({ email }: RecoverValues) => {
      // The link opens reset-password in this app (ekko://reset-password, exp://…/--/reset-password in dev).
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: Linking.createURL("reset-password") });
      if (error) throw error;
    },
    onSuccess: () => {
      setResult("sent");
      cooldown.start();
    },
    onError: (error) => {
      // WHY: same message whatever Auth answers, so the screen never reveals whether an account
      // exists (F-05 step C). Only a dropped connection differs: nothing was sent, so offer a retry.
      const offline = toAppError(error).code === "E-01";
      setResult(offline ? "offline" : "sent");
      if (!offline) cooldown.start();
    },
  });

  const submit = handleSubmit((values) => request.mutate(values));
  const waiting = cooldown.secondsLeft > 0;

  return (
    <AuthLayout
      testID="recover-screen"
      title="Recuperar contraseña"
      subtitle="Te enviaremos un enlace a tu correo."
      footer={<TextLink label="Volver a iniciar sesión" onPress={() => router.replace("/login")} testID="recover-login" />}
    >
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            label="Correo electrónico"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="send"
            onSubmitEditing={waiting ? undefined : () => void submit()}
            testID="recover-email"
          />
        )}
      />
      {result === "sent" ? <FormMessage variant="info" message={GENERIC_SENT} testID="recover-sent" /> : null}
      {result === "offline" ? (
        <FormMessage variant="error" message={ERRORS["E-01"].message} actionLabel="Reintentar" onAction={submit} testID="recover-error" />
      ) : null}
      <Button
        title={waiting ? `Reenviar en ${cooldown.secondsLeft} s` : result === "sent" ? "Reenviar enlace" : "Enviar enlace"}
        onPress={submit}
        loading={request.isPending}
        disabled={waiting}
        fullWidth
        testID="recover-submit"
      />
    </AuthLayout>
  );
}
