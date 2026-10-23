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
