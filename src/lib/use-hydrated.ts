"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * false during SSR and the hydration pass, true afterwards. Use it to defer
 * anything that depends on the browser clock or time zone, so server and
 * client markup match.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
