import { fireEvent, render, screen } from "@testing-library/react-native";
import { View } from "react-native";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

describe("EmptyState", () => {
  it("renders copy and fires its action", async () => {
    const onAction = jest.fn();
    await render(<EmptyState title="Sin resultados" message="Prueba con otra búsqueda." actionLabel="Limpiar búsqueda" onAction={onAction} />);
    expect(screen.getByRole("header", { name: "Sin resultados" })).toBeOnTheScreen();
    expect(screen.getByText("Prueba con otra búsqueda.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Limpiar búsqueda" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});

describe("EmptyState icon", () => {
  it("renders the icon only when provided", async () => {
    await render(<EmptyState title="A" message="b" actionLabel="c" onAction={jest.fn()} icon={<View testID="my-icon" />} testID="empty" />);
    expect(screen.getByTestId("my-icon")).toBeOnTheScreen();
    expect(screen.getByTestId("empty-icon")).toBeOnTheScreen();
  });

  it("omits the icon circle by default", async () => {
    await render(<EmptyState title="A" message="b" actionLabel="c" onAction={jest.fn()} testID="empty" />);
    expect(screen.queryByTestId("empty-icon")).toBeNull();
  });
});

describe("ErrorState", () => {
  it("defaults to the E-01 copy and retries", async () => {
    const onRetry = jest.fn();
    await render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No hay conexión. Revisa tus datos o Wi-Fi e inténtalo de nuevo.");
    await fireEvent.press(screen.getByRole("button", { name: "Reintentar" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the cloud-off icon by default", async () => {
    await render(<ErrorState onRetry={jest.fn()} testID="err" />);
    expect(screen.getByTestId("err-icon")).toBeOnTheScreen();
  });
});
