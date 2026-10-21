import { decideGate } from "./gate";

describe("decideGate (F-01 / appflow §1.1)", () => {
  it.each([
    ["auth still loading", { status: "loading", profile: undefined, profileFailed: false, finishingSignUp: false }, "loading"],
    ["signed out", { status: "signedOut", profile: undefined, profileFailed: false, finishingSignUp: false }, "auth"],
    ["signed out ignores a stale profile", { status: "signedOut", profile: { profile_complete: true }, profileFailed: false, finishingSignUp: false }, "auth"],
    ["profile loading", { status: "signedIn", profile: undefined, profileFailed: false, finishingSignUp: false }, "loading"],
    ["profile incomplete", { status: "signedIn", profile: { profile_complete: false }, profileFailed: false, finishingSignUp: false }, "completeProfile"],
    ["profile complete", { status: "signedIn", profile: { profile_complete: true }, profileFailed: false, finishingSignUp: false }, "tabs"],
    ["profile failed to load (fail closed)", { status: "signedIn", profile: undefined, profileFailed: true, finishingSignUp: false }, "completeProfile"],
    ["sign-up still saving the profile", { status: "signedIn", profile: { profile_complete: false }, profileFailed: false, finishingSignUp: true }, "loading"],
  ] as const)("%s -> %s", (_name, input, expected) => {
    expect(decideGate(input)).toBe(expected);
  });
});
