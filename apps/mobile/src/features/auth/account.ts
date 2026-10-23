import type { CompleteProfileValues, RegisterValues } from "@ekko/shared";
import { AuthApiError } from "@supabase/supabase-js";
import { useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../auth/AuthProvider";
import { toAppError } from "../../lib/appError";
import { supabase } from "../../lib/supabase";
import { sendVerificationCode } from "./emailVerification";

// Backend §4.1 get_my_profile.
export type MyProfile = {
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  email: string | null;
  auth_provider: string;
  email_verified: boolean;
  profile_complete: boolean;
  avatar_path: string | null;
  push_opt_in: boolean;
};

export const MY_PROFILE_KEY = ["my-profile"] as const;
export const REGISTER_MUTATION_KEY = ["register"] as const;

export function useMyProfile() {
  const { status, session } = useAuth();
  return useQuery({
    // WHY: keyed by user so a cached profile can never answer for the next account.
    queryKey: [...MY_PROFILE_KEY, session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_profile");
      if (error) throw error;
      return data as unknown as MyProfile;
    },
    enabled: status === "signedIn",
  });
}

async function completeProfile({ first_name, last_name, birth_date }: CompleteProfileValues): Promise<void> {
  const { error } = await supabase.rpc("complete_profile", {
    p_first_name: first_name,
    p_last_name: last_name,
    p_birth_date: birth_date,
  });
  if (error) throw error;
}

export function useCompleteProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeProfile,
    // NOTE: awaited, so the button stays busy until the fresh profile moves the gate (no flash).
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_PROFILE_KEY }),
  });
}

/** F-02: signUp, then complete_profile with the same names and date. */
export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: REGISTER_MUTATION_KEY,
    mutationFn: async (values: RegisterValues) => {
      const { data, error } = await supabase.auth.signUp({ email: values.email, password: values.password });
      if (error) throw error;
      // WHY: with email confirmations on, Auth hides an existing account as a user without identities.
      if (data.user?.identities?.length === 0) throw new AuthApiError("User already registered", 422, "user_already_exists");
      await completeProfile(values);
      // F-02 K: the first code goes out on its own. WHY not thrown: the account exists already, and
      // A-05 offers "Enviar código" when no send started the cooldown. toAppError reports E-99 only.
      await sendVerificationCode(values.email).catch((error: unknown) => void toAppError(error));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: MY_PROFILE_KEY }),
  });
}

/** F-02 K: a sign-up finished in this session (the mutation cache is cleared on sign-out). */
export function useJustSignedUp(): boolean {
  return useMutationState({ filters: { mutationKey: REGISTER_MUTATION_KEY, status: "success" } }).length > 0;
}

/**
 * Names/date typed in A-03 when complete_profile failed after signUp, so A-04 can prefill them
 * (no data loss). Lives in the memory-only mutation cache, cleared on sign-out.
 */
export function useRegisterDraft(): Partial<CompleteProfileValues> | undefined {
  const drafts = useMutationState({
    filters: { mutationKey: REGISTER_MUTATION_KEY },
    select: (mutation) => mutation.state.variables as RegisterValues | undefined,
  });
  const last = drafts.at(-1);
  return last && { first_name: last.first_name, last_name: last.last_name, birth_date: last.birth_date };
}

export function useVerifyEmailCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, token }: { email: string; token: string }) => {
      // ADR-14: this OTP sign-in fires the trigger that sets email_verified_at.
      const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
      if (error) throw error;
    },
    // NOTE: awaited, so the success message only shows once the banner's profile is fresh.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: MY_PROFILE_KEY }),
  });
}
