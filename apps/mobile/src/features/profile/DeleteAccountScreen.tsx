import { ERRORS, type ErrorCode } from "@ekko/shared";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text } from "react-native";

import { type AuthErrorCode, useAuth } from "../../auth/AuthProvider";
import { Button, FormMessage, TextField } from "../../components/ui";
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

// A-22 Eliminar cuenta (F-15, US-05). RN-09: re-registering with the same email does not restore used wheels.
export function DeleteAccountScreen() {
  const router = useRouter();
  const { finishAccountDeletion, endSession } = useAuth();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);
  const confirmed = typed.trim() === CONFIRMATION_WORD;

  const submit = async () => {
    if (!confirmed || busy) return;
    setBusy(true);
    setErrorCode(null);
    // NOTE: F-15 Apple branch plugs in here with F-03: re-authenticate with Apple and send
    // `apple_authorization_code` in the body (cancelled -> return to Perfil without invoking).
    const { error } = await supabase.functions.invoke("delete-account", { body: { confirmation: CONFIRMATION_WORD } });
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
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.h2, { color: colors.textPrimary }]}>
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
