import { render, screen } from "@testing-library/react-native";
import { TextField } from "./TextField";

describe("TextField", () => {
  it("is reachable by its label", async () => {
    await render(<TextField label="Correo electrónico" value="" onChangeText={jest.fn()} />);
    expect(screen.getByLabelText("Correo electrónico")).toBeOnTheScreen();
  });

  it("shows the error as text and as the field hint", async () => {
    await render(<TextField label="Correo electrónico" error="Revisa el formato del correo." />);
    expect(screen.getByText("Revisa el formato del correo.")).toBeOnTheScreen();
    expect(screen.getByRole("alert")).toBeOnTheScreen();
    expect(screen.getByTestId("status-icon-error", { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByLabelText("Correo electrónico").props.accessibilityHint).toBe("Revisa el formato del correo.");
  });

  it("forwards secureTextEntry", async () => {
    await render(<TextField label="Contraseña" secureTextEntry />);
    expect(screen.getByLabelText("Contraseña").props.secureTextEntry).toBe(true);
  });
});
