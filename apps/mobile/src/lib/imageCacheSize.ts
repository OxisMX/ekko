// Pure logic for the image-cache limit (SP-1 / RNF-03). No native imports so jest can run it.

export type CacheEntry =
  | { kind: "file"; sizeBytes: number }
  | { kind: "directory"; key: string };

/** Lists one directory level. `key` is whatever the lister needs to list the child (e.g. a URI). */
export type ListDirectory = (key: string) => CacheEntry[];

export function sumDirectoryBytes(rootKey: string, listDirectory: ListDirectory): number {
  let total = 0;
  for (const entry of listDirectory(rootKey)) {
    total += entry.kind === "file" ? entry.sizeBytes : sumDirectoryBytes(entry.key, listDirectory);
  }
  return total;
}

export function shouldClear(bytes: number, limitBytes: number): boolean {
  return bytes > limitBytes;
}
