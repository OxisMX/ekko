import { type BarcodeScanningResult, CameraView, useCameraPermissions } from "expo-camera";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AppState, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PermissionExplainer, ScannerOverlay, VisitResult } from "../components/visit";
import { isVisitToken, parseVisitToken } from "../features/visit/visitToken";
import { colors, MAX_FONT_SCALE, radii, spacing, textStyles } from "../theme";

// A-13 / A-14: camera permission and QR scanner (F-08, US-11).
export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [notEkko, setNotEkko] = useState(false);
  // WHY: a ref, not state — the camera fires several events before a re-render could stop it.
  const locked = useRef(false);

  // Back from Settings (SA-04) with the camera allowed: re-read the permission.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void getPermission();
    });
    return () => sub.remove();
  }, [getPermission]);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/"));

  const handleCode = (raw: string, acceptBareToken = false) => {
    if (locked.current) return;
    locked.current = true;
    const token = acceptBareToken && isVisitToken(raw.trim()) ? raw.trim() : parseVisitToken(raw);
    // TC-051: a foreign code never reaches the server.
    if (!token) {
      setNotEkko(true);
      return;
    }
    router.replace({ pathname: "/visit-result", params: { token } });
  };

  const keepScanning = () => {
    setNotEkko(false);
    locked.current = false;
  };

  if (!permission) return <View style={{ flex: 1, backgroundColor: colors.surface }} testID="scan-permission-loading" />;

  if (!permission.granted) {
    const denied = !permission.canAskAgain;
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.surface, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <PermissionExplainer
          variant={denied ? "denied" : "camera"}
          onPrimary={() => void (denied ? Linking.openSettings() : requestPermission())}
          onSecondary={close}
          testID={denied ? "scan-permission-denied" : "scan-permission-explainer"}
        />
      </View>
    );
  }

  if (notEkko) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.surface, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <VisitResult kind="not_ekko" onPrimary={keepScanning} onSecondary={close} secondaryLabel="Cerrar" testID="scan-not-ekko" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "black" }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }: BarcodeScanningResult) => handleCode(data)}
        testID="scan-camera"
      />
      <ScannerOverlay onClose={close} testID="scan-overlay" />
      {__DEV__ ? <DevTokenPaste onSubmit={(value) => handleCode(value, true)} bottom={insets.bottom + spacing.lg} /> : null}
    </View>
  );
}

// RQ-6: emulators have no camera pointed at a cashier. NOTE: behind __DEV__, so release bundles drop it.
function DevTokenPaste({ onSubmit, bottom }: { onSubmit: (value: string) => void; bottom: number }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  return (
    <View style={{ position: "absolute", left: spacing.lg, right: spacing.lg, bottom, gap: spacing.sm }}>
      {open ? (
        <TextInput
          value={value}
          onChangeText={setValue}
          onSubmitEditing={() => onSubmit(value)}
          placeholder="URL o token del QR"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="go"
          accessibilityLabel="URL o token del QR"
          testID="scan-dev-input"
          style={[textStyles.body, { backgroundColor: colors.surface, color: colors.textPrimary, borderRadius: radii.card, paddingHorizontal: spacing.md, minHeight: 44 }]}
        />
      ) : null}
      <Pressable
        onPress={() => (open && value ? onSubmit(value) : setOpen(true))}
        accessibilityRole="button"
        accessibilityLabel={open ? "Usar token" : "Pegar token"}
        hitSlop={8}
        testID="scan-dev-paste"
        style={{ alignSelf: "center", minHeight: 44, justifyContent: "center" }}
      >
        <Text maxFontSizeMultiplier={MAX_FONT_SCALE} style={[textStyles.body, { color: colors.surface, textDecorationLine: "underline" }]}>
          {open ? "Usar token" : "Pegar token"}
        </Text>
      </Pressable>
    </View>
  );
}
