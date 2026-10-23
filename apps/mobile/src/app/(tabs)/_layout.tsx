import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

import { TabIcon, type TabIconName } from "../../components/ui/TabIcon";
import { colors, fontFamily } from "../../theme";

const icon = (name: TabIconName) =>
  function TabBarIcon({ color }: { color: ColorValue }) {
    return <TabIcon name={name} color={color} />;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        // WHY: navigation uses navy, never the accent (brief §4.3, OD-3); labels stay visible (§4.2, §9).
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontFamily: fontFamily.semibold, fontSize: 12 },
        headerTitleStyle: { fontFamily: fontFamily.bold, color: colors.textPrimary },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Explorar", tabBarButtonTestID: "tab-explore", tabBarIcon: icon("explore") }} />
      <Tabs.Screen name="cards" options={{ title: "Mis Tarjetas", tabBarButtonTestID: "tab-cards", tabBarIcon: icon("cards") }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil", tabBarButtonTestID: "tab-profile", tabBarIcon: icon("profile") }} />
    </Tabs>
  );
}
