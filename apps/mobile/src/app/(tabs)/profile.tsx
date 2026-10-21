import { ERRORS } from "@ekko/shared";
import { useState } from "react";
import { Button, Text, View } from "react-native";

import { useAuth } from "../../auth/AuthProvider";
import { reportError } from "../../lib/sentry";

// NOTE: developer-facing placeholder for Sprint 1; the real A-xx profile screen uses the UI kit.
export default function ProfileScreen() {
  const { status, session, errorCode, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = () => {
    setSigningOut(true);
    signOut()
      .catch(reportError)
      .finally(() => setSigningOut(false));
  };

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 16 }}>
      {errorCode && <Text accessibilityRole="alert">{`${errorCode}: ${ERRORS[errorCode].message}`}</Text>}
      {status === "signedIn" ? (
        <>
          <Text>{session?.user.email ?? "Sesión sin correo"}</Text>
          <Button title="Cerrar sesión" onPress={handleSignOut} disabled={signingOut} />
        </>
      ) : (
        <Text>Sin sesión</Text>
      )}
    </View>
  );
}
