import { ERRORS, type ErrorCode } from "@ekko/shared";
import { isAuthApiError } from "@supabase/supabase-js";
import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";

import { useAuth } from "../auth/AuthProvider";
import { AuthLayout } from "../components/auth";
import { Check } from "../components/icons";
import { Entrance } from "../components/motion";
import { Button, CodeField, FormMessage } from "../components/ui";
import { useMyProfile, useVerifyEmailCode } from "../features/auth/account";
import {
  needsEmailVerification,
  useIsSendingVerificationCode,
  useSendVerificationCode,
  verificationCooldown,
} from "../features/auth/emailVerification";
import { TextLink } from "../features/auth/TextLink";
import { toAppError } from "../lib/appError";
import { useCooldown } from "../lib/cooldown";
import * as haptics from "../lib/haptics";
import { colors, MAX_FONT_SCALE, spacing, textStyles } from "../theme";

const WRONG_CODE = "Código incorrecto o vencido";
const CODE_LENGTH = 6;
const LEAVE_AFTER_MS = 1500; // Long enough to read "Correo verificado" (brief §5.5 toast).

// A-05 Verifica tu correo (F-02 K→L, F-04, ADR-14).
export default function VerifyEmailScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const profile = useMyProfile();
  const verify = useVerifyEmailCode();
  const send = useSendVerificationCode();
  const sending = useIsSendingVerificationCode();
  const cooldown = useCooldown(verificationCooldown);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string>();
  const [formError, setFormError] = useState<{ code: ErrorCode; retry: () => void } | null>(null);
  const email = profile.data?.email ?? session?.user.email ?? "";

  const leave = useCallback(() => (router.canGoBack() ? router.back() : router.replace("/")), [router]);

  useEffect(() => {
    if (!verify.isSuccess) return;
    haptics.success();
    const timer = setTimeout(leave, LEAVE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [verify.isSuccess, leave]);

  // F-03: verified (or Google/Apple) accounts have nothing to do here, e.g. after a stale deep link.
  if (verify.isIdle && profile.data && !needsEmailVerification(profile.data)) return <Redirect href="/" />;

  const submitCode = (token: string) => {
    setCodeError(undefined);
    setFormError(null);
    verify.mutate(
      { email, token },
      {
        onError: (error) => {
          // WHY: Auth answers 4xx for a wrong or expired OTP; the user just types the new one.
          if (isAuthApiError(error) && error.status !== 429) {
            setCodeError(WRONG_CODE);
            setCode("");
          } else {
            setFormError({ code: toAppError(error).code, retry: () => submitCode(token) });
          }
        },
      }
    );
  };

  const resend = () => {
    setFormError(null);
    send.mutate(email, { onError: (error) => setFormError({ code: toAppError(error).code, retry: resend }) });
  };

  const resendTitle =
    cooldown.secondsLeft > 0 ? `Reenviar en ${cooldown.secondsLeft} s` : cooldown.started ? "Reenviar código" : "Enviar código";
  const retryable = formError && (formError.code === "E-01" || formError.code === "E-99");

  return (
    <AuthLayout
      testID="verify-email-screen"
      title="Verifica tu correo"
      subtitle="Para girar la ruleta y canjear tus premios."
      footer={verify.isSuccess ? null : <TextLink label="Continuar sin verificar" onPress={leave} testID="verify-email-skip" />}
    >
      <FormMessage
        variant="info"
        message={
          cooldown.started
            ? `Enviamos un código de 6 dígitos a ${email}. Escríbelo aquí.`
            : `Toca "Enviar código" y te mandaremos un código de 6 dígitos a ${email}.`
        }
        testID="verify-email-instructions"
      />
      <CodeField
        value={code}
        onChangeText={(next) => {
          setCode(next);
          if (codeError) setCodeError(undefined);
        }}
        onComplete={submitCode}
        error={codeError}
        editable={!verify.isPending && !verify.isSuccess}
        autoFocus
        testID="verify-email-code"
      />
      {verify.isSuccess ? <VerifiedCelebration /> : null}
      {formError ? (
        <FormMessage
          variant="error"
          message={ERRORS[formError.code].message}
          actionLabel={retryable ? "Reintentar" : undefined}
          onAction={retryable ? formError.retry : undefined}
          testID="verify-email-error"
        />
      ) : null}
      {verify.isSuccess ? null : (
        <>
          {/* A-14: once a code was sent the main action is "Verificar"; resending is secondary. */}
          {cooldown.started ? (
            <Button
              title="Verificar"
              onPress={() => submitCode(code)}
              loading={verify.isPending}
              disabled={code.length < CODE_LENGTH || !email}
              fullWidth
              testID="verify-email-submit"
            />
          ) : null}
          <Button
            title={resendTitle}
            variant={cooldown.started ? "secondary" : "primary"}
            onPress={resend}
            loading={sending}
            disabled={cooldown.secondsLeft > 0 || verify.isPending || !email}
            fullWidth
            testID="verify-email-resend"
          />
        </>
      )}
    </AuthLayout>
  );
}

// A-15: celebrates the verification and says what it unlocks.
function VerifiedCelebration() {
  return (
    <View style={{ alignItems: "center", gap: spacing.md }} testID="verify-email-success" accessibilityLiveRegion="polite">
      <Entrance from={0.6} spring>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
          <Check color={colors.surface} size={34} />
        </View>
      </Entrance>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.h2, { color: colors.textPrimary }]}>
        Correo verificado
      </Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.textSecondary, textAlign: "center" }]}>
        Ya puedes girar la ruleta y canjear tus premios.
      </Text>
    </View>
  );
}
