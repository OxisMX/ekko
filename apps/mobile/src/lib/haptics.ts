import * as Haptics from "expo-haptics";
import { reportError } from "./sentry";

// WHY: haptics are decoration; a failure (unsupported device) must never break the action that triggered it.
function fire(run: () => Promise<void>): void {
  run().catch(reportError);
}

export const success = () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
export const light = () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
export const selection = () => fire(() => Haptics.selectionAsync());
