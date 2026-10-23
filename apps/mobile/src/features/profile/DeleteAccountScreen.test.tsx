import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { DeleteAccountScreen } from "./DeleteAccountScreen";

const mockInvoke = jest.fn();
const mockRouter = { back: jest.fn() };
const mockAuth = { finishAccountDeletion: jest.fn(), endSession: jest.fn() };

jest.mock("../../lib/supabase", () => ({ supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } } }));
jest.mock("../../lib/sentry", () => ({ reportError: jest.fn() }));
jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));
jest.mock("../../auth/AuthProvider", () => ({ useAuth: () => mockAuth }));

const httpError = (code: string) => new FunctionsHttpError({ json: async () => ({ error: code }) });
const type = (text: string) => fireEvent.changeText(screen.getByTestId("delete-account-input"), text);
const submit = () => fireEvent.press(screen.getByTestId("delete-account-submit"));

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.finishAccountDeletion.mockResolvedValue(undefined);
  mockInvoke.mockResolvedValue({ data: { deleted: true }, error: null });
});

describe("A-22 Eliminar cuenta", () => {
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
});
