import { ERRORS, type ErrorCode } from "@ekko/shared";
import { isAuthApiError } from "@supabase/supabase-js";
import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../auth/AuthProvider";
import { AuthLayout } from "../components/auth";
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

const WRONG_CODE = "Código incorrecto o vencido";
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
      {verify.isSuccess ? <FormMessage variant="success" message="Correo verificado" testID="verify-email-success" /> : null}
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
        <Button
          title={resendTitle}
          variant="secondary"
          onPress={resend}
          loading={sending}
          disabled={cooldown.secondsLeft > 0 || verify.isPending || !email}
          fullWidth
          testID="verify-email-resend"
        />
      )}
    </AuthLayout>
  );
}
