import { fireEvent, render, screen } from "@testing-library/react-native";
import { SearchField } from "./SearchField";

describe("SearchField", () => {
  it("shows the clear button only with text and clears on press (A-18)", async () => {
    const onChangeText = jest.fn();
    const { rerender } = await render(<SearchField value="" onChangeText={onChangeText} testID="s" />);
    expect(screen.queryByRole("button", { name: "Borrar búsqueda" })).toBeNull();
    await rerender(<SearchField value="café" onChangeText={onChangeText} testID="s" />);
    await fireEvent.press(screen.getByRole("button", { name: "Borrar búsqueda" }));
    expect(onChangeText).toHaveBeenCalledWith("");
  });
});
