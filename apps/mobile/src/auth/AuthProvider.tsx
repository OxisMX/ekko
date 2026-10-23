import type { ErrorCode } from "@ekko/shared";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { takePendingPush } from "../features/notifications/pushNavigation";
import { takePendingVisit } from "../features/visit/pendingVisit";
import { clearSocialNameDraft } from "../features/auth/socialSignIn";
import { signOutDevice } from "../features/auth/deviceRegistration";
import { reportError } from "../lib/sentry";
import { supabase } from "../lib/supabase";
import { isCustomerSession } from "./roleGuard";

export type AuthStatus = "loading" | "signedOut" | "signedIn";
export type AuthErrorCode = Extract<ErrorCode, "E-18" | "E-19">;

export type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  errorCode: AuthErrorCode | null;
  signOut: () => Promise<void>;
  /** F-15: the account no longer exists server-side; true on A-02 until the next sign-in. */
  accountDeleted: boolean;
  /** F-15: local cleanup after delete-account succeeded (no sign_out_device: the user is gone). */
  finishAccountDeletion: () => Promise<void>;
  /** Server says the session is no longer valid for this app (E-18/E-19): sign out and show why. */
  endSession: (code: AuthErrorCode) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null);
  // WHY: SIGNED_OUT does not say who caused it; E-18 is only for sign-outs the app did not ask for.
  const expectingSignOut = useRef(false);
  const signedIn = useRef(false);
  const [accountDeleted, setAccountDeleted] = useState(false);

  const signOut = useCallback(async () => {
    // WHY: single point for F-16 (also reached by endSession, E-18/E-19). The device must be released
    // while the JWT is still valid, so it goes first; it is best effort so a network failure never
    // traps the user in the app. The cache is cleared by the SIGNED_OUT listener below.
    await signOutDevice().catch(reportError);
    expectingSignOut.current = true;
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
  }, []);

  const finishAccountDeletion = useCallback(async () => {
    // WHY: the JWT's user is gone, so sign_out_device would fail; and no pending visit/push may leak
    // to whoever signs in next on this phone.
    takePendingVisit();
    takePendingPush();
    setAccountDeleted(true);
    expectingSignOut.current = true;
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
  }, []);

  const endSession = useCallback(
    (code: AuthErrorCode) => {
      setErrorCode(code);
      void signOut().catch(reportError);
    },
    [signOut],
  );

  useEffect(() => {
    // NOTE: INITIAL_SESSION delivers the stored session once the client has recovered it, so no
    // separate getSession() call (it would race this listener). A dead refresh token at cold start
    // is dropped by supabase-js before this fires and lands on signedOut without E-18 (F-01 → A-02).
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_OUT") {
        if (signedIn.current && !expectingSignOut.current) setErrorCode("E-18");
        expectingSignOut.current = false;
        clearSocialNameDraft();
        queryClient.clear(); // F-16: the in-memory cache belongs to the previous user.
      }

      if (nextSession && !isCustomerSession(nextSession)) {
        setErrorCode("E-19");
        // WHY: awaiting supabase calls inside this callback deadlocks the auth lock; defer it.
        setTimeout(() => void signOut().catch(reportError), 0);
        nextSession = null;
      } else if (nextSession) {
        setErrorCode(null);
        setAccountDeleted(false);
      }

      signedIn.current = nextSession !== null;
      setSession(nextSession);
      setStatus(nextSession ? "signedIn" : "signedOut");
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient, signOut]);

  const value = useMemo(
    () => ({ status, session, errorCode, signOut, accountDeleted, finishAccountDeletion, endSession }),
    [status, session, errorCode, signOut, accountDeleted, finishAccountDeletion, endSession],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
