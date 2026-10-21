import { Pressable, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { colors, fontFamily, MAX_FONT_SCALE, spacing, textStyles } from "../../theme";

export type VerificationBannerProps = {
  onResend: () => void;
  onEnterCode?: () => void;
  // Seconds left before another resend is allowed; 0 enables the button.
  cooldownSeconds: number;
  sending?: boolean;
  testID?: string;
};

function EnvelopeIcon() {
  const stroke = { stroke: colors.navy, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Rect x={3} y={5.5} width={18} height={13} rx={2.5} {...stroke} />
      <Path d="M4 7l8 6 8-6" {...stroke} />
    </Svg>
  );
}

function TextButton({ label, onPress, disabled = false, busy = false }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      hitSlop={{ left: spacing.sm, right: spacing.sm }}
      style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", opacity: pressed ? 0.6 : 1 })}
    >
      <Text
        maxFontSizeMultiplier={MAX_FONT_SCALE}
        // WHY: disabled keeps textSecondary (AA on white) instead of fading with opacity below 4.5:1.
        style={[
          textStyles.secondary,
          { fontFamily: fontFamily.semibold, color: disabled ? colors.textSecondary : colors.navy, textDecorationLine: disabled ? "none" : "underline" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// F-04: persistent while the email is unverified (§5.5); not role "alert" because it is not news.
export function VerificationBanner({ onResend, onEnterCode, cooldownSeconds, sending = false, testID }: VerificationBannerProps) {
  const coolingDown = cooldownSeconds > 0;
  const resendLabel = sending ? "Enviando…" : coolingDown ? `Reenviar en ${cooldownSeconds} s` : "Reenviar correo";
  return (
    <View
      testID={testID}
      style={{
        flexDirection: "row",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: spacing.xs,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceMuted,
      }}
    >
      <EnvelopeIcon />
      <View style={{ flex: 1 }}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.secondary, { color: colors.textPrimary }]}>
          Verifica tu correo para girar la ruleta y canjear tus premios.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: spacing.lg }}>
          <TextButton label={resendLabel} onPress={onResend} disabled={coolingDown || sending} busy={sending} />
          {onEnterCode ? <TextButton label="Ingresar código" onPress={onEnterCode} /> : null}
        </View>
      </View>
    </View>
  );
}
