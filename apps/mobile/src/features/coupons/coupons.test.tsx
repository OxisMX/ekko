import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { AppState } from "react-native";
import { useEffect as mockUseEffect } from "react";

import CouponCodeScreen from "../../app/coupon/[id]";
import CardsTab from "../../app/(tabs)/cards";
import * as Haptics from "expo-haptics";
import { COUPON_STATUS_POLL_MS } from "./couponStatus";
import type { MyCoupon } from "./myCoupons";

const mockSupabase = { rpc: jest.fn() };
const mockRouter = { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true };

jest.mock("../../lib/supabase", () => ({
  get supabase() {
    return mockSupabase;
  },
  supabaseUrl: "https://x.supabase.co",
}));
jest.mock("../../lib/sentry", () => ({ reportError: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: "c1", merchantId: "m1" }),
  useIsFocused: () => true,
  useFocusEffect: (effect: () => void) => mockUseEffect(effect, [effect]),
}));

const coupon = (over: Partial<MyCoupon> = {}): MyCoupon => ({
  id: "c1",
  merchant_id: "m1",
  merchant_name: "Café La Esquina",
  source: "card_reward",
  title: "Café gratis",
  description: null,
  terms: null,
  expires_at: "2027-04-12T12:00:00Z",
  merchant_available: true,
  ...over,
});

const revealed = { code: "ABC234", expires_at: "2027-04-12T12:00:00Z", title: "Café gratis", merchant_name: "Café La Esquina" };

async function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const invalidate = jest.spyOn(client, "invalidateQueries");
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { invalidate };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("A-18 Cupones", () => {
  it("shows loading, then the coupon with its Mostrar código action", async () => {
    // WHY deferred: on a slow CI runner an instantly resolved mock finished loading before the assertion.
    let resolveCoupons: (value: { data: unknown; error: null }) => void = () => undefined;
    mockSupabase.rpc.mockImplementation((fn: string) =>
      fn === "list_my_coupons"
        ? new Promise((resolve) => { resolveCoupons = resolve; })
        : Promise.resolve({ data: [], error: null })
    );
    await renderWithClient(<CardsTab />);
    await fireEvent.press(screen.getByRole("tab", { name: /^Cupones/ }));
    expect(screen.getByLabelText("Cargando cupones")).toBeOnTheScreen();
    resolveCoupons({ data: [coupon()], error: null });
    expect(await screen.findByText("Café gratis")).toBeOnTheScreen();
    expect(screen.getByText("Café La Esquina")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Mostrar código"));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/coupon/[id]", params: { id: "c1", merchantId: "m1" } });
  });

  it("keeps the coupon of an unavailable merchant usable (RN-71)", async () => {
    mockSupabase.rpc.mockImplementation((fn: string) =>
      Promise.resolve({ data: fn === "list_my_coupons" ? [coupon({ merchant_available: false })] : [], error: null })
    );
    await renderWithClient(<CardsTab />);
    await fireEvent.press(screen.getByRole("tab", { name: /^Cupones/ }));
    expect(await screen.findByText(/No disponible por ahora/)).toBeOnTheScreen();
    expect(screen.getByText("Mostrar código")).toBeOnTheScreen();
  });

  it("shows the active coupon count in the tab label (A-54)", async () => {
    mockSupabase.rpc.mockImplementation((fn: string) => Promise.resolve({ data: fn === "list_my_coupons" ? [coupon(), coupon({ id: "c2" })] : [], error: null }));
    await renderWithClient(<CardsTab />);
    expect(await screen.findByRole("tab", { name: "Cupones · 2" })).toBeOnTheScreen();
  });

  it("guides the empty state", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });
    await renderWithClient(<CardsTab />);
    await fireEvent.press(screen.getByRole("tab", { name: /^Cupones/ }));
    expect(await screen.findByText("Aún no tienes cupones")).toBeOnTheScreen();
  });

  it("shows the error state and retries", async () => {
    mockSupabase.rpc.mockImplementation((fn: string) =>
      Promise.resolve(fn === "list_my_coupons" ? { data: null, error: { message: "Network request failed" } } : { data: [], error: null })
    );
    await renderWithClient(<CardsTab />);
    await fireEvent.press(screen.getByRole("tab", { name: /^Cupones/ }));
    expect(await screen.findByTestId("coupons-error")).toBeOnTheScreen();
    mockSupabase.rpc.mockResolvedValue({ data: [coupon()], error: null });
    fireEvent.press(screen.getByText("Reintentar"));
    expect(await screen.findByText("Café gratis")).toBeOnTheScreen();
  });
});

describe("A-19 Código de canje", () => {
  it("shows the code in two groups with a spelled-out label", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: revealed, error: null });
    await renderWithClient(<CouponCodeScreen />);
    expect(await screen.findByText("ABC")).toBeOnTheScreen();
    expect(screen.getByText("234")).toBeOnTheScreen();
    expect(screen.getByLabelText("Código de canje: A, B, C, 2, 3, 4")).toBeOnTheScreen();
    expect(screen.getByText("Muestra este código al cajero")).toBeOnTheScreen();
    expect(mockSupabase.rpc).toHaveBeenCalledWith("reveal_coupon_code", { p_coupon_id: "c1" });
  });

  it("refreshes lists on close and when the app returns to the foreground", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: revealed, error: null });
    let onChange: (state: string) => void = () => {};
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
      onChange = listener as (state: string) => void;
      return { remove: jest.fn() };
    });
    const { invalidate } = await renderWithClient(<CouponCodeScreen />);
    await screen.findByText("ABC");
    await act(async () => onChange("active"));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["my-coupons"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["my-cards"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["merchant-detail", "m1"] });
    invalidate.mockClear();
    fireEvent.press(screen.getByText("Listo"));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["my-coupons"] });
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("A-65: shows the success state once get_coupon_status says redeemed, without re-revealing the code", async () => {
    const status = { status: "active", redeemed_at: null as string | null };
    mockSupabase.rpc.mockImplementation((fn: string) => Promise.resolve({ data: fn === "get_coupon_status" ? status : revealed, error: null }));
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
    try {
      await renderWithClient(<CouponCodeScreen />);
      expect(await screen.findByText("ABC")).toBeOnTheScreen();
      expect(mockSupabase.rpc).toHaveBeenCalledWith("get_coupon_status", { p_coupon_id: "c1" });
      expect(screen.queryByTestId("coupon-redeemed")).toBeNull();
      status.status = "redeemed";
      status.redeemed_at = "2026-10-23T12:00:00Z";
      await act(async () => {
        await jest.advanceTimersByTimeAsync(COUPON_STATUS_POLL_MS + 10);
      });
      expect(await screen.findByText("¡Listo! Disfruta tu Café gratis")).toBeOnTheScreen();
      expect(screen.queryByText("ABC")).toBeNull();
      expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");
      const statusCalls = () => mockSupabase.rpc.mock.calls.filter(([fn]) => fn === "get_coupon_status").length;
      const before = statusCalls();
      await act(async () => {
        await jest.advanceTimersByTimeAsync(COUPON_STATUS_POLL_MS * 3);
      });
      expect(statusCalls()).toBe(before);
      expect(mockSupabase.rpc.mock.calls.filter(([fn]) => fn === "reveal_coupon_code")).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it("E-06 sends the user to verify their email", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: "E-06" } });
    await renderWithClient(<CouponCodeScreen />);
    fireEvent.press(await screen.findByText("Verificar correo"));
    expect(mockRouter.push).toHaveBeenCalledWith("/verify-email");
  });

  it.each([
    ["E-10", "Este cupón venció."],
    ["E-11", "Este cupón ya fue canjeado."],
  ])("%s explains and refreshes on close", async (code, message) => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: code } });
    const { invalidate } = await renderWithClient(<CouponCodeScreen />);
    expect(await screen.findByText(message)).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Actualizar lista"));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["my-coupons"] });
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
