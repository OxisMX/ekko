import { isAuthApiError } from "@supabase/supabase-js";
import { useIsMutating, useMutation } from "@tanstack/react-query";

import { createCooldown } from "../../lib/cooldown";
import { supabase } from "../../lib/supabase";
import type { MyProfile } from "./account";

const RESEND_SECONDS = 60; // Server rule: one Auth email every 60 s per address.
const SEND_CODE_KEY = ["send-verification-code"] as const;

/** Shared by A-05 and the F-04 banner so neither can send while the other is cooling down. */
export const verificationCooldown = createCooldown();

/** F-03: Google/Apple accounts count as verified and never see A-05 or the banner. */
export function needsEmailVerification(profile: Pick<MyProfile, "auth_provider" | "email_verified"> | undefined): boolean {
  return profile?.auth_provider === "email" && !profile.email_verified;
}

/** Seconds Auth asks us to wait on a 429 ("…only request this after 42 seconds."), or null. */
export function retryAfterSeconds(error: unknown): number | null {
  if (!isAuthApiError(error) || error.status !== 429) return null;
  const seconds = Number(/(\d+)\s*seconds?/i.exec(error.message)?.[1]);
  return seconds > 0 ? seconds : RESEND_SECONDS;
}

/** ADR-14: Supabase's native email (6-digit code + link) for an existing account. */
export async function sendVerificationCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) {
    const wait = retryAfterSeconds(error);
    if (wait !== null) {
      // NOTE: a 429 means a code went out recently; just wait it out, no error to show.
      verificationCooldown.start(wait);
      return;
    }
    throw error;
  }
  verificationCooldown.start(RESEND_SECONDS);
}

export function useSendVerificationCode() {
  return useMutation({ mutationKey: SEND_CODE_KEY, mutationFn: sendVerificationCode });
}

/** True while A-05 or the banner is sending, so the other one shows "Enviando…" too. */
export function useIsSendingVerificationCode(): boolean {
  return useIsMutating({ mutationKey: SEND_CODE_KEY }) > 0;
}
