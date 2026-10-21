import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { AuthLayout } from "./AuthLayout";

jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);

describe("AuthLayout", () => {
  it("renders the wordmark, title, children and footer", async () => {
    await render(
      <AuthLayout title="Iniciar sesión" subtitle="Tus tarjetas de lealtad" footer={<Text>¿Ya tienes cuenta?</Text>}>
        <Text>Formulario</Text>
      </AuthLayout>,
    );
    expect(screen.getByText("Ekko Rewards")).toBeOnTheScreen();
    expect(screen.getByText("Tus tarjetas de lealtad")).toBeOnTheScreen();
    expect(screen.getByRole("header", { name: "Iniciar sesión" })).toBeOnTheScreen();
    expect(screen.getByText("Formulario")).toBeOnTheScreen();
    expect(screen.getByText("¿Ya tienes cuenta?")).toBeOnTheScreen();
  });

  it("hides the decorative pattern from screen readers", async () => {
    await render(
      <AuthLayout title="Crear cuenta">
        <Text>Formulario</Text>
      </AuthLayout>,
    );
    expect(screen.queryByTestId("brand-pattern")).toBeNull();
    const pattern = screen.getByTestId("brand-pattern", { includeHiddenElements: true });
    expect(pattern).not.toBeVisible();
    expect(pattern.props.importantForAccessibility).toBe("no-hide-descendants");
  });
});
