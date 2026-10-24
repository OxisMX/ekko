import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import { Alert } from "react-native";

import ExploreScreen from "../../app/(tabs)/index";
import type { MerchantListItem } from "./catalog";

const mockSupabase = { rpc: jest.fn(), auth: { signInWithOtp: jest.fn() } };
const mockAuth = { status: "signedIn", session: { user: { id: "u1", email: "ana@ekko.mx" } }, errorCode: null, signOut: jest.fn() };
const mockRouter = { push: jest.fn(), replace: jest.fn(), navigate: jest.fn() };

jest.mock("../../lib/supabase", () => ({
  get supabase() {
    return mockSupabase;
  },
  supabaseUrl: "https://x.supabase.co",
}));
jest.mock("../../lib/sentry", () => ({ reportError: jest.fn() }));
jest.mock("../../auth/AuthProvider", () => ({ useAuth: () => mockAuth }));
jest.mock("expo-router", () => ({ useRouter: () => mockRouter, useIsFocused: () => true }));
jest.mock("expo-linking", () => ({ openURL: jest.fn(() => Promise.resolve()) }));

const merchant = (id: string, name: string, maps_url = "https://maps.google.com/?q=1"): MerchantListItem => ({
  id,
  name,
  category: "cafeterias_postres",
  description: "Café de especialidad.",
  is_favorite: false,
  progress: null,
  logo_path: `merchants/${id}/logo/a`,
  cover_path: `merchants/${id}/cover/b`,
  maps_url,
});

type Profile = { auth_provider: string; email_verified: boolean; email: string };
let profile: Profile;
let listMerchants: jest.Mock;

function renderExplore() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <ExploreScreen />
    </QueryClientProvider>
  );
}

const listCalls = () => mockSupabase.rpc.mock.calls.filter(([name]) => name === "list_merchants").map(([, args]) => args);

beforeEach(() => {
  jest.clearAllMocks();
  profile = { auth_provider: "email", email_verified: true, email: "ana@ekko.mx" };
  listMerchants = jest.fn().mockResolvedValue({ data: { items: [merchant("m1", "Café La Esquina")], has_more: false }, error: null });
  mockSupabase.rpc.mockImplementation((name: string, args: unknown) =>
    name === "get_my_profile" ? Promise.resolve({ data: profile, error: null }) : listMerchants(args)
  );
});

describe("A-07 Explorar", () => {
  it("shows one loading placeholder, then the merchants and the end of the list", async () => {
    // WHY: shared skeleton awaits the reduce-motion setting, which lets a render flush resolve instant mocks; delay data so the loading state is observable.
    const instant = mockSupabase.rpc.getMockImplementation() as (...args: unknown[]) => unknown;
    mockSupabase.rpc.mockImplementation((...args: unknown[]) => new Promise((resolve) => setTimeout(() => resolve(instant(...args)), 50)));
    await renderExplore();
    expect(screen.getByLabelText("Cargando comercios")).toBeOnTheScreen();

    expect(await screen.findByText("Café La Esquina")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Cargando comercios")).toBeNull();
    expect(screen.getByText("No hay más comercios")).toBeOnTheScreen();
    expect(listCalls()[0]).toEqual({ p_seed: expect.any(String), p_query: undefined, p_category: undefined, p_offset: 0, p_limit: 10 });
  });

  it("searches 300 ms after typing, with the same session seed", async () => {
    await renderExplore();
    await screen.findByText("Café La Esquina");
    const seed = listCalls()[0].p_seed;

    await fireEvent.changeText(screen.getByLabelText("Buscar negocios"), " cafe ");
    expect(listCalls()).toHaveLength(1);
    await waitFor(() => expect(listCalls()).toHaveLength(2));
    expect(listCalls()[1]).toMatchObject({ p_seed: seed, p_query: "cafe", p_offset: 0 });
  });

  it("scrolls the search and chips with the list, keeping the same search field while it reloads", async () => {
    await renderExplore();
    await screen.findByText("Café La Esquina");
    expect(screen.getByTestId("explore-list")).toContainElement(screen.getByTestId("explore-header"));
    const input = screen.getByLabelText("Buscar negocios");

    listMerchants.mockReturnValueOnce(new Promise(() => undefined)); // the new query stays loading
    await fireEvent.changeText(input, "pan");
    await waitFor(() => expect(listCalls()).toHaveLength(2));
    expect(screen.getByLabelText("Cargando comercios")).toBeOnTheScreen();
    expect(screen.getByLabelText("Buscar negocios")).toBe(input);
  });

  it("filters by the chosen category and marks the chip selected", async () => {
    await renderExplore();
    await screen.findByText("Café La Esquina");

    await fireEvent.press(screen.getByRole("button", { name: "Barberías" }));
    await waitFor(() => expect(listCalls().at(-1)).toMatchObject({ p_category: "barberias" }));
    expect(screen.getByRole("button", { name: "Barberías" })).toBeSelected();
    expect(screen.getByRole("button", { name: "Todos" })).not.toBeSelected();
  });

  it("offers to clear the search when nothing matches, and clearing resets both filters", async () => {
    await renderExplore();
    await screen.findByText("Café La Esquina");
    listMerchants.mockResolvedValue({ data: { items: [], has_more: false }, error: null });

    await fireEvent.press(screen.getByRole("button", { name: "Spas" }));
    await fireEvent.changeText(screen.getByLabelText("Buscar negocios"), "zzz");
    await fireEvent.press(await screen.findByRole("button", { name: "Limpiar búsqueda" }));

    await waitFor(() => expect(listCalls().at(-1)).toMatchObject({ p_query: undefined, p_category: undefined }));
    expect(screen.getByLabelText("Buscar negocios").props.value).toBe("");
    expect(screen.getByRole("button", { name: "Todos" })).toBeSelected();
  });

  it("shows the offline state and retries", async () => {
    listMerchants.mockResolvedValueOnce({ data: null, error: { message: "TypeError: Network request failed", details: null } });
    await renderExplore();

    expect(await screen.findByText("Sin conexión")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Café La Esquina")).toBeOnTheScreen();
  });

  it("loads the next page from the offset after the first one", async () => {
    const first = Array.from({ length: 10 }, (_, i) => merchant(`m${i}`, `Negocio ${i}`));
    listMerchants
      .mockResolvedValueOnce({ data: { items: first, has_more: true }, error: null })
      .mockResolvedValueOnce({ data: { items: [merchant("m10", "Negocio 10")], has_more: false }, error: null });
    await renderExplore();
    await screen.findByText("Negocio 0");

    await fireEvent(screen.getByTestId("explore-list"), "endReached");
    await waitFor(() => expect(listCalls()).toHaveLength(2));
    expect(listCalls()[1]).toMatchObject({ p_offset: 10, p_limit: 10, p_seed: listCalls()[0].p_seed });
  });

  it("opens Google Maps from the card without opening the merchant", async () => {
    await renderExplore();
    await screen.findByText("Café La Esquina");

    await fireEvent.press(screen.getByRole("button", { name: "Abrir en Google Maps" }));
    expect(Linking.openURL).toHaveBeenCalledWith("https://maps.google.com/?q=1");
    expect(mockRouter.push).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "Café La Esquina, Cafeterías y Postres" }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/merchant/[id]", params: { id: "m1", name: "Café La Esquina" } });
  });

  it("refuses a non-https maps link", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    listMerchants.mockResolvedValue({ data: { items: [merchant("m1", "Café La Esquina", "javascript:alert(1)")], has_more: false }, error: null });
    await renderExplore();
    await screen.findByText("Café La Esquina");

    await fireEvent.press(screen.getByRole("button", { name: "Abrir en Google Maps" }));
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalled();
  });
});

describe("F-04 verification banner on Explorar", () => {
  it("shows for an unverified email account and leads to A-05", async () => {
    profile = { auth_provider: "email", email_verified: false, email: "ana@ekko.mx" };
    await renderExplore();

    expect(await screen.findByTestId("email-verification-banner")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Ingresar código" }));
    expect(mockRouter.push).toHaveBeenCalledWith("/verify-email");
  });

  it("resends from the banner and then cools down", async () => {
    profile = { auth_provider: "email", email_verified: false, email: "ana@ekko.mx" };
    mockSupabase.auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    await renderExplore();

    await fireEvent.press(await screen.findByRole("button", { name: "Reenviar correo" }));
    expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({ email: "ana@ekko.mx", options: { shouldCreateUser: false } });
    expect(await screen.findByRole("button", { name: /Reenviar en \d+ s/ })).toBeDisabled();
  });

  it.each([
    ["a verified email account", { auth_provider: "email", email_verified: true }],
    ["a Google account", { auth_provider: "google", email_verified: true }],
    ["an Apple account", { auth_provider: "apple", email_verified: true }],
  ])("stays hidden for %s", async (_case, account) => {
    profile = { ...account, email: "ana@ekko.mx" };
    await renderExplore();
    await screen.findByText("Café La Esquina");
    expect(screen.queryByTestId("email-verification-banner")).toBeNull();
  });
});
