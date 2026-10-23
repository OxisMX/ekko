import { AuthApiError } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import VerifyEmailScreen from "../../app/verify-email";
import { verificationCooldown } from "./emailVerification";

const mockSupabase = { rpc: jest.fn(), auth: { signInWithOtp: jest.fn(), verifyOtp: jest.fn() } };
const mockAuth = { status: "signedIn", session: { user: { id: "u1", email: "ana@ekko.mx" } }, errorCode: null, signOut: jest.fn() };
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => false) };

jest.mock("../../lib/supabase", () => ({
  get supabase() {
    return mockSupabase;
  },
}));
jest.mock("../../lib/sentry", () => ({ reportError: jest.fn() }));
jest.mock("../../auth/AuthProvider", () => ({ useAuth: () => mockAuth }));
jest.mock("expo-router", () => ({
  useRouter: () => mockRouter,
  Redirect: ({ href }: { href: string }) => {
    const { Text: MockText } = jest.requireActual("react-native");
    return <MockText>{`redirect:${href}`}</MockText>;
  },
}));
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);

let profile: { auth_provider: string; email_verified: boolean; email: string };

function renderVerify() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <VerifyEmailScreen />
    </QueryClientProvider>
  );
}

const codeInput = () => screen.getByLabelText("Código de verificación de 6 dígitos");

beforeEach(() => {
  jest.clearAllMocks();
  verificationCooldown.start(0); // WHY: the cooldown is app-wide; each test starts with resend allowed.
  profile = { auth_provider: "email", email_verified: false, email: "ana@ekko.mx" };
  mockSupabase.rpc.mockImplementation(() => Promise.resolve({ data: profile, error: null }));
});

describe("A-05 Verifica tu correo", () => {
  it("verifies a complete code, confirms, and goes home", async () => {
    mockSupabase.auth.verifyOtp.mockImplementation(async () => {
      profile = { ...profile, email_verified: true };
      return { data: {}, error: null };
    });
    await renderVerify();
    expect(await screen.findByText(/ana@ekko\.mx/)).toBeOnTheScreen();

    await fireEvent.changeText(codeInput(), "123 456");
    expect(mockSupabase.auth.verifyOtp).toHaveBeenCalledWith({ email: "ana@ekko.mx", token: "123456", type: "email" });
    expect(await screen.findByText(/Correo verificado/)).toBeOnTheScreen();
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith("/"), { timeout: 3000 });
  });

  it("clears the field and explains a wrong or expired code", async () => {
    mockSupabase.auth.verifyOtp.mockResolvedValue({ data: {}, error: new AuthApiError("Token has expired or is invalid", 403, "otp_expired") });
    await renderVerify();
    await screen.findByText(/ana@ekko\.mx/);

    await fireEvent.changeText(codeInput(), "999999");
    expect(await screen.findByText("Código incorrecto o vencido")).toBeOnTheScreen();
    expect(codeInput().props.value).toBe("");
  });

  it("disables resend during the 60 s cooldown after sending", async () => {
    mockSupabase.auth.signInWithOtp.mockResolvedValue({ data: {}, error: null });
    await renderVerify();

    await fireEvent.press(await screen.findByTestId("verify-email-resend"));
    expect(mockSupabase.auth.signInWithOtp).toHaveBeenCalledWith({ email: "ana@ekko.mx", options: { shouldCreateUser: false } });
    await waitFor(() => expect(screen.getByRole("button", { name: /Reenviar en (60|59) s/ })).toBeDisabled());
  });

  it("waits the seconds the server asks for on 429, without an error", async () => {
    mockSupabase.auth.signInWithOtp.mockResolvedValue({
      data: {},
      error: new AuthApiError("For security purposes, you can only request this after 42 seconds.", 429, "over_email_send_rate_limit"),
    });
    await renderVerify();

    await fireEvent.press(await screen.findByTestId("verify-email-resend"));
    await waitFor(() => expect(screen.getByRole("button", { name: /Reenviar en (42|41) s/ })).toBeDisabled());
    expect(screen.queryByTestId("verify-email-error")).toBeNull();
  });

  it("lets the user continue without verifying (F-02 L)", async () => {
    mockRouter.canGoBack.mockReturnValueOnce(true);
    await renderVerify();
    await fireEvent.press(await screen.findByRole("button", { name: "Continuar sin verificar" }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it("sends a Google account straight home (F-03)", async () => {
    profile = { auth_provider: "google", email_verified: true, email: "ana@gmail.com" };
    await renderVerify();
    expect(await screen.findByText("redirect:/")).toBeOnTheScreen();
  });
});
