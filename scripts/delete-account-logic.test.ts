import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { test } from "node:test";
import {
  buildClientSecretClaims,
  buildRevokeRequestBody,
  buildTokenRequestBody,
  readAppleConfig,
  readIdTokenSubject,
  revokeAppleAccess,
  signClientSecret,
} from "../supabase/functions/delete-account/apple.mts";
import { isOriginAllowed, parseDeleteAccountBody } from "../supabase/functions/delete-account/logic.mts";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const config = {
  teamId: "TEAM123456", keyId: "KEY1234567", clientId: "mx.oxis.ekko",
  privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
};
const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const field = (input: unknown, apple = false) => {
  const result = parseDeleteAccountBody(input, apple);
  return result.ok ? null : result.field;
};

test("parseDeleteAccountBody requires the exact confirmation word", () => {
  assert.deepEqual(parseDeleteAccountBody({ confirmation: "ELIMINAR" }, false), { ok: true, value: {} });
  assert.equal(field({ confirmation: "eliminar" }), "confirmation");
  assert.equal(field({}), "confirmation");
  assert.equal(field(null), "body");
  assert.equal(field([]), "body");
});

test("parseDeleteAccountBody demands the Apple code only for Apple accounts", () => {
  assert.equal(field({ confirmation: "ELIMINAR" }, true), "apple_authorization_code");
  assert.equal(field({ confirmation: "ELIMINAR", apple_authorization_code: "  " }, true), "apple_authorization_code");
  assert.equal(field({ confirmation: "ELIMINAR", apple_authorization_code: 5 }), "apple_authorization_code");
  assert.deepEqual(parseDeleteAccountBody({ confirmation: "ELIMINAR", apple_authorization_code: " c1 " }, true),
    { ok: true, value: { apple_authorization_code: "c1" } });
});

test("isOriginAllowed lets native calls (no Origin) through and checks browsers against the list", () => {
  assert.equal(isOriginAllowed(null, []), true);
  assert.equal(isOriginAllowed("https://evil.example", []), false);
  assert.equal(isOriginAllowed("https://app.example", ["https://app.example"]), true);
});

test("client secret claims and request bodies follow SP-3", () => {
  assert.deepEqual(buildClientSecretClaims(config, 1000),
    { iss: "TEAM123456", iat: 1000, exp: 1300, aud: "https://appleid.apple.com", sub: "mx.oxis.ekko" });
  assert.equal(buildTokenRequestBody(config, "SECRET", "CODE").toString(),
    "client_id=mx.oxis.ekko&client_secret=SECRET&code=CODE&grant_type=authorization_code");
  assert.equal(buildRevokeRequestBody(config, "SECRET", "RT").toString(),
    "client_id=mx.oxis.ekko&client_secret=SECRET&token=RT&token_type_hint=refresh_token");
});

test("readAppleConfig needs all four secrets and unescapes newlines", () => {
  const env = (values: Record<string, string>) => ({ get: (name: string) => values[name] });
  const all = { APPLE_TEAM_ID: "t", APPLE_KEY_ID: "k", APPLE_CLIENT_ID: "c", APPLE_PRIVATE_KEY: "a\\nb" };
  assert.equal(readAppleConfig(env({ ...all, APPLE_KEY_ID: "" })), null);
  assert.equal(readAppleConfig(env({}))?.privateKey, undefined);
  assert.equal(readAppleConfig(env(all))?.privateKey, "a\nb");
});

test("signClientSecret builds a verifiable ES256 JWT", async () => {
  const jwt = await signClientSecret(config, 1000);
  const [header, payload, signature] = jwt.split(".") as [string, string, string];
  assert.deepEqual(JSON.parse(Buffer.from(header, "base64url").toString()), { alg: "ES256", kid: "KEY1234567", typ: "JWT" });
  assert.equal(JSON.parse(Buffer.from(payload, "base64url").toString()).iss, "TEAM123456");
  const valid = verify("sha256", Buffer.from(`${header}.${payload}`), { key: publicKey, dsaEncoding: "ieee-p1363" },
    Buffer.from(signature, "base64url"));
  assert.equal(valid, true);
});

test("readIdTokenSubject reads sub and rejects garbage", () => {
  assert.equal(readIdTokenSubject(`h.${b64url({ sub: "apple-1" })}.s`), "apple-1");
  assert.equal(readIdTokenSubject("nope"), null);
  assert.equal(readIdTokenSubject(undefined), null);
});

function fakeApple(idTokenSub: string, revokeStatus = 200, tokenStatus = 200) {
  const calls: string[] = [];
  const fetchFn = (async (url: string) => {
    calls.push(url.split("/").pop() ?? "");
    if (url.endsWith("/token")) {
      return new Response(JSON.stringify({ id_token: `h.${b64url({ sub: idTokenSub })}.s`, refresh_token: "RT" }), { status: tokenStatus });
    }
    return new Response("", { status: revokeStatus });
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

test("revokeAppleAccess exchanges, checks the subject and revokes", async () => {
  const ok = fakeApple("apple-1");
  assert.equal(await revokeAppleAccess("CODE", "apple-1", config, 1000, ok.fetchFn), "revoked");
  assert.deepEqual(ok.calls, ["token", "revoke"]);
});

test("revokeAppleAccess refuses another user's Apple account and never revokes it", async () => {
  const other = fakeApple("someone-else");
  assert.equal(await revokeAppleAccess("CODE", "apple-1", config, 1000, other.fetchFn), "sub_mismatch");
  assert.deepEqual(other.calls, ["token"]);
});

test("revokeAppleAccess reports failures instead of throwing", async () => {
  assert.equal(await revokeAppleAccess("CODE", "apple-1", config, 1000, fakeApple("apple-1", 400).fetchFn), "failed");
  assert.equal(await revokeAppleAccess("CODE", "apple-1", config, 1000, fakeApple("apple-1", 200, 400).fetchFn), "failed");
  const broken = (async () => { throw new Error("network"); }) as unknown as typeof fetch;
  assert.equal(await revokeAppleAccess("CODE", "apple-1", config, 1000, broken), "failed");
});
