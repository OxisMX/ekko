import { act } from "@testing-library/react-native";
import { Slot } from "expo-router";
import { renderRouter } from "expo-router/testing-library";
import { useSyncExternalStore } from "react";
import { Text } from "react-native";

import type { GateRoute } from "./gate";
import { GatedStack } from "./GatedStack";

// The gate decision as a tiny external store, so tests can drive it like auth/profile changes.
let currentRoute: GateRoute = "loading";
let afterSignUp = false;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

function Layout() {
  const route = useSyncExternalStore(subscribe, () => currentRoute);
  return <GatedStack route={route} afterSignUp={afterSignUp} />;
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
      "verify-email": page("verify-email"),
      "merchant/[id]": page("merchant"),
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
  afterSignUp = false;
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

  it("lands a fresh sign-up on A-05 instead of Explorar (F-02 K)", async () => {
    afterSignUp = true;
    const app = await renderApp("/register");
    await go("auth");
    await go("loading");
    await go("tabs");
    expect(app.getPathname()).toBe("/verify-email");
  });

  it("keeps A-05 and the merchant screen behind the tabs gate", async () => {
    const app = await renderApp("/merchant/m1");
    await go("auth");
    expect(app.getPathname()).toBe("/login");

    const again = await renderApp("/verify-email");
    await go("completeProfile");
    expect(again.getPathname()).toBe("/complete-profile");
  });

  it("opens a merchant deep link once signed in", async () => {
    const app = await renderApp("/merchant/m1");
    await go("tabs");
    expect(app.getPathname()).toBe("/merchant/m1");
  });
});
