import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { useCardsTabBadge } from "./cardsTabBadge";

const mockSupabase = { rpc: jest.fn() };
jest.mock("../../lib/supabase", () => ({
  get supabase() {
    return mockSupabase;
  },
  supabaseUrl: "https://x.supabase.co",
}));

const card = (reward: boolean) => ({
  merchant_id: "m1", merchant_name: "Café", logo_path: null, stamp_image_path: null, merchant_available: true,
  stamps_count: 1, stamps_required: 8, cycle_expires_at: "2027-01-01T00:00:00Z", reward_available: reward, wheel_status: "none",
  stamps: [], reward_title: "Café americano", background_path: null, pending_extra_stamps: 0,
});
const coupon = { id: "c1", merchant_id: "m1", merchant_name: "Café", source: "wheel", title: "2x1", description: null, terms: null, expires_at: "2027-01-01T00:00:00Z", merchant_available: true };

function badgeFor(cards: unknown[], coupons: unknown[]) {
  mockSupabase.rpc.mockImplementation((fn: string) => Promise.resolve({ data: fn === "list_my_cards" ? cards : coupons, error: null }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useCardsTabBadge(), { wrapper });
}

describe("useCardsTabBadge (A-53)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("is on when a reward is available", async () => {
    const { result } = await badgeFor([card(true)], []);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("is on when there are active coupons", async () => {
    const { result } = await badgeFor([card(false)], [coupon]);
    await waitFor(() => expect(result.current).toBe(true));
  });

  it("is off with neither", async () => {
    const { result } = await badgeFor([card(false)], []);
    await waitFor(() => expect(mockSupabase.rpc).toHaveBeenCalledTimes(2));
    await act(async () => {});
    expect(result.current).toBe(false);
  });
});
