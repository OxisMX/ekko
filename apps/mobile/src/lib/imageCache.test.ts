import { type CacheEntry, shouldClear, sumDirectoryBytes } from "./imageCacheSize";

const tree: Record<string, CacheEntry[]> = {
  empty: [],
  nested: [
    { kind: "file", sizeBytes: 100 },
    { kind: "directory", key: "nested/a" },
  ],
  "nested/a": [
    { kind: "file", sizeBytes: 50 },
    { kind: "directory", key: "nested/a/b" },
  ],
  "nested/a/b": [{ kind: "file", sizeBytes: 25 }],
};
const list = (key: string) => tree[key] ?? [];

describe("sumDirectoryBytes", () => {
  it("returns 0 for an empty directory", () => {
    expect(sumDirectoryBytes("empty", list)).toBe(0);
  });

  it("sums files across nested directories", () => {
    expect(sumDirectoryBytes("nested", list)).toBe(175);
  });

  it("propagates listing errors to the caller", () => {
    const failing = () => {
      throw new Error("EACCES");
    };
    expect(() => sumDirectoryBytes("nested", failing)).toThrow("EACCES");
  });
});

describe("shouldClear", () => {
  const limit = 20 * 1024 * 1024;

  it("does not clear exactly at the limit", () => {
    expect(shouldClear(limit, limit)).toBe(false);
  });

  it("clears over the limit", () => {
    expect(shouldClear(limit + 1, limit)).toBe(true);
  });

  it("does not clear when empty", () => {
    expect(shouldClear(0, limit)).toBe(false);
  });
});
