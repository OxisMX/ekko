import { fireEvent, render, screen } from "@testing-library/react-native";
import { selection } from "../../lib/haptics";
import { Button } from "./Button";

jest.mock("../../lib/haptics", () => ({ selection: jest.fn() }));

afterEach(() => jest.clearAllMocks());

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

  it("fires the selection haptic only when asked", async () => {
    await render(
      <>
        <Button title="Uno" onPress={jest.fn()} haptic="selection" />
        <Button title="Dos" onPress={jest.fn()} />
      </>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Dos" }));
    expect(selection).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Uno" }));
    expect(selection).toHaveBeenCalledTimes(1);
  });

  it("scales down on press in and back on press out", async () => {
    await render(<Button title="Entrar" onPress={jest.fn()} />);
    const button = screen.getByRole("button", { name: "Entrar" });
    await fireEvent(button, "pressIn");
    await fireEvent(button, "pressOut");
    expect(button).toBeOnTheScreen();
  });
});
