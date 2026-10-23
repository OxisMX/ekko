import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Alert } from "react-native";

import { useToggleFavorite } from "./favorites";

const mockSupabase = { rpc: jest.fn() };
jest.mock("../../lib/supabase", () => ({
  get supabase() {
    return mockSupabase;
  },
  supabaseUrl: "https://x.supabase.co",
}));
jest.mock("../../lib/sentry", () => ({ reportError: jest.fn() }));

const item = (id: string, is_favorite: boolean) => ({ id, is_favorite });
const listKey = ["merchants", "seed", "", null];

async function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["merchant-detail", "m1"], { merchant: { id: "m1", is_favorite: false } });
  client.setQueryData(listKey, { pages: [{ items: [item("m1", false), item("m2", true)], has_more: false }], pageParams: [0] });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = await renderHook(() => useToggleFavorite(), { wrapper });
  return { client, result };
}

const isFavoriteInList = (client: QueryClient, id: string) =>
  (client.getQueryData(listKey) as { pages: { items: { id: string; is_favorite: boolean }[] }[] }).pages[0]!.items.find((i) => i.id === id)!.is_favorite;

describe("useToggleFavorite", () => {
  beforeEach(() => jest.clearAllMocks());

  it("flips the heart in the detail and the list, calls the RPC and refetches the list", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: { is_favorite: true }, error: null });
    const { client, result } = await setup();
    const invalidate = jest.spyOn(client, "invalidateQueries");
    await act(async () => result.current.mutate({ merchantId: "m1", isFavorite: false }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["merchants"] }));
    expect(mockSupabase.rpc).toHaveBeenCalledWith("toggle_favorite", { p_merchant_id: "m1" });
    expect((client.getQueryData(["merchant-detail", "m1"]) as { merchant: { is_favorite: boolean } }).merchant.is_favorite).toBe(true);
    expect(isFavoriteInList(client, "m1")).toBe(true);
  });

  it("reverts and tells the user when the RPC fails", async () => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: "TypeError: Network request failed" } });
    const { client, result } = await setup();
    await act(async () => result.current.mutate({ merchantId: "m1", isFavorite: false }));
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect((client.getQueryData(["merchant-detail", "m1"]) as { merchant: { is_favorite: boolean } }).merchant.is_favorite).toBe(false);
    expect(isFavoriteInList(client, "m1")).toBe(false);
  });
});
