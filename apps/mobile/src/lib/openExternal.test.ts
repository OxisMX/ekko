import * as Linking from "expo-linking";
import { Alert } from "react-native";

import { openExternalUrl } from "./openExternal";

jest.mock("./sentry", () => ({ reportError: jest.fn() }));
jest.mock("expo-linking", () => ({ openURL: jest.fn(() => Promise.resolve()) }));

beforeEach(() => jest.clearAllMocks());

it("opens https links only", () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  openExternalUrl("https://g.page/r/abc", "x");
  expect(Linking.openURL).toHaveBeenCalledWith("https://g.page/r/abc");

  for (const url of ["javascript:alert(1)", "http://maps.google.com", "", null]) openExternalUrl(url, "No pudimos abrir el enlace.");
  expect(Linking.openURL).toHaveBeenCalledTimes(1);
  expect(alert).toHaveBeenCalledTimes(4);
});
