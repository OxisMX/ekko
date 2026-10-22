import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { Toast, TOAST_DURATION_MS } from "./Toast";

jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const setup = async () => {
  const onAction = jest.fn();
  const onDismiss = jest.fn();
  await render(<Toast title="Café La Esquina" message="Tienes un cupón nuevo" actionLabel="Ver" onAction={onAction} onDismiss={onDismiss} testID="toast" />);
  return { onAction, onDismiss };
};

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it("renders the message and navigates on tap", async () => {
  const { onAction, onDismiss } = await setup();
  expect(screen.getByText("Tienes un cupón nuevo")).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button"));
  expect(onAction).toHaveBeenCalledTimes(1);
  expect(onDismiss).toHaveBeenCalledTimes(1);
});

it("dismisses itself after 5 s without navigating", async () => {
  const { onAction, onDismiss } = await setup();
  await act(async () => jest.advanceTimersByTime(TOAST_DURATION_MS));
  expect(onDismiss).toHaveBeenCalledTimes(1);
  expect(onAction).not.toHaveBeenCalled();
});
