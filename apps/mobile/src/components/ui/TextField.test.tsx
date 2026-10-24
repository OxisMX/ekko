import { fireEvent, render, screen } from "@testing-library/react-native";
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

  it("shows the helper until there is an error", async () => {
    const { rerender } = await render(<TextField label="Teléfono" helper="Solo números" />);
    expect(screen.getByText("Solo números")).toBeOnTheScreen();
    await rerender(<TextField label="Teléfono" helper="Solo números" error="Muy corto" />);
    expect(screen.queryByText("Solo números")).toBeNull();
  });

  it("highlights the border on focus and keeps the caller's handlers", async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    await render(<TextField label="Nombre" onFocus={onFocus} onBlur={onBlur} />);
    const input = screen.getByLabelText("Nombre");
    const box = input.parent!;
    expect(box).toHaveStyle({ borderColor: "transparent" });
    await fireEvent(input, "focus");
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(box).toHaveStyle({ borderColor: "#1F2A4A" });
    await fireEvent(input, "blur");
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(box).toHaveStyle({ borderColor: "transparent" });
  });
});
