import { STAMPS, stampGridRows } from "@ekko/shared";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, Chip } from "../../components/ui";
import { colors, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";

const DEMO_CATEGORIES = ["Todos", "Cafeterías", "Barberías"] as const;

// NOTE: demo screen to smoke-test the emulator; replace with the real catalog (A-07).
export default function ExploreScreen() {
  const [stamps, setStamps] = useState(0);
  const [category, setCategory] = useState<string>(DEMO_CATEGORIES[0]);
  const total = STAMPS.default;
  const completed = stamps === total;
  const rows = stampGridRows(total);

  const handlePress = () => setStamps(completed ? 0 : stamps + 1);

  return (
    <View style={styles.screen}>
      <View style={styles.chips}>
        {DEMO_CATEGORIES.map((name) => (
          <Chip key={name} label={name} selected={category === name} onPress={() => setCategory(name)} />
        ))}
      </View>

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

      <Text style={styles.progress} maxFontSizeMultiplier={MAX_FONT_SCALE} testID="stamp-progress">
        {completed ? "¡Completaste tu tarjeta! Tu recompensa te espera." : `${stamps} de ${total} sellos`}
      </Text>

      <Button
        title={completed ? "Reiniciar" : "Registrar visita (demo)"}
        onPress={handlePress}
        testID="demo-stamp-button"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xl, padding: spacing.lg, backgroundColor: colors.surface },
  chips: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm },
  card: { gap: spacing.md, padding: spacing.xl, borderRadius: radii.stampContainer, backgroundColor: colors.surfaceCard },
  row: { flexDirection: "row", justifyContent: "center", gap: spacing.md },
  stamp: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surface },
  stampFilled: { backgroundColor: colors.accent },
  progress: { ...textStyles.body, color: colors.textPrimary, textAlign: "center" },
});
