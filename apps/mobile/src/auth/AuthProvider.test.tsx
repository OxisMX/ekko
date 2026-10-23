import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { reportError } from "../lib/sentry";
import { AuthProvider, useAuth } from "./AuthProvider";

type Listener = (event: AuthChangeEvent, session: Session | null) => void;

const mockAuth = {
  listener: null as Listener | null,
  onAuthStateChange: jest.fn((listener: Listener) => {
    mockAuth.listener = listener;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  }),
  signOut: jest.fn(async (_options: { scope: string }) => {
    mockAuth.listener?.("SIGNED_OUT", null);
    return { error: null };
  }),
};

// WHY: getter, because jest.mock is hoisted above `mockAuth` and the factory runs at import time.
jest.mock("../lib/supabase", () => ({ supabase: { get auth() { return mockAuth; } } }));
const mockSignOutDevice = jest.fn();
jest.mock("../features/auth/deviceRegistration", () => ({ signOutDevice: () => mockSignOutDevice() }));
jest.mock("../lib/sentry", () => ({ reportError: jest.fn() }));

const session = (role: unknown) =>
  ({ access_token: "t", user: { email: "ana@ekko.mx", app_metadata: { role } } }) as unknown as Session;

function Probe() {
  const { status, errorCode, session, signOut, endSession, accountDeleted, finishAccountDeletion } = useAuth();
  return (
    <>
      <Text testID="auth" onPress={() => void signOut()}>
        {`${status}|${errorCode ?? "-"}|${session?.user.email ?? "-"}`}
      </Text>
      <Text testID="finish-deletion" onPress={() => void finishAccountDeletion()}>
        {`deleted:${accountDeleted}`}
      </Text>
      <Text testID="end-session" onPress={() => endSession("E-19")}>
        end
      </Text>
    </>
  );
}

let queryClient: QueryClient;

async function renderProvider() {
  queryClient = new QueryClient();
  const view = await render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>
  );
  return { ...view, emit: (event: AuthChangeEvent, s: Session | null) => act(() => mockAuth.listener!(event, s)) };
}

const authText = () => screen.getByTestId("auth").props.children as string;

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.listener = null;
  mockSignOutDevice.mockResolvedValue(undefined);
});

describe("AuthProvider", () => {
  it("starts loading and becomes signedOut without a stored session", async () => {
    const { emit } = await renderProvider();
    expect(authText()).toBe("loading|-|-");

    await emit("INITIAL_SESSION", null);
    expect(authText()).toBe("signedOut|-|-");
  });

  it("becomes signedIn with a stored customer session", async () => {
    const { emit } = await renderProvider();
    await emit("INITIAL_SESSION", session("customer"));
    expect(authText()).toBe("signedIn|-|ana@ekko.mx");
  });

  it("signs a merchant out locally and reports E-19", async () => {
    const { emit } = await renderProvider();
    await emit("INITIAL_SESSION", session("merchant"));

    expect(authText()).toBe("signedOut|E-19|-");
    await waitFor(() => expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: "local" }));
    expect(authText()).toBe("signedOut|E-19|-");
  });

  it("reports E-18 when the session ends without the user asking", async () => {
    const { emit } = await renderProvider();
    await emit("INITIAL_SESSION", session("customer"));
    await emit("SIGNED_OUT", null);
    expect(authText()).toBe("signedOut|E-18|-");
  });

  it("endSession signs out locally and keeps the server's reason (deleted account, wrong role)", async () => {
    const { emit } = await renderProvider();
    await emit("INITIAL_SESSION", session("customer"));
    await act(async () => {
      fireEvent.press(screen.getByTestId("end-session"));
    });
    await waitFor(() => expect(authText()).toBe("signedOut|E-19|-"));
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("does not report E-18 for a user-initiated sign-out", async () => {
    const { emit } = await renderProvider();
    await emit("INITIAL_SESSION", session("customer"));
    await fireEvent.press(screen.getByTestId("auth"));

    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(authText()).toBe("signedOut|-|-");
  });

  it("F-16: releases the device before the session ends and clears the cache", async () => {
    const { emit } = await renderProvider();
    await emit("INITIAL_SESSION", session("customer"));
    const clear = jest.spyOn(queryClient, "clear");
    await fireEvent.press(screen.getByTestId("auth"));

    expect(mockSignOutDevice.mock.invocationCallOrder[0]).toBeLessThan(mockAuth.signOut.mock.invocationCallOrder[0]!);
    expect(clear).toHaveBeenCalled();
  });

  it("F-16: a failing sign_out_device is reported but does not block the sign-out", async () => {
    mockSignOutDevice.mockRejectedValue(new Error("offline"));
    const { emit } = await renderProvider();
    await emit("INITIAL_SESSION", session("customer"));
    await fireEvent.press(screen.getByTestId("auth"));

    await waitFor(() => expect(authText()).toBe("signedOut|-|-"));
    expect(reportError).toHaveBeenCalled();
  });

  it("F-15: account deletion signs out locally without sign_out_device, clears the cache, flags A-02", async () => {
    const { emit } = await renderProvider();
    await emit("INITIAL_SESSION", session("customer"));
    const clear = jest.spyOn(queryClient, "clear");
    await fireEvent.press(screen.getByTestId("finish-deletion"));

    await waitFor(() => expect(authText()).toBe("signedOut|-|-"));
    expect(mockSignOutDevice).not.toHaveBeenCalled();
    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(clear).toHaveBeenCalled();
    expect(screen.getByTestId("finish-deletion")).toHaveTextContent("deleted:true");
  });
});
