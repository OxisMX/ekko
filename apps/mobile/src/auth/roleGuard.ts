import type { Session } from "@supabase/supabase-js";

// F-01 / E-19 (TRD §6.1): the mobile app is for customers only; merchants use the panel.
// `app_metadata` is set server-side (trigger / script), so the client cannot forge it in its JWT.
export function isCustomerSession(session: Pick<Session, "user">): boolean {
  return session.user?.app_metadata?.role === "customer";
}
