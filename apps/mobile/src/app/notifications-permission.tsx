import { useRouter } from "expo-router";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PermissionExplainer } from "../components/visit";
import { registerDevice } from "../features/auth/deviceRegistration";
import { requestPushPermission } from "../features/notifications/pushToken";
import { reportError } from "../lib/sentry";
import { colors } from "../theme";

// A-16 Permiso de notificaciones (F-07). Either button closes it and the flow continues (no push is fine).
export default function NotificationsPermissionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const activate = async () => {
    const granted = await requestPushPermission();
    close();
    // Registers the token now that the permission changed.
    if (granted) registerDevice().catch(reportError);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <PermissionExplainer variant="notifications" onPrimary={() => void activate()} onSecondary={close} testID="notifications-explainer" />
    </ScrollView>
  );
}
