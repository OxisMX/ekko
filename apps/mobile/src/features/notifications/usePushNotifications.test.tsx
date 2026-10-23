import { act, render, screen } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import { Text } from "react-native";

import type { GateRoute } from "../auth/gate";
import { resetPushNavigation } from "./pushNavigation";
import { foregroundHandler, usePushNotifications } from "./usePushNotifications";

const mockRouter = { push: jest.fn() };
const mockInvalidate = jest.fn();

jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("../../lib/supabase", () => ({ supabase: {}, supabaseUrl: "https://x.supabase.co" }));
jest.mock("../../lib/sentry", () => ({ addBreadcrumb: jest.fn() }));
jest.mock("../../lib/queryClient", () => ({ queryClient: { invalidateQueries: (...args: unknown[]) => mockInvalidate(...args) } }));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn(() => Promise.resolve(null)),
}));

const response = (id: string, data: unknown) => ({ notification: { request: { identifier: id, content: { title: "T", body: "B", data } } } });
const lastListener = (fn: jest.Mock) => fn.mock.calls[fn.mock.calls.length - 1][0] as (arg: unknown) => void;

let route: GateRoute = "tabs";
function Probe() {
  const { toast } = usePushNotifications(route);
  return <Text testID="toast">{JSON.stringify(toast)}</Text>;
}
const mount = () => render(<Probe />);
const toast = () => JSON.parse(screen.getByTestId("toast").props.children as string) as unknown;

beforeEach(() => {
  jest.clearAllMocks();
  resetPushNavigation();
  route = "tabs";
  jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValue(null);
});

it("foreground handler shows no OS banner", async () => {
  await expect(foregroundHandler.handleNotification({} as never)).resolves.toMatchObject({ shouldShowBanner: false, shouldShowList: false });
  await mount();
  expect(Notifications.setNotificationHandler).toHaveBeenCalledWith(foregroundHandler);
});

it("a foreground push shows a toast and refreshes coupons", async () => {
  await mount();
  await act(async () => lastListener(jest.mocked(Notifications.addNotificationReceivedListener) as never)(response("n1", { merchant_id: "m1", coupon_id: "c1" }).notification));
  expect(toast()).toEqual({ title: "T", body: "B", target: { merchantId: "m1", couponId: "c1" } });
  expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ["my-coupons"] });
  expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ["merchant-detail", "m1"] });
});

it("a malformed push is ignored", async () => {
  await mount();
  await act(async () => lastListener(jest.mocked(Notifications.addNotificationReceivedListener) as never)(response("n1", { nope: 1 }).notification));
  expect(toast()).toBeNull();
  expect(mockInvalidate).not.toHaveBeenCalled();
});

it("a tap with a session opens the merchant promos with the coupon highlighted", async () => {
  await mount();
  await act(async () => lastListener(jest.mocked(Notifications.addNotificationResponseReceivedListener) as never)(response("n1", { merchant_id: "m1", coupon_id: "c1" })));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: "/merchant/[id]", params: { id: "m1", tab: "promos", from: "push", coupon: "c1" } });
});

it("a tap without a session waits for the gate, then navigates", async () => {
  route = "auth";
  const view = await mount();
  await act(async () => lastListener(jest.mocked(Notifications.addNotificationResponseReceivedListener) as never)(response("n1", { merchant_id: "m1" })));
  expect(mockRouter.push).not.toHaveBeenCalled();
  route = "tabs";
  await view.rerender(<Probe />);
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
});

it("cold start: the same response from the listener and getLast opens once", async () => {
  const cold = response("n9", { merchant_id: "m1" });
  jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValue(cold as never);
  await mount();
  await act(async () => undefined);
  await act(async () => lastListener(jest.mocked(Notifications.addNotificationResponseReceivedListener) as never)(cold));
  expect(mockRouter.push).toHaveBeenCalledTimes(1);
});

it("does not crash when notifications are unavailable (Expo Go)", async () => {
  jest.mocked(Notifications.addNotificationReceivedListener).mockImplementationOnce(() => {
    throw new Error("unsupported");
  });
  await expect(mount()).resolves.toBeDefined();
});
