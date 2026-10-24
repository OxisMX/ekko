import { render, screen } from "@testing-library/react-native";
import { AppHeader, rewardsReadyText } from "./AppHeader";

let mockStatus = "signedIn";
let mockCards: { reward_available: boolean }[] = [];
jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);
jest.mock("../../auth/AuthProvider", () => ({ useAuth: () => ({ status: mockStatus }) }));
jest.mock("../../features/auth/account", () => ({ useMyProfile: () => ({ data: { first_name: "Ana" } }) }));
jest.mock("../../features/cards/myCards", () => ({ useMyCards: () => ({ data: mockCards }) }));

describe("AppHeader", () => {
  it("words the ready rewards", () => {
    expect(rewardsReadyText(0)).toBeUndefined();
    expect(rewardsReadyText(1)).toBe("Tienes 1 recompensa lista");
    expect(rewardsReadyText(2)).toBe("Tienes 2 recompensas listas");
  });

  it("greets on Explorar and counts rewards (A-09)", async () => {
    mockCards = [{ reward_available: true }, { reward_available: true }, { reward_available: false }];
    await render(<AppHeader title="Explorar" />);
    expect(screen.getByText("Hola, Ana")).toBeOnTheScreen();
    expect(screen.getByText("Tienes 2 recompensas listas")).toBeOnTheScreen();
  });

  it("keeps the title on other tabs", async () => {
    await render(<AppHeader title="Perfil" />);
    expect(screen.getByText("Perfil")).toBeOnTheScreen();
    expect(screen.queryByTestId("app-header-rewards")).toBeNull();
  });
});
