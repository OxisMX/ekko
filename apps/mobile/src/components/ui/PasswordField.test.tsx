import { fireEvent, render, screen } from "@testing-library/react-native";
import { PasswordField } from "./PasswordField";

describe("PasswordField", () => {
  it("toggles secureTextEntry and the toggle's accessible label", async () => {
    await render(<PasswordField label="Contraseña" value="secreto" onChangeText={jest.fn()} />);
    const input = screen.getByLabelText("Contraseña");
    expect(input.props.secureTextEntry).toBe(true);

    await fireEvent.press(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(screen.getByLabelText("Contraseña").props.secureTextEntry).toBe(false);
    expect(screen.getByText("Ocultar")).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole("button", { name: "Ocultar contraseña" }));
    expect(screen.getByLabelText("Contraseña").props.secureTextEntry).toBe(true);
  });

  it("passes textContentType and autoComplete through", async () => {
    await render(<PasswordField label="Contraseña" textContentType="newPassword" autoComplete="new-password" />);
    const input = screen.getByLabelText("Contraseña");
    expect(input.props.textContentType).toBe("newPassword");
    expect(input.props.autoComplete).toBe("new-password");
  });
});
