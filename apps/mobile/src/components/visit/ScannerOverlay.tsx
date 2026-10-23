import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { Flashlight } from "../icons";
import { colors, MAX_FONT_SCALE, radii, spacing, textStyles } from "../../theme";

export type ScannerOverlayProps = {
  onClose: () => void;
  hint?: string;
  /** A-58: a code was recognised; the viewfinder corners turn accent for a beat before navigating. */
  detected?: boolean;
  /** A-59: torch for dim venues. Omit `onToggleTorch` to hide the button. */
  torch?: boolean;
  onToggleTorch?: () => void;
  testID?: string;
};


const CORNER = 28;
const CORNER_WIDTH = 4;

const corners = [
  { top: 0, left: 0, borderTopWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH, borderTopLeftRadius: radii.card },
  { top: 0, right: 0, borderTopWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH, borderTopRightRadius: radii.card },
  { bottom: 0, left: 0, borderBottomWidth: CORNER_WIDTH, borderLeftWidth: CORNER_WIDTH, borderBottomLeftRadius: radii.card },
  { bottom: 0, right: 0, borderBottomWidth: CORNER_WIDTH, borderRightWidth: CORNER_WIDTH, borderBottomRightRadius: radii.card },
] as const;

export function ScannerOverlay({ onClose, hint = "Apunta al código QR del cajero", detected = false, torch = false, onToggleTorch, testID }: ScannerOverlayProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const size = Math.min(280, Math.round(Math.min(width, height) * 0.7));

  return (
    // box-none: only the close button takes touches, the camera underneath stays interactive.
    <View testID={testID} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.scrim} />
        <View style={{ flexDirection: "row", height: size }}>
          <View style={styles.scrim} />
          <View testID="scanner-viewfinder" style={{ width: size, height: size }}>
            {corners.map((corner, i) => (
              <View key={i} style={[{ position: "absolute", width: CORNER, height: CORNER, borderColor: detected ? colors.accent : colors.surface }, corner]} />
            ))}
          </View>
          <View style={styles.scrim} />
        </View>
        <View style={[styles.scrim, { alignItems: "center", paddingTop: spacing.xl, paddingHorizontal: spacing.xl }]}>
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.surface, textAlign: "center" }]}>
            {hint}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Cerrar escáner"
        hitSlop={8}
        style={({ pressed }) => ({
          position: "absolute",
          top: insets.top + spacing.sm,
          left: insets.left + spacing.lg,
          width: 44,
          height: 44,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.scrim,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Svg width={22} height={22} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
          <Path d="M6 6l12 12M18 6L6 18" stroke={colors.surface} strokeWidth={2.4} strokeLinecap="round" />
        </Svg>
      </Pressable>
      {onToggleTorch ? (
        <Pressable
          onPress={onToggleTorch}
          accessibilityRole="button"
          accessibilityLabel={torch ? "Apagar linterna" : "Encender linterna"}
          accessibilityState={{ selected: torch }}
          hitSlop={8}
          testID="scanner-torch"
          style={({ pressed }) => ({
            position: "absolute",
            top: insets.top + spacing.sm,
            right: insets.right + spacing.lg,
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: torch ? colors.surface : colors.scrim,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Flashlight size={22} color={torch ? colors.navy : colors.surface} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.scrim },
});
