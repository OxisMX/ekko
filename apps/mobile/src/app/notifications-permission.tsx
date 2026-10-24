import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PermissionExplainer } from "../components/visit";
import { MY_PROFILE_KEY } from "../features/auth/account";
import { registerDevice } from "../features/auth/deviceRegistration";
import { requestPushPermission } from "../features/notifications/pushToken";
import { optInToPromotions } from "../features/profile/profileEdit";
import { reportError } from "../lib/sentry";
import { colors } from "../theme";

// A-16 Permiso de notificaciones (F-07). WHY: no "not now" button (Apple 5.1.1(iv)); the system prompt
// decides, and the screen closes either way (no push is fine).
export default function NotificationsPermissionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const activate = async () => {
    const granted = await requestPushPermission();
    close();
    // Registers the token now that the permission changed.
    if (!granted) return;
    registerDevice().catch(reportError);
    optInToPromotions()
      .then(() => queryClient.invalidateQueries({ queryKey: MY_PROFILE_KEY }))
      .catch(reportError);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surface }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <PermissionExplainer variant="notifications" onPrimary={() => void activate()} testID="notifications-explainer" />
    </ScrollView>
  );
}
