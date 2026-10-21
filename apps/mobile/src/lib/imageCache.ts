import { Directory, File, Paths } from "expo-file-system";
import { Image } from "expo-image";
import { Platform } from "react-native";

import { type CacheEntry, shouldClear, sumDirectoryBytes } from "./imageCacheSize";

export const IMAGE_CACHE_LIMIT_BYTES = 20 * 1024 * 1024;

// WHY: SP-1 / RNF-03 (20 MB disk cap). expo-image 58.0.16 has no cap API on Android:
// ExpoImageAppGlideModule.kt:26-28 builds InternalCacheDiskCacheFactory(context) with Glide's
// default size/dir, and Image.configureCache (Image.tsx:216-221, "@platform ios") is iOS-only.
// Image.getCachePathAsync is per-cache-key (ExpoImageModule.kt:273-285), so it cannot give us the
// directory; we use the library defaults instead:
//   Android: <cacheDir>/image_manager_disk_cache  (Glide DiskCache.Factory.DEFAULT_DISK_CACHE_DIR)
//   iOS:     <Library/Caches>/com.hackemist.SDImageCache  (SDImageCache default namespace)
// Both are Paths.cache children; the one that does not exist on the platform counts as 0 bytes.
// TODO(SP-1): confirm both paths on a real device/emulator after browsing images.
const IMAGE_CACHE_DIRECTORY_NAMES = ["image_manager_disk_cache", "com.hackemist.SDImageCache"];

function listWithExpoFileSystem(uri: string): CacheEntry[] {
  return new Directory(uri).list().map((entry): CacheEntry => {
    if (entry instanceof Directory) return { kind: "directory", key: entry.uri };
    return { kind: "file", sizeBytes: entry instanceof File ? entry.size : 0 };
  });
}

function measureImageCacheBytes(): number {
  return IMAGE_CACHE_DIRECTORY_NAMES.reduce((total, name) => {
    const directory = new Directory(Paths.cache, name);
    return total + (directory.exists ? sumDirectoryBytes(directory.uri, listWithExpoFileSystem) : 0);
  }, 0);
}

export type ImageCacheResult = { bytesBefore: number; cleared: boolean };

/** Never throws: cache housekeeping must not break app start. */
export async function enforceImageCacheLimit(
  limitBytes: number = IMAGE_CACHE_LIMIT_BYTES
): Promise<ImageCacheResult> {
  let bytesBefore = 0;
  try {
    // NOTE: iOS also gets SDWebImage's native cap so it holds during the session, not only at start.
    if (Platform.OS === "ios") Image.configureCache({ maxDiskSize: limitBytes });
    bytesBefore = measureImageCacheBytes();
    if (!shouldClear(bytesBefore, limitBytes)) return { bytesBefore, cleared: false };
    return { bytesBefore, cleared: await Image.clearDiskCache() };
  } catch (error) {
    // NOTE: Sentry replaces this warn in S1.
    console.warn("enforceImageCacheLimit failed", error);
    return { bytesBefore, cleared: false };
  }
}
