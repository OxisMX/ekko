import { ERRORS, signInSchema, type SignInValues } from "@ekko/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAuthApiError } from "@supabase/supabase-js";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { type ComponentRef, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { TextInput } from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import { AuthLayout } from "../../components/auth";
import { Button, FormMessage, PasswordField, TextField } from "../../components/ui";
import { TextLink } from "../../features/auth/TextLink";
import { toAppError } from "../../lib/appError";
import { supabase } from "../../lib/supabase";

type FormError = { message: string; retry: boolean };

function describeSignInError(error: unknown): FormError {
  // WHY: one message for unknown email and wrong password, so the form never reveals accounts.
  if (isAuthApiError(error) && error.code === "invalid_credentials") {
    return { message: "Correo o contraseña incorrectos.", retry: false };
  }
  const { code } = toAppError(error);
  return { message: ERRORS[code].message, retry: code === "E-01" || code === "E-99" };
}

// A-02 (brief §4.2). Google/Apple buttons arrive with F-03 in a later sprint.
export default function LoginScreen() {
  const router = useRouter();
  const { status, errorCode } = useAuth();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [formError, setFormError] = useState<FormError | null>(null);
  const { control, handleSubmit } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const signIn = useMutation({
    mutationFn: async (values: SignInValues) => {
      const { error } = await supabase.auth.signInWithPassword(values);
      if (error) throw error;
    },
    onMutate: () => setFormError(null),
    onError: (error) => setFormError(describeSignInError(error)),
  });

  const submit = handleSubmit((values) => signIn.mutate(values));
  // NOTE: once signed in the gate is loading the profile; keep the button busy until it moves on.
  const busy = signIn.isPending || status === "signedIn";

  return (
    <AuthLayout
      testID="login-screen"
      title="Iniciar sesión"
      subtitle="Tus sellos y recompensas, en un solo lugar."
      footer={<TextLink label="¿No tienes cuenta? Crear cuenta" onPress={() => router.push("/register")} testID="login-register" />}
    >
      {errorCode ? <FormMessage variant="error" message={ERRORS[errorCode].message} testID="login-auth-error" /> : null}
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
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
            testID="login-email"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field, fieldState }) => (
          <PasswordField
            ref={passwordRef}
            label="Contraseña"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            returnKeyType="go"
            onSubmitEditing={() => void submit()}
            testID="login-password"
          />
        )}
      />
      {formError ? (
        <FormMessage
          variant="error"
          message={formError.message}
          actionLabel={formError.retry ? "Reintentar" : undefined}
          onAction={formError.retry ? submit : undefined}
          testID="login-error"
        />
      ) : null}
      <Button title="Entrar" onPress={submit} loading={busy} fullWidth testID="login-submit" />
      <TextLink label="¿Olvidaste tu contraseña?" onPress={() => router.push("/recover")} testID="login-recover" />
    </AuthLayout>
  );
}
