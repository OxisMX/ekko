import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";

import ScanScreen from "../../app/scan";

const TOKEN = "AbCdEfGhIjKlMnOpQr_-12";
const mockRouter = { replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
const mockRequest = jest.fn();
let mockPermission: { granted: boolean; canAskAgain: boolean } | null;

jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("expo-linking", () => ({ openSettings: jest.fn(() => Promise.resolve()) }));
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("expo-camera", () => ({
  useCameraPermissions: () => [mockPermission, mockRequest, jest.fn()],
  // The mock camera is a plain View; tests fire onBarcodeScanned through its props.
  CameraView: (props: object) => {
    const { View } = jest.requireActual<typeof import("react-native")>("react-native");
    return <View {...props} />;
  },
}));

// A-58: navigation waits ~150 ms so the accent corners register.
const settle = () => act(async () => void (await new Promise((resolve) => setTimeout(resolve, 200))));
const scan = async (data: string) => {
  await fireEvent(screen.getByTestId("scan-camera"), "barcodeScanned", { data });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPermission = { granted: true, canAskAgain: true };
});

describe("A-13 / A-14 scanner", () => {
  it("explains before asking for the camera (undetermined)", async () => {
    mockPermission = { granted: false, canAskAgain: true };
    await render(<ScanScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Continuar" }));
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("scan-camera")).toBeNull();
  });

  it("sends a denied camera to Settings", async () => {
    mockPermission = { granted: false, canAskAgain: false };
    await render(<ScanScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Abrir ajustes" }));
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it("claims only the first valid code", async () => {
    await render(<ScanScreen />);
    expect(screen.getByTestId("scan-camera").props.barcodeScannerSettings).toEqual({ barcodeTypes: ["qr"] });
    await scan(`https://ekko.oxis.mx/v/${TOKEN}`);
    await scan(`https://ekko.oxis.mx/v/${TOKEN}`);
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(screen.getAllByTestId("scanner-viewfinder")).toHaveLength(1);
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    await settle();
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: "/visit-result", params: { token: TOKEN } });
  });

  it("toggles the torch (A-59)", async () => {
    await render(<ScanScreen />);
    expect(screen.getByTestId("scan-camera").props.enableTorch).toBe(false);
    await fireEvent.press(screen.getByRole("button", { name: "Encender linterna" }));
    expect(screen.getByTestId("scan-camera").props.enableTorch).toBe(true);
    expect(screen.getByRole("button", { name: "Apagar linterna" })).toBeOnTheScreen();
  });

  it("rejects a foreign code locally and lets the user keep scanning (TC-051)", async () => {
    await render(<ScanScreen />);
    await scan("https://example.com/promo");
    expect(screen.getByText("Este no es un código de Ekko.")).toBeOnTheScreen();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Seguir escaneando" }));
    await scan(`ekko://v/${TOKEN}`);
    await settle();
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  });

  it("dev builds can paste a token (RQ-6)", async () => {
    await render(<ScanScreen />);
    await fireEvent.press(screen.getByText("Pegar token"));
    await fireEvent.changeText(screen.getByTestId("scan-dev-input"), TOKEN);
    await fireEvent.press(screen.getByText("Usar token"));
    await settle();
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: "/visit-result", params: { token: TOKEN } });
  });

  it("has no paste control when __DEV__ is false", async () => {
    const g = globalThis as unknown as { __DEV__: boolean };
    const dev = g.__DEV__;
    g.__DEV__ = false;
    try {
      await render(<ScanScreen />);
      expect(screen.getByTestId("scan-camera")).toBeOnTheScreen();
      expect(screen.queryByText("Pegar token")).toBeNull();
    } finally {
      g.__DEV__ = dev;
    }
  });
});
