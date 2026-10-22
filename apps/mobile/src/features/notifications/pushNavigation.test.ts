import { addBreadcrumb } from "../../lib/sentry";
import { couponsHref, markHandled, parsePushData, pushHref, resetPushNavigation, setPendingPush, takePendingPush } from "./pushNavigation";

jest.mock("../../lib/sentry", () => ({ addBreadcrumb: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  resetPushNavigation();
});

describe("parsePushData", () => {
  it("accepts merchant_id with and without coupon_id", () => {
    expect(parsePushData({ merchant_id: "m1", coupon_id: "c1" })).toEqual({ merchantId: "m1", couponId: "c1" });
    expect(parsePushData({ merchant_id: "m1" })).toEqual({ merchantId: "m1", couponId: null });
    expect(parsePushData({ merchant_id: "m1", coupon_id: null })).toEqual({ merchantId: "m1", couponId: null });
  });

  it.each([undefined, null, {}, { merchant_id: "" }, { merchant_id: 5 }, { merchant_id: "m1", coupon_id: 3 }])("ignores malformed %p with a breadcrumb only", (data) => {
    expect(parsePushData(data)).toBeNull();
    expect(addBreadcrumb).toHaveBeenCalledWith("push", expect.not.stringContaining("m1"));
  });
});

describe("destinations", () => {
  it("opens the Promociones tab and highlights the coupon", () => {
    expect(pushHref({ merchantId: "m1", couponId: "c1" })).toEqual({
      pathname: "/merchant/[id]",
      params: { id: "m1", tab: "promos", from: "push", coupon: "c1" },
    });
  });

  it("omits the coupon param without coupon_id", () => {
    expect(pushHref({ merchantId: "m1", couponId: null })).toEqual({ pathname: "/merchant/[id]", params: { id: "m1", tab: "promos", from: "push" } });
  });

  it("falls back to the coupons tab", () => {
    expect(couponsHref).toEqual({ pathname: "/cards", params: { tab: "coupons" } });
  });
});

describe("pending push and dedupe", () => {
  it("keeps the target until taken, once", () => {
    setPendingPush({ merchantId: "m1", couponId: null });
    expect(takePendingPush()).toEqual({ merchantId: "m1", couponId: null });
    expect(takePendingPush()).toBeNull();
  });

  it("handles a notification request id only once (cold start)", () => {
    expect(markHandled("req-1")).toBe(true);
    expect(markHandled("req-1")).toBe(false);
    expect(markHandled("req-2")).toBe(true);
  });
});
