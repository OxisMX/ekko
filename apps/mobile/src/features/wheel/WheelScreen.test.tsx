import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import * as Haptics from "expo-haptics";
import WheelScreen from "../../app/wheel/[merchantId]";

const mockSupabase = { rpc: jest.fn() };
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) };
let mockParams: Record<string, string> = { merchantId: "m1" };
const mockExplainer = jest.fn();

jest.mock("../../lib/supabase", () => ({
  get supabase() {
    return mockSupabase;
  },
  supabaseUrl: "https://x.supabase.co",
}));
jest.mock("../../lib/sentry", () => ({ reportError: jest.fn() }));
jest.mock("../auth/deviceRegistration", () => ({ deviceIdDigest: () => Promise.resolve("digest") }));
jest.mock("../notifications/pushExplainer", () => ({ maybeShowPushExplainer: (...args: unknown[]) => mockExplainer(...args) }));
jest.mock("../../components/useReduceMotion", () => ({ useReduceMotion: () => true }));
// WHY: the animation itself is native-driven; the angle math is covered in wheelAngle.test.ts.
jest.mock("../../components/wheel", () => ({
  WheelDisc: ({ targetIndex, onSettled }: { targetIndex: number | null; onSettled: () => void }) => {
    const { useEffect } = jest.requireActual("react");
    useEffect(() => {
      if (targetIndex !== null) onSettled();
    }, [targetIndex, onSettled]);
    return null;
  },
}));
jest.mock("expo-router", () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);

const segments = [
  { index: 0, label: "Postre gratis" },
  { index: 1, label: "Sello extra" },
  { index: 2, label: "10% de descuento" },
];
let wheelResult: { data: unknown; error: unknown };
let spinResult: { data: unknown; error: unknown };

const rpcCalls = (name: string) => mockSupabase.rpc.mock.calls.filter(([fn]) => fn === name);
const rpcError = (message: string) => ({ data: null, error: { message, details: null } });

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <WheelScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { merchantId: "m1" };
  wheelResult = { data: { segments, status: "available" }, error: null };
  spinResult = { data: { segment_index: 2, prize_type: "coupon", label: "10% de descuento", coupon_id: "c9" }, error: null };
  mockSupabase.rpc.mockImplementation((name: string) => Promise.resolve(name === "get_wheel" ? wheelResult : spinResult));
});

describe("A-12 WheelScreen", () => {
  it("spins with the device digest, shows the coupon and opens it", async () => {
    await renderScreen();
    await fireEvent.press(await screen.findByTestId("wheel-spin"));
    expect(await screen.findByText("¡Ganaste 10% de descuento!")).toBeOnTheScreen();
    expect(screen.getByTestId("wheel-prize-coupon")).toHaveTextContent(/10% de descuento/);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
    expect(rpcCalls("spin_wheel")).toEqual([["spin_wheel", { p_merchant_id: "m1", p_device_id_digest: "digest" }]]);
    await fireEvent.press(screen.getByText("Ver mi cupón"));
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: "/coupon/[id]", params: { id: "c9", merchantId: "m1" } });
  });

  it("blocks a second spin while the first is in flight", async () => {
    await renderScreen();
    const button = await screen.findByTestId("wheel-spin");
    await fireEvent.press(button);
    await fireEvent.press(button);
    await screen.findByText("¡Ganaste 10% de descuento!");
    expect(rpcCalls("spin_wheel")).toHaveLength(1);
  });

  it("announces an extra stamp without a coupon button", async () => {
    spinResult = { data: { segment_index: 1, prize_type: "extra_stamp", label: "Sello extra", coupon_id: null }, error: null };
    await renderScreen();
    await fireEvent.press(await screen.findByTestId("wheel-spin"));
    expect(await screen.findByText("¡Sello extra!")).toBeOnTheScreen();
    expect(screen.getByText("Se suma en tu próxima visita")).toBeOnTheScreen();
    expect(screen.queryByText("Ver mi cupón")).toBeNull();
  });

  it("explains E-06 from get_wheel status and goes to email verification", async () => {
    wheelResult = { data: { segments, status: "needs_verification" }, error: null };
    await renderScreen();
    await fireEvent.press(await screen.findByText("Verificar correo"));
    expect(mockRouter.push).toHaveBeenCalledWith("/verify-email");
  });

  it("explains E-06 when spin_wheel rejects", async () => {
    spinResult = rpcError("E-06");
    await renderScreen();
    await fireEvent.press(await screen.findByTestId("wheel-spin"));
    expect(await screen.findByTestId("wheel-unverified")).toBeOnTheScreen();
  });

  it("shows the already-spun state for status spun and for E-09", async () => {
    wheelResult = { data: { segments, status: "spun" }, error: null };
    const first = await renderScreen();
    expect(await screen.findByTestId("wheel-spun")).toBeOnTheScreen();
    await first.unmount();

    wheelResult = { data: { segments, status: "available" }, error: null };
    spinResult = rpcError("E-09");
    await renderScreen();
    await fireEvent.press(await screen.findByTestId("wheel-spin"));
    expect(await screen.findByTestId("wheel-spun")).toBeOnTheScreen();
  });

  it("shows unavailable and retryable error states", async () => {
    wheelResult = { data: { segments, status: "unavailable" }, error: null };
    const first = await renderScreen();
    expect(await screen.findByTestId("wheel-unavailable")).toBeOnTheScreen();
    await first.unmount();

    wheelResult = rpcError("network request failed");
    await renderScreen();
    expect(await screen.findByTestId("wheel-error")).toBeOnTheScreen();
  });

  it("opens A-16 after closing when asked by the entry point", async () => {
    mockParams = { merchantId: "m1", explainer: "1" };
    wheelResult = { data: { segments, status: "spun" }, error: null };
    await renderScreen();
    await fireEvent.press(await screen.findByText("Cerrar"));
    expect(mockRouter.back).toHaveBeenCalled();
    await waitFor(() => expect(mockExplainer).toHaveBeenCalledWith(mockRouter));
  });
});
