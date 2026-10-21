import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import { Alert } from "react-native";

import MerchantScreen from "../../app/merchant/[id]";
import { menuChips, type MerchantDetail, productsFor } from "./merchantDetail";

const mockSupabase = { rpc: jest.fn() };
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock("../../lib/supabase", () => ({
  get supabase() {
    return mockSupabase;
  },
  supabaseUrl: "https://x.supabase.co",
}));
jest.mock("../../lib/sentry", () => ({ reportError: jest.fn() }));
jest.mock("expo-router", () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({ id: "m1" }) }));
jest.mock("expo-linking", () => ({ openURL: jest.fn(() => Promise.resolve()) }));
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);

function makeDetail(overrides: { card?: Partial<MerchantDetail["card"]>; menu?: MerchantDetail["menu"]; coupons?: MerchantDetail["coupons"] } = {}): MerchantDetail {
  return {
    merchant: {
      id: "m1",
      name: "Café La Esquina",
      category: "cafeterias_postres",
      description: "Café de especialidad.",
      address: "Av. Juárez 1",
      logo_path: "merchants/m1/logo/a",
      cover_path: "merchants/m1/cover/b",
      maps_url: "https://maps.google.com/?q=1",
      reviews_url: "https://g.page/r/review",
      available: true,
    },
    card: {
      has_relation: true,
      stamps_required: 8,
      stamps: [
        { granted_at: "2026-10-01T17:00:00Z", is_bonus: false },
        { granted_at: "2026-10-08T17:00:00Z", is_bonus: false },
        { granted_at: "2026-10-15T17:00:00Z", is_bonus: true },
      ],
      cycle_expires_at: "2027-04-01T17:00:00Z",
      reward_title: "Café americano gratis",
      reward_description: null,
      terms: "Compra mínima de $100 MXN.",
      background_path: null,
      pending_extra_stamps: 0,
      reward_coupon_id: null,
      stamped_today: false,
      ...overrides.card,
    },
    wheel: { status: "spun" },
    menu: overrides.menu ?? {
      categories: [
        { id: "c2", name: "Postres", position: 2 },
        { id: "c1", name: "Cafés", position: 1 },
      ],
      products: [
        { id: "p1", category_id: "c1", name: "Latte", description: null, price: 69, image_path: null, is_featured: true, is_sold_out: false },
        { id: "p2", category_id: "c1", name: "Espresso", description: null, price: 45, image_path: null, is_featured: false, is_sold_out: true },
        { id: "p3", category_id: "c2", name: "Brownie", description: null, price: 55, image_path: null, is_featured: false, is_sold_out: false },
      ],
    },
    offers: [{ id: "o1", title: "2x1 en lattes", description: "Todo el día.", weekday: 1, image_path: null }],
    coupons: overrides.coupons ?? [],
  };
}

let detailResult: { data: unknown; error: unknown };
let addCardResult: { data: unknown; error: unknown };

const rpcCalls = (name: string) => mockSupabase.rpc.mock.calls.filter(([fn]) => fn === name).map(([, args]) => args);

function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <MerchantScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  detailResult = { data: makeDetail(), error: null };
  addCardResult = { data: { created: true, wheel: { status: "available" } }, error: null };
  mockSupabase.rpc.mockImplementation((name: string) => Promise.resolve(name === "add_card" ? addCardResult : detailResult));
});

describe("A-08..A-11 Detalle de comercio", () => {
  it("shows the skeleton, then the header, tabs and the stamp card", async () => {
    await renderScreen();
    expect(screen.getByLabelText("Cargando comercio")).toBeOnTheScreen();

    expect(await screen.findByText("3 de 8 sellos")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Cargando comercio")).toBeNull();
    expect(screen.getByLabelText("Café La Esquina, Cafeterías y Postres")).toBeOnTheScreen();
    expect(screen.getByRole("tab", { name: "Tarjeta", selected: true })).toBeOnTheScreen();
    expect(screen.getByTestId("merchant-terms")).toHaveTextContent("Compra mínima de $100 MXN.");
    expect(screen.queryByText("Agregar a mis tarjetas")).toBeNull();
    expect(rpcCalls("get_merchant_detail")).toEqual([{ p_merchant_id: "m1" }]);
  });

  it("without a relation offers 'Agregar a mis tarjetas' and calls add_card, then refetches", async () => {
    detailResult = { data: makeDetail({ card: { has_relation: false, stamps: [], cycle_expires_at: null } }), error: null };
    await renderScreen();
    expect(await screen.findByText("0 de 8 sellos")).toBeOnTheScreen();

    await fireEvent.press(screen.getByText("Agregar a mis tarjetas"));
    expect(rpcCalls("add_card")).toEqual([{ p_merchant_id: "m1" }]);
    await waitFor(() => expect(rpcCalls("get_merchant_detail")).toHaveLength(2));
  });

  it("'Ver recompensa' switches to Promociones and highlights the reward coupon", async () => {
    const coupon = { id: "k1", source: "card_reward" as const, title: "Café americano gratis", description: null, terms: null, expires_at: "2026-11-20T06:00:00Z" };
    detailResult = { data: makeDetail({ card: { reward_coupon_id: "k1" }, coupons: [coupon] }), error: null };
    await renderScreen();

    await fireEvent.press(await screen.findByText("Ver recompensa"));
    expect(screen.getByRole("tab", { name: "Promociones", selected: true })).toBeOnTheScreen();
    expect(screen.getByTestId("coupon-highlighted")).toContainElement(screen.getByTestId("coupon-k1"));
    expect(screen.getByTestId("offer-o1")).toBeOnTheScreen();
  });

  it("'Registrar visita' opens the scanner and is hidden while the merchant is unavailable", async () => {
    const first = await renderScreen();
    await fireEvent.press(await screen.findByRole("button", { name: "Registrar visita" }));
    expect(mockRouter.push).toHaveBeenCalledWith("/scan");
    await first.unmount();

    const detail = makeDetail();
    detailResult = { data: { ...detail, merchant: { ...detail.merchant, available: false } }, error: null };
    await renderScreen();
    expect(await screen.findByText("3 de 8 sellos")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Registrar visita" })).toBeNull();
  });

  it("Menú: 'Más pedidos' is the first chip and filters; sold-out products are labelled", async () => {
    await renderScreen();
    await fireEvent.press(await screen.findByRole("tab", { name: "Menú" }));

    expect(screen.getByTestId("product-p1")).toBeOnTheScreen();
    expect(screen.queryByTestId("product-p2")).toBeNull();

    await fireEvent.press(screen.getByTestId("menu-chip-c1"));
    expect(screen.getByTestId("product-p2")).toBeOnTheScreen();
    expect(screen.getByText("Agotado por hoy")).toBeOnTheScreen();
    expect(screen.queryByTestId("product-p3")).toBeNull();
  });

  it("Menú empty state leads back to the card", async () => {
    detailResult = { data: makeDetail({ menu: { categories: [], products: [] } }), error: null };
    await renderScreen();
    await fireEvent.press(await screen.findByRole("tab", { name: "Menú" }));

    expect(screen.getByText("Este negocio aún no publica su menú")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Ver tarjeta"));
    expect(screen.getByRole("tab", { name: "Tarjeta", selected: true })).toBeOnTheScreen();
  });

  it("Reseña opens the merchant's reviews_url", async () => {
    await renderScreen();
    await fireEvent.press(await screen.findByRole("tab", { name: "Reseña" }));
    await fireEvent.press(screen.getByText("Dejar una reseña en Google Maps"));
    expect(Linking.openURL).toHaveBeenCalledWith("https://g.page/r/review");
  });

  it("E-05 explains the merchant is unavailable and goes back", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    detailResult = { data: null, error: { message: "E-05", details: null, code: "P0001" } };
    await renderScreen();

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect(alert).toHaveBeenCalledWith("Este negocio no está disponible por ahora.");
  });

  it("network failure shows a retryable error", async () => {
    detailResult = { data: null, error: { message: "TypeError: Network request failed" } };
    await renderScreen();
    expect(await screen.findByTestId("merchant-error")).toBeOnTheScreen();
  });
});

describe("menu helpers", () => {
  it("orders categories by position, hides empty ones and filters by chip", () => {
    const { menu } = makeDetail();
    menu.categories.push({ id: "c3", name: "Vacía", position: 0 });
    expect(menuChips(menu).map((c) => c.label)).toEqual(["Más pedidos", "Cafés", "Postres"]);
    expect(productsFor(menu, "featured").map((p) => p.id)).toEqual(["p1"]);
    expect(productsFor(menu, "c2").map((p) => p.id)).toEqual(["p3"]);
    const noFeatured = { ...menu, products: menu.products.map((p) => ({ ...p, is_featured: false })) };
    expect(menuChips(noFeatured)[0]?.label).toBe("Cafés");
  });
});
