import { fireEvent, render, screen } from "@testing-library/react-native";
import { VerificationBanner } from "./VerificationBanner";

describe("VerificationBanner", () => {
  it("disables resend during cooldown and shows the countdown", async () => {
    const onResend = jest.fn();
    await render(<VerificationBanner onResend={onResend} cooldownSeconds={42} />);
    expect(screen.getByText("Verifica tu correo para girar la ruleta y canjear tus premios.")).toBeOnTheScreen();
    const button = screen.getByRole("button", { name: "Reenviar en 42 s" });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
    expect(onResend).not.toHaveBeenCalled();
  });

  it("resends when the cooldown is over and offers the code entry", async () => {
    const onResend = jest.fn();
    const onEnterCode = jest.fn();
    await render(<VerificationBanner onResend={onResend} onEnterCode={onEnterCode} cooldownSeconds={0} />);
    await fireEvent.press(screen.getByRole("button", { name: "Reenviar correo" }));
    await fireEvent.press(screen.getByRole("button", { name: "Ingresar código" }));
    expect(onResend).toHaveBeenCalledTimes(1);
    expect(onEnterCode).toHaveBeenCalledTimes(1);
  });

  it("is busy and disabled while sending", async () => {
    await render(<VerificationBanner onResend={jest.fn()} cooldownSeconds={0} sending />);
    const button = screen.getByRole("button", { name: "Enviando…" });
    expect(button).toBeDisabled();
    expect(button).toBeBusy();
  });
});
