import { fireEvent, render, screen } from "@testing-library/react-native";
import { useState } from "react";
import { CodeField } from "./CodeField";

function Harness({ onComplete, error }: { onComplete: (code: string) => void; error?: string }) {
  const [code, setCode] = useState("");
  return <CodeField value={code} onChangeText={setCode} onComplete={onComplete} error={error} />;
}

const LABEL = "Código de verificación de 6 dígitos";

describe("CodeField", () => {
  it("keeps only digits", async () => {
    await render(<Harness onComplete={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText(LABEL), "1a2-3");
    expect(screen.getByLabelText(LABEL)).toHaveDisplayValue("123");
  });

  it("fires onComplete once with the 6-digit code", async () => {
    const onComplete = jest.fn();
    await render(<Harness onComplete={onComplete} />);
    const input = screen.getByLabelText(LABEL);
    await fireEvent.changeText(input, "12345");
    await fireEvent.changeText(input, "123456");
    await fireEvent.changeText(input, "1234567");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("123456");
  });

  it("shows the error", async () => {
    await render(<Harness onComplete={jest.fn()} error="El código no es válido." />);
    expect(screen.getByText("Error: El código no es válido.")).toBeOnTheScreen();
    expect(screen.getByLabelText(LABEL).props.accessibilityHint).toBe("El código no es válido.");
  });
});
