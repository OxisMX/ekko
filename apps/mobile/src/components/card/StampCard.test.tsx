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

  it("shows only the reward and expiry, and summarises everything for screen readers", async () => {
    await render(<StampCard {...base} />);
    expect(screen.queryByText("3 de 8 sellos")).toBeNull();
    expect(screen.getByText("Premio: Café americano")).toBeOnTheScreen();
    expect(screen.getByText("Vence el 15/01/2027")).toBeOnTheScreen();
    expect(screen.getByLabelText("Café La Esquina: 3 de 8 sellos, premio Café americano, vence el 15/01/2027. Te faltan 5 para tu premio")).toBeOnTheScreen();
    expect(screen.getAllByTestId("stamp-granted")).toHaveLength(3);
    expect(screen.getAllByTestId("stamp-empty")).toHaveLength(5);
    expect(screen.queryByTestId("stamp-remaining")).toBeNull();
  });

  it("rings the gift slot with one stamp left (A-27)", async () => {
    const seven = Array.from({ length: 7 }, () => stamp("2026-10-01T18:00:00Z"));
    await render(<StampCard {...base} stamps={seven} />);
    expect(screen.getAllByTestId("stamp-empty")[0]).toHaveStyle({ borderStyle: "dashed", borderColor: "#FF7A3D" });
  });

  it("draws empty slots dashed (A-30)", async () => {
    await render(<StampCard {...base} />);
    expect(screen.getAllByTestId("stamp-empty")[0]).toHaveStyle({ borderStyle: "dashed", borderWidth: 1 });
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

  it("keeps unavailable and extra-stamp state in the screen-reader label only", async () => {
    await render(<StampCard {...base} available={false} pendingExtraStamps={1} />);
    expect(screen.queryByText("No disponible")).toBeNull();
    expect(screen.queryByText("+1 sello extra en tu próxima visita")).toBeNull();
    expect(screen.getByLabelText(/\+1 sello extra en tu próxima visita\. No disponible$/)).toBeOnTheScreen();
  });

  it("renders the wallet header strip with merchant and n/m", async () => {
    await render(<StampCard {...base} header={{ logoUri: null, name: "Café La Esquina", badge: "Premio listo" }} />);
    expect(screen.getAllByText("Café La Esquina")).toHaveLength(1);
    expect(screen.getByText("3/8")).toBeOnTheScreen();
    expect(screen.getByText("Premio listo")).toBeOnTheScreen();
  });

  it("marks bonus stamps with a star and names them in the label (RN-36)", async () => {
    const stamps = [
      { grantedAt: "2026-01-01T12:00:00Z", isBonus: false },
      { grantedAt: "2026-01-02T12:00:00Z", isBonus: true },
    ];
    await render(<StampCard {...base} stamps={stamps} testID="card" />);
    expect(screen.getAllByTestId("stamp-bonus")).toHaveLength(1);
    expect(screen.getByLabelText(/1 sello extra/)).toBeOnTheScreen();
  });

  it("draws perfect circles, capped at 64 and shrunk to the slot when narrow", async () => {
    await render(<StampCard {...base} />);
    expect(screen.getAllByTestId("stamp-empty")[0]).toHaveStyle({ width: 64, height: 64, borderRadius: 32 });
    // 4 per row in a 200-wide grid: (200 - 3 * 8) / 4 = 44.
    await fireEvent(screen.getAllByTestId("stamp-row")[0]!.parent!, "layout", { nativeEvent: { layout: { width: 200, height: 100 } } });
    expect(screen.getAllByTestId("stamp-empty")[0]).toHaveStyle({ width: 44, height: 44, borderRadius: 22 });
    expect(screen.getAllByTestId("stamp-granted")[0]).toHaveStyle({ width: 44, height: 44, borderRadius: 22 });
  });

  const imageUris = () =>
    screen.getAllByTestId("merchant-logo-image", { includeHiddenElements: true }).map((node) => node.props.source[0].uri as string);

  it("stamps with the merchant logo when there is no stamp image", async () => {
    await render(<StampCard {...base} logoUri="https://x.test/logo.webp" />);
    expect(new Set(imageUris())).toEqual(new Set(["https://x.test/logo.webp"]));
  });

  it("stamps with the custom stamp image when set", async () => {
    await render(<StampCard {...base} logoUri="https://x.test/logo.webp" stampImageUri="https://x.test/stamp.webp" />);
    expect(new Set(imageUris())).toEqual(new Set(["https://x.test/stamp.webp"]));
  });
});
