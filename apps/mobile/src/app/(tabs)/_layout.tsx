import { Tabs } from "expo-router";
import { type ColorValue, View } from "react-native";

import { AppHeader } from "../../components/layout/AppHeader";
import { useCardsTabBadge } from "../../features/cards/cardsTabBadge";
import { TabIcon, type TabIconName } from "../../components/ui/TabIcon";
import { colors, fontFamily } from "../../theme";


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
          backgroundColor: focused ? colors.navyTint : "transparent",
        }}
      >
        <TabIcon name={name} color={color} />
      </View>
    );
  };

export default function TabsLayout() {
  const cardsBadge = useCardsTabBadge();
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
      <Tabs.Screen name="cards" options={{
          title: "Mis Tarjetas",
          tabBarButtonTestID: "tab-cards",
          tabBarIcon: icon("cards"),
          // A-53: an empty-string badge renders as a dot; accent marks a reward moment (OD-3).
          tabBarBadge: cardsBadge ? "" : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, minWidth: 10, height: 10, borderRadius: 5 },
          tabBarAccessibilityLabel: cardsBadge ? "Mis Tarjetas, tienes novedades" : undefined,
        }} />
      <Tabs.Screen name="profile" options={{ title: "Perfil", tabBarButtonTestID: "tab-profile", tabBarIcon: icon("profile") }} />
    </Tabs>
  );
}
