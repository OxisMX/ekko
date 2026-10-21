import { render, screen } from "@testing-library/react-native";
import { ProductCard } from "./ProductCard";

describe("ProductCard", () => {
  it("formats the price as MXN and shows the featured badge", async () => {
    await render(<ProductCard name="Latte" description="Con leche entera" price={69} featured />);
    expect(screen.getByText("$69.00")).toBeOnTheScreen();
    expect(screen.getByText("Más pedidos")).toBeOnTheScreen();
    expect(screen.queryByText("Agotado por hoy")).toBeNull();
  });

  it("labels a sold-out product", async () => {
    await render(<ProductCard name="Latte" price={69} soldOut imageUri="https://example.com/latte.webp" />);
    expect(screen.getByText("Agotado por hoy")).toBeOnTheScreen();
    expect(screen.getByLabelText("Latte. $69.00. Agotado por hoy")).toBeOnTheScreen();
  });
});
