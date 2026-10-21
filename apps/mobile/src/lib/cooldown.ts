import { useEffect, useState, useSyncExternalStore } from "react";

export type Cooldown = {
  start: (seconds: number) => void;
  endsAt: () => number | null;
  subscribe: (listener: () => void) => () => void;
};

/**
 * A resend cooldown that lives outside any screen, so every screen using the same instance shares
 * it (A-05 and the F-04 banner never double-send). WHY a deadline, not a counter: a backgrounded
 * app pauses JS timers, and the server's 60 s keep running.
 */
export function createCooldown(): Cooldown {
  let deadline: number | null = null;
  const listeners = new Set<() => void>();
  return {
    start(seconds) {
      deadline = Date.now() + seconds * 1000;
      listeners.forEach((listener) => listener());
    },
    endsAt: () => deadline,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const secondsUntil = (deadline: number | null) => (deadline === null ? 0 : Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));

export function useCooldown(cooldown: Cooldown) {
  const deadline = useSyncExternalStore(cooldown.subscribe, cooldown.endsAt);
  const [shown, setShown] = useState(() => ({ deadline, seconds: secondsUntil(deadline) }));
  // WHY: a new deadline must show its full count on this render, not one tick later.
  if (shown.deadline !== deadline) setShown({ deadline, seconds: secondsUntil(deadline) });

  useEffect(() => {
    if (secondsUntil(deadline) === 0) return;
    const timer = setInterval(() => {
      const seconds = secondsUntil(deadline);
      setShown({ deadline, seconds });
      if (seconds === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  return { secondsLeft: shown.seconds, started: deadline !== null, start: cooldown.start };
}
