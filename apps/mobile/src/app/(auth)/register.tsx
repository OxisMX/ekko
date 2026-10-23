import { ERRORS, localToday, registerSchema, type RegisterInput, type RegisterValues } from "@ekko/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { type ComponentRef, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Switch, Text, TextInput, View } from "react-native";

import { AuthLayout, SocialButtons } from "../../components/auth";
import { Button, DateField, FormMessage, PasswordField, TextField } from "../../components/ui";
import { FieldError } from "../../components/ui/TextField";
import { useRegister } from "../../features/auth/account";
import { TextLink } from "../../features/auth/TextLink";
import { toAppError } from "../../lib/appError";
import { fromIsoDate, toIsoDate } from "../../lib/calendarDate";
import { reportError } from "../../lib/sentry";
import { colors, MAX_FONT_SCALE, spacing, textStyles } from "../../theme";

// TODO(legal, PRD 12.1): confirm the final privacy notice URL before release.
const PRIVACY_URL = "https://ekko.oxis.mx/privacidad";

// A-03 / F-02 (US-01). On success the gate takes the user to A-05 (GatedStack afterSignUp).
export default function RegisterScreen() {
  const router = useRouter();
  const lastNameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [errorCode, setErrorCode] = useState<keyof typeof ERRORS | null>(null);
  const { control, handleSubmit, getValues } = useForm<RegisterInput, unknown, RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { first_name: "", last_name: "", email: "", password: "", birth_date: "", privacy_accepted: false },
  });

  const register = useRegister();
  // NOTE: the age check runs inside registerSchema (E-07 at the date field), before signUp.
  const submit = handleSubmit((values) => {
    setErrorCode(null);
    register.mutate(values, { onError: (error) => setErrorCode(toAppError(error).code) });
  });
  const maximumDate = fromIsoDate(localToday(new Date())) ?? new Date();

  return (
    <AuthLayout testID="register-screen" title="Crear cuenta" subtitle="Junta sellos y gana recompensas.">
      <SocialButtons testIDPrefix="register" />
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
            testID="register-first-name"
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
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => emailRef.current?.focus()}
            testID="register-last-name"
          />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField
            ref={emailRef}
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
            testID="register-email"
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
            // The rule stays visible as a hint until it turns into an error.
            error={fieldState.error?.message}
            accessibilityHint="Mínimo 8 caracteres"
            placeholder="Mínimo 8 caracteres"
            textContentType="newPassword"
            autoComplete="new-password"
            returnKeyType="done"
            testID="register-password"
          />
        )}
      />
      <Controller
        control={control}
        name="birth_date"
        render={({ field, fieldState }) => (
          <DateField
            label="Fecha de nacimiento"
            value={fromIsoDate(field.value)}
            onChange={(date) => field.onChange(toIsoDate(date))}
            maximumDate={maximumDate}
            error={fieldState.error?.message}
            testID="register-birth-date"
          />
        )}
      />
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary }]}>
        Solo para mayores de 18 años.
      </Text>
      <Controller
        control={control}
        name="privacy_accepted"
        render={({ field, fieldState }) => (
          <View style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 44 }}>
              <Switch
                value={field.value}
                onValueChange={field.onChange}
                accessibilityLabel="Acepto el aviso de privacidad"
                accessibilityHint={fieldState.error?.message}
                trackColor={{ true: colors.primary }}
                testID="register-privacy"
              />
              <Text
                maxFontSizeMultiplier={MAX_FONT_SCALE}
                importantForAccessibility="no"
                style={[textStyles.secondary, { flex: 1, color: colors.textPrimary }]}
                onPress={() => field.onChange(!field.value)}
              >
                Acepto el aviso de privacidad
              </Text>
            </View>
            <TextLink
              label="Leer el aviso de privacidad"
              accessibilityRole="link"
              onPress={() => void Linking.openURL(PRIVACY_URL).catch(reportError)}
              testID="register-privacy-link"
            />
            <FieldError error={fieldState.error?.message} />
          </View>
        )}
      />
      {errorCode === "E-20" ? (
        <View style={{ gap: spacing.xs }}>
          <FormMessage
            variant="error"
            message={ERRORS["E-20"].message}
            actionLabel="Iniciar sesión"
            onAction={() => router.replace("/login")}
            testID="register-error"
          />
          {/* NOTE: FormMessage takes a single action; the second E-20 option sits right below it. */}
          <TextLink
            label="Recuperar contraseña"
            onPress={() => router.replace({ pathname: "/recover", params: { email: getValues("email").trim() } })}
            testID="register-recover"
          />
        </View>
      ) : errorCode ? (
        <FormMessage
          variant="error"
          message={ERRORS[errorCode].message}
          actionLabel={errorCode === "E-01" || errorCode === "E-99" ? "Reintentar" : undefined}
          onAction={errorCode === "E-01" || errorCode === "E-99" ? submit : undefined}
          testID="register-error"
        />
      ) : null}
      <Button title="Crear cuenta" onPress={submit} loading={register.isPending} fullWidth testID="register-submit" />
      <TextLink label="¿Ya tienes cuenta? Inicia sesión" onPress={() => router.replace("/login")} testID="register-login" />
    </AuthLayout>
  );
}
