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
  useIsFocused: () => true,
  useFocusEffect: (effect: () => void) => mockUseEffect(effect, [effect]),
}));

const card = (over: Partial<MyCard> = {}): MyCard => ({
  merchant_id: "m1",
  merchant_name: "Café La Esquina",
  logo_path: null,
  stamp_image_path: null,
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

const detail = {
  merchant: { id: "m1", name: "Café La Esquina", category: "cafeterias_postres", description: null, address: null, logo_path: null, cover_path: null, maps_url: null, reviews_url: null, available: true, is_favorite: false },
  card: {
    stamp_image_path: null,
    has_relation: true,
    stamps_required: 6,
    stamps: ["01", "08", "15"].map((day) => ({ granted_at: `2026-10-${day}T17:00:00Z`, is_bonus: false })),
    cycle_expires_at: "2027-04-12T12:00:00Z",
    reward_title: "Café americano",
    reward_description: null,
    terms: null,
    background_path: null,
    pending_extra_stamps: 0,
    reward_coupon_id: null,
    stamped_today: false,
  },
  wheel: { status: "no_wheel" },
  menu: { categories: [], products: [] },
  offers: [],
  coupons: [],
};

// list_my_cards answers `cardsResult`; get_merchant_detail (one per stacked card) answers `detail`.
let cardsResult: { data: unknown; error: unknown };
const answerRpc = (name: string) => {
  if (name === "list_my_cards") return Promise.resolve(cardsResult);
  return Promise.resolve({ data: name === "get_merchant_detail" ? detail : [], error: null });
};

beforeEach(() => {
  jest.clearAllMocks();
  cardsResult = { data: [card()], error: null };
  mockSupabase.rpc.mockImplementation(answerRpc);
});

describe("A-12 Mis Tarjetas", () => {
  beforeEach(() => {
    mockParams = {};
  });

  it("opens on the coupons tab when asked to (F-12)", async () => {
    mockParams = { tab: "coupons" };
    cardsResult = { data: [], error: null };
    await renderCards();
    expect(await screen.findByTestId("coupons-empty")).toBeOnTheScreen();
  });

  it("shows a loading placeholder, then the stacked card with its real stamp card", async () => {
    // WHY: shared skeleton awaits the reduce-motion setting, which lets a render flush resolve instant mocks; delay data so the loading state is observable.
    mockSupabase.rpc.mockImplementation((name: string) => new Promise((resolve) => setTimeout(() => resolve(answerRpc(name)), 50)));
    await renderCards();
    expect(screen.getByLabelText("Cargando tarjetas")).toBeOnTheScreen();
    expect(await screen.findByText("Premio: Café americano")).toBeOnTheScreen();
    expect(screen.getByText("Café La Esquina")).toBeOnTheScreen();
    expect(screen.getByText("3/6")).toBeOnTheScreen();
    expect(screen.getByText("Vence el 12/04/2027")).toBeOnTheScreen();
    expect(screen.queryByText("Premio listo")).toBeNull();
    expect(mockSupabase.rpc).toHaveBeenCalledWith("list_my_cards");
  });

  it("shows the reward and wheel states in the strip and a full accessibility label", async () => {
    cardsResult = { data: [card({ reward_available: true, wheel_status: "available" })], error: null };
    await renderCards();
    expect(await screen.findByText("Premio listo")).toBeOnTheScreen();
    expect(screen.getByLabelText("Café La Esquina, 3 de 6 sellos, premio Café americano, vence el 12/04/2027, Premio listo")).toBeOnTheScreen();
  });

  it("opens the merchant detail when any card in the stack is pressed", async () => {
    cardsResult = { data: [card(), card({ merchant_id: "m2", merchant_name: "Panadería Sol" })], error: null };
    await renderCards();
    await fireEvent.press(await screen.findByTestId("my-card-m1"));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/merchant/[id]", params: { id: "m1", name: "Café La Esquina" } });
    await fireEvent.press(screen.getByTestId("my-card-m2"));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/merchant/[id]", params: { id: "m2", name: "Panadería Sol" } });
  });

  it("keeps an unavailable merchant visible, labelled, and still opens its detail (RN-71)", async () => {
    cardsResult = { data: [card({ merchant_available: false, reward_available: true })], error: null };
    await renderCards();
    expect(await screen.findByText("No disponible")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("my-card-m1"));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/merchant/[id]", params: { id: "m1", name: "Café La Esquina" } });
  });

  it("guides the first use to Explorar", async () => {
    cardsResult = { data: [], error: null };
    await renderCards();
    expect(await screen.findByText("Aún no tienes tarjetas")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Explorar comercios"));
    expect(mockRouter.navigate).toHaveBeenCalledWith("/");
  });

  it("shows the error state and retries", async () => {
    cardsResult = { data: null, error: { message: "Network request failed" } };
    await renderCards();
    expect(await screen.findByTestId("cards-error")).toBeOnTheScreen();
    cardsResult = { data: [card()], error: null };
    await fireEvent.press(screen.getByText("Reintentar"));
    expect(await screen.findByText("Café La Esquina")).toBeOnTheScreen();
  });

  it("opens the scanner from Registrar visita", async () => {
    await renderCards();
    await screen.findByText("Café La Esquina");
    await fireEvent.press(screen.getByText("Registrar visita"));
    expect(mockRouter.push).toHaveBeenCalledWith("/scan");
  });
});
