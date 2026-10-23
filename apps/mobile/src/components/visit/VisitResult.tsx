import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, fontFamily, MAX_FONT_SCALE, spacing, textStyles } from "../../theme";
import { GiftIcon } from "../card/StampCard";
import { Button } from "../ui/Button";
import { useReduceMotion } from "../useReduceMotion";

export type VisitResultKind = "stamped" | "completed" | "already_today" | "expired_or_used" | "unavailable" | "offline" | "not_ekko";

export type VisitResultProps = {
  kind: VisitResultKind;
  merchantName?: string;
  stampsCount?: number;
  stampsRequired?: number;
  /** >1 when a pending extra stamp was granted with the visit (RN-36). */
  stampsAdded?: number;
  onPrimary: () => void;
  primaryLabel?: string;
  onSecondary?: () => void;
  secondaryLabel?: string;
  testID?: string;
};

// Copy: brief §8.2; actions: AppFlow §7 (E-01..E-05, E-08).
const copy: Record<VisitResultKind, { title: string; message?: string; primaryLabel: string }> = {
  stamped: { title: "¡Sello registrado!", primaryLabel: "Ver mi tarjeta" },
  completed: { title: "¡Completaste tu tarjeta!", message: "Tu recompensa te espera.", primaryLabel: "Ver recompensa" },
  already_today: { title: "Visita ya registrada", message: "Ya registraste tu visita de hoy en este negocio. Vuelve mañana.", primaryLabel: "Cerrar" },
  expired_or_used: { title: "Código no válido", message: "Este código ya no es válido. Pide al cajero uno nuevo.", primaryLabel: "Escanear de nuevo" },
  unavailable: { title: "Negocio no disponible", message: "Este negocio no está disponible por ahora. Tus sellos siguen guardados.", primaryLabel: "Volver" },
  offline: { title: "Sin conexión", message: "No hay conexión. Revisa tus datos o Wi-Fi e inténtalo de nuevo.", primaryLabel: "Reintentar" },
  not_ekko: { title: "Código no reconocido", message: "Este no es un código de Ekko.", primaryLabel: "Seguir escaneando" },
};

const ICON_SIZE = 96;
// expo-animation: strong ease-out for entrances.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

function isSuccess(kind: VisitResultKind) {
  return kind === "stamped" || kind === "completed";
}

function CheckIcon() {
  return (
    <Svg width={44} height={44} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={colors.navy} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function NoticeIcon() {
  const stroke = { stroke: colors.textSecondary, strokeWidth: 1.8, strokeLinecap: "round" as const, fill: "none" };
  return (
    <Svg width={40} height={40} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Circle cx={12} cy={12} r={9} {...stroke} />
      <Path d="M12 7.5v5.5M12 16.5h.01" {...stroke} strokeWidth={2.2} />
    </Svg>
  );
}

// PX-6: ≤ 600 ms, never blocks (buttons are live from the first frame); §9: skipped with reduce motion.
function CelebrationEntrance({ children }: { children: React.ReactNode }) {
  const reduce = useReduceMotion();
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduce === null) return;
    if (reduce) {
      progress.setValue(1);
      return;
    }
    const anim = Animated.timing(progress, { toValue: 1, duration: 450, easing: EASE_OUT, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [reduce, progress]);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
  return <Animated.View style={{ opacity: progress, transform: [{ scale }] }}>{children}</Animated.View>;
}

function ResultIcon({ kind }: { kind: VisitResultKind }) {
  const circle = { width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2, alignItems: "center", justifyContent: "center" } as const;
  if (!isSuccess(kind)) {
    return (
      <View testID="visit-result-notice" style={[circle, { backgroundColor: colors.surfaceMuted }]}>
        <NoticeIcon />
      </View>
    );
  }
  // Accent only here: reward moment (OD-3), as a non-text ring.
  return (
    <CelebrationEntrance>
      <View testID="visit-result-celebration" style={[circle, { backgroundColor: colors.surface, borderWidth: 4, borderColor: colors.accent }]}>
        {kind === "completed" ? <GiftIcon size={44} /> : <CheckIcon />}
      </View>
    </CelebrationEntrance>
  );
}

export function VisitResult({
  kind,
  merchantName,
  stampsCount,
  stampsRequired,
  stampsAdded,
  onPrimary,
  primaryLabel,
  onSecondary,
  secondaryLabel,
  testID,
}: VisitResultProps) {
  const { title, primaryLabel: defaultPrimary } = copy[kind];
  const message =
    kind === "stamped" ? (stampsCount != null && stampsRequired != null ? `Llevas ${stampsCount} de ${stampsRequired}.` : undefined) : copy[kind].message;
  const error = !isSuccess(kind);
  const extra = isSuccess(kind) && stampsAdded != null && stampsAdded > 1 ? `+${stampsAdded} sellos` : null;

  // iOS ignores accessibilityLiveRegion, so the result is announced explicitly once.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility([title, message].filter(Boolean).join(" "));
  }, [title, message]);

  return (
    <View testID={testID} accessibilityLiveRegion="polite" style={{ alignItems: "center", gap: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing["2xl"] }}>
      <ResultIcon kind={kind} />
      <View style={{ alignItems: "center", gap: spacing.sm }}>
        {merchantName ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary, textAlign: "center" }]}>
            {merchantName}
          </Text>
        ) : null}
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} accessibilityRole="header" style={[textStyles.h1, { color: colors.textPrimary, textAlign: "center" }]}>
          {title}
        </Text>
        {message ? (
          <Text
            accessibilityRole={error ? "alert" : undefined}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={[textStyles.body, { color: error ? colors.textPrimary : colors.textSecondary, textAlign: "center", fontVariant: ["tabular-nums"] }]}
          >
            {message}
          </Text>
        ) : null}
        {extra ? (
          // Accent as badge background with dark text, like StampCard (§4.3).
          <View testID="visit-result-extra" style={{ marginTop: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 999, backgroundColor: colors.accent }}>
            <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { fontFamily: fontFamily.semibold, color: colors.textPrimary }]}>
              {extra}
            </Text>
          </View>
        ) : null}
        {extra ? (
          <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textSecondary, textAlign: "center" }]}>
            Incluye tu sello extra
          </Text>
        ) : null}
      </View>
      <View style={{ alignSelf: "stretch", gap: spacing.md, marginTop: spacing.sm }}>
        <Button title={primaryLabel ?? defaultPrimary} onPress={onPrimary} fullWidth testID={testID && `${testID}-primary`} />
        {onSecondary && secondaryLabel ? <Button title={secondaryLabel} onPress={onSecondary} variant="secondary" fullWidth testID={testID && `${testID}-secondary`} /> : null}
      </View>
    </View>
  );
}
