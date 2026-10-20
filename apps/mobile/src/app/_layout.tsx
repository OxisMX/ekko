import { Stack } from "expo-router";
import { useEffect } from "react";

import { enforceImageCacheLimit } from "../lib/imageCache";

export default function RootLayout() {
  useEffect(() => {
    // Fire-and-forget: enforceImageCacheLimit never throws and must not block first render.
    void enforceImageCacheLimit();
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
