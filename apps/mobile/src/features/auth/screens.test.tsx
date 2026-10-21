import { ERRORS } from "@ekko/shared";
import { AuthApiError } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactElement } from "react";

import RegisterScreen from "../../app/(auth)/register";
import LoginScreen from "../../app/(auth)/login";
import RecoverScreen from "../../app/(auth)/recover";
import CompleteProfileScreen from "../../app/complete-profile";
import ResetPasswordScreen from "../../app/reset-password";

const mockSupabase = {
  auth: {
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    signInWithOtp: jest.fn(),
    exchangeCodeForSession: jest.fn(),
    setSession: jest.fn(),
    updateUser: jest.fn(),
  },
  rpc: jest.fn(),
};
const mockAuth = { status: "signedOut", session: null as unknown, errorCode: null as string | null, signOut: jest.fn() };
const mockRouter = { push: jest.fn(), replace: jest.fn() };
let mockParams: Record<string, string> = {};
let mockPickedDate = new Date(2000, 0, 15);

jest.mock("../../lib/supabase", () => ({ get supabase() { return mockSupabase; } }));
jest.mock("../../lib/sentry", () => ({ reportError: jest.fn() }));
jest.mock("../../auth/AuthProvider", () => ({ useAuth: () => mockAuth }));
jest.mock("expo-router", () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams }));
jest.mock("expo-linking", () => ({ createURL: (path: string) => `ekko://${path}`, openURL: jest.fn() }));
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("@react-native-community/datetimepicker", () => {
  const { Pressable } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: (props: { onChange: (event: unknown, date?: Date) => void }) => (
      <Pressable testID="mock-picker" onPress={() => props.onChange({ type: "set" }, mockPickedDate)} />
    ),
  };
});

function renderScreen(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);

async function pickBirthDate(testID: string, date: Date) {
  mockPickedDate = date;
  await fireEvent.press(screen.getByTestId(testID));
  await fireEvent.press(screen.getByTestId("mock-picker"));
  await fireEvent.press(screen.getByRole("button", { name: "Listo" }));
}

async function fillRegister(birthDate: Date) {
  await type("Nombre", " Daniela ");
  await type("Apellido", "Ruiz");
  await type("Correo electrónico", "daniela@example.com");
  await type("Contraseña", "secreta123");
  await pickBirthDate("register-birth-date", birthDate);
  await fireEvent(screen.getByTestId("register-privacy"), "valueChange", true);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.status = "signedOut";
  mockAuth.errorCode = null;
  mockParams = {};
});

describe("A-02 Iniciar sesión", () => {
  it("shows one generic message for wrong credentials", async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
    });
    await renderScreen(<LoginScreen />);
    await type("Correo electrónico", "ana@ekko.mx");
    await type("Contraseña", "mala");
    await fireEvent.press(screen.getByTestId("login-submit"));

    expect(await screen.findByText(/Correo o contraseña incorrectos\./)).toBeOnTheScreen();
    expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: "ana@ekko.mx", password: "mala" });
  });

  it("shows E-19 coming from the auth provider", async () => {
    mockAuth.errorCode = "E-19";
    await renderScreen(<LoginScreen />);
    expect(screen.getByText(new RegExp(ERRORS["E-19"].message))).toBeOnTheScreen();
  });
});

describe("A-03 Crear cuenta", () => {
  it("blocks an under-18 birth date before calling signUp (E-07 at the field)", async () => {
    await renderScreen(<RegisterScreen />);
    const today = new Date();
    await fillRegister(new Date(today.getFullYear() - 17, today.getMonth(), today.getDate()));
    await fireEvent.press(screen.getByTestId("register-submit"));

    expect(await screen.findByText(`Error: ${ERRORS["E-07"].message}`)).toBeOnTheScreen();
    expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
  });

  it("offers sign-in and recovery when the email already exists (E-20)", async () => {
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError("User already registered", 422, "user_already_exists"),
    });
    await renderScreen(<RegisterScreen />);
    await fillRegister(new Date(2000, 0, 15));
    await fireEvent.press(screen.getByTestId("register-submit"));

    expect(await screen.findByText(new RegExp(ERRORS["E-20"].message))).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/login");
    await fireEvent.press(screen.getByTestId("register-recover"));
    // Sprint 2 review: A-06 opens with the email already typed.
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: "/recover", params: { email: "daniela@example.com" } });
    expect(mockSupabase.rpc).not.toHaveBeenCalled();
  });

  it("signs up and then saves the profile with a YYYY-MM-DD date", async () => {
    mockSupabase.auth.signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: {} }, error: null });
    mockSupabase.rpc.mockResolvedValue({ data: { profile_complete: true }, error: null });
    await renderScreen(<RegisterScreen />);
    await fillRegister(new Date(2000, 0, 15));
    await fireEvent.press(screen.getByTestId("register-submit"));

    await waitFor(() =>
      expect(mockSupabase.rpc).toHaveBeenCalledWith("complete_profile", {
        p_first_name: "Daniela",
        p_last_name: "Ruiz",
        p_birth_date: "2000-01-15",
      })
    );
    expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({ email: "daniela@example.com", password: "secreta123" });
    expect(mockSupabase.auth.signUp.mock.invocationCallOrder[0] ?? Infinity).toBeLessThan(mockSupabase.rpc.mock.invocationCallOrder[0] ?? 0);
  });

  it("sends the first verification code after saving the profile (F-02 K)", async () => {
    mockSupabase.auth.signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: {} }, error: null });
    mockSupabase.rpc.mockResolvedValue({ data: { profile_complete: true }, error: null });
    mockSupabase.auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    await renderScreen(<RegisterScreen />);
    await fillRegister(new Date(2000, 0, 15));
    await fireEvent.press(screen.getByTestId("register-submit"));

    await waitFor(() =>
      expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({ email: "daniela@example.com", options: { shouldCreateUser: false } })
    );
    expect(mockSupabase.rpc.mock.invocationCallOrder[0] ?? Infinity).toBeLessThan(mockSupabase.auth.signInWithOtp.mock.invocationCallOrder[0] ?? 0);
  });

  it("still finishes sign-up when the first code cannot be sent", async () => {
    mockSupabase.auth.signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: {} }, error: null });
    mockSupabase.rpc.mockResolvedValue({ data: { profile_complete: true }, error: null });
    mockSupabase.auth.signInWithOtp.mockResolvedValue({ data: {}, error: new TypeError("Network request failed") });
    await renderScreen(<RegisterScreen />);
    await fillRegister(new Date(2000, 0, 15));
    await fireEvent.press(screen.getByTestId("register-submit"));

    await waitFor(() => expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId("register-submit")).toBeEnabled());
    expect(screen.queryByTestId("register-error")).toBeNull();
  });
});

describe("A-04 Completar perfil", () => {
  it("shows an existing birth date read-only (RN-04) and prefills the names", async () => {
    mockAuth.status = "signedIn";
    mockAuth.session = { user: { id: "u1" } };
    mockSupabase.rpc.mockResolvedValue({
      data: { first_name: "Ana", last_name: null, birth_date: "1990-03-07", profile_complete: false },
      error: null,
    });
    await renderScreen(<CompleteProfileScreen />);

    const birthDate = await screen.findByTestId("complete-profile-birth-date-readonly");
    expect(birthDate.props.value).toBe("07/03/1990");
    expect(birthDate.props.editable).toBe(false);
    expect(screen.queryByTestId("complete-profile-birth-date")).toBeNull();
    expect(screen.getByLabelText("Nombre").props.value).toBe("Ana");
  });
});

describe("A-06 Recuperar contraseña", () => {
  it.each([
    ["the request succeeds", { data: {}, error: null }],
    ["Auth answers with an error", { data: null, error: new AuthApiError("Unable to process", 400, "unexpected_failure") }],
  ])("shows the same generic message when %s", async (_case, result) => {
    mockSupabase.auth.resetPasswordForEmail.mockResolvedValue(result);
    await renderScreen(<RecoverScreen />);
    await type("Correo electrónico", "ana@ekko.mx");
    await fireEvent.press(screen.getByTestId("recover-submit"));

    expect(await screen.findByText(/Si el correo existe, recibirás un enlace para restablecer tu contraseña\./)).toBeOnTheScreen();
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("ana@ekko.mx", { redirectTo: "ekko://reset-password" });
    expect(screen.getByTestId("recover-submit")).toBeDisabled();
  });
});

describe("A-06 prefill", () => {
  it("starts with the email passed from A-03", async () => {
    mockParams = { email: "daniela@example.com" };
    await renderScreen(<RecoverScreen />);
    expect(screen.getByLabelText("Correo electrónico").props.value).toBe("daniela@example.com");
  });
});

describe("F-05 Nueva contraseña", () => {
  it("shows the expired state for an invalid code", async () => {
    mockParams = { code: "used-code" };
    mockSupabase.auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: new AuthApiError("invalid flow state", 404, "flow_state_not_found"),
    });
    await renderScreen(<ResetPasswordScreen />);

    expect(await screen.findByText("Este enlace venció")).toBeOnTheScreen();
    expect(mockSupabase.auth.exchangeCodeForSession).toHaveBeenCalledWith("used-code");
    await fireEvent.press(screen.getByTestId("reset-password-request-new"));
    expect(mockRouter.replace).toHaveBeenCalledWith("/recover");
  });
});
