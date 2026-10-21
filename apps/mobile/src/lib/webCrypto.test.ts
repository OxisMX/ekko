import { installWebCrypto } from "./webCrypto";

const deps = () => ({
  digest: jest.fn(async () => new ArrayBuffer(32)),
  getRandomValues: jest.fn(<T,>(array: T) => array),
});

describe("installWebCrypto", () => {
  it("adds getRandomValues and subtle.digest when the runtime has no crypto (Hermes)", async () => {
    const target: { crypto?: unknown } = {};
    const d = deps();
    installWebCrypto(target, d);
    const crypto = target.crypto as Crypto;

    crypto.getRandomValues(new Uint32Array(4));
    expect(d.getRandomValues).toHaveBeenCalled();
    await expect(crypto.subtle.digest("SHA-256", new Uint8Array([1]))).resolves.toBeInstanceOf(ArrayBuffer);
    await expect(crypto.subtle.digest({ name: "sha-256" }, new Uint8Array([1]))).resolves.toBeInstanceOf(ArrayBuffer);
    expect(d.digest).toHaveBeenCalledWith("SHA-256", expect.any(Uint8Array));
  });

  it("rejects digests other than SHA-256 instead of computing the wrong hash", async () => {
    const target: { crypto?: unknown } = {};
    installWebCrypto(target, deps());
    await expect((target.crypto as Crypto).subtle.digest("SHA-1", new Uint8Array())).rejects.toThrow("Unsupported");
  });

  it("keeps a native implementation that already exists", () => {
    const nativeRandom = jest.fn();
    const nativeSubtle = {};
    const target: { crypto?: unknown } = { crypto: { getRandomValues: nativeRandom, subtle: nativeSubtle } };
    installWebCrypto(target, deps());
    expect((target.crypto as { getRandomValues: unknown }).getRandomValues).toBe(nativeRandom);
    expect((target.crypto as { subtle: unknown }).subtle).toBe(nativeSubtle);
  });
});
