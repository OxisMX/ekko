import { render, screen } from "@testing-library/react-native";
import { OfferCard } from "./OfferCard";

// Tue 2026-10-20 03:00 UTC is still Monday 19 in Mexico City.
const mondayNightInMexico = new Date("2026-10-20T03:00:00Z");

describe("OfferCard", () => {
  it("highlights the offer when its weekday is today in Mexico City", async () => {
    await render(<OfferCard weekday={1} title="2x1 en lattes" description="Todo el día" now={mondayNightInMexico} />);
    expect(screen.getByText("Lunes")).toBeOnTheScreen();
    expect(screen.getByText("Hoy")).toBeOnTheScreen();
  });

  it("does not highlight other days", async () => {
    await render(<OfferCard weekday={2} title="Pan dulce" description="Después de las 5" now={mondayNightInMexico} />);
    expect(screen.getByText("Martes")).toBeOnTheScreen();
    expect(screen.queryByText("Hoy")).toBeNull();
  });
});
