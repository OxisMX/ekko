import { nextPageParam, type MerchantsPage } from "./catalog";

jest.mock("../../lib/supabase", () => ({ supabase: {}, supabaseUrl: "https://x.supabase.co" }));

const page = (count: number, has_more: boolean): MerchantsPage => ({
  items: Array.from({ length: count }, (_, i) => ({
    id: `m${i}`,
    name: "x",
    category: "otros",
    description: "",
    logo_path: "",
    cover_path: "",
    is_favorite: false,
    progress: null,
    maps_url: "https://maps.google.com",
  })),
  has_more,
});

describe("nextPageParam", () => {
  it("asks for the offset after everything loaded so far while has_more", () => {
    expect(nextPageParam(page(10, true), [page(10, true)])).toBe(10);
    expect(nextPageParam(page(10, true), [page(10, true), page(10, true)])).toBe(20);
  });

  it("stops when the server says there is nothing more", () => {
    expect(nextPageParam(page(4, false), [page(10, true), page(4, false)])).toBeUndefined();
  });
});
