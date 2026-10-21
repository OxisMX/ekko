import { ERRORS, type ErrorCode } from "@ekko/shared";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import { FormMessage, VerificationBanner } from "../../components/ui";
import { toAppError } from "../../lib/appError";
import { useCooldown } from "../../lib/cooldown";
import { spacing } from "../../theme";
import { useMyProfile } from "./account";
import { needsEmailVerification, useIsSendingVerificationCode, useSendVerificationCode, verificationCooldown } from "./emailVerification";

/**
 * F-04 / brief §5.5: shown while an email account is unverified. NOTE: the profile query refetches
 * when the app returns to the foreground (lib/queryClient focusManager, RR-4), so a code entered or a
 * link opened elsewhere hides this on return.
 */
export function EmailVerificationBanner() {
  const router = useRouter();
  const { session } = useAuth();
  const profile = useMyProfile();
  const send = useSendVerificationCode();
  const sending = useIsSendingVerificationCode();
  const { secondsLeft } = useCooldown(verificationCooldown);
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);

  const email = profile.data?.email ?? session?.user.email;
  if (!needsEmailVerification(profile.data) || !email) return null;

  const resend = () => {
    setErrorCode(null);
    send.mutate(email, { onError: (error) => setErrorCode(toAppError(error).code) });
  };

  return (
    <View testID="email-verification-banner">
      <VerificationBanner
        onResend={resend}
        onEnterCode={() => router.push("/verify-email")}
        cooldownSeconds={secondsLeft}
        sending={sending}
      />
      {errorCode ? (
        <FormMessage
          variant="error"
          message={ERRORS[errorCode].message}
          style={{ marginHorizontal: spacing.lg, marginTop: spacing.sm }}
          testID="email-verification-banner-error"
        />
      ) : null}
    </View>
  );
}
