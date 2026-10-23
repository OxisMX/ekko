import { fireEvent, render, screen } from "@testing-library/react-native";
import { initialsOf, MerchantCard } from "./MerchantCard";

const merchant = {
  id: "m1",
  name: "Café La Esquina",
  categoryLabel: "Cafeterías",
  description: "Café de especialidad y pan recién horneado.",
  coverUri: "https://example.com/cover_540.webp",
  logoUri: null,
  isFavorite: false,
};

describe("MerchantCard", () => {
  it("renders name, category and description with a card label", async () => {
    await render(<MerchantCard merchant={merchant} onPress={jest.fn()} onOpenMap={jest.fn()} onToggleFavorite={jest.fn()} />);
    expect(screen.getByText("Café La Esquina")).toBeOnTheScreen();
    expect(screen.getByText("Cafeterías")).toBeOnTheScreen();
    expect(screen.getByText("Café de especialidad y pan recién horneado.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Café La Esquina, Cafeterías" })).toBeOnTheScreen();
  });

  it("fires onPress and onOpenMap separately", async () => {
    const onPress = jest.fn();
    const onOpenMap = jest.fn();
    await render(<MerchantCard merchant={merchant} onPress={onPress} onOpenMap={onOpenMap} onToggleFavorite={jest.fn()} />);

    await fireEvent.press(screen.getByRole("button", { name: "Abrir en Google Maps" }));
    expect(onOpenMap).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole("button", { name: "Café La Esquina, Cafeterías" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onOpenMap).toHaveBeenCalledTimes(1);
  });

  it("toggles the favorite without opening the merchant", async () => {
    const onPress = jest.fn();
    const onToggleFavorite = jest.fn();
    await render(<MerchantCard merchant={merchant} onPress={onPress} onOpenMap={jest.fn()} onToggleFavorite={onToggleFavorite} />);
    const heart = screen.getByRole("button", { name: "Agregar a favoritos" });
    expect(heart).not.toBeSelected();
    await fireEvent.press(heart);
    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("labels a favorite as removable and selected", async () => {
    await render(<MerchantCard merchant={{ ...merchant, isFavorite: true }} onPress={jest.fn()} onOpenMap={jest.fn()} onToggleFavorite={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Quitar de favoritos" })).toBeSelected();
  });

  it("falls back to initials when there is no logo", async () => {
    await render(<MerchantCard merchant={merchant} onPress={jest.fn()} onOpenMap={jest.fn()} onToggleFavorite={jest.fn()} />);
    expect(screen.getByTestId("merchant-logo-initials")).toHaveTextContent("CL");
  });

  it("computes initials from up to two words", () => {
    expect(initialsOf("  panadería   del centro ")).toBe("PD");
    expect(initialsOf("Ekko")).toBe("E");
  });
});
