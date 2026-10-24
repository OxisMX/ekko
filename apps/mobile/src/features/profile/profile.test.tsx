import { ERRORS } from "@ekko/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { Alert, Linking } from "react-native";

import { EditProfileScreen } from "./EditProfileScreen";
import { ProfileScreen } from "./ProfileScreen";
import { RedemptionsScreen } from "./RedemptionsScreen";

const mockUpload = jest.fn();
const mockSupabase = {
  rpc: jest.fn(),
  storage: { from: () => ({ upload: mockUpload, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x/${path}` } }) }) },
};
const mockRouter = { push: jest.fn(), navigate: jest.fn(), back: jest.fn() };
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
jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("expo-image-manipulator", () => ({
  SaveFormat: { JPEG: "jpeg" },
  ImageManipulator: {
    manipulate: () => ({ resize: () => ({ renderAsync: async () => ({ saveAsync: async () => ({ uri: "file:///resized.jpg" }) }) }) }),
  },
}));
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("../auth/EmailVerificationBanner", () => ({ EmailVerificationBanner: () => null }));

const profile = {
  first_name: "Ana",
  last_name: "López",
  birth_date: "1990-03-05",
  email: "ana@ekko.mx",
  auth_provider: "email",
  email_verified: true,
  profile_complete: true,
  avatar_path: null,
  push_opt_in: true,
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
  mockUpload.mockResolvedValue({ error: null });
  mockSupabase.rpc.mockResolvedValue({ data: profile, error: null });
});

describe("A-20 Perfil", () => {
  it("shows the info and the stats strip with the birth date read-only, and opens the editor", async () => {
    await renderWith(<ProfileScreen />);
    expect(await screen.findByTestId("profile-name")).toHaveTextContent("Ana López");
    expect(screen.getByText("AL", { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText("ana@ekko.mx")).toBeOnTheScreen();
    expect(screen.getByTestId("profile-birth-date")).toHaveTextContent(/05\/03\/1990/);
    expect(screen.queryByLabelText("Nombre")).toBeNull();
    expect(screen.queryByTestId("profile-push-opt-in")).toBeNull();
    expect(screen.queryByTestId("profile-save")).toBeNull();
    await fireEvent.press(screen.getByTestId("profile-edit"));
    expect(mockRouter.push).toHaveBeenCalledWith("/edit-profile");
    await fireEvent.press(screen.getByTestId("profile-delete-account"));
    expect(mockRouter.push).toHaveBeenCalledWith("/delete-account");
  });

  it("shows the dev push simulator only in __DEV__", async () => {
    const view = await renderWith(<ProfileScreen />);
    expect(await screen.findByTestId("profile-dev-push")).toBeOnTheScreen();
    await view.unmount();
    Object.assign(globalThis, { __DEV__: false });
    try {
      await renderWith(<ProfileScreen />);
      expect(await screen.findByTestId("profile-name")).toBeOnTheScreen();
      expect(screen.queryByTestId("profile-dev-push")).toBeNull();
    } finally {
      Object.assign(globalThis, { __DEV__: true });
    }
  });

  it("shows the achievements strip from my cards and redemptions (A-78)", async () => {
    const cardRow = (n: number, stamps: number) => ({
      merchant_id: `m${n}`, merchant_name: "Café", logo_path: null, stamp_image_path: null, merchant_available: true,
      stamps_count: stamps, stamps_required: 8, cycle_expires_at: "2027-01-01T00:00:00Z", reward_available: false, wheel_status: "none",
      stamps: [], reward_title: "Café americano", background_path: null, pending_extra_stamps: 0,
    });
    mockSupabase.rpc.mockImplementation((name: string) =>
      Promise.resolve({ data: name === "list_my_cards" ? [cardRow(1, 3), cardRow(2, 4)] : name === "list_my_redemptions" ? [row(1)] : profile, error: null })
    );
    await renderWith(<ProfileScreen />);
    expect(await screen.findByLabelText("Sellos: 7")).toBeOnTheScreen();
    expect(screen.getByLabelText("Tarjetas: 2")).toBeOnTheScreen();
    expect(screen.getByLabelText("Canjes: 1")).toBeOnTheScreen();
  });

  it("links to the history", async () => {
    await renderWith(<ProfileScreen />);
    await fireEvent.press(await screen.findByTestId("profile-history"));
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

describe("Editar perfil", () => {
  it("shows email and birth date as locked fields", async () => {
    await renderWith(<EditProfileScreen />);
    expect(await screen.findByTestId("profile-birth-date")).toHaveTextContent(/05\/03\/1990/);
    expect(screen.getAllByText(/No se puede cambiar/)).toHaveLength(2);
    expect(screen.getByTestId("profile-email")).toHaveTextContent(/Verificado/);
  });

  it("renders Guardar only when something changed, disabled while the names are invalid (A-79)", async () => {
    await renderWith(<EditProfileScreen />);
    await screen.findByTestId("profile-photo-change");
    expect(screen.queryByTestId("profile-save")).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("Nombre"), "A");
    expect(screen.getByText("Tu nombre debe tener al menos 2 caracteres.")).toBeOnTheScreen();
    expect(screen.getByTestId("profile-save")).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText("Nombre"), "Ana María");
    expect(screen.getByTestId("profile-save")).toBeEnabled();
    await fireEvent.changeText(screen.getByLabelText("Nombre"), "Ana");
    expect(screen.queryByTestId("profile-save")).toBeNull();
  });

  it("saves names and notification preference with update_profile and confirms", async () => {
    await renderWith(<EditProfileScreen />);
    await fireEvent.changeText(await screen.findByLabelText("Nombre"), " Ana María ");
    await fireEvent(screen.getByTestId("profile-push-opt-in"), "valueChange", false);
    mockSupabase.rpc.mockResolvedValue({ data: { ...profile, first_name: "Ana María", push_opt_in: false }, error: null });
    await fireEvent.press(screen.getByTestId("profile-save"));
    expect(await screen.findByText("Cambios guardados")).toBeOnTheScreen();
    expect(mockSupabase.rpc).toHaveBeenCalledWith("update_profile", {
      p_first_name: "Ana María",
      p_last_name: "López",
      p_avatar_path: null,
      p_push_opt_in: false,
    });
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled(), { timeout: 3000 });
  });

  it("shows a plain-language message when saving fails", async () => {
    await renderWith(<EditProfileScreen />);
    await fireEvent.changeText(await screen.findByLabelText("Apellido"), "Pérez");
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: "TypeError: Network request failed" } });
    await fireEvent.press(screen.getByTestId("profile-save"));
    expect(await screen.findByText(ERRORS["E-01"].message)).toBeOnTheScreen();
    expect(screen.getByTestId("profile-save")).toBeEnabled();
  });

  it("uploads a picked photo to customer-avatars/<uid>/ and saves its path", async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: "file:///picked.jpg" }] });
    jest.spyOn(globalThis, "fetch").mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(8) } as Response);
    await renderWith(<EditProfileScreen />);
    await fireEvent.press(await screen.findByTestId("profile-photo-change"));
    mockSupabase.rpc.mockResolvedValue({ data: { ...profile, avatar_path: "u1/1.jpg" }, error: null });
    await fireEvent.press(await waitFor(() => { const b = screen.getByTestId("profile-save"); expect(b).toBeEnabled(); return b; }));
    await waitFor(() => expect(mockUpload).toHaveBeenCalled());
    expect(mockUpload.mock.calls[0]![0]).toMatch(/^u1\/\d+\.jpg$/);
    expect(mockUpload.mock.calls[0]![2]).toEqual({ contentType: "image/jpeg" });
    await waitFor(() =>
      expect(mockSupabase.rpc).toHaveBeenCalledWith("update_profile", expect.objectContaining({ p_avatar_path: mockUpload.mock.calls[0]![0] }))
    );
  });

  it("explains how to allow photo access when permission is denied", async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });
    await renderWith(<EditProfileScreen />);
    await fireEvent.press(await screen.findByTestId("profile-photo-change"));
    expect(await screen.findByText(/permite el acceso a tus fotos/)).toBeOnTheScreen();
  });

  it("offers to activate notifications when they can still be asked", async () => {
    permission("denied", true);
    mockRequestPush.mockResolvedValue(true);
    await renderWith(<EditProfileScreen />);
    await fireEvent.press(await screen.findByText("Activar"));
    await waitFor(() => expect(mockRegisterDevice).toHaveBeenCalled());
  });

  it("shows the system row under the switch only when the OS permission needs attention (A-76)", async () => {
    permission("denied", false);
    await renderWith(<EditProfileScreen />);
    expect(await screen.findByText(/Desactivadas en el sistema/)).toBeOnTheScreen();
    expect(screen.getByTestId("profile-push-opt-in")).toBeOnTheScreen();
  });

  it("opens system settings when the permission is blocked", async () => {
    permission("denied", false);
    const open = jest.spyOn(Linking, "openSettings").mockResolvedValue();
    await renderWith(<EditProfileScreen />);
    await fireEvent.press(await screen.findByText("Abrir ajustes"));
    expect(open).toHaveBeenCalled();
    expect(mockRequestPush).not.toHaveBeenCalled();
  });

  it("shows a single notifications control when permission is granted", async () => {
    await renderWith(<EditProfileScreen />);
    expect(await screen.findByTestId("profile-push-opt-in")).toBeOnTheScreen();
    await act(async () => {});
    expect(screen.queryByTestId("profile-notifications-action")).toBeNull();
    expect(screen.queryByText(/Desactivadas en el sistema/)).toBeNull();
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
    expect(screen.getByText("Canjeado · 01/10/2026 · 12:30")).toBeOnTheScreen();
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
