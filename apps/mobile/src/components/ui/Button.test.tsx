import { fireEvent, render, screen } from "@testing-library/react-native";
import { Button } from "./Button";

describe("Button", () => {
  it("calls onPress", async () => {
    const onPress = jest.fn();
    await render(<Button title="Entrar" onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "Entrar" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled", async () => {
    const onPress = jest.fn();
    await render(<Button title="Entrar" onPress={onPress} disabled />);
    const button = screen.getByRole("button", { name: "Entrar" });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });

  it("does not call onPress while loading and exposes busy state", async () => {
    const onPress = jest.fn();
    await render(<Button title="Entrar" onPress={onPress} loading />);
    const button = screen.getByRole("button", { name: "Entrar" });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeBusy();
    expect(screen.queryByText("Entrar")).toBeNull();
  });
});
