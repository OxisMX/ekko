import { ERRORS, type ErrorCode } from "@ekko/shared";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform, ScrollView, Text } from "react-native";

import { type AuthErrorCode, useAuth } from "../../auth/AuthProvider";
import { Button, FormMessage, TextField } from "../../components/ui";
import { requestAppleAuthorizationCode } from "../auth/socialSignIn";
import { reportError } from "../../lib/sentry";
import { supabase } from "../../lib/supabase";
import { colors, MAX_FONT_SCALE, spacing, textStyles } from "../../theme";

const CONFIRMATION_WORD = "ELIMINAR";

async function readErrorCode(error: unknown): Promise<ErrorCode> {
  // WHY: a dropped connection is E-01 (retry); anything unreadable is E-99, reported with context.
  if (error instanceof FunctionsFetchError) return "E-01";
  if (error instanceof FunctionsHttpError) {
    const body: unknown = await error.context.json().catch(() => null);
    const code = typeof body === "object" && body !== null && "error" in body ? body.error : null;
    if (typeof code === "string" && code in ERRORS) return code as ErrorCode;
  }
  reportError(error);
  return "E-99";
}

type AppleCode = string | null | "cancelled" | "unsupported";

async function readAppleCode(hasAppleIdentity: boolean): Promise<AppleCode> {
  if (!hasAppleIdentity) return null;
  // WHY: Sign in with Apple exists on iOS only; an Apple account opened elsewhere cannot revoke its token.
  if (Platform.OS !== "ios") return "unsupported";
  return (await requestAppleAuthorizationCode()) ?? "cancelled";
}

// A-22 Eliminar cuenta (F-15, US-05). RN-09: re-registering with the same email does not restore used wheels.
export function DeleteAccountScreen() {
  const router = useRouter();
  const { session, finishAccountDeletion, endSession } = useAuth();
  const hasAppleIdentity = session?.user.identities?.some((identity) => identity.provider === "apple") ?? false;
  const [appleNotice, setAppleNotice] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);
  const confirmed = typed.trim() === CONFIRMATION_WORD;

  const submit = async () => {
    if (!confirmed || busy) return;
    setBusy(true);
    setErrorCode(null);
    setAppleNotice(false);
    // F-15 Apple branch: Apple needs a fresh authorization code to revoke the token.
    const appleCode = await readAppleCode(hasAppleIdentity).catch((error: unknown) => {
      reportError(error);
      return "failed" as const;
    });
    if (appleCode === "failed") {
      setErrorCode("E-21");
      setBusy(false);
      return;
    }
    if (appleCode === "cancelled") {
      setBusy(false);
      return;
    }
    if (appleCode === "unsupported") {
      setAppleNotice(true);
      setBusy(false);
      return;
    }
    const { error } = await supabase.functions.invoke("delete-account", {
      body: { confirmation: CONFIRMATION_WORD, ...(appleCode ? { apple_authorization_code: appleCode } : {}) },
    });
    if (!error) {
      // The gate sends the user to A-02, which shows "Tu cuenta fue eliminada.".
      await finishAccountDeletion().catch(reportError);
      return;
    }
    const code = await readErrorCode(error);
    if (code === "E-18" || code === "E-19") {
      endSession(code as AuthErrorCode);
      return;
    }
    setErrorCode(code);
    setBusy(false);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.h2, { color: colors.textPrimary }]}>
        ¿Eliminar tu cuenta?
      </Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.textPrimary }]} testID="delete-account-warning">
        Perderás todos tus sellos, cupones y premios. Esta acción no se puede deshacer. Si te registras de nuevo con el mismo correo, las ruletas que ya usaste no se reactivan.
      </Text>
      <TextField
        label="Escribe ELIMINAR para confirmar"
        value={typed}
        onChangeText={setTyped}
        editable={!busy}
        autoCapitalize="characters"
        autoCorrect={false}
        testID="delete-account-input"
      />
      {appleNotice ? (
        <FormMessage
          variant="info"
          message="Para eliminar una cuenta creada con Apple, hazlo desde un iPhone o iPad, o escribe a soporte."
          testID="delete-account-apple-notice"
        />
      ) : null}
      {errorCode ? (
        <FormMessage
          variant="error"
          message={ERRORS[errorCode].message}
          actionLabel={errorCode === "E-01" || errorCode === "E-99" ? "Reintentar" : undefined}
          onAction={errorCode === "E-01" || errorCode === "E-99" ? () => void submit() : undefined}
          testID="delete-account-error"
        />
      ) : null}
      <Button title="Eliminar mi cuenta" variant="destructive" onPress={() => void submit()} disabled={!confirmed} loading={busy} fullWidth testID="delete-account-submit" />
      <Button title="Cancelar" variant="secondary" onPress={() => router.back()} disabled={busy} fullWidth testID="delete-account-cancel" />
    </ScrollView>
  );
}
