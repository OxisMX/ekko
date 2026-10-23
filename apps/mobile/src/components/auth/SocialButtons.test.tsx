import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { SocialButtons } from "./SocialButtons";

const mockGoogle = jest.fn();
const mockApple = jest.fn();
const mockAppleAvailable = jest.fn();

jest.mock("../../features/auth/socialSignIn", () => ({
  signInWithGoogle: () => mockGoogle(),
  signInWithApple: () => mockApple(),
  isAppleSignInAvailable: () => mockAppleAvailable(),
}));
jest.mock("../../lib/sentry", () => ({ reportError: jest.fn() }));
jest.mock("expo-apple-authentication", () => {
  const { Pressable } = jest.requireActual("react-native");
  return {
    AppleAuthenticationButton: (props: object) => <Pressable accessibilityRole="button" {...props} />,
    AppleAuthenticationButtonType: { CONTINUE: 0 },
    AppleAuthenticationButtonStyle: { BLACK: 1 },
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGoogle.mockResolvedValue("signedIn");
  mockApple.mockResolvedValue("signedIn");
  mockAppleAvailable.mockResolvedValue(true);
});

describe("SocialButtons", () => {
  it("shows Google and, when available, Apple", async () => {
    await render(<SocialButtons testIDPrefix="login" />);
    expect(screen.getByLabelText("Continuar con Google")).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId("login-apple")).toBeTruthy());
  });

  it("hides Apple when unavailable (Android)", async () => {
    mockAppleAvailable.mockResolvedValue(false);
    await render(<SocialButtons testIDPrefix="login" />);
    await waitFor(() => expect(mockAppleAvailable).toHaveBeenCalled());
    expect(screen.queryByTestId("login-apple")).toBeNull();
  });

  it("stays silent on cancel", async () => {
    mockGoogle.mockResolvedValue("cancelled");
    await render(<SocialButtons testIDPrefix="login" />);
    await fireEvent.press(screen.getByTestId("login-google"));
    expect(mockGoogle).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("login-social-error")).toBeNull();
  });

  it("shows E-21 with retry on provider error", async () => {
    mockGoogle.mockRejectedValueOnce(new Error("boom"));
    await render(<SocialButtons testIDPrefix="login" />);
    await fireEvent.press(screen.getByTestId("login-google"));
    expect(await screen.findByText(/No pudimos conectar con Google\/Apple/)).toBeTruthy();
    await fireEvent.press(screen.getByText("Reintentar"));
    expect(mockGoogle).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByTestId("login-social-error")).toBeNull());
  });
});
