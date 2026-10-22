import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { reportError } from "../../lib/sentry";
import { BirthdayGreeting } from "./BirthdayGreeting";
import { resetBirthdayState, useEnsureBirthdayCouponsOnce } from "./birthdayCoupons";

const mockSupabase = { rpc: jest.fn() };
const mockRouter = { navigate: jest.fn() };
const mockAuth = { status: "signedIn", session: { user: { id: "u1" } } };

jest.mock("../../lib/supabase", () => ({
  get supabase() {
    return mockSupabase;
  },
}));
jest.mock("../../lib/sentry", () => ({ reportError: jest.fn() }));
jest.mock("../../auth/AuthProvider", () => ({ useAuth: () => mockAuth }));
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

function Harness() {
  useEnsureBirthdayCouponsOnce("u1");
  return <BirthdayGreeting />;
}

let client: QueryClient;
const renderHarness = () =>
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>
  );
const ensureCalls = () => mockSupabase.rpc.mock.calls.filter(([name]) => name === "ensure_birthday_coupons");

function mockRpc(ensure: () => unknown) {
  mockSupabase.rpc.mockImplementation((name: string) =>
    Promise.resolve(name === "get_my_profile" ? { data: { first_name: "Ana" }, error: null } : ensure())
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  resetBirthdayState();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

describe("F-12 cupón de cumpleaños", () => {
  it("greets once, invalidates coupons and opens the coupons tab", async () => {
    mockRpc(() => ({ data: { created: 2 }, error: null }));
    const invalidate = jest.spyOn(client, "invalidateQueries");
    await renderHarness();
    expect(await screen.findByText("¡Feliz cumpleaños, Ana!")).toBeOnTheScreen();
    expect(screen.getByText("Tienes 2 regalos de cumpleaños")).toBeOnTheScreen();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["my-coupons"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["merchant-detail"] });
    await fireEvent.press(screen.getByRole("button", { name: "Ver mis cupones" }));
    expect(mockRouter.navigate).toHaveBeenCalledWith({ pathname: "/cards", params: { tab: "coupons" } });
    expect(screen.queryByTestId("birthday-greeting")).toBeNull();
  });

  it("can be dismissed and does not call the RPC again on remount", async () => {
    mockRpc(() => ({ data: { created: 1 }, error: null }));
    const first = await renderHarness();
    expect(await screen.findByText("Tienes 1 regalo de cumpleaños")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Cerrar felicitación" }));
    expect(screen.queryByTestId("birthday-greeting")).toBeNull();
    await first.unmount();
    await renderHarness();
    expect(screen.queryByTestId("birthday-greeting")).toBeNull();
    expect(ensureCalls()).toHaveLength(1);
  });

  it("shows nothing when no gift was created", async () => {
    mockRpc(() => ({ data: { created: 0 }, error: null }));
    await renderHarness();
    await waitFor(() => expect(ensureCalls()).toHaveLength(1));
    expect(screen.queryByTestId("birthday-greeting")).toBeNull();
  });

  it("reports a failure without showing anything", async () => {
    mockRpc(() => ({ data: null, error: { message: "boom" } }));
    await renderHarness();
    await waitFor(() => expect(reportError).toHaveBeenCalledWith({ message: "boom" }));
    expect(screen.queryByTestId("birthday-greeting")).toBeNull();
  });
});
