import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { DeleteAccountScreen } from "./DeleteAccountScreen";

const mockInvoke = jest.fn();
const mockRouter = { back: jest.fn() };
const mockAppleCode = jest.fn();
const mockAuth: { finishAccountDeletion: jest.Mock; endSession: jest.Mock; session: unknown } = {
  finishAccountDeletion: jest.fn(),
  endSession: jest.fn(),
  session: { user: { identities: [{ provider: "email" }] } },
};
const appleSession = { user: { identities: [{ provider: "email" }, { provider: "apple" }] } };

jest.mock("../../lib/supabase", () => ({ supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } } }));
jest.mock("../../lib/sentry", () => ({ reportError: jest.fn() }));
jest.mock("../auth/socialSignIn", () => ({ requestAppleAuthorizationCode: () => mockAppleCode() }));
const mockCache: Record<string, unknown> = {};
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ getQueryData: (key: string[]) => mockCache[key[0]!] }) }));
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("../../auth/AuthProvider", () => ({ useAuth: () => mockAuth }));

const httpError = (code: string) => new FunctionsHttpError({ json: async () => ({ error: code }) });
const type = (text: string) => fireEvent.changeText(screen.getByTestId("delete-account-input"), text);
const submit = () => fireEvent.press(screen.getByTestId("delete-account-submit"));

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(mockCache)) delete mockCache[key];
  mockAuth.session = { user: { identities: [{ provider: "email" }] } };
  mockAppleCode.mockResolvedValue("apple-code");
  mockAuth.finishAccountDeletion.mockResolvedValue(undefined);
  mockInvoke.mockResolvedValue({ data: { deleted: true }, error: null });
});

describe("A-22 Eliminar cuenta", () => {
  it("states the concrete loss from cached data, else the generic copy (A-81)", async () => {
    const view = await render(<DeleteAccountScreen />);
    expect(screen.getByTestId("delete-account-warning")).toHaveTextContent(/^Perderás todos tus sellos, cupones y premios\. Esta acción/);
    await view.unmount();
    mockCache["my-cards"] = [{ stamps_count: 5 }, { stamps_count: 9 }];
    mockCache["my-coupons"] = [{}];
    await render(<DeleteAccountScreen />);
    expect(screen.getByTestId("delete-account-warning")).toHaveTextContent(/^Perderás 2 tarjetas, 14 sellos y 1 cupón\. Esta acción/);
  });

  it("keeps the button disabled until the exact word is typed", async () => {
    await render(<DeleteAccountScreen />);
    const disabled = () => screen.getByTestId("delete-account-submit").props.accessibilityState.disabled;
    expect(disabled()).toBe(true);
    await type("eliminar");
    expect(disabled()).toBe(true);
    await type("ELIMINA");
    expect(disabled()).toBe(true);
    await type(" ELIMINAR ");
    expect(disabled()).toBe(false);
    await submit();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("invokes delete-account and cleans up the session on success", async () => {
    mockInvoke.mockResolvedValue({ data: { deleted: true }, error: null });
    await render(<DeleteAccountScreen />);
    await type("ELIMINAR");
    await submit();
    expect(mockInvoke).toHaveBeenCalledWith("delete-account", { body: { confirmation: "ELIMINAR" } });
    expect(mockAuth.finishAccountDeletion).toHaveBeenCalledTimes(1);
  });

  it("blocks a second submit while the request is pending", async () => {
    mockInvoke.mockReturnValue(new Promise(() => undefined));
    await render(<DeleteAccountScreen />);
    await type("ELIMINAR");
    await submit();
    await submit();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("delete-account-submit").props.accessibilityState.busy).toBe(true);
  });

  it.each([
    ["E-01", new FunctionsFetchError(new TypeError("Network request failed")), /No hay conexión/],
    ["E-99", httpError("E-99"), /Algo salió mal/],
  ])("shows %s with retry, and retrying works", async (_code, error, message) => {
    mockInvoke.mockResolvedValueOnce({ data: null, error }).mockResolvedValueOnce({ data: { deleted: true }, error: null });
    await render(<DeleteAccountScreen />);
    await type("ELIMINAR");
    await submit();
    expect(await screen.findByText(message)).toBeOnTheScreen();
    expect(mockAuth.finishAccountDeletion).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(screen.getByText("Reintentar")));
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(mockAuth.finishAccountDeletion).toHaveBeenCalledTimes(1);
  });

  it("treats E-18 as an expired session", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: httpError("E-18") });
    await render(<DeleteAccountScreen />);
    await type("ELIMINAR");
    await submit();
    expect(mockAuth.endSession).toHaveBeenCalledWith("E-18");
  });

  it("Cancelar goes back", async () => {
    await render(<DeleteAccountScreen />);
    await fireEvent.press(screen.getByTestId("delete-account-cancel"));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  describe("Apple identity (F-15)", () => {
    beforeEach(() => {
      mockAuth.session = appleSession;
    });

    it("re-authenticates and sends apple_authorization_code", async () => {
      await render(<DeleteAccountScreen />);
      await type("ELIMINAR");
      await submit();
      expect(mockInvoke).toHaveBeenCalledWith("delete-account", { body: { confirmation: "ELIMINAR", apple_authorization_code: "apple-code" } });
      expect(mockAuth.finishAccountDeletion).toHaveBeenCalledTimes(1);
    });

    it("stays on the screen without error when the user cancels Apple", async () => {
      mockAppleCode.mockResolvedValue(null);
      await render(<DeleteAccountScreen />);
      await type("ELIMINAR");
      await submit();
      expect(mockInvoke).not.toHaveBeenCalled();
      expect(screen.queryByTestId("delete-account-error")).toBeNull();
      expect(screen.getByTestId("delete-account-submit").props.accessibilityState.busy).toBe(false);
    });

    it("shows E-21 when Apple fails", async () => {
      mockAppleCode.mockRejectedValue(new Error("apple down"));
      await render(<DeleteAccountScreen />);
      await type("ELIMINAR");
      await submit();
      expect(mockInvoke).not.toHaveBeenCalled();
      expect(await screen.findByTestId("delete-account-error")).toBeOnTheScreen();
    });
  });

  it("does not ask Apple when the account has no Apple identity", async () => {
    await render(<DeleteAccountScreen />);
    await type("ELIMINAR");
    await submit();
    expect(mockAppleCode).not.toHaveBeenCalled();
  });
});
