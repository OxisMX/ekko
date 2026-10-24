import { fireEvent, render, screen } from "@testing-library/react-native";
import { CouponCard, relativeExpiry } from "./CouponCard";

const now = new Date("2026-10-20T18:00:00Z");

describe("CouponCard", () => {
  it.each([
    ["card_reward", "Premio"],
    ["wheel", "Bienvenida"],
    ["push", "Promoción"],
    ["birthday", "Cumpleaños"],
  ] as const)("labels source %s as %s", async (source, label) => {
    await render(<CouponCard title="2x1" source={source} expiresAt="2026-10-30T18:00:00Z" now={now} />);
    expect(screen.getByText(label)).toBeOnTheScreen();
  });

  it("warns with the words 'Por vencer' under 7 days (A-55)", async () => {
    await render(<CouponCard title="2x1" source="push" expiresAt="2026-10-23T19:00:00Z" now={now} />);
    expect(screen.getByText("Por vencer")).toBeOnTheScreen();
    expect(screen.getByText("Vence en 3 días · 23/10/2026")).toBeOnTheScreen();
  });

  it("draws the ticket divider only when there is a CTA (A-64)", async () => {
    const { rerender } = await render(<CouponCard title="2x1" source="push" expiresAt="2026-10-30T18:00:00Z" now={now} />);
    expect(screen.queryByTestId("coupon-ticket-divider", { includeHiddenElements: true })).toBeNull();
    await rerender(<CouponCard title="2x1" source="push" expiresAt="2026-10-30T18:00:00Z" now={now} onShowCode={jest.fn()} />);
    expect(screen.getByTestId("coupon-ticket-divider", { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it("puts 'No disponible por ahora' on its own line (A-69)", async () => {
    await render(<CouponCard title="2x1" merchantName="Café" merchantUnavailable source="push" expiresAt="2026-10-30T18:00:00Z" now={now} />);
    expect(screen.getByText("Café")).toBeOnTheScreen();
    expect(screen.getByText("No disponible por ahora")).toBeOnTheScreen();
  });

  it("warns with the words 'Por vencer' under 24 h", async () => {
    await render(<CouponCard title="2x1" source="wheel" expiresAt="2026-10-21T17:00:00Z" now={now} />);
    expect(screen.getByText("Por vencer")).toBeOnTheScreen();
    expect(screen.getByText("Vence en 23 h · 21/10/2026")).toBeOnTheScreen();
  });

  it("shows relative days and no warning when far from expiry", async () => {
    await render(<CouponCard title="2x1" merchantName="Café La Esquina" source="push" expiresAt="2026-10-30T19:00:00Z" now={now} />);
    expect(screen.queryByText("Por vencer")).toBeNull();
    expect(screen.getByText("Vence en 10 días · 30/10/2026")).toBeOnTheScreen();
    expect(screen.getByText("Café La Esquina")).toBeOnTheScreen();
  });

  it("renders the action only when provided", async () => {
    await render(<CouponCard title="2x1" source="push" expiresAt="2026-10-23T19:00:00Z" now={now} />);
    expect(screen.queryByRole("button")).toBeNull();

    const onAction = jest.fn();
    await render(<CouponCard title="2x1" source="push" expiresAt="2026-10-23T19:00:00Z" now={now} actionLabel="Mostrar código" onAction={onAction} />);
    await fireEvent.press(screen.getByRole("button", { name: "Mostrar código" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("formats relative expiry edges", () => {
    expect(relativeExpiry("2026-10-20T18:30:00Z", now)).toBe("Vence en menos de 1 h");
    expect(relativeExpiry("2026-10-21T19:00:00Z", now)).toBe("Vence en 1 día");
    expect(relativeExpiry("2026-10-20T17:00:00Z", now)).toBe("Vencido");
  });

  it("highlighted shows the badge (default and custom) and a primary show-code button", async () => {
    const { rerender } = await render(<CouponCard title="2x1" source="wheel" expiresAt="2026-10-30T18:00:00Z" now={now} highlighted onShowCode={jest.fn()} />);
    expect(screen.getByText("Nuevo")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Mostrar código" })).toHaveStyle({ backgroundColor: "#1E2124" });
    await rerender(<CouponCard title="2x1" source="wheel" expiresAt="2026-10-30T18:00:00Z" now={now} highlighted badge="Para ti" />);
    expect(screen.getByText("Para ti")).toBeOnTheScreen();
  });

  it("not highlighted: no badge and a secondary show-code button", async () => {
    await render(<CouponCard title="2x1" source="wheel" expiresAt="2026-10-30T18:00:00Z" now={now} onShowCode={jest.fn()} />);
    expect(screen.queryByText("Nuevo")).toBeNull();
    expect(screen.getByRole("button", { name: "Mostrar código" })).toHaveStyle({ backgroundColor: "#FFFFFF" });
  });
});
