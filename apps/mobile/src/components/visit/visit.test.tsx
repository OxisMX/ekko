import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { PermissionExplainer, ScannerOverlay, VisitResult, type VisitResultKind } from ".";

jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);

beforeEach(() => jest.clearAllMocks());

describe("VisitResult", () => {
  it("shows stamp progress, extra stamps and fires both actions", async () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    await render(
      <VisitResult kind="stamped" merchantName="Café Luna" stampsCount={4} stampsRequired={8} stampsAdded={2} onPrimary={onPrimary} onSecondary={onSecondary} secondaryLabel="Listo" />,
    );
    expect(screen.getByRole("header", { name: "¡Sello registrado!" })).toBeOnTheScreen();
    expect(screen.getByText("Llevas 4 de 8.")).toBeOnTheScreen();
    expect(screen.getByText("+2 sellos")).toBeOnTheScreen();
    expect(screen.getByText("Incluye tu sello extra")).toBeOnTheScreen();
    expect(screen.getByText("Café Luna")).toBeOnTheScreen();
    expect(screen.getByTestId("visit-result-celebration")).toBeOnTheScreen();
    expect(screen.queryByRole("alert")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Ver mi tarjeta" }));
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it("shows the progress dots with the latest filled, and fires one success haptic (A-60)", async () => {
    await render(<VisitResult kind="stamped" stampsCount={3} stampsRequired={8} onPrimary={jest.fn()} />);
    expect(screen.getByTestId("visit-result-dots", { includeHiddenElements: true }).children).toHaveLength(8);
    expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  });

  it("fills every dot when the card is completed (A-61)", async () => {
    await render(<VisitResult kind="completed" stampsCount={8} stampsRequired={8} onPrimary={jest.fn()} />);
    expect(screen.getByTestId("visit-result-dots", { includeHiddenElements: true }).children).toHaveLength(8);
  });

  it("gives no haptic or dots for errors", async () => {
    await render(<VisitResult kind="offline" onPrimary={jest.fn()} />);
    expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    expect(screen.queryByTestId("visit-result-dots", { includeHiddenElements: true })).toBeNull();
  });

  it("gives both actions stable testIDs (RQ-3)", async () => {
    await render(<VisitResult kind="offline" onPrimary={jest.fn()} onSecondary={jest.fn()} secondaryLabel="Cerrar" testID="visit-result" />);
    expect(screen.getByTestId("visit-result-primary")).toBeOnTheScreen();
    expect(screen.getByTestId("visit-result-secondary")).toBeOnTheScreen();
  });

  it("omits the extra badge for a single stamp", async () => {
    await render(<VisitResult kind="stamped" stampsCount={1} stampsRequired={8} stampsAdded={1} onPrimary={jest.fn()} />);
    expect(screen.queryByTestId("visit-result-extra")).toBeNull();
  });

  it("celebrates a completed card", async () => {
    await render(<VisitResult kind="completed" onPrimary={jest.fn()} primaryLabel="Ver premio" />);
    expect(screen.getByText("¡Completaste tu tarjeta!")).toBeOnTheScreen();
    expect(screen.getByText("Tu recompensa te espera.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Ver premio" })).toBeOnTheScreen();
  });

  it.each<[VisitResultKind, string, string]>([
    ["already_today", "Ya registraste tu visita de hoy en este negocio. Vuelve mañana.", "Cerrar"],
    ["expired_or_used", "Este código ya no es válido. Pide al cajero uno nuevo.", "Escanear de nuevo"],
    ["unavailable", "Este negocio no está disponible por ahora. Tus sellos siguen guardados.", "Volver"],
    ["offline", "No hay conexión. Revisa tus datos o Wi-Fi e inténtalo de nuevo.", "Reintentar"],
    ["not_ekko", "Este no es un código de Ekko.", "Seguir escaneando"],
  ])("%s announces its message as an alert", async (kind, message, action) => {
    const onPrimary = jest.fn();
    await render(<VisitResult kind={kind} onPrimary={onPrimary} />);
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(screen.getByTestId("visit-result-notice")).toBeOnTheScreen();
    expect(screen.queryByTestId("visit-result-celebration")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: action }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });
});

describe("PermissionExplainer", () => {
  it("notifications variant lists concrete benefits and only offers Continuar (A-82, Apple 5.1.1(iv))", async () => {
    await render(<PermissionExplainer variant="notifications" onPrimary={jest.fn()} />);
    expect(screen.getByText(/cupón esté por vencer/)).toBeOnTheScreen();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Continuar" })).toBeOnTheScreen();
  });

  it("camera variant asks for permission", async () => {
    const onPrimary = jest.fn();
    await render(<PermissionExplainer variant="camera" onPrimary={onPrimary} />);
    await fireEvent.press(screen.getByRole("button", { name: "Continuar" }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("denied variant sends to settings", async () => {
    const onPrimary = jest.fn();
    await render(<PermissionExplainer variant="denied" onPrimary={onPrimary} onSecondary={jest.fn()} />);
    expect(screen.getByRole("header", { name: "La cámara está desactivada" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Abrir ajustes" }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });
});

describe("ScannerOverlay", () => {
  it("turns the corners accent when a code is detected and offers the torch (A-58, A-59)", async () => {
    const onToggleTorch = jest.fn();
    await render(<ScannerOverlay onClose={jest.fn()} detected onToggleTorch={onToggleTorch} />);
    await fireEvent.press(screen.getByRole("button", { name: "Encender linterna" }));
    expect(onToggleTorch).toHaveBeenCalledTimes(1);
  });

  it("shows the hint and closes", async () => {
    const onClose = jest.fn();
    await render(<ScannerOverlay onClose={onClose} />);
    expect(screen.getByText("Apunta al código QR del cajero")).toBeOnTheScreen();
    expect(screen.getByTestId("scanner-viewfinder")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Cerrar escáner" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
