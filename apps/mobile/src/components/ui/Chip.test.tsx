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

  it("draws the unselected chip with a soft border and primary text", async () => {
    await render(<Chip label="Cafeterías" selected={false} onPress={jest.fn()} />);
    const chip = screen.getByRole("button", { name: "Cafeterías" });
    expect(chip).toHaveStyle({ borderColor: "#E9E6DF", borderWidth: 1.5 });
    expect(screen.getByText("Cafeterías")).toHaveStyle({ color: "#1E2124" });
  });
});
