import { act, render, screen } from "@testing-library/react-native";
import { AccessibilityInfo, Text } from "react-native";
import { Burst, Entrance } from "./Entrance";

const setReduce = (value: boolean) => jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(value);

afterEach(() => jest.restoreAllMocks());

describe("Entrance", () => {
  it("renders children at full opacity and scale under reduce motion", async () => {
    setReduce(true);
    await render(
      <Entrance>
        <Text>premio</Text>
      </Entrance>,
    );
    const view = screen.getByText("premio").parent!;
    await act(async () => {});
    expect(view).toHaveStyle({ opacity: 1 });
  });

  it("renders its children while animating", async () => {
    setReduce(false);
    await render(
      <Entrance from={0.8} delay={10} spring>
        <Text>premio</Text>
      </Entrance>,
    );
    expect(screen.getByText("premio")).toBeOnTheScreen();
  });
});

describe("Burst", () => {
  it("is not rendered under reduce motion", async () => {
    setReduce(true);
    await render(<Burst testID="burst" />);
    await act(async () => {});
    expect(screen.queryByTestId("burst", { includeHiddenElements: true })).toBeNull();
  });

  it("renders when motion is allowed", async () => {
    setReduce(false);
    await render(<Burst testID="burst" />);
    await act(async () => {});
    expect(screen.getByTestId("burst", { includeHiddenElements: true })).toBeOnTheScreen();
  });
});
