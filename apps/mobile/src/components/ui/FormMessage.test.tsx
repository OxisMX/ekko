import { fireEvent, render, screen } from "@testing-library/react-native";
import { FormMessage } from "./FormMessage";

describe("FormMessage", () => {
  it.each(["error", "info", "success"] as const)("shows the %s variant as an icon plus the plain message", async (variant) => {
    await render(<FormMessage variant={variant} message="Texto" />);
    expect(screen.getByText("Texto")).toBeOnTheScreen();
    expect(screen.getByTestId(`status-icon-${variant}`, { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it("announces errors as an alert", async () => {
    await render(<FormMessage variant="error" message="Ese correo ya tiene cuenta." />);
    expect(screen.getByRole("alert", { name: "Ese correo ya tiene cuenta." })).toBeOnTheScreen();
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
