import { act, screen } from "@testing-library/react-native";
import { Slot, useLocalSearchParams } from "expo-router";
import { renderRouter } from "expo-router/testing-library";
import { useSyncExternalStore } from "react";
import { Text } from "react-native";

import VisitLinkScreen from "../../app/v/[token]";
import type { GateRoute } from "../auth/gate";
import { GatedStack } from "../auth/GatedStack";
import { PENDING_VISIT_TTL_MS, setPendingVisit, takePendingVisit, usePendingVisitRedirect } from "./pendingVisit";

const TOKEN = "AbCdEfGhIjKlMnOpQr_-12";

// The gate decision as a tiny external store, as in GatedStack.test.tsx.
let currentRoute: GateRoute = "loading";
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function Layout() {
  const route = useSyncExternalStore(subscribe, () => currentRoute);
  usePendingVisitRedirect(route);
  return <GatedStack route={route} />;
}

function VisitResultStub() {
  const params = useLocalSearchParams();
  return <Text testID="visit-result-params">{JSON.stringify(params)}</Text>;
}

const page = (name: string) =>
  function Page() {
    return <Text>{name}</Text>;
  };

const renderApp = (initialUrl: string) =>
  renderRouter(
    {
      _layout: Layout,
      "(tabs)/_layout": () => <Slot />,
      "(tabs)/index": page("explore"),
      "(auth)/_layout": () => <Slot />,
      "(auth)/login": page("login"),
      "complete-profile": page("complete-profile"),
      "visit-result": VisitResultStub,
      "v/[token]": VisitLinkScreen,
    },
    { initialUrl }
  );

const go = (route: GateRoute) =>
  act(() => {
    currentRoute = route;
    listeners.forEach((listener) => listener());
  });

beforeEach(() => {
  currentRoute = "loading";
  takePendingVisit();
});

describe("F-09 /v/:token", () => {
  it("signed in: claims right away", async () => {
    const app = await renderApp(`/v/${TOKEN}`);
    await go("tabs");
    expect(app.getPathname()).toBe("/visit-result");
    expect(screen.getByTestId("visit-result-params")).toHaveTextContent(JSON.stringify({ token: TOKEN }));
  });

  it("signed out: keeps the token through login and claims it within 60 s", async () => {
    const app = await renderApp(`/v/${TOKEN}`);
    await go("auth");
    expect(app.getPathname()).toBe("/login");
    await go("loading");
    await go("tabs");
    expect(app.getPathname()).toBe("/visit-result");
    expect(screen.getByTestId("visit-result-params")).toHaveTextContent(JSON.stringify({ token: TOKEN }));
  });

  it("signed out for more than 60 s: shows the expired result without claiming", async () => {
    const app = await renderApp(`/v/${TOKEN}`);
    await go("auth");
    expect(app.getPathname()).toBe("/login");
    // The link arrived 61 s before the login finished.
    setPendingVisit(TOKEN, Date.now() - PENDING_VISIT_TTL_MS - 1000);
    await go("tabs");
    expect(app.getPathname()).toBe("/visit-result");
    expect(screen.getByTestId("visit-result-params")).toHaveTextContent(JSON.stringify({ expired: "1" }));
  });

  it("a malformed token is not Ekko and is never stored", async () => {
    await renderApp("/v/not-a-token");
    await go("tabs");
    expect(screen.getByText("Este no es un código de Ekko.")).toBeOnTheScreen();
    expect(takePendingVisit()).toBeNull();
  });
});
