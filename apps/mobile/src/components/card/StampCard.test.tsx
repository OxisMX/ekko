import { fireEvent, render, screen } from "@testing-library/react-native";
import { StampCard, type StampCardProps } from "./StampCard";

const stamp = (grantedAt: string) => ({ grantedAt, isBonus: false });

const base: StampCardProps = {
  stampsRequired: 8,
  stamps: [stamp("2026-10-01T18:00:00Z"), stamp("2026-10-05T18:00:00Z"), stamp("2026-10-10T18:00:00Z")],
  logoUri: null,
  merchantName: "Café La Esquina",
  backgroundUri: null,
  rewardTitle: "Café americano",
  cycleExpiresAt: "2027-01-15T18:00:00Z",
  pendingExtraStamps: 0,
  rewardAvailable: false,
  available: true,
};

describe("StampCard", () => {
  it.each([
    [4, 1],
    [6, 2],
    [8, 2],
    [10, 2],
  ])("lays out %i stamps in %i row(s) with the right slot counts", async (stampsRequired, rowCount) => {
    await render(<StampCard {...base} stampsRequired={stampsRequired} stamps={[]} />);
    expect(screen.getAllByTestId("stamp-row")).toHaveLength(rowCount);
    expect(screen.getAllByTestId("stamp-empty")).toHaveLength(stampsRequired);
  });

  it("shows progress, reward and expiry and summarises them for screen readers", async () => {
    await render(<StampCard {...base} />);
    expect(screen.getByText("3 de 8 sellos")).toBeOnTheScreen();
    expect(screen.getByText("Premio: Café americano")).toBeOnTheScreen();
    expect(screen.getByText("Vence el 15/01/2027")).toBeOnTheScreen();
    expect(screen.getByLabelText("Café La Esquina: 3 de 8 sellos, premio Café americano, vence el 15/01/2027")).toBeOnTheScreen();
    expect(screen.getAllByTestId("stamp-granted")).toHaveLength(3);
    expect(screen.getAllByTestId("stamp-empty")).toHaveLength(5);
  });

  it("draws the gift icon only on the last empty slot", async () => {
    await render(<StampCard {...base} />);
    expect(screen.getAllByTestId("stamp-gift", { includeHiddenElements: true })).toHaveLength(1);
  });

  it("drops the gift icon once the last slot is stamped", async () => {
    const full = Array.from({ length: 4 }, () => stamp("2026-10-01T18:00:00Z"));
    await render(<StampCard {...base} stampsRequired={4} stamps={full} />);
    expect(screen.queryByTestId("stamp-gift", { includeHiddenElements: true })).toBeNull();
  });

  it("shows stamp dates in Mexico City, not UTC", async () => {
    // 05:30 UTC on Oct 2 is 23:30 on Oct 1 in Mexico City (UTC-6).
    await render(<StampCard {...base} stamps={[stamp("2026-10-02T05:30:00Z")]} />);
    expect(screen.getByText("01/10/26")).toBeOnTheScreen();
    expect(screen.queryByText("02/10/26")).toBeNull();
  });

  it("highlights the newest stamp when asked", async () => {
    await render(<StampCard {...base} highlightLast />);
    expect(screen.getAllByTestId("stamp-new")).toHaveLength(1);
    expect(screen.getAllByTestId("stamp-granted")).toHaveLength(2);
  });

  it("shows the reward notice and fires onViewReward (RN-27)", async () => {
    const onViewReward = jest.fn();
    await render(<StampCard {...base} stamps={[]} rewardAvailable onViewReward={onViewReward} />);
    expect(screen.getByText("Recompensa disponible")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Ver recompensa" }));
    expect(onViewReward).toHaveBeenCalledTimes(1);
  });

  it("labels an unavailable merchant (RN-71)", async () => {
    await render(<StampCard {...base} available={false} />);
    expect(screen.getByText("No disponible")).toBeOnTheScreen();
  });

  it("shows the extra-stamp badge only when one is pending", async () => {
    await render(<StampCard {...base} />);
    expect(screen.queryByText("+1 en tu próxima visita")).toBeNull();
    await render(<StampCard {...base} pendingExtraStamps={1} />);
    expect(screen.getByText("+1 en tu próxima visita")).toBeOnTheScreen();
  });
});
