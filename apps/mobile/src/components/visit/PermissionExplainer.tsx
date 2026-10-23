import { Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { colors, MAX_FONT_SCALE, spacing, textStyles } from "../../theme";
import { Button } from "../ui/Button";

export type PermissionExplainerProps = {
  /** camera: pre-prompt (PX-3); denied: the OS will not ask again, so send the user to Settings; notifications: A-16 pre-prompt. */
  variant: "camera" | "denied" | "notifications";
  onPrimary: () => void;
  onSecondary: () => void;
  testID?: string;
};

const copy = {
  camera: {
    title: "Registra tu visita",
    body: "Usamos la cámara solo para leer el código QR que te muestra el cajero. No guardamos fotos ni video.",
    primary: "Permitir cámara",
    secondary: "Ahora no",
  },
  denied: {
    title: "La cámara está desactivada",
    body: "Para registrar tu visita, permite el acceso a la cámara para Ekko desde los ajustes de tu teléfono.",
    primary: "Abrir ajustes",
    secondary: "Volver",
  },
  notifications: {
    title: "Entérate de tus sellos",
    body: "Te avisamos cuando ganes sellos, cupones y ofertas de tus comercios.",
    primary: "Activar notificaciones",
    secondary: "Ahora no",
  },
} as const;

const iconStroke = { stroke: colors.navy, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

function BellIcon() {
  return (
    <Svg width={44} height={44} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15zM10 20.5a2 2 0 0 0 4 0" {...iconStroke} />
    </Svg>
  );
}

function CameraIcon() {
  const stroke = iconStroke;
  return (
    <Svg width={44} height={44} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      <Path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" {...stroke} />
      <Circle cx={12} cy={13} r={3.5} {...stroke} />
    </Svg>
  );
}

export function PermissionExplainer({ variant, onPrimary, onSecondary, testID }: PermissionExplainerProps) {
  const { title, body, primary, secondary } = copy[variant];
  return (
    <View testID={testID} style={{ alignItems: "center", gap: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing["2xl"] }}>
      <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center" }}>
        {variant === "notifications" ? <BellIcon /> : <CameraIcon />}
      </View>
      <View style={{ alignItems: "center", gap: spacing.sm }}>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} accessibilityRole="header" style={[textStyles.h1, { color: colors.textPrimary, textAlign: "center" }]}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.textSecondary, textAlign: "center" }]}>
          {body}
        </Text>
      </View>
      <View style={{ alignSelf: "stretch", gap: spacing.md, marginTop: spacing.sm }}>
        <Button title={primary} onPress={onPrimary} fullWidth testID={testID && `${testID}-primary`} />
        <Button title={secondary} onPress={onSecondary} variant="secondary" fullWidth testID={testID && `${testID}-secondary`} />
      </View>
    </View>
  );
}
