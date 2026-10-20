import { STAMPS } from "@ekko/shared";
import { Text, View } from "react-native";

export default function ExploreScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Explorar</Text>
      {/* Proves @ekko/shared resolves under Metro; remove with the real screen. */}
      <Text>{STAMPS.default}</Text>
    </View>
  );
}
