import { fireEvent, render, screen } from "@testing-library/react-native";
import { DateField } from "./DateField";

// The picker is native; the mock exposes its props and lets the test "pick" a date.
jest.mock("@react-native-community/datetimepicker", () => {
  const { Pressable } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: (props: { onChange: (event: unknown, date?: Date) => void; maximumDate?: Date; mode: string }) => (
      <Pressable
        testID="mock-picker"
        accessibilityLabel={`picker ${props.mode} ${props.maximumDate?.getFullYear() ?? ""}`}
        // 23:59 local on 15/01/2000: east-of-UTC zones would see this as the 16th in UTC.
        onPress={() => props.onChange({ type: "set" }, new Date(2000, 0, 15, 23, 59))}
      />
    ),
  };
});

jest.mock("react-native-safe-area-context", () => jest.requireActual("react-native-safe-area-context/jest/mock").default);

describe("DateField", () => {
  it("shows the placeholder when there is no value", async () => {
    await render(<DateField label="Fecha de nacimiento" value={null} onChange={jest.fn()} />);
    expect(screen.getByText("Selecciona tu fecha")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Fecha de nacimiento, Selecciona tu fecha" })).toBeOnTheScreen();
  });

  it("shows the value as dd/mm/aaaa", async () => {
    await render(<DateField label="Fecha de nacimiento" value={new Date(1999, 2, 7)} onChange={jest.fn()} />);
    expect(screen.getByText("07/03/1999")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Fecha de nacimiento, 07/03/1999" })).toBeOnTheScreen();
  });

  it("exposes the error as text and hint", async () => {
    await render(<DateField label="Fecha de nacimiento" value={null} onChange={jest.fn()} error="Debes tener 18 años o más." />);
    expect(screen.getByText("Error: Debes tener 18 años o más.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: /Fecha de nacimiento/ }).props.accessibilityHint).toBe("Debes tener 18 años o más.");
  });

  it("opens the picker and commits the picked calendar day without shifting it", async () => {
    const onChange = jest.fn();
    await render(
      <DateField label="Fecha de nacimiento" value={null} onChange={onChange} maximumDate={new Date(2008, 9, 20)} />,
    );
    expect(screen.queryByTestId("mock-picker")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: /Fecha de nacimiento/ }));
    expect(screen.getByLabelText("picker date 2008")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("mock-picker"));
    await fireEvent.press(screen.getByRole("button", { name: "Listo" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const picked: Date = onChange.mock.calls[0][0];
    expect([picked.getFullYear(), picked.getMonth(), picked.getDate()]).toEqual([2000, 0, 15]);
    expect([picked.getHours(), picked.getMinutes()]).toEqual([0, 0]);
  });

  it("does not open when disabled", async () => {
    await render(<DateField label="Fecha de nacimiento" value={null} onChange={jest.fn()} disabled />);
    const field = screen.getByRole("button", { name: /Fecha de nacimiento/ });
    expect(field).toBeDisabled();
    await fireEvent.press(field);
    expect(screen.queryByTestId("mock-picker")).toBeNull();
  });
});
