import { useIsFocused } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import { View } from "react-native";
import { colors, radii } from "../../theme";

// Content as a white sheet with a curved top corner over the dark brand background (like AuthLayout).
export function TabSheet({ children }: { children: ReactNode }) {
  // WHY: tab screens stay mounted under pushed screens; only the focused one may set the status bar.
  const focused = useIsFocused();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgBrand }}>
      {focused ? <StatusBar style="light" /> : null}
      <View style={{ flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: radii.sheet, borderCurve: "continuous", overflow: "hidden" }}>
        {children}
      </View>
    </View>
  );
}
