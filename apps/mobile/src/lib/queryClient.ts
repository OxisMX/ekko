import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

// NOTE: memory-only cache by design (TRD §8.2: JSON data is never persisted to disk).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1 },
    mutations: { retry: false },
  },
});

// RR-4: lists refresh when the app returns to the foreground.
focusManager.setEventListener((handleFocus) => {
  if (Platform.OS === "web") return undefined;
  const subscription = AppState.addEventListener("change", (state) => handleFocus(state === "active"));
  return () => subscription.remove();
});
