import { fireEvent, render, screen } from "@testing-library/react-native";
import { FormMessage } from "./FormMessage";

describe("FormMessage", () => {
  it.each([
    ["error", "Error:"],
    ["info", "Aviso:"],
    ["success", "Listo:"],
  ] as const)("prefixes the %s variant with %s", async (variant, prefix) => {
    await render(<FormMessage variant={variant} message="Texto" />);
    expect(screen.getByText(`${prefix} Texto`)).toBeOnTheScreen();
  });

  it("announces errors as an alert", async () => {
    await render(<FormMessage variant="error" message="Ese correo ya tiene cuenta." />);
    expect(screen.getByRole("alert", { name: "Error: Ese correo ya tiene cuenta." })).toBeOnTheScreen();
  });

  it("does not use the alert role for info", async () => {
    await render(<FormMessage variant="info" message="Revisa tu correo." />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders the action and calls onAction", async () => {
    const onAction = jest.fn();
    await render(<FormMessage variant="error" message="Ese correo ya tiene cuenta." actionLabel="Iniciar sesión" onAction={onAction} />);
    await fireEvent.press(screen.getByRole("button", { name: "Iniciar sesión" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
