import { colors, radii, spacing, STAMPS, stampGridRows } from "@ekko/shared";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

// NOTE: demo screen to smoke-test the emulator; replace with the real catalog (A-07).
export default function ExploreScreen() {
  const [stamps, setStamps] = useState(0);
  const total = STAMPS.default;
  const completed = stamps === total;
  const rows = stampGridRows(total);

  const handlePress = () => setStamps(completed ? 0 : stamps + 1);

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        {rows.map((count, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {Array.from({ length: count }, (_, i) => {
              const filled = rows.slice(0, rowIndex).reduce((a, b) => a + b, 0) + i < stamps;
              return <View key={i} style={[styles.stamp, filled && styles.stampFilled]} />;
            })}
          </View>
        ))}
      </View>

      <Text style={styles.progress} testID="stamp-progress">
        {completed ? "¡Completaste tu tarjeta! Tu recompensa te espera." : `${stamps} de ${total} sellos`}
      </Text>

      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        testID="demo-stamp-button"
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>{completed ? "Reiniciar" : "Registrar visita (demo)"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xl, padding: spacing.lg, backgroundColor: colors.surface },
  card: { gap: spacing.md, padding: spacing.xl, borderRadius: radii.stampContainer, backgroundColor: colors.surfaceCard },
  row: { flexDirection: "row", justifyContent: "center", gap: spacing.md },
  stamp: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface },
  stampFilled: { backgroundColor: colors.accent },
  progress: { fontSize: 16, color: colors.textPrimary, textAlign: "center" },
  button: { minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.xl, borderRadius: radii.button, backgroundColor: colors.primary },
  buttonPressed: { opacity: 0.8 },
  buttonText: { color: colors.surface, fontSize: 16, fontWeight: "600" },
});
