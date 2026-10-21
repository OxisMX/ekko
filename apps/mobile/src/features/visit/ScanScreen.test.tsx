import { fireEvent, render, screen } from "@testing-library/react-native";
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
    await fireEvent.press(screen.getByRole("button", { name: "Permitir cámara" }));
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
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: "/visit-result", params: { token: TOKEN } });
  });

  it("rejects a foreign code locally and lets the user keep scanning (TC-051)", async () => {
    await render(<ScanScreen />);
    await scan("https://example.com/promo");
    expect(screen.getByText("Este no es un código de Ekko.")).toBeOnTheScreen();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Seguir escaneando" }));
    await scan(`ekko://v/${TOKEN}`);
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
  });

  it("dev builds can paste a token (RQ-6)", async () => {
    await render(<ScanScreen />);
    await fireEvent.press(screen.getByText("Pegar token"));
    await fireEvent.changeText(screen.getByTestId("scan-dev-input"), TOKEN);
    await fireEvent.press(screen.getByText("Usar token"));
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
