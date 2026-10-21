import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";

import { VisitResult } from "../../components/visit";
import { setPendingVisit } from "../../features/visit/pendingVisit";
import { isVisitToken } from "../../features/visit/visitToken";
import { colors } from "../../theme";

// F-09: /v/:token opened in the app. The token waits in memory; usePendingVisitRedirect (root
// layout) claims it once the gate reaches tabs, or sends a signed-out customer to log in first.
export default function VisitLinkScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const valid = isVisitToken(token);

  useEffect(() => {
    if (valid) setPendingVisit(token);
  }, [valid, token]);

  return (
    <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.surface }}>
      {valid ? (
        <ActivityIndicator accessibilityLabel="Abriendo tu visita" color={colors.navy} testID="visit-link-loading" />
      ) : (
        <VisitResult kind="not_ekko" primaryLabel="Ir al inicio" onPrimary={() => router.replace("/")} testID="visit-link-invalid" />
      )}
    </View>
  );
}
