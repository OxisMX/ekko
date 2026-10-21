import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Text, View } from "react-native";

import { Button } from "../../components/ui";
import { colors, fontFamily, MAX_FONT_SCALE, spacing, textStyles } from "../../theme";

// NOTE: placeholder until A-08..A-11 (Sprint 4); a way back keeps it from being a dead end (PX-7).
export default function MerchantScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ id: string; name?: string }>();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xl, padding: spacing.xl, backgroundColor: colors.surface }}>
      <Stack.Screen
        options={{
          title: typeof name === "string" && name ? name : "Comercio",
          headerTitleStyle: { fontFamily: fontFamily.bold, color: colors.textPrimary },
          headerTintColor: colors.navy,
          headerBackButtonDisplayMode: "minimal",
        }}
      />
      <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.textPrimary, textAlign: "center" }]}>
        El detalle del comercio llega en la siguiente versión.
      </Text>
      <Button title="Volver" onPress={goBack} testID="merchant-back" />
    </View>
  );
}
