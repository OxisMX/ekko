import { fireEvent, render, screen } from "@testing-library/react-native";
import { StampCardDetails, type StampCardDetailsProps } from "./StampCardDetails";

const base: StampCardDetailsProps = {
  stampsCount: 3,
  stampsRequired: 8,
  rewardDescription: null,
  pendingExtraStamps: 0,
  rewardAvailable: false,
  available: true,
  wheelOffered: false,
  onSpinWheel: jest.fn(),
  terms: null,
};

describe("StampCardDetails", () => {
  it("shows progress and what is missing (A-27)", async () => {
    await render(<StampCardDetails {...base} rewardDescription="Un café de 12 oz." />);
    expect(screen.getByText("3 de 8 sellos")).toBeOnTheScreen();
    expect(screen.getByTestId("stamp-remaining")).toHaveTextContent("Te faltan 5 para tu premio");
    expect(screen.getByText("Un café de 12 oz.")).toBeOnTheScreen();
    await render(<StampCardDetails {...base} stampsCount={7} />);
    expect(screen.getByText("¡Solo te falta 1!")).toBeOnTheScreen();
  });

  it("shows the reward notice and fires onViewReward (RN-27)", async () => {
    const onViewReward = jest.fn();
    await render(<StampCardDetails {...base} rewardAvailable onViewReward={onViewReward} />);
    expect(screen.getByText("Recompensa disponible")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Ver recompensa" }));
    expect(onViewReward).toHaveBeenCalledTimes(1);
  });

  it("labels an unavailable merchant (RN-71) and the pending extra stamp", async () => {
    await render(<StampCardDetails {...base} available={false} pendingExtraStamps={1} />);
    expect(screen.getByText("No disponible")).toBeOnTheScreen();
    expect(screen.getByText("+1 sello extra en tu próxima visita")).toBeOnTheScreen();
  });

  it("offers the wheel and collapsible terms only when given", async () => {
    const onSpinWheel = jest.fn();
    await render(<StampCardDetails {...base} wheelOffered onSpinWheel={onSpinWheel} terms="Compra mínima." />);
    await fireEvent.press(screen.getByText("Tienes un giro de bienvenida"));
    expect(onSpinWheel).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("merchant-terms")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Términos y condiciones" }));
    expect(screen.getByTestId("merchant-terms")).toHaveTextContent("Compra mínima.");
  });
});
