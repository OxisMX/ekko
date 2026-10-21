import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// null until the system setting is known, so callers can hold the animation instead of flashing it.
export function useReduceMotion(): boolean | null {
  const [reduce, setReduce] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => !cancelled && setReduce(value))
      .catch(() => !cancelled && setReduce(false));
    return () => {
      cancelled = true;
    };
  }, []);
  return reduce;
}
