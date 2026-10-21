import { act } from "@testing-library/react-native";
import { Slot } from "expo-router";
import { renderRouter } from "expo-router/testing-library";
import { useSyncExternalStore } from "react";
import { Text } from "react-native";

import type { GateRoute } from "./gate";
import { GatedStack } from "./GatedStack";

// The gate decision as a tiny external store, so tests can drive it like auth/profile changes.
let currentRoute: GateRoute = "loading";
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function Layout() {
  const route = useSyncExternalStore(subscribe, () => currentRoute);
  return <GatedStack route={route} />;
}

function page(name: string) {
  return function Page() {
    return <Text>{name}</Text>;
  };
}

async function renderApp(initialUrl = "/") {
  return await renderRouter(
    {
      _layout: Layout,
      "(tabs)/_layout": () => <Slot />,
      "(tabs)/index": page("explore"),
      "(tabs)/cards": page("cards"),
      "(auth)/_layout": () => <Slot />,
      "(auth)/login": page("login"),
      "(auth)/register": page("register"),
      "complete-profile": page("complete-profile"),
      "reset-password": page("reset-password"),
    },
    { initialUrl }
  );
}

const go = (route: GateRoute) =>
  act(() => {
    currentRoute = route;
    listeners.forEach((listener) => listener());
  });

beforeEach(() => {
  currentRoute = "loading";
});

describe("GatedStack", () => {
  it("sends a signed-out user to login", async () => {
    const app = await renderApp();
    await go("auth");
    expect(app.getPathname()).toBe("/login");
  });

  it("sends an incomplete profile to complete-profile", async () => {
    const app = await renderApp();
    await go("completeProfile");
    expect(app.getPathname()).toBe("/complete-profile");
  });

  it("keeps a complete profile on the deep-linked tab", async () => {
    const app = await renderApp("/cards");
    await go("tabs");
    expect(app.getPathname()).toBe("/cards");
  });

  it("blocks a deep link into the tabs when signed out", async () => {
    const app = await renderApp("/cards");
    await go("auth");
    expect(app.getPathname()).toBe("/login");
  });

  it("blocks auth screens once signed in", async () => {
    const app = await renderApp("/register");
    await go("tabs");
    expect(app.getPathname()).toBe("/");
  });

  it("moves from login to tabs on sign-in", async () => {
    const app = await renderApp();
    await go("auth");
    await go("loading");
    await go("tabs");
    expect(app.getPathname()).toBe("/");
  });

  it("keeps reset-password reachable whatever the auth state", async () => {
    const app = await renderApp("/reset-password?code=x");
    await go("auth");
    expect(app.getPathname()).toBe("/reset-password");
    await go("tabs");
    expect(app.getPathname()).toBe("/reset-password");
  });
});
