import * as Haptics from "expo-haptics";
import { light, selection, success } from "./haptics";

it("fires the matching haptic", () => {
  success();
  light();
  selection();
  expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");
  expect(Haptics.impactAsync).toHaveBeenCalledWith("light");
  expect(Haptics.selectionAsync).toHaveBeenCalled();
});

it("reports instead of throwing when the haptic fails", async () => {
  const { reportError } = jest.requireMock("./sentry");
  (Haptics.selectionAsync as jest.Mock).mockRejectedValueOnce(new Error("nope"));
  expect(() => selection()).not.toThrow();
  await Promise.resolve();
  await Promise.resolve();
  expect(reportError).toHaveBeenCalled();
});
