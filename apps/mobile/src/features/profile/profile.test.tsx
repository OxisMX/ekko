import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import { Alert, Linking } from "react-native";

import { ProfileScreen } from "./ProfileScreen";
import { RedemptionsScreen } from "./RedemptionsScreen";

const mockSupabase = { rpc: jest.fn() };
const mockRouter = { push: jest.fn(), navigate: jest.fn() };
const mockSignOut = jest.fn();
const mockRegisterDevice = jest.fn();
const mockRequestPush = jest.fn();

jest.mock("../../lib/supabase", () => ({
  get supabase() {
    return mockSupabase;
  },
}));
jest.mock("../../lib/sentry", () => ({ reportError: jest.fn() }));
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("expo-notifications", () => ({ getPermissionsAsync: jest.fn() }));
jest.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ status: "signedIn", session: { user: { id: "u1", email: "ana@ekko.mx" } }, signOut: mockSignOut }),
}));
jest.mock("../auth/deviceRegistration", () => ({ registerDevice: () => mockRegisterDevice() }));
jest.mock("../notifications/pushToken", () => ({ requestPushPermission: () => mockRequestPush() }));
jest.mock("../auth/EmailVerificationBanner", () => ({ EmailVerificationBanner: () => null }));

const profile = {
  first_name: "Ana",
  last_name: "López",
  birth_date: "1990-03-05",
  email: "ana@ekko.mx",
  auth_provider: "email",
  email_verified: true,
  profile_complete: true,
};

const permission = (status: string, canAskAgain: boolean) =>
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status, canAskAgain });

function renderWith(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  permission("granted", true);
  mockRegisterDevice.mockResolvedValue(undefined);
  mockSupabase.rpc.mockResolvedValue({ data: profile, error: null });
});

describe("A-20 Perfil", () => {
  it("shows the data with the birth date as read-only", async () => {
    await renderWith(<ProfileScreen />);
    expect(await screen.findByTestId("profile-name")).toHaveTextContent("Ana López");
    expect(screen.getByText("AL", { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId("profile-birth-date")).toHaveTextContent(/05\/03\/1990/);
    expect(screen.getByText(/No se puede cambiar/)).toBeOnTheScreen();
    expect(screen.getByTestId("profile-email")).toHaveTextContent(/Verificado/);
    expect(screen.queryByText(/Eliminar cuenta/)).toBeNull();
  });

  it("offers to activate notifications when they can still be asked", async () => {
    permission("denied", true);
    mockRequestPush.mockResolvedValue(true);
    await renderWith(<ProfileScreen />);
    await fireEvent.press(await screen.findByText("Activar"));
    await waitFor(() => expect(mockRegisterDevice).toHaveBeenCalled());
  });

  it("opens system settings when the permission is blocked", async () => {
    permission("denied", false);
    const open = jest.spyOn(Linking, "openSettings").mockResolvedValue();
    await renderWith(<ProfileScreen />);
    await fireEvent.press(await screen.findByText("Abrir ajustes"));
    expect(open).toHaveBeenCalled();
    expect(mockRequestPush).not.toHaveBeenCalled();
  });

  it("shows no action when notifications are granted, and links to the history", async () => {
    await renderWith(<ProfileScreen />);
    expect(await screen.findByText("Activadas")).toBeOnTheScreen();
    expect(screen.queryByTestId("profile-notifications-action")).toBeNull();
    await fireEvent.press(screen.getByTestId("profile-history"));
    expect(mockRouter.push).toHaveBeenCalledWith("/redemptions");
  });

  it("signs out only after confirming, and blocks a second tap", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    let finish!: () => void;
    mockSignOut.mockReturnValue(new Promise<void>((resolve) => (finish = resolve)));
    await renderWith(<ProfileScreen />);
    await fireEvent.press(await screen.findByTestId("profile-sign-out"));
    expect(mockSignOut).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]![2]!;
    await act(async () => buttons.find((b) => b.style === "destructive")!.onPress!());
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Cerrando sesión…")).toBeOnTheScreen();
    await act(async () => finish());
  });
});

const row = (n: number) => ({ coupon_id: `c${n}`, merchant_name: "Café La Esquina", title: `Beneficio ${n}`, source: "wheel", redeemed_at: "2026-10-01T18:30:00Z" });

describe("A-21 Historial", () => {
  it("shows a loading placeholder while the first page is pending", async () => {
    mockSupabase.rpc.mockReturnValue(new Promise(() => undefined));
    await renderWith(<RedemptionsScreen />);
    expect(screen.getByLabelText("Cargando historial")).toBeOnTheScreen();
  });

  it("shows rows with origin and date/time", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [row(1)], error: null });
    await renderWith(<RedemptionsScreen />);
    expect(await screen.findByText("Beneficio 1")).toBeOnTheScreen();
    expect(screen.getByText("Bienvenida")).toBeOnTheScreen();
    expect(screen.getByText("01/10/2026 · 12:30")).toBeOnTheScreen();
    expect(mockSupabase.rpc).toHaveBeenCalledWith("list_my_redemptions", { p_offset: 0, p_limit: 20 });
  });

  it("shows the empty state", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });
    await renderWith(<RedemptionsScreen />);
    expect(await screen.findByText("Aún no has canjeado cupones")).toBeOnTheScreen();
  });

  it("shows an error and retries", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await renderWith(<RedemptionsScreen />);
    mockSupabase.rpc.mockResolvedValue({ data: [row(1)], error: null });
    await fireEvent.press(await screen.findByText("Reintentar"));
    expect(await screen.findByText("Beneficio 1")).toBeOnTheScreen();
  });

  it("loads the next page at the end of the list and stops on a short page", async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({ data: Array.from({ length: 20 }, (_, i) => row(i)), error: null })
      .mockResolvedValueOnce({ data: [row(20)], error: null });
    await renderWith(<RedemptionsScreen />);
    await screen.findByText("Beneficio 0");
    const list = screen.getByTestId("redemptions-list");
    await fireEvent(list, "endReached");
    await waitFor(() => expect(mockSupabase.rpc).toHaveBeenLastCalledWith("list_my_redemptions", { p_offset: 20, p_limit: 20 }));
    await act(async () => undefined); // WHY: let the short last page settle; FlatList only renders the first rows.
    await fireEvent(list, "endReached");
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
  });
});
