// WHY: Hermes has no WebCrypto. Without it supabase-js falls back to PKCE "plain" (the challenge
// equals the verifier) and, if `crypto` is missing entirely, to a Math.random verifier. That weakens
// the password-recovery link (F-05) and Google OAuth (ADR-15). expo-crypto provides the primitives.

type Digest = (algorithm: "SHA-256", data: BufferSource) => Promise<ArrayBuffer>;
type RandomValues = <T extends ArrayBufferView | null>(array: T) => T;

export function installWebCrypto(target: { crypto?: unknown }, deps: { digest: Digest; getRandomValues: RandomValues }) {
  const current = (target.crypto ?? {}) as { subtle?: unknown; getRandomValues?: unknown };
  if (typeof current.getRandomValues !== "function") current.getRandomValues = deps.getRandomValues;
  if (current.subtle === undefined) {
    current.subtle = {
      digest(algorithm: AlgorithmIdentifier, data: BufferSource) {
        const name = typeof algorithm === "string" ? algorithm : algorithm.name;
        if (name.toUpperCase() !== "SHA-256") return Promise.reject(new Error(`Unsupported digest: ${name}`));
        return deps.digest("SHA-256", data);
      },
    };
  }
  target.crypto = current;
}
