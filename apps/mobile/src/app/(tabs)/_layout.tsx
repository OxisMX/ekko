import { Tabs } from "expo-router";
import { type ColorValue, View } from "react-native";

import { AppHeader } from "../../components/layout/AppHeader";
import { TabIcon, type TabIconName } from "../../components/ui/TabIcon";
import { colors, fontFamily } from "../../theme";

// navy at 12%: subtle on white while the navy icon keeps full contrast on top.
const ACTIVE_PILL = "rgba(31, 42, 74, 0.12)";

const icon = (name: TabIconName) =>
  function TabBarIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    // WHY: a pill behind the active icon marks the current section by shape, not only by color (§9).
    return (
      <View
        testID={focused ? `tab-indicator-${name}` : undefined}
        style={{
          width: 56,
          height: 30,
          borderRadius: 15,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: focused ? ACTIVE_PILL : "transparent",
        }}
      >
        <TabIcon name={name} color={color} />
      </View>
    );
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        header: ({ options }) => <AppHeader title={options.title ?? ""} />,
        // WHY: navigation uses navy, never the accent (brief §4.3, OD-3); labels stay visible (§4.2, §9).
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontFamily: fontFamily.semibold, fontSize: 12 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Explorar", tabBarButtonTestID: "tab-explore", tabBarIcon: icon("explore") }} />
      <Tabs.Screen name="cards" options={{ title: "Mis Tarjetas", tabBarButtonTestID: "tab-cards", tabBarIcon: icon("cards") }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil", tabBarButtonTestID: "tab-profile", tabBarIcon: icon("profile") }} />
    </Tabs>
  );
}
