import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { useEffect as mockUseEffect } from "react";

import CardsTab from "../../app/(tabs)/cards";
import type { MyCard } from "./myCards";

const mockSupabase = { rpc: jest.fn() };
let mockParams: { tab?: string } = {};
const mockRouter = { push: jest.fn(), navigate: jest.fn() };

jest.mock("../../lib/supabase", () => ({
  get supabase() {
    return mockSupabase;
  },
  supabaseUrl: "https://x.supabase.co",
}));
jest.mock("../../lib/sentry", () => ({ reportError: jest.fn() }));
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (effect: () => void) => mockUseEffect(effect, [effect]),
}));

const card = (over: Partial<MyCard> = {}): MyCard => ({
  merchant_id: "m1",
  merchant_name: "Café La Esquina",
  logo_path: null,
  merchant_available: true,
  stamps_count: 3,
  stamps_required: 6,
  cycle_expires_at: "2027-04-12T12:00:00Z",
  reward_available: false,
  wheel_status: "no_wheel",
  ...over,
});

function renderCards() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <CardsTab />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.rpc.mockResolvedValue({ data: [card()], error: null });
});

describe("A-12 Mis Tarjetas", () => {
  beforeEach(() => {
    mockParams = {};
  });

  it("opens on the coupons tab when asked to (F-12)", async () => {
    mockParams = { tab: "coupons" };
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });
    await renderCards();
    expect(await screen.findByTestId("coupons-empty")).toBeOnTheScreen();
  });

  it("shows a loading placeholder, then the card with progress and expiry", async () => {
    await renderCards();
    expect(screen.getByLabelText("Cargando tarjetas")).toBeOnTheScreen();
    expect(await screen.findByText("Café La Esquina")).toBeOnTheScreen();
    expect(screen.getByText(/3 de 6 sellos · Vence el 12 abr/)).toBeOnTheScreen();
    expect(screen.queryByText("Recompensa disponible")).toBeNull();
    expect(screen.queryByText("Gira tu ruleta")).toBeNull();
    expect(mockSupabase.rpc).toHaveBeenCalledWith("list_my_cards");
  });

  it("shows the reward and wheel badges and a full accessibility label", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [card({ reward_available: true, wheel_status: "available" })], error: null });
    await renderCards();
    expect(await screen.findByText("Recompensa disponible")).toBeOnTheScreen();
    expect(screen.getByText("Gira tu ruleta")).toBeOnTheScreen();
    expect(screen.getByLabelText("Café La Esquina. 3 de 6 sellos. Vence el 12 abr. Recompensa disponible. Gira tu ruleta")).toBeOnTheScreen();
  });

  it("the wheel badge opens A-12, also while the email is unverified", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [card({ wheel_status: "needs_verification" })], error: null });
    await renderCards();
    await fireEvent.press(await screen.findByText("Gira tu ruleta"));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/wheel/[merchantId]", params: { merchantId: "m1" } });
    expect(mockRouter.push).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: "/merchant/[id]" }));
  });

  it("opens the merchant detail when a card is pressed", async () => {
    await renderCards();
    fireEvent.press(await screen.findByTestId("my-card-m1"));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/merchant/[id]", params: { id: "m1", name: "Café La Esquina" } });
  });

  it("dims an unavailable merchant and offers no action (RN-71)", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [card({ merchant_available: false, reward_available: true })], error: null });
    await renderCards();
    expect(await screen.findByText("No disponible")).toBeOnTheScreen();
    expect(screen.queryByText("Recompensa disponible")).toBeNull();
    fireEvent.press(screen.getByTestId("my-card-m1"));
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it("guides the first use to Explorar", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null });
    await renderCards();
    expect(await screen.findByText("Aún no tienes tarjetas")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Explorar comercios"));
    expect(mockRouter.navigate).toHaveBeenCalledWith("/");
  });

  it("shows the error state and retries", async () => {
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: "Network request failed" } });
    await renderCards();
    expect(await screen.findByTestId("cards-error")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Reintentar"));
    expect(await screen.findByText("Café La Esquina")).toBeOnTheScreen();
  });

  it("opens the scanner from Registrar visita", async () => {
    await renderCards();
    await screen.findByText("Café La Esquina");
    fireEvent.press(screen.getByText("Registrar visita"));
    expect(mockRouter.push).toHaveBeenCalledWith("/scan");
  });
});
