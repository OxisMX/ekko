import { fireEvent, render, screen } from "@testing-library/react-native";
import { SegmentedTabs } from "./SegmentedTabs";

const tabs = [
  { key: "card", label: "Tarjeta" },
  { key: "menu", label: "Menú" },
  { key: "promos", label: "Promociones" },
  { key: "review", label: "Reseña" },
] as const;

describe("SegmentedTabs", () => {
  it("marks the active tab as selected and reports changes", async () => {
    const onChange = jest.fn();
    await render(<SegmentedTabs tabs={tabs} value="card" onChange={onChange} />);
    expect(screen.getByRole("tab", { name: "Tarjeta" })).toBeSelected();
    expect(screen.getByRole("tab", { name: "Menú" })).not.toBeSelected();

    await fireEvent.press(screen.getByRole("tab", { name: "Menú" }));
    expect(onChange).toHaveBeenCalledWith("menu");

    await fireEvent.press(screen.getByRole("tab", { name: "Tarjeta" }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("exposes a stable testID per tab (RQ-3)", async () => {
    await render(<SegmentedTabs tabs={tabs} value="card" onChange={jest.fn()} testID="merchant-tabs" />);
    expect(screen.getByTestId("merchant-tabs-promos")).toBeOnTheScreen();
  });
});
