import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import NotificationsPermissionScreen from "../../app/notifications-permission";

const mockSupabase = { rpc: jest.fn() };
const mockRouter = { canGoBack: () => true, back: jest.fn(), replace: jest.fn() };
const mockRequestPush = jest.fn();
const mockRegisterDevice = jest.fn();

jest.mock("../../lib/supabase", () => ({
  get supabase() {
    return mockSupabase;
  },
}));
jest.mock("../../lib/sentry", () => ({ reportError: jest.fn() }));
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("../auth/deviceRegistration", () => ({ registerDevice: () => mockRegisterDevice() }));
jest.mock("./pushToken", () => ({ requestPushPermission: () => mockRequestPush() }));

async function renderScreen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <NotificationsPermissionScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
  mockRegisterDevice.mockResolvedValue(undefined);
});

// Apple 4.5.4: accepting the explainer (copy mentions offers) is the promotional-push consent.
it("opts in to promotions only when the system permission is granted", async () => {
  mockRequestPush.mockResolvedValue(true);
  await renderScreen();
  fireEvent.press(screen.getByTestId("notifications-explainer-primary"));
  await waitFor(() => expect(mockSupabase.rpc).toHaveBeenCalledWith("set_push_opt_in", { p_value: true }));
  expect(mockRouter.back).toHaveBeenCalled();
});

it("does not opt in when the system permission is denied", async () => {
  mockRequestPush.mockResolvedValue(false);
  await renderScreen();
  fireEvent.press(screen.getByTestId("notifications-explainer-primary"));
  await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
  expect(mockSupabase.rpc).not.toHaveBeenCalled();
  expect(screen.queryByTestId("notifications-explainer-secondary")).toBeNull();
});
