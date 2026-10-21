import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";

import VisitResultScreen from "../../app/visit-result";

const TOKEN = "AbCdEfGhIjKlMnOpQr_-12";
const mockSupabase = { rpc: jest.fn() };
const mockRouter = { replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) };
const mockEndSession = jest.fn();
let mockParams: Record<string, string>;

jest.mock("../../lib/supabase", () => ({
  get supabase() {
    return mockSupabase;
  },
  supabaseUrl: "https://x.supabase.co",
}));
jest.mock("../../lib/sentry", () => ({ reportError: jest.fn() }));
jest.mock("../auth/deviceRegistration", () => ({ deviceIdDigest: () => Promise.resolve("digest") }));
jest.mock("../../auth/AuthProvider", () => ({ useAuth: () => ({ endSession: mockEndSession }) }));
jest.mock("expo-router", () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);

const success = {
  merchant_id: "m1",
  merchant_name: "Café Luna",
  stamps_added: 1,
  stamps_count: 4,
  stamps_required: 8,
  cycle_completed: false,
  reward_coupon_id: null,
  relation_created: false,
  wheel_status: null,
};
const networkError = { message: "TypeError: Network request failed" };

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <VisitResultScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { token: TOKEN };
});

describe("A-15 visit result", () => {
  it("claims with the token and device digest, then opens the card with the new stamp", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: success, error: null });
    await renderScreen();
    expect(await screen.findByText("Llevas 4 de 8.")).toBeOnTheScreen();
    expect(mockSupabase.rpc).toHaveBeenCalledWith("claim_visit", { p_token: TOKEN, p_device_id_digest: "digest" });
    await fireEvent.press(screen.getByRole("button", { name: "Ver mi tarjeta" }));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith({ pathname: "/merchant/[id]", params: { id: "m1", highlight: "last" } });
  });

  it("a completed card opens Promociones on the reward coupon", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: { ...success, cycle_completed: true, reward_coupon_id: "k1" }, error: null });
    await renderScreen();
    await fireEvent.press(await screen.findByRole("button", { name: "Ver recompensa" }));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith({ pathname: "/merchant/[id]", params: { id: "m1", tab: "promos", coupon: "k1" } });
  });

  it.each([
    ["E-02", "Este código ya no es válido. Pide al cajero uno nuevo."],
    ["E-03", "Este código ya no es válido. Pide al cajero uno nuevo."],
    ["E-04", "Ya registraste tu visita de hoy en este negocio. Vuelve mañana."],
    ["E-05", "Este negocio no está disponible por ahora. Tus sellos siguen guardados."],
    ["E-08", "Este no es un código de Ekko."],
  ])("%s maps to its result", async (code, message) => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: code, details: null } });
    await renderScreen();
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("offline retries once with the same token, then asks for a new code", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: networkError });
    await renderScreen();
    await fireEvent.press(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("button", { name: "Escanear de nuevo" })).toBeOnTheScreen();
    expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
    expect(mockSupabase.rpc.mock.calls.map(([, args]) => args.p_token)).toEqual([TOKEN, TOKEN]);
    await fireEvent.press(screen.getByRole("button", { name: "Escanear de nuevo" }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/scan");
  });

  it("a retry that succeeds shows the stamp", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: networkError }).mockResolvedValueOnce({ data: success, error: null });
    await renderScreen();
    await fireEvent.press(await screen.findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("¡Sello registrado!")).toBeOnTheScreen();
  });

  it("an expired pending link never calls the server (F-09 M)", async () => {
    mockParams = { expired: "1" };
    await renderScreen();
    expect(screen.getByRole("alert")).toHaveTextContent("Este código ya no es válido. Pide al cajero uno nuevo.");
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it("E-18 keeps the token pending and ends the session (RR-3)", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: "E-18", details: null } });
    await renderScreen();
    await screen.findByRole("alert");
    expect(mockEndSession).toHaveBeenCalledWith("E-18");
    const { takePendingVisit } = jest.requireActual<typeof import("./pendingVisit")>("./pendingVisit");
    expect(takePendingVisit()).toEqual({ token: TOKEN, fresh: true });
  });
});
