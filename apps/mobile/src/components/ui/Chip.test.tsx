import { fireEvent, render, screen } from "@testing-library/react-native";
import { Chip } from "./Chip";

describe("Chip", () => {
  it("exposes selected state and calls onPress", async () => {
    const onPress = jest.fn();
    await render(
      <>
        <Chip label="Todos" selected onPress={onPress} />
        <Chip label="Cafeterías" selected={false} onPress={jest.fn()} />
      </>,
    );
    expect(screen.getByRole("button", { name: "Todos" })).toBeSelected();
    expect(screen.getByRole("button", { name: "Cafeterías" })).not.toBeSelected();
    await fireEvent.press(screen.getByRole("button", { name: "Todos" }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
