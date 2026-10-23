import { fireEvent, render, screen } from "@testing-library/react-native";
import { CardRow } from "./CardRow";

const base = {
  merchantName: "Café Luna",
  logoUri: null,
  stampsCount: 3,
  stampsRequired: 8,
  cycleExpiresAt: "2026-12-31T00:00:00Z",
  rewardAvailable: false,
  available: true,
  onPress: jest.fn(),
  testID: "my-card-1",
};

describe("CardRow accessibility", () => {
  it("exposes the nested wheel badge as a custom action and a testID", async () => {
    const onWheelPress = jest.fn();
    await render(<CardRow {...base} wheelAvailable onWheelPress={onWheelPress} />);
    const row = screen.getByRole("button", { name: /Café Luna.*Gira tu ruleta/ });
    expect(row.props.accessibilityActions).toEqual([{ name: "wheel", label: "Girar ruleta" }]);
    await fireEvent(row, "accessibilityAction", { nativeEvent: { actionName: "wheel" } });
    expect(onWheelPress).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("my-card-1-wheel")).toBeOnTheScreen();
  });

  it("offers no custom action without a wheel", async () => {
    await render(<CardRow {...base} wheelAvailable={false} />);
    expect(screen.getByTestId("my-card-1").props.accessibilityActions).toBeUndefined();
  });
});

describe("CardRow anticipation (A-50)", () => {
  it.each([
    [7, "¡Te falta 1 sello!"],
    [6, "¡Te faltan 2 sellos!"],
  ])("with %i of 8 stamps says %s", async (stampsCount, text) => {
    await render(<CardRow {...base} stampsCount={stampsCount} wheelAvailable={false} />);
    expect(screen.getByText(text)).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: new RegExp(text) })).toBeOnTheScreen();
  });

  it("stays quiet far from the reward, with a reward ready, and when unavailable", async () => {
    const { rerender } = await render(<CardRow {...base} stampsCount={3} wheelAvailable={false} />);
    expect(screen.queryByTestId("card-row-hint")).toBeNull();
    await rerender(<CardRow {...base} stampsCount={7} rewardAvailable wheelAvailable={false} />);
    expect(screen.queryByTestId("card-row-hint")).toBeNull();
    await rerender(<CardRow {...base} stampsCount={7} available={false} wheelAvailable={false} />);
    expect(screen.queryByTestId("card-row-hint")).toBeNull();
    expect(screen.getByText("No disponible por ahora")).toBeOnTheScreen();
  });
});
