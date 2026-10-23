import { fireEvent, render, screen } from "@testing-library/react-native";
import { Animated } from "react-native";
import { MerchantHeader } from "./MerchantHeader";

jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);

describe("MerchantHeader", () => {
  it("renders name, category and a working map button", async () => {
    const onOpenMap = jest.fn();
    const onToggleFavorite = jest.fn();
    await render(
      <MerchantHeader name="Café La Esquina" categoryLabel="Cafeterías" coverUri={null} logoUri={null} onOpenMap={onOpenMap} isFavorite={false} onToggleFavorite={onToggleFavorite} scrollY={new Animated.Value(0)} />,
    );
    expect(screen.getByRole("header", { name: "Café La Esquina, Cafeterías" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Abrir en Google Maps" }));
    expect(onOpenMap).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole("button", { name: "Agregar a favoritos" }));
    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
  });

  it("shows the stamps chip only when given (A-25)", async () => {
    const props = { name: "Café", categoryLabel: "Cafeterías", coverUri: null, logoUri: null, onOpenMap: jest.fn(), isFavorite: false, onToggleFavorite: jest.fn() };
    const { rerender } = await render(<MerchantHeader {...props} />);
    expect(screen.queryByTestId("merchant-progress-chip")).toBeNull();
    await rerender(<MerchantHeader {...props} progressLabel="3 de 8 sellos" />);
    expect(screen.getByTestId("merchant-progress-chip")).toHaveTextContent("3 de 8 sellos");
  });
});
