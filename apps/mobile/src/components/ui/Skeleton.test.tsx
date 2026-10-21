import { render, screen } from "@testing-library/react-native";
import { MerchantCardSkeleton, Skeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("is hidden from screen readers", async () => {
    await render(<Skeleton testID="block" height={20} />);
    expect(screen.queryByTestId("block")).toBeNull();
    expect(screen.getByTestId("block", { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it("MerchantCardSkeleton exposes a single 'Cargando' label", async () => {
    await render(<MerchantCardSkeleton />);
    expect(screen.getAllByLabelText("Cargando")).toHaveLength(1);
  });
});
